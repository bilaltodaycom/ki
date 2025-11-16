/* ========= KONSTANTEN ========= */

const GEMINI_KEY = "AIzaSyCNkNN9ymA4vtbVoKmKPCFW0ZRTONldGBU";

let chats = JSON.parse(localStorage.getItem("chats") || "[]");
let currentChat = localStorage.getItem("currentChatID") || null;

/* ========= POPUP INITIALISIERUNG ========= */

window.onload = () => {
    const name = localStorage.getItem("username");
    const firstTime = localStorage.getItem("popupShown");

    if (!firstTime || !name) {
        document.getElementById("startPopup").classList.remove("hidden");
    } else {
        loadChatUI();
    }
};

/* ========= START POPUP WEITER ========= */

document.getElementById("popupContinue").onclick = () => {
    const name = document.getElementById("usernameInput").value.trim();
    if (name.length < 1) return;

    localStorage.setItem("username", name);
    localStorage.setItem("popupShown", "true");

    newChat(true);
    closePopup("startPopup");
};

/* ========= POPUP SCHLIEßEN ========= */

function closePopup(id) {
    document.getElementById(id).classList.add("hidden");
    loadChatUI();
}

/* ========= CHAT UI LADEN ========= */

function loadChatUI() {
    renderChatList();
    if (!currentChat) newChat();
    loadChatMessages();
}

/* ========= NEUER CHAT ========= */

document.getElementById("newChat").onclick = () => newChat();

function newChat(first = false) {
    const id = Date.now();
    currentChat = id;
    chats.push({ id, title: "Chat " + id, messages: [] });
    localStorage.setItem("currentChatID", id);
    saveChats();
    renderChatList();

    if (first) {
        addMessage("bot", `Hallo ${localStorage.getItem("username")}, schön dich zu sehen! Wie kann ich dir helfen?`);
    } else {
        loadChatMessages();
    }
}

/* ========= NACHRICHT SENDEN ========= */

document.getElementById("sendBtn").onclick = sendMessage;

document.getElementById("messageInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
});

function sendMessage() {
    const text = document.getElementById("messageInput").value.trim();
    if (!text) return;

    addMessage("user", text);
    document.getElementById("messageInput").value = "";

    generateBotReply(text);
}

/* ========= NACHRICHT HINZUFÜGEN ========= */

function addMessage(role, text) {
    const chat = chats.find(c => c.id == currentChat);
    chat.messages.push({ role, text });
    saveChats();
    loadChatMessages();
}

/* ========= CHATLISTE ========= */

function renderChatList() {
    const list = document.getElementById("chatList");
    list.innerHTML = "";
    chats.forEach(c => {
        const div = document.createElement("div");
        div.className = "sidebar-btn";
        div.textContent = c.title;
        div.onclick = () => {
            currentChat = c.id;
            localStorage.setItem("currentChatID", c.id);
            loadChatMessages();
        };
        list.appendChild(div);
    });
}

/* ========= CHAT NACHRICHTEN LADEN ========= */

function loadChatMessages() {
    const chat = chats.find(c => c.id == currentChat);
    if (!chat) return;

    const box = document.getElementById("messages");
    box.innerHTML = "";

    chat.messages.forEach(m => {
        const div = document.createElement("div");
        div.className = "message " + (m.role === "user" ? "user" : "bot");
        div.textContent = m.text;
        box.appendChild(div);
    });

    box.scrollTop = box.scrollHeight;
}

/* ========= CHATS SPEICHERN ========= */

function saveChats() {
    localStorage.setItem("chats", JSON.stringify(chats));
}

/* ========= KI ANTWORT ========= */

async function generateBotReply(text) {

    updateServerStatus("Verbinde...");

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text }] }] })
            }
        );

        if (!response.ok) throw new Error("API Fehler");

        const data = await response.json();
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Fehler bei KI";

        addMessage("bot", reply);
        updateServerStatus("BilalToday Server verbunden");
        return;
    }

    catch (e) {
        updateServerStatus("Offline – Fallback aktiv");
        offlineAI(text);
    }
}

/* ========= OFFLINE AI ========= */

function offlineAI(text) {

    text = text.toLowerCase();

    if (text.includes("wetter")) {
        addMessage("bot", "Ich kann das Wetter gerade nicht abrufen.");
        return;
    }

    if (text.includes("wer ist") || text.includes("was ist")) {
        addMessage("bot", "Ich bin offline – aber kurz erklärt: " + text);
        return;
    }

    addMessage("bot", "Ich bin offline, aber ich helfe dir trotzdem! 🙂");
}

/* ========= SERVERSTATUS ========= */

function updateServerStatus(t) {
    document.getElementById("serverStatus").textContent = t;
}
