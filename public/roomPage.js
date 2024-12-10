

// Erstelle eine Socket.IO-Verbindung
const socket = io()

// Ein globaler Producer für Medienstreams
let producer = null


// Füge eine Methode hinzu, um Anfragen an den Server zu stellen
socket.request = function request(type, data = {}) {
  // Sende einen Socket-Event-Typ und die zugehörigen Daten an den Server
  return new Promise((resolve, reject) => {
    socket.emit(type, data, (data) => {
      // Überprüfe die Antwort vom Server
      if (data.error) {
        // Lehne die Promise bei Fehler ab
        reject(data.error)
      } else {
         // Erfülle die Promise bei Erfolg
        resolve(data)
      }
    })
  })
}

// Globale Variable für den Raum-Client
let rc = null

function joinRoom(name, room_id) {
   // Überprüfe, ob der Benutzer bereits mit einem Raum verbunden ist
  if (rc && rc.isOpen()) {
    // Warnung bei doppeltem Beitritt
    console.log('Already connected to a room')
  } else {
    //Geräte für Kamera initialisieren
    initEnumerateDevices()

    // Erstelle eine neue Instanz von RoomClient
    rc = new RoomClient(localMedia, remoteVideos, window.mediasoupClient, socket, room_id, name, roomOpen)

    // Füge Event-Listener für den Raum hinzu
    addListeners()

  }
}

function roomOpen() {
  // Protokollausgabe für Debugging
  console.log('roomOpen aufgerufen');
  
  // Zeige die Schaltfläche für Video starten an
  reveal(startVideoButton)

   // Verstecke die Schaltfläche für Video stoppen
  hide(stopVideoButton)
 
  
}

// Verstecke ein HTML-Element
function hide(elem) {
  // Ändere die Klasse, um das Element auszublenden
  elem.className = 'hidden'
}

function reveal(elem) {
  if (elem) {
    elem.className = ''; // Entferne die Klasse für das Verstecken
    console.log(`${elem.id} sichtbar gemacht`); // Protokolliere die Änderung
  } else {
    console.error("Element nicht gefunden:", elem);
  }
  // Debugging-Informationen
  console.log(`${elem.id} style.display:`, getComputedStyle(elem).display);

}


function addListeners() {
  

  

  
  // Listener für das Starten des Videos
  rc.on(RoomClient.EVENTS.startVideo, () => {
    hide(startVideoButton)
    reveal(stopVideoButton)
  })
  // Listener für das Stoppen des Videos
  rc.on(RoomClient.EVENTS.stopVideo, () => {
    hide(stopVideoButton)
    reveal(startVideoButton)
  })
 


  
}

// Verhindert mehrfaches Abrufen von Geräten
let isEnumerateDevices = false

// Viele Browser erlauben kein Abrufen von Geräten ohne vorheriges getUserMedia
function initEnumerateDevices() {
  // Beende, wenn bereits initialisiert
  if (isEnumerateDevices) return

  const constraints = {
    video: true
  }

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then((stream) => {
      enumerateDevices() // Geräte abrufen und auflisten
      stream.getTracks().forEach(function (track) { // Stoppe den Stream, da er nur für die Initialisierung benötigt wird
        track.stop()
      })
    })
    .catch((err) => {
      console.error('Access denied for audio/video: ', err)
    })
}

function enumerateDevices() {
  //// Lade die verfügbaren Mediengerätes
  navigator.mediaDevices.enumerateDevices().then((devices) =>
    devices.forEach((device) => {
      let el = null
      if ('videoinput' === device.kind) {
        el = videoSelect
      }
      if (!el) return

       // Erstelle eine neue Option für das Gerät
      let option = document.createElement('option')
      option.value = device.deviceId // Geräte-ID
      option.innerText = device.label // Geräte-Label
      el.appendChild(option)
      isEnumerateDevices = true
    })
  )
}
