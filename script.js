// --- Globale Variablen & Konstanten ---

// **WICHTIG: Ersetzen Sie HIER_DEIN_KEY durch Ihren tatsächlichen Gemini API Key**
const GEMINI_API_KEY = 'AIzaSyCNkNN9ymA4vtbVoKmKPCFW0ZRTONldGBU';
const VALID_CUSTOMER_NO = '4163';
const APP_VERSION = '1.0.0';
const DEFAULT_THEME = 'dark';
const DEFAULT_MODEL = 'Mini';
const BASE_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + GEMINI_API_KEY;

// DOM-Elemente
const elements = {
    startPopup: document.getElementById('start-popup'),
    usernameInput: document.getElementById('username-input'),
    startButton: document.getElementById('start-button'),
    
    settingsPopup: document.getElementById('settings-popup'),
    settingsBtn: document.getElementById('settings-btn'),
    closeSettings: document.getElementById('close-settings'),
    settingsUsername: document.getElementById('settings-username'),
    saveUsername: document.getElementById('save-username'),
    themeSelect: document.getElementById('theme-select'),
    modelSelect: document.getElementById('model-select'),
    modelStatus: document.getElementById('model-status'),

    customerPopup: document.getElementById('customer-popup'),
    customerInput: document.getElementById('customer-input'),
    customerSubmit: document.getElementById('customer-submit'),
    customerCancel: document.getElementById('customer-cancel'),
    customerError: document.getElementById('customer-error'),

    chatMessages: document.getElementById('chat-messages'),
    userInput: document.getElementById('user-input'),
    sendBtn: document.getElementById('send-btn'),

    newChatBtn: document.getElementById('new-chat-btn'),
    chatHistoryList: document.getElementById('chat-history-list'),
    deleteAllChatsBtn: document.getElementById('delete-all-chats-btn'),
    chatTitle: document.getElementById('chat-title'),

    statusFooter: document.getElementById('status-footer'),
};

// App-Status
let appState = {
    username: 'Nutzer',
    theme: DEFAULT_THEME,
    model: DEFAULT_MODEL,
    chats: {}, // { chatId: { title: '...', messages: [...] } }
    currentChatId: null,
    isFirstVisit: true,
    isBotTyping: false,
    proNanoUnlocked: false, // Für Kundennummer-Check
    apiStatus: {
        gemini: true,
        wikipedia: true,
        weather: true
    }
};


// --- LocalStorage Management ---

/**
 * Lädt den gesamten App-Status aus dem LocalStorage.
 */
function loadState() {
    const savedState = localStorage.getItem('bilalTodayChatbotState');
    if (savedState) {
        Object.assign(appState, JSON.parse(savedState));
    }
    
    // Initialisierungen, falls LocalStorage leer
    if (!appState.chats || Object.keys(appState.chats).length === 0) {
        startNewChat(false); // Startet einen leeren Chat, falls keine Chats vorhanden
    } else if (appState.currentChatId && appState.chats[appState.currentChatId]) {
        // Chat laden
    } else {
        // Lade den letzten Chat, falls currentChatId ungültig
        appState.currentChatId = Object.keys(appState.chats)[0];
    }
    
    // UI initialisieren
    applyTheme(appState.theme);
    renderChatHistory();
    loadCurrentChat();
    updateModelStatus(appState.model);

    // Setzt Versionsnummer im Footer
    document.getElementById('app-version').textContent = APP_VERSION;
}

/**
 * Speichert den gesamten App-Status im LocalStorage.
 */
function saveState() {
    localStorage.setItem('bilalTodayChatbotState', JSON.stringify(appState));
}


// --- Pop-ups & Initialisierung ---

/**
 * Zeigt das Begrüßungs-Pop-up beim ersten Besuch.
 */
function showWelcomePopup() {
    if (appState.isFirstVisit) {
        elements.startPopup.classList.remove('hidden');
    }
}

/**
 * Behandelt den Klick auf "Weiter" im Begrüßungs-Pop-up.
 */
