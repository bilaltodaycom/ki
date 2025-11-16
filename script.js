
/* script.js - BilalToday Chatbot (v1.1.0)
   - Vollständig clientseitig
   - Gemini-API Key (eingebettet, wie gewünscht)
   - Wikipedia, Open-Meteo, DuckDuckGo (ohne Key)
   - Robust: immer Offline-Fallbacks, Kontext, Modelle Mini/Pro/Nano
   - LocalStorage: name, theme, model, chats, lastChatId, popupShown
*/

/* ==========================
   KONFIGURATION (hier ist dein Key)
   ========================== */
const GEMINI_API_KEY = "AIzaSyCNkNN9ymA4vtbVoKmKPCFW0ZRTONldGBU"; // exakt wie angegeben
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// Kostenlose APIs (ohne Key)
const WIKI_ENDPOINT = "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srsearch=";
const WEATHER_BASE = "https://api.open-meteo.com/v1/forecast";
const DUCKDUCKGO_ENDPOINT = "https://api.duckduckgo.com/?q="; // format=json&pretty=1

// Gültige Kundennummer für Pro/Nano (wie gefordert)
const CUSTOMER_CODE = "4163";

/* ==========================
   Default State & Storage
   ========================== */
const DEFAULTS = {
  name: null,
  theme: "dark",
  model: "mini",
  chats: [],
  lastChatId: null,
  popupShown: false
};

function loadState(){
  try {
    const raw = localStorage.getItem("bilaltoday_state");
    const parsed = raw ? JSON.parse(raw) : {};
    return Object.assign({}, DEFAULTS, parsed);
  } catch(e){
    return Object.assign({}, DEFAULTS);
  }
}
function saveState(){
  localStorage.setItem("bilaltoday_state", JSON.stringify(state));
}

let state = loadState();

/* ==========================
   DOM Elemente
   ========================== */
const el = {
  chatsList: document.getElementById("chatsList"),
  newChatBtn: document.getElementById("newChatBtn"),
  clearChatsBtn: document.getElementById("clearChatsBtn"),
  chatWindow: document.getElementById("chatWindow"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  serverStatus: document.getElementById("serverStatus"),
  userGreeting: document.getElementById("userGreeting"),
  chatTitle: document.getElementById("chatTitle"),

  // settings
  settingsBtn: document.getElementById("settingsBtn"),
  settingsModal: document.getElementById("settingsModal"),
  closeSettings: document.getElementById("closeSettings"),
  settingsName: document.getElementById("settingsName"),
  saveName: document.getElementById("saveName"),
  themeSelect: document.getElementById("themeSelect"),
  saveTheme: document.getElementById("saveTheme"),
  modelSelect: document.getElementById("modelSelect"),
  saveModel: document.getElementById("saveModel"),

  // welcome
  welcomePopup: document.getElementById("welcomePopup"),
  welcomeName: document.getElementById("welcomeName"),
  welcomeContinue: document.getElementById("welcomeContinue"),

  // model popup
  modelPopup: document.getElementById("modelPopup"),
  customerNumber: document.getElementById("customerNumber"),
  confirmModel: document.getElementById("confirmModel"),
  cancelModel: document.getElementById("cancelModel"),
  modelError: document.getElementById("modelError"),
};

/* ==========================
   UI Initialisierung & Theme
   ========================== */
applyTheme(state.theme);
if(state.name) el.userGreeting.textContent = `Hallo ${state.name}`;

/* Initial */
init();

function init(){
  renderChatsList();
  if(!state.popupShown || !state.name){
    showWelcome();
  } else {
    if(state.lastChatId) openChatById(state.lastChatId);
    else createNewChat("Willkommen");
  }
  bindUI();
  updateServerStatus();
  setInterval(updateServerStatus, 20000); // status alle 20s aktualisieren
}

/* ==========================
   Theme anwenden
   ========================== */
function applyTheme(name){
  const app = document.getElementById("app");
  app.classList.remove("dark","light","purple","ocean");
  if(!name) name = "dark";
  app.classList.add(name);
  state.theme = name;
  saveState();
}

/* ==========================
   Chats: Render, Open, Create, Clear
   ========================== */
function renderChatsList(){
  el.chatsList.innerHTML = "";
  (state.chats || []).forEach(chat => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.dataset.id = chat.id;
    const title = escapeHtml(chat.title || "Neuer Chat");
    const meta = `${(chat.messages?.length) || 0} Nachrichten`;
    div.innerHTML = `<div class="chat-item-title">${title}</div><div class="chat-item-meta">${meta}</div>`;
    div.addEventListener("click", ()=> openChatById(chat.id));
    el.chatsList.appendChild(div);
  });
  saveState();
}

