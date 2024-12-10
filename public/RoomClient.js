// Medientypen, die produziert werden können
const mediaType = {
  video: 'videoType'
  
}

// Definierte Events für Raumaktionen
const _EVENTS = {
  startVideo: 'startVideo',
  stopVideo: 'stopVideo',
}

class RoomClient {
  constructor(localMediaEl, remoteVideoEl, mediasoupClient, socket, room_id, name, successCallback) {
    // Name des Peers
    this.name = name

    // HTML-Element für lokale Medien
    this.localMediaEl = localMediaEl

    // HTML-Element für entfernte Videos
    this.remoteVideoEl = remoteVideoEl

    // Mediasoup-Client-Bibliothek
    this.mediasoupClient = mediasoupClient

    // Verbindung zum Server via Socket.IO
    this.socket = socket

    // Transport zum Senden von Medien
    this.producerTransport = null

    // Transport zum Empfangen von Medien
    this.consumerTransport = null

    // Mediasoup-Device (Konfiguration)
    this.device = null

    // Raum-ID
    this.room_id = room_id

    // Gibt an, ob ein Video im Vollbildmodus ist
    this.isVideoOnFullScreen = false

    // Gibt an, ob die Liste der verfügbaren Geräte sichtbar ist
    this.isDevicesVisible = false

    // Konsumierte Medien
    this.consumers = new Map()

    // Produzierte Medien
    this.producers = new Map()

    console.log('Mediasoup client', mediasoupClient)

    // Zuordnung Medientyp -> Producer-ID
    this.producerLabel = new Map()

    // Status, ob der Raum geöffnet ist
    this._isOpen = false

    // Event-Listener für benutzerdefinierte Events
    this.eventListeners = new Map()

    // Alle verfügbaren Events initialisieren
    Object.keys(_EVENTS).forEach(
      function (evt) {
        this.eventListeners.set(evt, [])
      }.bind(this)
    )

    // Raum erstellen und beitreten
    this.createRoom(room_id).then(
      async function () {
        // Dem Raum beitreten
        await this.join(name, room_id)
        // Sockets initialisieren
        this.initSockets()
        // Raumstatus auf "geöffnet" setzen
        this._isOpen = true
        // Erfolgscallback ausführen
        successCallback()
      }.bind(this)
    )
  }

  ////////// INIT /////////

  async createRoom(room_id) {
    // Server-Anfrage zum Erstellen eines Raums
    await this.socket
      .request('createRoom', {
        room_id
      })
      .catch((err) => {
        // Fehler beim Erstellen des Raums
        console.log('Create room error:', err)
      })
  }

  async join(name, room_id) {
     // Dem Raum beitreten
    socket
      .request('join', {
        name,
        room_id
      })
      .then(
        async function (e) {
          // Erfolgreich beigetreten
          console.log('Joined to room', e)
           // RTP-Fähigkeiten abrufen
          const data = await this.socket.request('getRouterRtpCapabilities')
           // Mediasoup-Device laden
          let device = await this.loadDevice(data)
          this.device = device
          // Transports initialisieren
          await this.initTransports(device)
          // Anfrage nach existierenden Produzenten
          this.socket.emit('getProducers')
        }.bind(this)
      )
      .catch((err) => {
        console.log('Join error:', err)
      })
  }

  //Mediasoup-Device laden
  async loadDevice(routerRtpCapabilities) {
    let device
    try {
      device = new this.mediasoupClient.Device()
    } catch (error) {
      // Browser unterstützt keine WebRTC
      if (error.name === 'UnsupportedError') {
        console.error('Browser not supported')
        alert('Browser not supported')
      }
      console.error(error)
    }
    // RTP-Fähigkeiten im Device laden
    await device.load({
      routerRtpCapabilities
    })
    return device
  }