function handleStartClick() {
    const name = elements.usernameInput.value.trim();
    if (name) {
        appState.username = name;
        appState.isFirstVisit = false;
        elements.startPopup.classList.add('hidden');
        saveState();
        
        // Erste Bot-Nachricht
        const welcomeMessage = `Hallo **${appState.username}**, schön dich zu sehen! Wie kann ich dir helfen?`;
        addMessage('bot', welcomeMessage);
        
        // Titel des ersten Chats setzen
        if (appState.chats[appState.currentChatId]) {
             appState.chats[appState.currentChatId].title = 'Willkommen';
             renderChatHistory();
        }
        
        saveChat();
    } else {
        alert('Bitte gib deinen Namen ein.');
    }
}


// --- Chat-Nachrichten ---

/**
 * Fügt eine Nachricht zur UI und zum aktuellen Chat-Verlauf hinzu.
 * @param {string} sender - 'user' oder 'bot'
 * @param {string} content - Der Nachrichtentext
 * @param {boolean} [save=true] - Speichern nach dem Hinzufügen
 * @returns {HTMLElement} - Das erstellte Nachrichtenelement
 */
function addMessage(sender, content, save = true) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', sender);
    
    let htmlContent = content;

    // Markdown-Ersetzung (rudimentär für die UI)
    htmlContent = htmlContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    htmlContent = htmlContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
    htmlContent = htmlContent.replace(/\n/g, '<br>');


    if (sender === 'bot') {
        messageElement.innerHTML = `
            <div class="icon"><i class="fas fa-robot"></i></div>
            <div class="content">${htmlContent}</div>
        `;
    } else {
        messageElement.innerHTML = `<div class="content">${htmlContent}</div>`;
    }

    elements.chatMessages.appendChild(messageElement);
    autoScroll();

    if (save && appState.currentChatId) {
        appState.chats[appState.currentChatId].messages.push({ sender, content });
        saveChat();
        updateChatTitle(content);
    }
    
    return messageElement;
}

/**
 * Aktualisiert den Titel des aktuellen Chats basierend auf der ersten Nachricht.
 * @param {string} firstMessage - Die erste Nachricht (oder der Anfang)
 */
function updateChatTitle(firstMessage) {
    if (appState.chats[appState.currentChatId].messages.length === 1) {
        const title = firstMessage.substring(0, 30).trim() + (firstMessage.length > 30 ? '...' : '');
        appState.chats[appState.currentChatId].title = title;
        renderChatHistory();
    }
}


/**
 * Zeigt die "Bot schreibt..." Animation.
 * @returns {HTMLElement} - Das erstellte Element
 */