function openChatById(id){
  const chat = state.chats.find(c=>c.id===id);
  if(!chat) return;
  state.lastChatId = id;
  saveState();
  el.chatTitle.textContent = chat.title || "BilalToday";
  el.chatWindow.innerHTML = "";
  (chat.messages || []).forEach(m => appendMessageToWindow(m.role, m.text));
  autoscroll();
}

function createNewChat(title="Neuer Chat"){
  const id = "chat_"+Date.now();
  const chat = { id, title, messages: [] };
  state.chats.unshift(chat);
  state.lastChatId = id;
  saveState();
  renderChatsList();
  openChatById(id);
}

function clearAllChats(){
  if(!confirm("Alle Chats wirklich löschen?")) return;
  state.chats = [];
  state.lastChatId = null;
  saveState();
  renderChatsList();
  createNewChat("Willkommen");
}

/* ==========================
   Nachrichtenanzeige Helpers
   ========================== */
function appendMessageToWindow(role, text){
  const tpl = document.getElementById("messageTpl");
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.classList.add(role === "user" ? "user" : "bot");
  node.querySelector(".message-inner").textContent = text;
  el.chatWindow.appendChild(node);
  autoscroll();
}

function autoscroll(){ el.chatWindow.scrollTo({ top: el.chatWindow.scrollHeight, behavior: "smooth" }); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ==========================
   UI Event Bindings
   ========================== */
function bindUI(){
  el.newChatBtn.onclick = ()=> createNewChat("Neuer Chat");
  el.clearChatsBtn.onclick = clearAllChats;

  el.sendBtn.addEventListener("click", onSend);
  el.messageInput.addEventListener("keypress", (e)=> { if(e.key === "Enter") onSend(); });

  el.settingsBtn.addEventListener("click", ()=> {
    el.settingsModal.classList.remove("hidden");
    el.settingsName.value = state.name || "";
    el.themeSelect.value = state.theme || "dark";
    el.modelSelect.value = state.model || "mini";
  });
  el.closeSettings.addEventListener("click", ()=> el.settingsModal.classList.add("hidden"));

  el.saveName.addEventListener("click", ()=> {
    const v = el.settingsName.value.trim();
    if(v){ state.name = v; saveState(); el.userGreeting.textContent = `Hallo ${v}`; alert("Name gespeichert."); }
  });

  el.saveTheme.addEventListener("click", ()=> {
    const t = el.themeSelect.value;
    applyTheme(t);
    alert("Theme gespeichert.");
  });

  el.saveModel.addEventListener("click", ()=> {
    const m = el.modelSelect.value;
    if(m === "pro" || m === "nano"){
      el.modelPopup.classList.remove("hidden");
      el.customerNumber.value = "";
    } else {
      state.model = m; saveState(); alert("Modell gesetzt: " + m);
    }
  });

  el.confirmModel.addEventListener("click", ()=> {
    const num = el.customerNumber.value.trim();
    if(num === CUSTOMER_CODE){
      const m = el.modelSelect.value;
      state.model = m; saveState();
      el.modelPopup.classList.add("hidden");
      el.modelError.classList.add("hidden");
      alert("Modell aktiviert: " + m);
    } else {
      el.modelError.classList.remove("hidden");
      el.modelError.textContent = "Ungültige Nummer";
    }
  });
  el.cancelModel.addEventListener("click", ()=> { el.modelPopup.classList.add("hidden"); el.modelError.classList.add("hidden"); });

  el.welcomeContinue.addEventListener("click", ()=> {
    const name = (el.welcomeName.value.trim() || "Freund");
    state.name = name;
    state.popupShown = true;
    saveState();
    el.userGreeting.textContent = `Hallo ${name}`;
    el.welcomePopup.classList.add("hidden");
    // erste automatische Nachricht
    const greeting = `Hallo ${name}, schön dich zu sehen! Wie kann ich dir helfen?`;
    sendBotMessage(greeting, {save:true});
  });
}

/* ==========================
   Willkommen anzeigen
   ========================== */
function showWelcome(){
  el.welcomePopup.classList.remove("hidden");
}

/* ==========================
   Senden -> KI / Fallback
   ========================== */
async function onSend(){
  const text = el.messageInput.value.trim();
  if(!text) return;
  el.messageInput.value = "";
  addMessageToChat("user", text);
  appendMessageToWindow("user", text);

  // typing indicator
  const typing = document.createElement("div");
  typing.className = "message bot typing";
  typing.textContent = "…schreibt…";
  el.chatWindow.appendChild(typing);
  autoscroll();

  el.sendBtn.classList.add("sending");
  setTimeout(()=> el.sendBtn.classList.remove("sending"), 900);

  try {
    const reply = await generateReply(text);
    removeTyping(typing);
    addMessageToChat("bot", reply);
    appendMessageToWindow("bot", reply);
  } catch(e){
    removeTyping(typing);
    const fallback = offlineFallbackResponse(text);
    addMessageToChat("bot", fallback);
    appendMessageToWindow("bot", fallback);
  } finally {
    autoscroll();
  }
}
function removeTyping(node){
  try { node.remove(); } catch(e){ /* ignore */ }
}

function addMessageToChat(role, text){
  let chat = state.chats.find(c=>c.id===state.lastChatId);
  if(!chat){
    createNewChat("Chat");
    chat = state.chats.find(c=>c.id===state.lastChatId);
  }
  chat.messages.push({ role, text, time: Date.now() });
  // begrenze History-Länge
  if(chat.messages.length > 400) chat.messages = chat.messages.slice(-300);
  saveState();
  renderChatsList();
}

/* ==========================
   Reply-Logik: API-Versuche -> Fallback
   ========================== */
async function generateReply(userText){
  const model = state.model || "mini";

  // 1) Versuch Gemini (primär)
  try {
    const g = await tryGemini(userText, model);
    if(g) return g;
  } catch(e){
    // console.warn('Gemini failed', e);
  }

  // 2) Versuche DuckDuckGo Instant Answer für allgemeine Fakten
  try {
    const dd = await tryDuckDuckGo(userText);
    if(dd) return dd;
  } catch(e){}

  // 3) Wikipedia bei Wissensfragen
  if(isWikiQuery(userText)){
    try {
      const w = await tryWikipedia(userText);
      if(w) return w;
    } catch(e){}
  }

  // 4) Wetter-Anfragen
  if(isWeatherQuery(userText)){
    const city = extractCity(userText) || "Düsseldorf";
    const coords = cityToCoords(city);
    if(coords){
      try {
        const we = await tryWeather(coords.lat, coords.lon);
        if(we) return we;
      } catch(e){}
    }
  }

  // 5) Offline-Fallback (immer garantierte Antwort)
  return offlineFallbackResponse(userText);
}

/* ==========================
   Gemini API call
   ========================== */
async function tryGemini(prompt, model){
  // Baue Konversationskontext (letzte 8 Nachrichten)
  const chat = state.chats.find(c=>c.id===state.lastChatId);
  const context = (chat?.messages || []).slice(-8).map(m => (m.role==="user" ? `User: ${m.text}` : `Assistant: ${m.text}`)).join("\n");
  const persona = `Du bist BilalToday Chatbot. Antworte auf Deutsch. Nutzer: ${state.name || "Freund"}. Modell: ${model}.`;
  const fullPrompt = `${persona}\n\nKonversation:\n${context}\n\nUser: ${prompt}\nAssistant:`;

  // Körper für Gemini (vereinfachte Form)
  const body = {
    input: { text: fullPrompt },
    temperature: model === "pro" ? 0.3 : (model === "nano" ? 0.9 : 0.7),
    maxOutputTokens: model === "pro" ? 512 : (model === "nano" ? 60 : 160)
  };

  // Anfrage (CORS kann serverseitig limitiert sein — falls Fehler -> fallback)
  const res = await fetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: timeoutSignal(7000)
  });

  if(!res.ok) throw new Error("Gemini nicht erreichbar");
  const data = await res.json();
  const content = extractTextFromGeminiResponse(data);
  if(content) return adaptByModelLength(content, model);
  throw new Error("Keine Gemini-Antwort");
}

