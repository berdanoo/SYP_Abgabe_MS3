
//Importiere die benötigten Modul
const express = require('express')
const app = express()
const https = require('httpolyglot')
const fs = require('fs')
const mediasoup = require('mediasoup')
const config = require('./configs/configServer')
const path = require('path')
const Room = require('./classes/Room')
const Peer = require('./classes/Peer')




// SSL-Zertifikat und Schlüssel laden
const keyPath = path.join(__dirname, '..', 'ssl', 'key.pem');
const certPath = path.join(__dirname, '..', 'ssl', 'cert.pem');
const key = fs.readFileSync(keyPath);
const cert = fs.readFileSync(certPath)

// HTTPS-Optionen konfigurieren
const options = {
  key,
  cert
}

// HTTPS-Server erstellen
const httpsServer = https.createServer(options, app)


// Socket.io auf dem HTTPS-Server einrichten
const io = require('socket.io')(httpsServer)


// Express konfigurieren, um statische Dateien bereitzustellen
app.use(express.static(path.join(__dirname, '..', 'public')))
app.use(express.json());


// Server starten und auf Konfigurations-Port lausche
httpsServer.listen(config.listenPort, () => {
  console.log('Listening on https://' + config.listenIp + ':' + config.listenPort)
})

// Alle Mediasoup-Worker (Prozesse)
let workers = [] // Liste der Worker
let nextMediasoupWorkerIdx = 0 // Index für Round-Robin-Worker-Zuweisung

// Liste aller Räume
let roomList = new Map()


// Anonyme asynchrone Funktion, um die Worker zu erstellen
;(async () => {
  await createWorkers()
})()

// Funktion zum Erstellen von Mediasoup-Workern
async function createWorkers() {
  let { numWorkers } = config.mediasoup // Anzahl der Worker aus Konfiguration

  for (let i = 0; i < numWorkers; i++) {
    // Neuen Worker erstellen
    let worker = await mediasoup.createWorker({
      logLevel: config.mediasoup.worker.logLevel,
      logTags: config.mediasoup.worker.logTags,
      rtcMinPort: config.mediasoup.worker.rtcMinPort,
      rtcMaxPort: config.mediasoup.worker.rtcMaxPort
    })

    // Ereignis, wenn ein Worker abstürzt
    worker.on('died', () => {
      console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid)
      setTimeout(() => process.exit(1), 2000)
    })
     // Worker zur Liste hinzufügen
    workers.push(worker)

    }
}