  async initTransports(device) {
   // Initialisiert den Transport für Produzenten (zum Hochladen von Medien)
    {
      // Anfrage zum Erstellen eines WebRTC-Transports für den Produzenten
      const data = await this.socket.request('createWebRtcTransport', {
        // Bevorzugt UDP, falls verfügbar
        forceTcp: false,
        // RTP-Fähigkeiten des Geräts
        rtpCapabilities: device.rtpCapabilities
      })

      if (data.error) {
        // Fehler beim Transport erstelle
        console.error(data.error)
        return
      }

      // Transport erstellen (zum Senden von Medien)
      this.producerTransport = device.createSendTransport(data)

      // Ereignis: Verbindung herstellen
      this.producerTransport.on(
        'connect',
        async function ({ dtlsParameters }, callback, errback) {
          this.socket
            .request('connectTransport', {
              // Sicherheitsparameter für DTLS
              dtlsParameters,
              transport_id: data.id
            })
            .then(callback)
            .catch(errback)
        }.bind(this)
      )

        // Ereignis: Produktion starten (z. B. Videodaten senden)
      this.producerTransport.on(
        'produce',
        async function ({ kind, rtpParameters }, callback, errback) {
          try {
            const { producer_id } = await this.socket.request('produce', {
              producerTransportId: this.producerTransport.id,
               // Medientyp 
              kind,
              rtpParameters
            })
            // Erfolgreich produziert
            callback({
              id: producer_id
            })
          } catch (err) {
            // Fehler beim Produzieren
            errback(err)
          }
        }.bind(this)
      )

       // Ereignis: Verbindungsstatus ändern
      this.producerTransport.on(
        'connectionstatechange',
        function (state) {
          switch (state) {
            case 'connecting':
              break

            case 'connected':
              //localVideo.srcObject = stream
              break

            case 'failed':
              this.producerTransport.close()
              break

            default:
              break
          }
        }.bind(this)
      )
    }

    // Initialisiert den Transport für Konsumenten (zum Empfangen von Medien)
    {
      const data = await this.socket.request('createWebRtcTransport', {
        forceTcp: false
      })

      if (data.error) {
        // Fehler beim Transport erstellen
        console.error(data.error)
        return
      }

      // Transport erstellen (zum Empfangen von Medien)
      this.consumerTransport = device.createRecvTransport(data)
      // Ereignis: Verbindung herstellen
      this.consumerTransport.on(
        'connect',
        function ({ dtlsParameters }, callback, errback) {
          this.socket
            .request('connectTransport', {
              transport_id: this.consumerTransport.id,
              dtlsParameters // Sicherheitsparameter für DTLS
            })
            .then(callback)
            .catch(errback)
        }.bind(this)
      )

      // Ereignis: Verbindungsstatus ändern
      this.consumerTransport.on(
        'connectionstatechange',
        async function (state) {
          switch (state) {
            case 'connecting':
              break

            case 'connected':
              //remoteVideo.srcObject = await stream;
              //await socket.request('resume');
              break

            case 'failed':
              this.consumerTransport.close()
              break

            default:
              break
          }
        }.bind(this)
      )
    }
  }

  initSockets() {
    // Ereignis: Ein Consumer wird geschlossen
    this.socket.on(
      'consumerClosed',
      function ({ consumer_id }) {
        console.log('Closing consumer:', consumer_id)
        // Entfernt den geschlossenen Consumer
        this.removeConsumer(consumer_id)
      }.bind(this)
    )

   
    this.socket.on(
      // Ereignis: Neue Produzenten sind verfügbar
      'newProducers',
      async function (data) {
        console.log('New producers', data)
        for (let { producer_id } of data) {
          // Konsumieren von Medienstreams
          await this.consume(producer_id)
        }
      }.bind(this)
    )

    // Ereignis: Socket-Verbindung getrennt
    this.socket.on(
      'disconnect',
      function () {
        // Raum verlassen und Ressourcen bereinigen
        this.exit(true)
      }.bind(this)
    )
  }

  //////// MAIN FUNCTIONS /////////////