function extractTextFromGeminiResponse(data){
  // Robustheit: such an verschiedenen Stellen nach Text
  try {
    if(data.output && Array.isArray(data.output) && data.output[0]?.content){
      // häufige Struktur
      const content = data.output[0].content;
      if(Array.isArray(content)){
        for(const c of content){
          if(typeof c.text === "string") return c.text;
        }
      }
    }
    if(typeof data.output_text === "string") return data.output_text;
    if(data.candidates && data.candidates.length && data.candidates[0].content){
      if(typeof data.candidates[0].content === "string") return data.candidates[0].content;
    }
    // Fallback: stringify
    if(typeof data === "object") return JSON.stringify(data).slice(0,1200);
  } catch(e){}
  return null;
}

/* ==========================
   DuckDuckGo Instant Answer (ohne Key)
   ========================== */
async function tryDuckDuckGo(q){
  const url = DUCKDUCKGO_ENDPOINT + encodeURIComponent(q) + "&format=json&no_html=1&skip_disambig=1";
  const res = await fetch(url, { cache: "no-store", signal: timeoutSignal(5000) });
  if(!res.ok) throw new Error("DDG offline");
  const json = await res.json();
  // Verwende AbstractText / RelatedTopics als Kurzantwort
  if(json?.AbstractText && json.AbstractText.length > 10){
    return `DuckDuckGo: ${json.AbstractText}`;
  }
  // try RelatedTopics
  if(Array.isArray(json?.RelatedTopics) && json.RelatedTopics.length){
    const rt = json.RelatedTopics[0];
    if(rt?.Text) return `Info: ${rt.Text}`;
  }
  throw new Error("Keine DuckDuckGo-Antwort");
}