function showTyping() {
    elements.sendBtn.disabled = true;
    appState.isBotTyping = true;

    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', 'bot', 'typing-message');
    
    messageElement.innerHTML = `
        <div class="icon"><i class="fas fa-robot"></i></div>
        <div class="content typing-dots">
            <span>...schreibt...</span>
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;

    elements.chatMessages.appendChild(messageElement);
    autoScroll();
    return messageElement;
}

/**
 * Entfernt die "Bot schreibt..." Animation.
 * @param {HTMLElement} typingElement - Das Element der Typing-Animation
 */
function hideTyping(typingElement) {
    if (typingElement) {
        typingElement.remove();
    }
    appState.isBotTyping = false;
    elements.sendBtn.disabled = false;
    elements.userInput.focus();
}

/**
 * Scrollt automatisch zum Ende der Nachrichten.
 */
function autoScroll() {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}


// --- Chatverlauf Management ---

/**
 * Startet einen neuen, leeren Chat.
 * @param {boolean} [shouldPrompt=true] - Ob eine Willkommensnachricht gesendet werden soll
 */
function startNewChat(shouldPrompt = true) {
    const newChatId = Date.now().toString();
    appState.currentChatId = newChatId;
    appState.chats[newChatId] = {
        title: 'Neuer Chat',
        messages: []
    };
    
    elements.chatMessages.innerHTML = ''; // Leere den Haupt-Chatbereich
    elements.chatTitle.textContent = 'Neuer Chat';
    
    if (shouldPrompt) {
        const welcomeMessage = `Hallo **${appState.username}**, ich bin dein **BilalToday Chatbot**. Wie kann ich dir helfen?`;
        addMessage('bot', welcomeMessage, false);
        appState.chats[newChatId].messages.push({ sender: 'bot', content: welcomeMessage });
    }

    saveState();
    renderChatHistory();
}

/**
 * Wechselt zum ausgewählten Chat.
 * @param {string} chatId - Die ID des Chats
 */
function switchChat(chatId) {
    if (appState.currentChatId === chatId) return;
    
    appState.currentChatId = chatId;
    loadCurrentChat();
    saveState();
    renderChatHistory();
}

/**
 * Lädt die Nachrichten des aktuellen Chats in die UI.
 */
function loadCurrentChat() {
    elements.chatMessages.innerHTML = '';
    const chat = appState.chats[appState.currentChatId];
    
    if (chat) {
        chat.messages.forEach(msg => {
            addMessage(msg.sender, msg.content, false); // false, da die Nachrichten bereits gespeichert sind
        });
        elements.chatTitle.textContent = chat.title;
    }
    autoScroll();
}

/**
 * Speichert den aktuellen Chat.
 */
function saveChat() {
    saveState();
}

/**
 * Rendert die Liste der Chats in der Sidebar.
 */
function renderChatHistory() {
    elements.chatHistoryList.innerHTML = '';
    
    // Sortiere Chats nach der neuesten (höchsten) ID
    const sortedChatIds = Object.keys(appState.chats).sort((a, b) => b - a);
    
    sortedChatIds.forEach(chatId => {
        const chat = appState.chats[chatId];
        const item = document.createElement('div');
        item.classList.add('chat-history-item');
        item.textContent = chat.title;
        item.dataset.chatId = chatId;
        
        if (chatId === appState.currentChatId) {
            item.classList.add('active');
            elements.chatTitle.textContent = chat.title; // Titel aktualisieren
        }
        
        item.addEventListener('click', () => switchChat(chatId));
        elements.chatHistoryList.appendChild(item);
    });
}

/**
 * Löscht alle Chats nach Bestätigung.
 */
function deleteAllChats() {
    if (confirm('Bist du sicher, dass du ALLE Chat-Verläufe löschen möchtest? Dies kann nicht rückgängig gemacht werden.')) {
        appState.chats = {};
        startNewChat(true); // Starte einen neuen Chat mit Willkommensnachricht
    }
}


// --- Einstellungen (Settings) ---

/**
 * Wendet das ausgewählte Theme auf den Body an.
 * @param {string} themeName - Der Name des Themes
 */
function applyTheme(themeName) {
    document.body.className = `${themeName}-theme`;
    appState.theme = themeName;
    elements.themeSelect.value = themeName;
    saveState();
}

/**
 * Öffnet das Einstellungs-Pop-up.
 */
function openSettings() {
    elements.settingsUsername.value = appState.username;
    elements.themeSelect.value = appState.theme;
    elements.modelSelect.value = appState.model;
    updateModelStatus(appState.model);
    elements.settingsPopup.classList.remove('hidden');
}

/**
 * Schließt das Einstellungs-Pop-up.
 */
function closeSettings() {
    elements.settingsPopup.classList.add('hidden');
}

/**
 * Speichert den neuen Nutzernamen.
 */
function saveNewUsername() {
    const newName = elements.settingsUsername.value.trim();
    if (newName && newName !== appState.username) {
        appState.username = newName;
        saveState();
        alert(`Name erfolgreich auf "${newName}" geändert!`);
        // Optional: Chat-Titel und Begrüßung in einem neuen Chat anpassen.
    }
}

/**
 * Aktualisiert den Status des ausgewählten Modells im Einstellungs-Pop-up.
 * @param {string} modelName - Der Name des Modells
 */
function updateModelStatus(modelName) {
    elements.modelStatus.textContent = 
        (modelName === 'Mini') ? 'Aktiviert: Mini-Modell (Standard)' :
        (appState.proNanoUnlocked ? `Aktiviert: ${modelName}-Modell (Kundennummer aktiv)` : `Gesperrt: ${modelName}-Modell benötigt Kundennummer`);
    elements.modelStatus.style.color = appState.proNanoUnlocked || modelName === 'Mini' ? '#4CAF50' : '#FFC107';
}

/**
 * Behandelt die Auswahl eines neuen KI-Modells.
 */
function handleModelSelection() {
    const selectedModel = elements.modelSelect.value;

    if (selectedModel === 'Mini') {
        appState.model = selectedModel;
        saveState();
        updateModelStatus(selectedModel);
        return;
    }

    // Pro oder Nano ausgewählt -> Kundennummer erforderlich
    if (!appState.proNanoUnlocked) {
        showCustomerPopup(selectedModel);
    } else {
        appState.model = selectedModel;
        saveState();
        updateModelStatus(selectedModel);
    }
}

/**
 * Zeigt das Kundennummern-Pop-up.
 * @param {string} modelToUnlock - Das zu entsperrende Modell
 */
function showCustomerPopup(modelToUnlock) {
    elements.customerPopup.dataset.model = modelToUnlock; // Speichert das Modell temporär
    elements.customerError.textContent = '';
    elements.customerInput.value = '';
    elements.customerPopup.classList.remove('hidden');
}

/**
 * Behandelt die Eingabe der Kundennummer.
 */
function handleCustomerSubmit() {
    const input = elements.customerInput.value.trim();
    const modelToUnlock = elements.customerPopup.dataset.model;

    if (input === VALID_CUSTOMER_NO) {
        appState.proNanoUnlocked = true;
        appState.model = modelToUnlock;
        saveState();
        updateModelStatus(modelToUnlock);
        elements.customerPopup.classList.add('hidden');
        alert(`Modell ${modelToUnlock} erfolgreich aktiviert!`);
    } else {
        elements.customerError.textContent = 'Fehler: Ungültige Kundennummer.';
    }
}

/**
 * Bricht die Kundennummer-Eingabe ab und setzt das Modell auf Mini zurück.
 */
function handleCustomerCancel() {
    elements.customerPopup.classList.add('hidden');
    elements.modelSelect.value = appState.model; // Setzt die Auswahl zurück
}


// --- API / Offline Logik ---

/**
 * Aktualisiert den Server-Status im Footer.
 */
function updateServerStatus() {
    let statusText = [];

    if (appState.apiStatus.gemini) {
        statusText.push('BilalToday Server verbunden');
    } else {
        statusText.push('Gemini API nicht verbunden');
    }

    if (!appState.apiStatus.wikipedia) {
        statusText.push('Wikipedia offline');
    }

    if (!appState.apiStatus.weather) {
        statusText.push('Wetter-API nicht erreichbar');
    }

    // Wenn alles offline, zeige nur den Offline-Status
    if (!appState.apiStatus.gemini && !appState.apiStatus.wikipedia && !appState.apiStatus.weather) {
         elements.statusFooter.innerHTML = '<span style="color: #FFC107;"><i class="fas fa-exclamation-triangle"></i> Vollständiger Offline-Modus</span>';
    } else {
        // Filtere doppelte Meldungen und zeige nur die negativen + eine positive
        const uniqueStatus = Array.from(new Set(statusText));
        elements.statusFooter.innerHTML = uniqueStatus.map(s => {
            if (s.includes('Server verbunden')) return `<span style="color: #4CAF50;"><i class="fas fa-check-circle"></i> ${s}</span>`;
            if (s.includes('nicht verbunden')) return `<span style="color: ${appState.apiStatus.gemini ? '#4CAF50' : '#FFC107'};"><i class="fas fa-exclamation-triangle"></i> ${s}</span>`;
            return `<span style="color: #FFC107;"><i class="fas fa-exclamation-triangle"></i> ${s}</span>`;
        }).join(' | ');
    }
}


/**
 * Ruft die Gemini API auf.
 * @param {string} prompt - Die Benutzeranfrage
 * @returns {Promise<string>} - Die KI-Antwort oder Fallback-Text
 */
async function callGemini(prompt) {
    const history = appState.chats[appState.currentChatId].messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));
    
    // Füge den Modell-Kontext als System-Nachricht hinzu
    const systemPrompt = `Du bist der BilalToday Chatbot. Dein Name ist nicht ChatGPT. Dein aktuelles Modell ist ${appState.model}. 
                          Wenn das Modell Mini ist, antworte kurz und prägnant. 
                          Wenn das Modell Pro ist, antworte ausführlich und intelligent. 
                          Wenn das Modell Nano ist, antworte extrem kurz (1-2 Sätze).
                          Du nutzt den Namen des Nutzers: ${appState.username}. Antworte immer freundlich und hilfreich.`;

    const contents = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        ...history,
        { role: 'user', parts: [{ text: prompt }] }
    ];

    try {
        const response = await fetch(BASE_GEMINI_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: contents
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini HTTP-Fehler: ${response.status}`);
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
            appState.apiStatus.gemini = true;
            updateServerStatus();
            return text;
        } else {
            throw new Error('Ungültige Gemini-Antwortstruktur');
        }

    } catch (error) {
        console.error('Gemini API Fehler:', error);
        appState.apiStatus.gemini = false;
        updateServerStatus();
        return offlineFallback(prompt, 'gemini');
    }
}

