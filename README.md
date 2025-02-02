# Mediasoup video conferencing

Diese Projekt ist eine Abbgabe für den Kunden. Es soll eine Website für Multi-Party-Video-/Audio-/Bildschirmkonferenzen mit Mediasoup und SFU sein



# Voraussetzungen
Sie haben npm installiert.
Sie haben Node.js installiert.

# Code ausführen
-   Führen Sie `npm install` aus und danach `npm start`, um die Anwendung zu starten. Öffnen Sie dann Ihren Browser unter `https://<lokaleIpAdresse>:3000` oder einer von Ihnen im Konfigurationsfile definierten Port/URL.
-   (optional) Bearbeiten Sie die Datei `src/configs/Serverconfig.js` nach Ihren Bedürfnissen und ersetzen Sie die Zertifikate `ssl/key.pem ssl/cert.pem` durch Ihre eigenen.

# Bereitstellung

-   Ersetzen Sie in der Datei `config.js` die `announcedIP` durch die öffentliche IP-Adresse Ihres Servers und passen Sie den Port an, über den Sie den Dienst bereitstellen möchten.


-  Fügen Sie Firewall-Regeln für den Port der Webseite (Standard 3016) und die RTC-Verbindungen (Standard UDP 10000-10100) für die Maschine hinzu.

# Anbindung von Firestore 

-  Link für Console https://console.firebase.google.com navigieren.  Projekt neu erstellen / bereits existierendes Projekt auswählen
-  Gehe zu Einstellungen → Dienstkonten
-  Klicke auf Neuen privaten Schlüssel generieren → Die JSON-Datei speichern

# Firebase in dein Node.js-Projekt einbinden
# Erstelle eine Datei firebase.js:
-  const admin = require("firebase-admin");
-  # Darauf achten das Pfad korrekt zum erzeugten private key führt
-  const serviceAccount = require("./pfad/zu/deiner/service-account.json");

- admin.initializeApp({
 - credential: admin.credential.cert(serviceAccount)
- });

- const db = admin.firestore();

- module.exports = db;

# Erstelle/hinzufügen eine Datei index.js und füge folgendes ein:

- const db = require("./firebase"); # pfad der Datei in der die obige config definiert wurde