/* ==========================
   Wikipedia (ohne Key)
   ========================== */
async function tryWikipedia(q){
  const topic = extractWikiTopic(q);
  const url = WIKI_ENDPOINT + encodeURIComponent(topic);
  const res = await fetch(url, { cache: "no-store", signal: timeoutSignal(5000) });
  if(!res.ok) throw new Error("Wiki offline");
  const json = await res.json();
  if(json?.query?.search?.length){
    const s = json.query.search[0];
    const snippet = (s.snippet || "").replace(/<\/?[^>]+(>|$)/g, "");
    return `Wikipedia (${topic}): ${snippet} ...`;
  }
  throw new Error("Kein Wiki-Eintrag");
}

/* ==========================
   Wetter (Open-Meteo, ohne Key)
   ========================== */
async function tryWeather(lat, lon){
  const url = `${WEATHER_BASE}?latitude=${lat}&longitude=${lon}&current_weather=true`;
  const res = await fetch(url, { cache: "no-store", signal: timeoutSignal(5000) });
  if(!res.ok) throw new Error("Wetter-API offline");
  const json = await res.json();
  if(json?.current_weather){
    const cw = json.current_weather;
    return `Wetter (Schätzung): ${cw.temperature}°C, Wind ${cw.windspeed} km/h, Code: ${cw.weathercode}.`;
  }
  throw new Error("kein Wetterdaten");
}

/* ==========================
   Offline-Fallbacks (immer liefern)
   ========================== */
function offlineFallbackResponse(userText){
  const lower = userText.toLowerCase();
  const name = state.name || "Freund";

  // Wetter-Fallback
  if(isWeatherQuery(userText)){
    const city = extractCity(userText) || "Düsseldorf";
    return `Ich kann das Wetter gerade nicht abrufen. Grobe Schätzung für ${city}: wechselhaft, 10–18°C möglich. (${name})`;
  }

  // Wiki-Fallback
  if(isWikiQuery(userText)){
    const topic = extractWikiTopic(userText) || userText;
    return `Kurzinfo zu ${topic}: Das ist ein wichtiges Thema. Ich kann dir eine strukturierte Übersicht geben: Hintergrund, wichtige Punkte und Quellenhinweise — frag einfach nach Details.`;
  }

  // Smalltalk
  if(/^(hi|hallo|hey|servus|moin)\b/i.test(lower) || /wie geht/i.test(lower)){
    return `Hey ${name}! Mir geht's gut – danke der Nachfrage. Wie kann ich dir helfen?`;
  }

  // Generische Hilfestellung
  const model = state.model || "mini";
  const base = `Offline-Antwort: Du fragst: "${userText}". Ich habe gerade keinen Zugriff auf externe Dienste, gebe aber gern Tipps, Zusammenfassungen oder nächste Schritte.`;
  return adaptByModelLength(base, model);
}