/**
 * Ruft die Wikipedia API auf.
 * @param {string} topic - Das Suchthema
 * @returns {Promise<string>} - Ein zusammengefasster Wikipedia-Eintrag
 */
async function callWikipedia(topic) {
    const WIKI_URL = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srsearch=${encodeURIComponent(topic)}&srlimit=1`;
    try {
        const response = await fetch(WIKI_URL);
        if (!response.ok) throw new Error(`Wikipedia HTTP-Fehler: ${response.status}`);

        const data = await response.json();
        
        if (data.query.search.length > 0) {
            const snippet = data.query.search[0].snippet.replace(/<span.*?\/span>/g, ''); // HTML-Tags entfernen
            appState.apiStatus.wikipedia = true;
            updateServerStatus();
            return `Laut Wikipedia: **${snippet}** ... [mehr erfahren]`;
        } else {
            throw new Error('Kein Wikipedia-Eintrag gefunden');
        }

    } catch (error) {
        console.error('Wikipedia API Fehler:', error);
        appState.apiStatus.wikipedia = false;
        updateServerStatus();
        return offlineFallback(topic, 'wikipedia');
    }
}

/**
 * Ruft die Open-Meteo Wetter API auf (für eine feste Koordinate).
 * @returns {Promise<string>} - Der aktuelle Wetterbericht
 */
async function callWeather() {
    // Feste Koordinaten für Düsseldorf (D-Dorf, Deutschland)
    const LAT = 51.2217;
    const LONG = 6.7761;
    const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LONG}&current_weather=true`;

    try {
        const response = await fetch(WEATHER_URL);
        if (!response.ok) throw new Error(`Wetter HTTP-Fehler: ${response.status}`);

        const data = await response.json();
        const temp = data.current_weather.temperature;
        const windspeed = data.current_weather.windspeed;

        appState.apiStatus.weather = true;
        updateServerStatus();
        return `Das aktuelle Wetter in **Düsseldorf** beträgt **${temp}°C** bei einer Windgeschwindigkeit von ${windspeed} km/h.`;

    } catch (error) {
        console.error('Wetter API Fehler:', error);
        appState.apiStatus.weather = false;
        updateServerStatus();
        return offlineFallback(null, 'weather');
    }
}

