let localStream;
const peerConnections = {}; // Speichere PeerConnections für jeden Teilnehmer
const configuration = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, // STUN-Server
    ],
};

// Backend-URL
const API_URL = "https://localhost:3000/api";

// Benutzer registrieren
async function registerUser() {
    console.log("In der RegisterUser methode")
    const loginName = document.getElementById("usernameInputFeldReg").value;
    const passwort = document.getElementById("registerPass").value;

    try {
        const response = await fetch(`${API_URL}/users/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ loginName, passwort }),
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("userID", data.userid);
            localStorage.setItem("username", data.loginName);
            alert("Registrierung erfolgreich!");
            window.location.href = "loginPage.html";
        } else {
            alert(data.error || "Registrierung fehlgeschlagen");
        }
    } catch (error) {
        console.error("Fehler bei der Registrierung:", error);
    }
}

// Benutzer anmelden
async function loginUser() {
    const loginName = document.getElementById("usernameInputFeld").value;
    const passwort = document.getElementById("loginPass").value;

    try {
        const response = await fetch(`${API_URL}/users/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ loginName, passwort }),
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("userID", data.userid);
            localStorage.setItem("username", data.loginName);
            alert("Anmeldung erfolgreich!");
            window.location.href = "afterLogin.html";
        } else {
            alert(data.error || "Anmeldung fehlgeschlagen");
        }
    } catch (error) {
        console.error("Fehler bei der Anmeldung:", error);
}

// Raum erstellen oder beitreten
async function enterRoom(action) {
    const userID = localStorage.getItem("userID");
    const roomID = document.getElementById("roomID").value 
    console.log(roomID);
    console.log(userID);
    localStorage.setItem("roomID",roomID);
    localStream.setItem("userID",userID);

    if (action === "create") {
       
        const passwort = document.getElementById("roomPassword").value;

        try {
            const response = await fetch(`${API_URL}/sessions/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    userID,
                    name: roomID,
                    passwort,
                }),
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem("sessionID", data.sitzungID); // Speichere sessionID
                alert("Raum erfolgreich erstellt!");
                window.location.href = "roomPage.html";
            } else {
                alert(data.error || "Fehler beim Erstellen des Raums");
            }
        } catch (error) {
            console.error("Fehler beim Erstellen des Raums:", error);
        }
    }

    if (action === "join") {
    const sessionID = document.getElementById("joinRoomID").value;
    const passwort = document.getElementById("joinRoomPassword").value; // Passwort hinzufügen
    try {
        const response = await fetch(`${API_URL}/sessions/join`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ sessionID, userID, passwort }), // Passwort mitsenden
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem("sessionID", sessionID); // Speichere sessionID
            alert("Raum erfolgreich beigetreten!");
            window.location.href = "roomPage.html";
        } else {
            alert(data.error || "Fehler beim Beitreten des Raums");
        }
    } catch (error) {
        console.error("Fehler beim Beitreten des Raums:", error);
    }
}

}

// Logout
function logout() {
    localStorage.clear();
    alert("Abgemeldet!");
    window.location.href = "index.html";
}

}