/* ==========================
   Einfache NLP-Helpers
   ========================== */
function isWeatherQuery(text){ return /\bwetter\b|\btemperatur\b|\bregen\b|\bsonne\b|\bwie ist das wetter\b/i.test(text); }
function isWikiQuery(text){ return /\bwer ist\b|\bwas ist\b|\bgeschichte von\b|\bdefiniert\b|\bwiki\b/i.test(text); }

function extractCity(text){
  const m = text.match(/\bin\s+([A-Za-zäöüÄÖÜß\- ]{2,30})/i);
  if(m) return capitalizeWords(m[1].trim());
  if(/\bduesseldorf\b|\bdüsseldorf\b|\bdusseldorf\b/i.test(text)) return "Düsseldorf";
  return null;
}

function extractWikiTopic(text){
  const m = text.match(/\b(?:wer ist|was ist|geschichte von|definiert)\s+(.+)/i);
  if(m) return m[1].trim();
  return text.trim();
}

function capitalizeWords(s){ return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "); }

function cityToCoords(city){
  const map = {
    "Düsseldorf": {lat:51.2277, lon:6.7735},
    "Mettman": {lat:51.2559, lon:6.9405},
    "Berlin": {lat:52.52, lon:13.405},
    "Hamburg": {lat:53.5511, lon:9.9937},
    "Köln": {lat:50.9375, lon:6.9603},
    "München": {lat:48.1351, lon:11.5820}
  };
  return map[city] || map["Düsseldorf"];
}

/* ==========================
   Modell-Längenanpassung
   ========================== */
function adaptByModelLength(text, model){
  if(model === "nano") return shorten(text, 80);
  if(model === "mini") return shorten(text, 260);
  return text; // pro = ausführlicher
}
function shorten(s, max){ return s.length <= max ? s : s.slice(0, max-1) + "…"; }

/* ==========================
   Server-Status Anzeige
   ========================== */
async function updateServerStatus(){
  let geminiOK = false, wikiOK = false, weatherOK = false, ddgOK = false;
  // Wikipedia
  try {
    const w = await fetch(WIKI_ENDPOINT + encodeURIComponent("Düsseldorf"), { method: "GET", cache:"no-store", signal: timeoutSignal(4000) });
    wikiOK = w.ok;
  } catch(e){}
  // Open-Meteo
  try {
    const coords = cityToCoords("Düsseldorf");
    const w2 = await fetch(`${WEATHER_BASE}?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`, { cache:"no-store", signal: timeoutSignal(4000) });
    weatherOK = w2.ok;
  } catch(e){}
  // DuckDuckGo
  try {
    const dd = await fetch(DUCKDUCKGO_ENDPOINT + encodeURIComponent("Düsseldorf") + "&format=json", { cache:"no-store", signal: timeoutSignal(4000) });
    ddgOK = dd.ok;
  } catch(e){}
  // Gemini quick ping (POST small)
  try {
    const t = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ input: { text: "Ping" } }),
      signal: timeoutSignal(3000)
    });
    geminiOK = t.ok;
  } catch(e){ geminiOK = false; }

  const statuses = [
    geminiOK ? "Gemini API verbunden" : "Gemini API nicht verbunden",
    wikiOK ? "Wikipedia verbunden" : "Wikipedia offline",
    weatherOK ? "Wetter-API verbunden" : "Wetter-API nicht erreichbar",
    ddgOK ? "DuckDuckGo verbunden" : "DuckDuckGo offline"
  ];
  el.serverStatus.textContent = statuses.join(" • ");
}

/* ==========================
   Hilfsfunktionen
   ========================== */
function timeoutSignal(ms){
  const controller = new AbortController();
  setTimeout(()=> controller.abort(), ms);
  return controller.signal;
}

/* ==========================
   Debug / Utilities (nützlich beim Entwickeln)
   ========================== */
window._BilalTodayState = state;
window.resetBilalState = ()=> { localStorage.removeItem("bilaltoday_state"); location.reload(); };