/**
 * Führt einen intelligenten Offline-Fallback durch.
 * @param {string|null} prompt - Der ursprüngliche Prompt oder Suchbegriff
 * @param {string} apiName - Die API, die fehlgeschlagen ist ('gemini', 'wikipedia', 'weather')
 * @returns {string} - Die Fallback-Antwort
 */
function offlineFallback(prompt, apiName) {
    const name = appState.username;

    switch (apiName) {
        case 'gemini':
            const modelText = appState.model === 'Mini' ? 'kurz und prägnant' :
                              appState.model === 'Pro' ? 'ausführlich' :
                              'extrem kurz';
                              
            // Einfache Schlüsselwort-Antworten
            if (prompt.toLowerCase().includes('hallo') || prompt.toLowerCase().includes('wie geht')) {
                return `Hallo ${name}! Ich bin im Offline-Modus, aber mir geht es gut. Wie kann ich dir trotzdem ${modelText} helfen?`;
            }
            if (prompt.toLowerCase().includes('was ist') || prompt.toLowerCase().includes('erkläre')) {
                return `Da meine Haupt-KI gerade offline ist, kann ich dir nur eine einfache Antwort geben, ${name}: 
                        Ein komplexes Thema wie das, wonach du fragst, erfordert eine Online-Suche. 
                        Aber kurz gesagt, es ist **sehr wichtig** für ... (hier eine allgemeine Wissensantwort).`;
            }
            return `Entschuldige, ${name}. Meine fortschrittliche KI-Engine ist momentan nicht erreichbar. Ich kann dir leider nur ${modelText} und allgemeine Smalltalk-Antworten geben. Versuch es später noch einmal!`;

        case 'wikipedia':
            return `Ich kann die Wikipedia-Datenbank im Moment nicht erreichen, ${name}. Ich weiß aber, dass **${prompt}** ein sehr interessantes Thema ist.`;

        case 'weather':
            return `Ich kann das Wetter gerade nicht abrufen, ${name}. Es ist wahrscheinlich ${Math.random() > 0.5 ? 'sonnig' : 'bewölkt'} und die Temperatur liegt bei angenehmen 15 bis 20 Grad.`;
    }

    return `Fehler: API nicht erreichbar. Generiere Standard-Fallback-Antwort.`;
}


