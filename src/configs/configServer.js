
// Importiert das Betriebssystem-Modul von Node.js
const os = require('os')

// Ruft die Netzwerkinterfaces des Systems ab
const ifaces = os.networkInterfaces()

// Funktion zur Ermittlung der lokalen IP-Adresse
const getLocalIp = () => {
  // Standard-IP-Adresse (localhost) als Fallback
  let localIp = '127.0.0.1'

  // Iteriere über die Namen der Netzwerkinterfaces
  Object.keys(ifaces).forEach((ifname) => {
    for (const iface of ifaces[ifname]) {
      // Überspringe IPv6-Adressen und interne Adressen wie 127.0.0.1
      if (iface.family !== 'IPv4' || iface.internal !== false) {
        continue
      }
      // Setzt die lokale IP-Adresse auf die erste gefundene IPv4-Adresse
      localIp = iface.address
       // Beendet die Schleife, sobald die IP-Adresse gefunden ist
      return
    }
  })
  // Gibt die gefundene lokale IP-Adresse zurück
  return localIp
}

// Exportiert die Konfigurationsoptionen für das Modul
module.exports = {

   // Die IP-Adresse, auf der der Server lauscht
  listenIp: '0.0.0.0',
  listenPort: 3000,
  //Pfad zu ssl
  sslCrt: '../../ssl/cert.pem',
  sslKey: '../../ssl/key.pem',

  mediasoup: {
    // Worker einstellung
    numWorkers: Object.keys(os.cpus()).length,

    // Einstellungen für die Worker-Prozesse
    worker: {
      // Portbereich für WebRTC-Verbindungen
      rtcMinPort: 10000,
      rtcMaxPort: 10100,
      // Protokollierungsstufe für den Worker
      logLevel: 'warn',

      // Protokoll-Tags zur Verfolgung spezifischer Ereignisse
      logTags: [
        'info',  // Allgemeine Informationen
        'ice',   // ICE-Verbindungen (Interactive Connectivity Establishment)
        'dtls',  // DTLS-Protokoll (Datagram Transport Layer Security)
        'rtp',   // RTP-Protokoll (Real-time Transport Protocol)
        'srtp',  // SRTP-Protokoll (Secure RTP)
        'rtcp'   // RTCP-Protokoll (RTP Control Protocol)
      
      ]
    },

    // Router einstellung
    router: {
      mediaCodecs: [

        //Codec fuer Video
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000
          }
        }
      ]
    },


    // WebRtcTransport einstellungen
    webRtcTransport: {
      listenIps: [
        {
          ip: '0.0.0.0',  // Lauscht auf allen Interfaces
          announcedIp: getLocalIp() // gibt die oeffentliche IP-Adresse bekannt
        }
      ],

      // Maximale Eingangs-Bitrate (in Bits pro Sekunde) für Verbindungen
      maxIncomingBitrate: 1500000,
      // Anfangs verfügbare ausgehende Bitrate (in Bits pro Sekunde)
      initialAvailableOutgoingBitrate: 1000000
    }
  }
}