  async produce(type, deviceId = null) {
    // Überprüfen, ob der Typ "video" ist
    if (type !== mediaType.video) {
        console.error('Only video type is supported')
        return
    }

    // Definiere die Medienbeschränkungen für Video
    let mediaConstraints = {
        audio: false, // Audio ist deaktiviert
        video: {
            width: {
                min: 640, // Minimale Breite
                ideal: 1920 // Ideale Breite
            },
            height: {
                min: 400, // Minimale Höhe
                ideal: 1080 // Ideale Höhe
            },
            deviceId: deviceId // Optionaler Gerätespezifikator
        }
    }

    // Überprüfen, ob das Gerät Video produzieren kann
    if (!this.device.canProduce('video')) {
        console.error('Cannot produce video')
        return
    }

    // Überprüfen, ob ein Producer für diesen Typ bereits existiert
    if (this.producerLabel.has(type)) {
        console.log('Producer already exists for this type: ' + type)
        return
    }

    console.log('Mediaconstraints:', mediaConstraints)

    try {
        // Medienstream für die Kamera abrufen
        let stream = await navigator.mediaDevices.getUserMedia(mediaConstraints)
        console.log(navigator.mediaDevices.getSupportedConstraints())

        // Videospur aus dem Stream extrahieren
        const track = stream.getVideoTracks()[0]
        const params = { track }

        // Zusätzliche Kodierungsoptionen für Video
        params.encodings = [
            {
                rid: 'r0',
                maxBitrate: 100000,
                scalabilityMode: 'S1T3'
            },
            {
                rid: 'r1',
                maxBitrate: 300000,
                scalabilityMode: 'S1T3'
            },
            {
                rid: 'r2',
                maxBitrate: 900000,
                scalabilityMode: 'S1T3'
            }
        ]
        params.codecOptions = {
            videoGoogleStartBitrate: 1000
        }

        // Producer für Video erstellen
        const producer = await this.producerTransport.produce(params)
        console.log('Producer created:', producer)

        // Producer speichern
        this.producers.set(producer.id, producer)

        // Video-Element für die lokale Vorschau erstellen
        let elem = document.createElement('video')
        elem.srcObject = stream
        elem.id = producer.id
        elem.playsinline = false
        elem.autoplay = true
        elem.className = 'vid'
        this.localMediaEl.appendChild(elem) // Element anhängen
        this.handleFS(elem.id) // Vollbild-Handler

        // Ereignis: Medien-Track beendet
        producer.on('trackended', () => {
            this.closeProducer(type)
        })

        // Ereignis: Transport geschlossen
        producer.on('transportclose', () => {
            console.log('Producer transport closed')
            elem.srcObject.getTracks().forEach((track) => track.stop())
            elem.parentNode.removeChild(elem)
            this.producers.delete(producer.id)
        })

        // Ereignis: Producer geschlossen
        producer.on('close', () => {
            console.log('Producer closed')
            elem.srcObject.getTracks().forEach((track) => track.stop())
            elem.parentNode.removeChild(elem)
            this.producers.delete(producer.id)
        })

        // Producer-ID speichern
        this.producerLabel.set(type, producer.id)

        // Benachrichtigung auslösen
        this.event(_EVENTS.startVideo)
    } catch (err) {
        console.error('Produce error:', err)
    }
  }


  async consume(producer_id) {
   // Hole den Konsum-Stream für den angegebenen Producer

    this.getConsumeStream(producer_id).then(
      function ({ consumer, stream, kind }) {
        this.consumers.set(consumer.id, consumer)

        let elem
        if (kind === 'video') {
          elem = document.createElement('video')
          elem.srcObject = stream
          elem.id = consumer.id
          elem.playsinline = false
          elem.autoplay = true
          elem.className = 'vid'
          this.remoteVideoEl.appendChild(elem)
          this.handleFS(elem.id)
        } 

        
        // Ereignis: Medien-Track beendet
        consumer.on(
          'trackended',
          function () {
            this.removeConsumer(consumer.id)
          }.bind(this)
        )

         // Ereignis: Transport geschlossen
        consumer.on(
          'transportclose',
          function () {
            this.removeConsumer(consumer.id)
          }.bind(this)
        )
      }.bind(this)
    )
  }

  async getConsumeStream(producerId) {
    // Hole die RTP-Fähigkeiten des Geräts
    const { rtpCapabilities } = this.device
    // Anfrage zum Konsumieren des Streams vom Producer
    const data = await this.socket.request('consume', {
       // Übertrage die RTP-Fähigkeiten
      rtpCapabilities,
      // ID des Transportes, der verwendet wir
      consumerTransportId: this.consumerTransport.id, 
      // ID des Producers, dessen Stream konsumiert werden soll
      producerId
    })
    const { id, kind, rtpParameters } = data

    let codecOptions = {}
     // Erstelle einen neuen Consumer mit den übergebenen Daten
    const consumer = await this.consumerTransport.consume({
      id,
      producerId,
      kind,
      rtpParameters,
      codecOptions
    })

    // Erstelle einen neuen MediaStream für den Consumer
    const stream = new MediaStream()
     // Füge den Medien-Track hinzu
    stream.addTrack(consumer.track)

    return {
      consumer,
      stream,
      kind
    }
  }

  closeProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log('There is no producer for this type ' + type)
      return
    }

    let producer_id = this.producerLabel.get(type)
    console.log('Close producer', producer_id)

    // Informiere den Server, dass der Producer geschlossen wird
    this.socket.emit('producerClosed', {
      producer_id
    })

    // Schließe den Producer und entferne ihn aus der Map
    this.producers.get(producer_id).close()
    this.producers.delete(producer_id)
    this.producerLabel.delete(type)

   

    switch (type) {
      case mediaType.video:
        this.event(_EVENTS.stopVideo)
        break
      
      default:
        return
    }
  }

  // Pausiere den Producer
  pauseProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log('There is no producer for this type ' + type)
      return
    }

    let producer_id = this.producerLabel.get(type)
    this.producers.get(producer_id).pause()
  }

  // Setze den Producer fort
  resumeProducer(type) {
    if (!this.producerLabel.has(type)) {
      console.log('There is no producer for this type ' + type)
      return
    }

    let producer_id = this.producerLabel.get(type)
    this.producers.get(producer_id).resume()
  }

  // Beende alle Tracks des Streams
  removeConsumer(consumer_id) {
    let elem = document.getElementById(consumer_id)
    elem.srcObject.getTracks().forEach(function (track) {
      track.stop()
    })
     // Entferne das HTML-Element aus dem DOM
    elem.parentNode.removeChild(elem)

    // Entferne den Consumer aus der Map
    this.consumers.delete(consumer_id)
  }

  exit(offline = false) {
    let clean = function () {
      this._isOpen = false // Raumstatus auf "geschlossen" setzen
      this.consumerTransport.close() // Schließe den Consumer-Transport
      this.producerTransport.close() // Schließe den Producer-Transport
      this.socket.off('disconnect') // Entferne Socket-Ereignisse
      this.socket.off('newProducers')
      this.socket.off('consumerClosed')
    }.bind(this)

    if (!offline) {
      // Sende eine Anfrage, den Raum zu verlassen
      this.socket
        .request('exitRoom')
        .then((e) => console.log(e))
        .catch((e) => console.warn(e))
        .finally(
          function () {
            // Direkt bereinigen, wenn offline
            clean()
          }.bind(this)
        )
    } else {
      clean()
    }

    
  }

  ///////  HELPERS //////////

  async roomInfo() {
    let info = await this.socket.request('getMyRoomInfo')
    return info
  }

  static get mediaType() {
    return mediaType
  }

  event(evt) {
    if (this.eventListeners.has(evt)) {
      this.eventListeners.get(evt).forEach((callback) => callback())
    }
  }

  on(evt, callback) {
    this.eventListeners.get(evt).push(callback)
  }

  //////// GETTERS ////////

  isOpen() {
    return this._isOpen
  }

  static get EVENTS() {
    return _EVENTS
  }

  //////// UTILITY ////////


  showDevices() {
    if (!this.isDevicesVisible) {
      reveal(devicesList)
      this.isDevicesVisible = true
    } else {
      hide(devicesList)
      this.isDevicesVisible = false
    }
  }

  handleFS(id) {
    // Vollbild-Status überwache
    let videoPlayer = document.getElementById(id)
    videoPlayer.addEventListener('fullscreenchange', (e) => {
      if (videoPlayer.controls) return
      let fullscreenElement = document.fullscreenElement
      if (!fullscreenElement) {
        videoPlayer.style.pointerEvents = 'auto'
        // Vollbildmodus verlassen
        this.isVideoOnFullScreen = false
      }
    })

    videoPlayer.addEventListener('webkitfullscreenchange', (e) => {
      if (videoPlayer.controls) return
      let webkitIsFullScreen = document.webkitIsFullScreen
      if (!webkitIsFullScreen) {
        videoPlayer.style.pointerEvents = 'auto'
        this.isVideoOnFullScreen = false
      }
    })
        // Klick-Event zum Umschalten des Vollbildmodus
    videoPlayer.addEventListener('click', (e) => {
      if (videoPlayer.controls) return
      if (!this.isVideoOnFullScreen) {
        if (videoPlayer.requestFullscreen) {
          videoPlayer.requestFullscreen()
        } else if (videoPlayer.webkitRequestFullscreen) {
          videoPlayer.webkitRequestFullscreen()
        } else if (videoPlayer.msRequestFullscreen) {
          videoPlayer.msRequestFullscreen()
        }
        this.isVideoOnFullScreen = true
        videoPlayer.style.pointerEvents = 'none'
      } else {
        // Verlasse den Vollbildmodus
        if (document.exitFullscreen) {
          document.exitFullscreen()
        } else if (document.webkitCancelFullScreen) {
          document.webkitCancelFullScreen()
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen()
        }
        this.isVideoOnFullScreen = false
        videoPlayer.style.pointerEvents = 'auto'
      }
    })
  }
}