// --- Haupt-Sende-Logik ---

/**
 * Sendet die Benutzeranfrage und ruft die KI-Antwort ab.
 */
async function sendMessage() {
    const prompt = elements.userInput.value.trim();
    if (!prompt || appState.isBotTyping) return;

    // UI vorbereiten
    elements.userInput.value = '';
    elements.userInput.style.height = '50px'; // Höhe zurücksetzen
    elements.sendBtn.disabled = true;

    // Benutzer-Nachricht hinzufügen
    addMessage('user', prompt);

    // Typing-Animation starten
    const typingElement = showTyping();

    let responseText = '';
    
    // 1. Spezielle Befehle prüfen (Wetter, Wikipedia)
    if (prompt.toLowerCase().includes('wetter')) {
        responseText = await callWeather();
    } else if (prompt.toLowerCase().includes('was ist') || prompt.toLowerCase().includes('erkläre')) {
        // Thema extrahieren (rudimentär)
        const parts = prompt.toLowerCase().split(/(was ist|erkläre)\s+/);
        const topic = parts.length > 2 ? parts[2].trim() : 'Zufallsthema';

        // 2. Wikipedia versuchen (mit eigenem Fallback)
        responseText = await callWikipedia(topic);
        
        // Wenn Wikipedia erfolgreich war, sende die Antwort direkt
        if (appState.apiStatus.wikipedia) {
            // Wenn Wikipedia erfolgreich war und Gemini offline ist, senden wir die Antwort.
            // Wenn Gemini online ist, könnte man Gemini bitten, die Wikipedia-Antwort zu formatieren,
            // aber für dieses Setup senden wir sie direkt.
        } else {
            // Wikipedia ist offline -> Nur Gemini (oder Gemini Fallback) kann helfen.
            responseText = await callGemini(prompt);
        }

    } else {
        // 3. Normaler Chat (Gemini oder Fallback)
        responseText = await callGemini(prompt);
    }


    // 4. Antwort hinzufügen und UI aktualisieren
    hideTyping(typingElement);
    addMessage('bot', responseText);
    elements.sendBtn.disabled = false;
}


// --- Event Listener ---

/**
 * Fügt alle Event Listener hinzu.
 */
function setupEventListeners() {
    // Start Pop-up
    elements.startButton.addEventListener('click', handleStartClick);

    // Chat-Eingabe
    elements.sendBtn.addEventListener('click', sendMessage);
    elements.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Auto-Resize der Textarea und Senden-Button-Aktivierung
    elements.userInput.addEventListener('input', () => {
        elements.userInput.style.height = 'auto'; // Zurücksetzen
        elements.userInput.style.height = elements.userInput.scrollHeight + 'px';
        elements.sendBtn.disabled = elements.userInput.value.trim().length === 0;
    });

    // Sidebar
    elements.newChatBtn.addEventListener('click', () => startNewChat(true));
    elements.deleteAllChatsBtn.addEventListener('click', deleteAllChats);
    
    // Settings
    elements.settingsBtn.addEventListener('click', openSettings);
    elements.closeSettings.addEventListener('click', closeSettings);
    elements.saveUsername.addEventListener('click', saveNewUsername);
    elements.themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));
    elements.modelSelect.addEventListener('change', handleModelSelection);

    // Customer Pop-up
    elements.customerSubmit.addEventListener('click', handleCustomerSubmit);
    elements.customerCancel.addEventListener('click', handleCustomerCancel);
}


// --- Start der Anwendung ---

/**
 * Startet die gesamte Anwendung.
 */
function initializeApp() {
    loadState();
    setupEventListeners();
    showWelcomePopup();
    updateServerStatus(); // Initialer Status
}

// App starten, wenn das DOM geladen ist
document.addEventListener('DOMContentLoaded', initializeApp);