// Ereignis, wenn ein neuer Socket verbunden wird
io.on('connection', (socket) => {
  socket.on('createRoom', async ({ room_id }, callback) => {
    if (roomList.has(room_id)) {
      callback('already exists')
    } else {
      console.log('Created room', { room_id: room_id })
      let worker = await getMediasoupWorker()
      roomList.set(room_id, new Room(room_id, worker, io))
      callback(room_id)
    }
  })

  // Benutzer tritt einem Raum bei
  socket.on('join', ({ room_id, name }, cb) => {
    console.log('User joined', {
      room_id: room_id,
      name: name
    })

    if (!roomList.has(room_id)) {
      return cb({
        error: 'Room does not exist'
      })
    }

    // Peer zum Raum hinzufügen
    roomList.get(room_id).addPeer(new Peer(socket.id, name))
    // Raum-ID am Socket speichern
    socket.room_id = room_id

    // Raumdaten zurückgeben
    cb(roomList.get(room_id).toJson())
  })


  socket.on('getProducers', () => {
    // ueberprüft, ob der Raum, dem der Socket zugeordnet ist, existiert
    if (!roomList.has(socket.room_id)) return
    console.log('Get producers', { name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}` })

     // Ruft die Liste der aktuellen Produzenten (video) im Raum ab
    let producerList = roomList.get(socket.room_id).getProducerListForPeer()

    // Sendet die Liste der Produzenten an den anfragenden Peer
    socket.emit('newProducers', producerList)
  })

    // Router RTP-Fähigkeiten abrufen
  socket.on('getRouterRtpCapabilities', (_, callback) => {
     // Protokolliert die Anfrage zum Abrufen der RTP-Fähigkeiten
    console.log('Get RouterRtpCapabilities', {
      name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`
    })

    try {
         // Holt die RTP-Fähigkeiten des Routers aus dem entsprechenden Raum
      callback(roomList.get(socket.room_id).getRtpCapabilities())
    } catch (e) {
        // Im Fehlerfall wird die Fehlermeldung an den Client zurückgegeben
      callback({
        error: e.message
      })
    }
  })


  // Event: WebRTC-Transport erstellen
  socket.on('createWebRtcTransport', async (_, callback) => {
    console.log('Create webrtc transport', {
      name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`
    })

    try {
        // Erstelle einen neuen WebRTC-Transport für den aktuellen Peer im Raum
      const { params } = await roomList.get(socket.room_id).createWebRtcTransport(socket.id)

      callback(params)
        // Übergib die Transport-Parameter an den Client
    } catch (err) {
      console.error(err)
      callback({
        error: err.message
      })
    }
  })

   // Transport verbinden
  socket.on('connectTransport', async ({ transport_id, dtlsParameters }, callback) => {
    // Log die Anfrage zum Verbinden eines Transports
    console.log('Connect transport', { name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}` })

    // Stelle sicher, dass der Raum existiert
    if (!roomList.has(socket.room_id)) return
    // Verbinde den Transport des Peers mit den angegebenen DTLS-Parametern
    await roomList.get(socket.room_id).connectPeerTransport(socket.id, transport_id, dtlsParameters)

    //Verbindung erfolgreich
    callback('success') 
  })


  // Event: Producer erstellen (Medien-Stream erzeugen)
  socket.on('produce', async ({ kind, rtpParameters, producerTransportId }, callback) => {
    if (!roomList.has(socket.room_id)) {
      return callback({ error: 'not is a room' })
    }

     // Erstelle einen neuen Producer für den Peer im aktuellen Raum
    let producer_id = await roomList.get(socket.room_id).produce(socket.id, producerTransportId, rtpParameters, kind)

     // Log die Produzenteninformationen
    console.log('Produce', {
      type: `${kind}`,
      name: `${roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
      id: `${producer_id}`
    })

    // Gib die Producer-ID an den Client zurück
    callback({
      producer_id
    })
  })

  // Event: Consumer erstellen (Medien empfangen)
  socket.on('consume', async ({ consumerTransportId, producerId, rtpCapabilities }, callback) => {
    //TODO null handling
    let params = await roomList.get(socket.room_id).consume(socket.id, consumerTransportId, producerId, rtpCapabilities)

     // Log die Konsumaktion
    console.log('Consuming', {
      name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`,
      producer_id: `${producerId}`,
      consumer_id: `${params.id}`
    })

    // Gib die Parameter an den Client zurück
    callback(params)
  })

  // Event: Consumer wieder aufnehmen (Media empfangen fortsetzen)
  socket.on('resume', async (data, callback) => {
    await consumer.resume() // Consumer fortsetzen
    callback() // Rückmeldung an den Client
  })

  // Event: Informationen über den aktuellen Raum abrufen
  socket.on('getMyRoomInfo', (_, cb) => {
     // Übergibt die Raum-Informationen an den Client
    cb(roomList.get(socket.room_id).toJson())
  })

  // Event: Peer trennt die Verbindung
  socket.on('disconnect', () => {
    // Log die Trennung des Peers
    console.log('Disconnect', {
      name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`
    })

    // Entferne den Peer aus dem Raum, wenn er einen Raum ha
    if (!socket.room_id) return
    roomList.get(socket.room_id).removePeer(socket.id)
  })

  // Event: Producer schließen
  socket.on('producerClosed', ({ producer_id }) => {
    console.log('Producer close', {
      name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`
    })

    // Schließe den Producer
    roomList.get(socket.room_id).closeProducer(socket.id, producer_id)
  })

  // Event: Raum verlassen
  socket.on('exitRoom', async (_, callback) => {
    console.log('Exit room', {
      name: `${roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().get(socket.id).name}`
    })

    // Überprüfe, ob der Raum existier
    if (!roomList.has(socket.room_id)) {
      callback({
        error: 'not currently in a room'
      })
      return
    }
    
    // Entferne den Peer aus dem Raum
    await roomList.get(socket.room_id).removePeer(socket.id)

     // Lösche den Raum, wenn keine Peers mehr vorhanden sind
    if (roomList.get(socket.room_id).getPeers().size === 0) {
      roomList.delete(socket.room_id)
    }

    // Setze die Raum-ID des Sockets zurück
    socket.room_id = null

    // Gib dem Client Rückmeldun
    callback('successfully exited room')
  })
})

// Hilfsfunktion: Unbenutzte Funktion, listet alle Räume auf
function room() {
  return Object.values(roomList).map((r) => {
    return {
      router: r.router.id,
      peers: Object.values(r.peers).map((p) => {
        return {
          name: p.name
        }
      }),
      id: r.id
    }
  })
}

/**
 * Funktion: Holt den nächsten Mediasoup-Worker basierend auf einer Round-Robin-Strategie.
 */
function getMediasoupWorker() {
    // Hole den aktuellen Worker
  const worker = workers[nextMediasoupWorkerIdx]

    // Wähle den nächsten Worker aus
  if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0

    // Gib den ausgewählten Worker zurüc
  return worker
}
