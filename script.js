

let currentWord = "";
let slotCount = 0;
let score = 0;
let currentBatchStart = 0;
const batchSize = 4;
let italianVoices = [];
let currentWordIndex = 0;
let playedWords = new Set();
let currentWordData = null;

let uppercaseMode = true; // toggle maiuscolo/minuscolo
/*let wordBank = [];  carica il file words.js*/

// 🟢 Bottone maiuscolo/minuscolo
window.addEventListener("DOMContentLoaded", () => {
    const buttonBar = document.querySelector(".buttonBar") || document.body;
    const toggleCaseBtn = document.createElement("button");
    toggleCaseBtn.id = "toggleCaseBtn";
    toggleCaseBtn.textContent = "🔠 minuscolo";
    toggleCaseBtn.style.marginLeft = "10px";
    buttonBar.appendChild(toggleCaseBtn);

    toggleCaseBtn.addEventListener("click", () => {
        uppercaseMode = !uppercaseMode;
        toggleCaseBtn.textContent = uppercaseMode ? "🔠 minuscolo" : "🔡 MAIUSCOLO";

        updateDisplayedText();
        updateLetterImage(); // 🔥 aggiorna immagine
    });

// --- NUOVO: Selettore Modalità Lettura ---
    const voiceModeSelect = document.createElement("select");
    voiceModeSelect.id = "voiceModeSelect";
    voiceModeSelect.style.marginLeft = "10px";
    voiceModeSelect.innerHTML = `
        <option value="auto">🤖 Auto</option>
        <option value="pc">🖥️ PC</option>
        <option value="android">📱 Android</option>
        <option value="syllables">🧩 Sillabe pure</option>
    `;
    buttonBar.appendChild(voiceModeSelect);

});

function populateVoiceList() {
    const voices = speechSynthesis.getVoices();

    italianVoices = voices.filter(v => v.lang.toLowerCase().startsWith("it"));

    const select = document.getElementById("voiceSelect");
    select.innerHTML = "";

    italianVoices.forEach((voice, index) => {
        const option = document.createElement("option");
        option.value = index;
        //option.textContent = `${voice.name} (${voice.lang})`; stringa dati voce più lunga
		option.textContent = cleanVoiceName(voice.name);
        select.appendChild(option);
    });

    // fallback se non trova voci italiane
    if (italianVoices.length === 0) {
        voices.forEach((voice, index) => {
            const option = document.createElement("option");
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            select.appendChild(option);
        });
    }
}

function cleanVoiceName(name) {
    return name
        // rimuove brand
        .replace(/^Microsoft\s*/i, "")
        .replace(/^Google\s*/i, "")

        // rimuove Desktop
        .replace(/\s*Desktop/i, "")

        // rimuove riferimenti lingua/paese
        .replace(/\(?\bItalian\b.*\)?/i, "")
        .replace(/\(?\bItalia\b.*\)?/i, "")
        .replace(/\(?\bItaly\b.*\)?/i, "")
        .replace(/\bit[-_]?IT\b/i, "")

        // rimuove trattini e parentesi vuote
        .replace(/[-()]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}


function getAudioSyllables() {
    if (!currentWordData) return [];
    
    const mode = document.getElementById("voiceModeSelect")?.value || "auto";
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroidDevice = /Android|Adr|Linux/i.test(ua);

    if (mode === "android" || (mode === "auto" && isAndroidDevice)) {
        return currentWordData.phoneticAndroid || currentWordData.syllables;
    } else if (mode === "pc" || (mode === "auto" && !isAndroidDevice)) {
        return currentWordData.phoneticPC || currentWordData.syllables;
    } else {
        return currentWordData.syllables;
    }
}

// 🌐 Imposta le voci italiane per speechSynthesis


function getSelectedVoice() {
    if (!italianVoices || italianVoices.length === 0) return null;

    const selectedIndex = document.getElementById("voiceSelect").value;
    return italianVoices[selectedIndex] || italianVoices[0];
}



// 1. Variabile per mantenere la voce
let itVoice = null;

// 2. Funzione per trovare la voce italiana (da eseguire subito)
function loadItalianVoice() {
    italianVoices = speechSynthesis.getVoices().filter(v => v.lang.includes("it"));
}


// Caricamento iniziale e gestione asincrona


async function speakSyllables() {
    if (!currentWordData) return;

    window.speechSynthesis.cancel();

    const syllablesToSpeak = getAudioSyllables();

    const userChoice = document.getElementById("voiceModeSelect")?.value || "auto";
    const isAndroidMode = userChoice === "android" ||
        (userChoice === "auto" && /Android/i.test(navigator.userAgent));

    syllablesToSpeak.forEach((syll, i) => {
        let sound = syll.toLowerCase().trim();

        if (sound.includes('gn')) sound = sound.replace('gn', 'gné');
        if (sound.includes('gli')) sound = sound.replace('gli', 'glì');

        const utter = new SpeechSynthesisUtterance(sound);
        utter.lang = "it-IT";

        // 🔥 SEMPRE usare la voce scelta dall’utente
        utter.voice = getSelectedVoice();

        utter.rate = isAndroidMode ? 0.6 : 0.9;

        utter.onstart = () => {
            if (typeof highlightSyllable === "function") highlightSyllable(i);
        };

        window.speechSynthesis.speak(utter);
    });
}


// --- GESTIONE TRASCINAMENTO (MOUSE + LIM) ---
let touchedElement = null; // elemento trascinato via touch



// Drag globali
document.addEventListener("dragstart", e => {
    const el = e.target;
    if (!el || !el.textContent.trim()) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.setData("text", el.textContent.trim());
    e.dataTransfer.setData("sourceId", el.id);
    e.dataTransfer.setData("bgColor", window.getComputedStyle(el).backgroundColor);
});

// Touch globali
// --- GESTIONE TRASCINAMENTO (VERSIONE OTTIMIZZATA PER AUDIO) ---
document.addEventListener("touchstart", e => {
    const target = e.target;

    // 🛑 AGGIUNTA FONDAMENTALE: Se tocchiamo un bottone o i suoi figli, 
    // usciamo subito senza fare nulla. Questo sblocca l'audio.
    if (target.closest("button") || target.closest(".buttonBar")) {
        return; 
    }

    // Filtro per gli elementi trascinabili (tua logica originale)
    if (!target.classList.contains("letter") &&
        !target.classList.contains("slot") &&
        !target.classList.contains("syllable-cell") &&
        !target.classList.contains("separator-slot")) return;

    if (target.textContent.trim() !== "") {
        touchedElement = target;
        target.style.opacity = "0.6";
        // NON mettiamo e.preventDefault() qui, altrimenti blocchiamo i bottoni
    }
}, { passive: true }); // passive: true permette ai bottoni di rispondere meglio

document.addEventListener("touchmove", e => {
    // Solo se stiamo davvero trascinando qualcosa blocchiamo lo scroll
    if (touchedElement) {
        if (e.cancelable) e.preventDefault();
    }
}, { passive: false });

document.addEventListener("touchend", e => {
    if (!touchedElement) return;

    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(
        touch.clientX,
        touch.clientY
    )?.closest(".slot, .syllable-cell, .separator-slot");

    if (target &&
        (target.classList.contains("slot") ||
         target.classList.contains("syllable-cell") ||
         target.classList.contains("separator-slot"))) {

        const char = touchedElement.textContent.trim();
        const sourceId = touchedElement.id;
        const bgColor = window.getComputedStyle(touchedElement).backgroundColor;

        handleDropEffect(char, sourceId, bgColor, target, true);
    }

    touchedElement.style.opacity = "1";
    touchedElement = null;
});


function loadWord(index) {
    const entry = wordBank[index];      // parola corrente
    currentWordData = entry;            // ⭐ importante!

    currentWordIndex = index;
    document.getElementById("syllableControls").style.display = "none";
    document.getElementById("syllableArea").innerHTML = "";

    currentWord = entry.word;
    slotCount = currentWord.length;

    document.getElementById("wordTitle").textContent = "Componi la parola";
    document.getElementById("iconDisplay").textContent = entry.icon;

    // --- gestione media ---
    const imgEl = document.getElementById("wordImage");
    const vidEl = document.getElementById("wordVideo");
    const audEl = document.getElementById("wordAudio");

    [vidEl, audEl].forEach(media => {
        if (media) {
            media.pause();
            media.currentTime = 0;
            media.style.display = "none";
            media.removeAttribute("src");
            media.load();
        }
    });

    imgEl.style.display = "none";

    if (entry.image) {
        imgEl.src = entry.image;
        imgEl.style.display = "block";
    } else if (entry.video) {
        vidEl.src = entry.video;
        vidEl.style.display = "block";
        vidEl.autoplay = true;
        vidEl.loop = false;
        vidEl.muted = false;
        vidEl.play().catch(err => console.log("Errore video:", err));
    } else if (entry.audio) {
        audEl.src = entry.audio;
        audEl.style.display = "block";
        audEl.autoplay = true;
        audEl.play().catch(err => console.log("Errore audio:", err));
    }

    // --- immagine lettera iniziale ---
    const letterEl = document.getElementById("letterImage");
    if (currentWord) {
        const baseLetter = currentWord[0].toUpperCase();

        const fileName = uppercaseMode
            ? `${baseLetter}.png`
            : `${baseLetter}_lower.png`;

        letterEl.src = `letters/${fileName}`;
        letterEl.style.display = "block";
    } else {
        letterEl.style.display = "none";
    }

    generateSlots();
    generateLetters();
}

function renderWordBatch() {
    const menu = document.getElementById("wordMenu");
    menu.innerHTML = "";

    const batch = wordBank.slice(currentBatchStart, currentBatchStart + batchSize);
    batch.forEach((entry, i) => {
        const btn = document.createElement("button");
		btn.classList.add("wordBtn"); // crea la classe dei bottoni delle parole costruire
        btn.textContent = entry.icon || "🔤";
        btn.style.fontSize = "32px";

        if (playedWords.has(entry.word)) {
            btn.style.backgroundColor = "#ffe082";
            btn.disabled = true;
        }

        btn.onclick = () => {
            if (!playedWords.has(entry.word)) {
                loadWord(currentBatchStart + i);
            }
        };

        menu.appendChild(btn);
    });

    document.getElementById("iconDisplay").textContent = "";
}

function addNavigationButtons() {
    const menu = document.getElementById("wordMenu");

    if (currentBatchStart >= batchSize) {
        const backBtn = document.createElement("button");
        backBtn.textContent = "← Torna indietro";
        backBtn.onclick = () => {
            currentBatchStart -= batchSize;
            renderWordBatch();
            addNavigationButtons();
        };
        menu.appendChild(backBtn);
    }

    if (currentBatchStart + batchSize < wordBank.length) {
        const nextBtn = document.createElement("button");
        nextBtn.textContent = "Prosegui →";
        nextBtn.onclick = () => {
            currentBatchStart += batchSize;
            renderWordBatch();
            addNavigationButtons();
        };
        menu.appendChild(nextBtn);
    }
}

function updateScoreDisplay() {
    document.getElementById("scoreStar").textContent = `⭐ ${score}`;
}

function showSyllableButton() {
    const area = document.getElementById("syllableArea");
    area.innerHTML = "";

    const btn = document.createElement("button");
    btn.textContent = "✅ dividi in sillabe";
    btn.id = "syllableCheckBtn";
    btn.className = "syllable-button";
    btn.onclick = () => generateSyllableGrid();
    area.appendChild(btn);
}
document.getElementById("verifyBtn").onclick = () => {
    const slots = document.querySelectorAll(".slot");
    const composed = Array.from(slots).map(s => s.textContent.trim()).join("");
    speak(composed);
    updateDisplayedText();

    const mascot = document.getElementById("mascot");
    const isCorrect = composed.toUpperCase() === currentWord.toUpperCase();
    const isLastWord = currentWordIndex === wordBank.length - 1;

    playedWords.add(currentWord);

    if (isCorrect) {
        showReward("word");
        score += 2;
        updateScoreDisplay();
        mascot.textContent = "🎉🐥🎉";
        playSound("success");

        if (isLastWord) {
            showSyllableButton();
            setTimeout(() => window.celebrate(), 300);
        } else {
            showSyllableButton();
        }

    } else {
        score -= 1;
        updateScoreDisplay();
        mascot.textContent = "😕🐥";
        playSound("wordError");
        document.getElementById("syllableArea").innerHTML = "";
    }

    mascot.style.display = "block";
    renderWordBatch();
    addNavigationButtons();
};


// --- Sillabazione ---


function verifySyllabation(correctSyllables) {
    const cells = document.querySelectorAll(".syllable-cell");
    const sequence = Array.from(cells).map(c => c.textContent.trim()).filter(Boolean);

    let current = "";
    let groupIndices = [];
    const groups = [];

    for (let i = 0; i < sequence.length; i++) {
        const char = sequence[i];
        if (char === "/") {
            if (current) {
                groups.push({ text: current, indices: [...groupIndices] });
                current = "";
                groupIndices = [];
            }
        } else {
            current += char;
            groupIndices.push(i);
        }
    }
    if (current) groups.push({ text: current, indices: [...groupIndices] });

    const mascot = document.getElementById("mascot");
    let allCorrect = true;

    groups.forEach((group, i) => {
        const isCorrect = group.text.toLowerCase() === (correctSyllables[i] || "").toLowerCase();
        group.indices.forEach(idx => {
            const cell = document.getElementById(`syll-cell-${idx}`);
            cell.style.backgroundColor = isCorrect ? "#c8f7c5" : "#f8d7da";
        });
        if (!isCorrect) allCorrect = false;
    });

    const helpBtn = document.getElementById("syllHelpBtn");
    if (allCorrect && groups.length === correctSyllables.length) {
        showReward("syllable");
        score += 2;
        mascot.textContent = "🎊🐥 Sillabazione corretta!";
        playSound("success");
        if (helpBtn) helpBtn.style.display = "none";
    } else {
        score -= 1;
        mascot.textContent = "😓🐥 Sillabazione errata.";
        playSound("syllableError");
        if (helpBtn) helpBtn.style.display = "inline-block";
    }

    updateScoreDisplay();
    mascot.style.display = "block";
    updateDisplayedText();
}




async function speakSyllablesSync(visualArray, audioArray, cells) {
    speechSynthesis.cancel();

    let currentCellIndex = 0;

    for (let i = 0; i < audioArray.length; i++) {
        const visualSyllable = visualArray[i];
        let sound = audioArray[i].toLowerCase().trim();

        if (sound.includes('gn')) sound = sound.replace('gn', 'gné');
        if (sound.includes('gli')) sound = sound.replace('gli', 'glì');

        const utter = new SpeechSynthesisUtterance(sound);
        utter.lang = "it-IT";
        utter.voice = getSelectedVoice();
        utter.rate = 0.8;

        visualSyllable.split("").forEach(letter => {
            if (cells[currentCellIndex]) {
                cells[currentCellIndex].textContent = uppercaseMode ? letter.toUpperCase() : letter.toLowerCase();
                cells[currentCellIndex].style.backgroundColor = "#c8f7c5";
                currentCellIndex++;
            }
        });

        if (i < audioArray.length - 1 && cells[currentCellIndex]) {
            cells[currentCellIndex].textContent = "/";
            cells[currentCellIndex].style.backgroundColor = "#fff8dc";
            currentCellIndex++;
        }

        await new Promise(resolve => {
            utter.onend = () => setTimeout(resolve, 10);
        });

        speechSynthesis.speak(utter);
    }
}



async function showCorrectSyllabation() {
    const entry = wordBank.find(w => w.word === currentWord);
    if (!entry) return;
    
    const visualSyllables = entry.syllables;

    // 🔥 STESSA LOGICA DI speakSyllables PER LA FONETICA
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroid = /Android|Adr|Linux/i.test(ua);
    const isAndroidPhone = isAndroid && /Mobile/i.test(ua);
    const isAndroidTablet = isAndroid && !/Mobile/i.test(ua);

    const audioSyllables = getAudioSyllables();


    const cells = document.querySelectorAll(".syllable-cell");

    // Pulizia e backup
    const backup = Array.from(cells).map(c => ({ text: c.textContent, bg: c.style.backgroundColor }));
    cells.forEach(cell => { cell.textContent = ""; cell.style.backgroundColor = ""; });

    // --- LOGICA PER TABLET: Non usiamo await nel ciclo ---
    speechSynthesis.cancel();

    visualSyllables.forEach((visSyll, i) => {
        const audioSyll = audioSyllables[i];
        if (!audioSyll) return;

        const utter = new SpeechSynthesisUtterance(audioSyll.toLowerCase());
        utter.lang = "it-IT";
        utter.rate = 0.8;
        utter.voice = getSelectedVoice();

        utter.onstart = () => {
            // Calcolo offset celle per questa sillaba
            const offset = visualSyllables.slice(0, i).join("").length + i;

            visSyll.split("").forEach((char, charIdx) => {
                const targetCell = cells[offset + charIdx];
                if (targetCell) {
                    targetCell.textContent = uppercaseMode ? char.toUpperCase() : char.toLowerCase();
                    targetCell.style.backgroundColor = "#c8f7c5";
                }
            });

            const sepCell = cells[offset + visSyll.length];
            if (sepCell && i < visualSyllables.length - 1) {
                sepCell.textContent = "/";
                sepCell.style.backgroundColor = "#fff8dc";
            }
        };

        speechSynthesis.speak(utter);
    });

    setTimeout(() => {
        cells.forEach((cell, i) => {
            if (backup[i]) {
                cell.textContent = backup[i].text;
                cell.style.backgroundColor = backup[i].bg;
            }
        });
        updateDisplayedText();
    }, 4000);
}


// --- Shuffle array
function shuffleArray(array) {
    return array.map(v => ({value:v, sort: Math.random()}))
                .sort((a,b)=> a.sort - b.sort)
                .map(({value})=>value);
}

/* =========================
   DRAG UNIVERSALE LIM SAFE
========================= */

function enableUniversalDrag() {

  let dragged = null;
  let offsetX = 0;
  let offsetY = 0;

  document.querySelectorAll(".letter").forEach(el => {

    el.onpointerdown = e => {

      dragged = el;

      const rect = el.getBoundingClientRect();

      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      el.style.position = "fixed";
      el.style.zIndex = "9999";
      el.style.pointerEvents = "none";

      moveAt(e.clientX, e.clientY);
    };
  });

  function moveAt(x, y) {
    if (!dragged) return;
    dragged.style.left = (x - offsetX) + "px";
    dragged.style.top = (y - offsetY) + "px";
  }

  document.onpointermove = e => {
    if (!dragged) return;
    moveAt(e.clientX, e.clientY);
  };

  document.onpointerup = e => {
    if (!dragged) return;

    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);

    if (dropTarget && dropTarget.classList.contains("slot")) {
      dropTarget.textContent = dragged.textContent;
      dropTarget.style.background = "#c8e6c9";
    }

    dragged.style.position = "";
    dragged.style.left = "";
    dragged.style.top = "";
    dragged.style.zIndex = "";
    dragged.style.pointerEvents = "";

    dragged = null;
  };
}



// Funzione per sbloccare l'audio su Tablet/Smartphone
function resumeAudioContext() {
    if (speechSynthesis.speaking) return;
    const utterance = new SpeechSynthesisUtterance("");
    speechSynthesis.speak(utterance);
    console.log("Audio sbloccato");
    
    // Rimuoviamo i listener dopo il primo sblocco
    document.removeEventListener('click', resumeAudioContext);
    document.removeEventListener('touchstart', resumeAudioContext);
}
document.addEventListener('click', resumeAudioContext);
document.addEventListener('touchstart', resumeAudioContext);


/*let wordBank = [];  carica il file words.js*/



// 🌐 Imposta le voci italiane per speechSynthesis
speechSynthesis.onvoiceschanged = populateVoiceList;



function speak(text) {
    if (!text) return;

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "it-IT";
    utterance.voice = getSelectedVoice();
    utterance.rate = 0.9;
    utterance.pitch = 1.0;

    speechSynthesis.speak(utterance);
}






function playSound(type) {
    let src = "";

    switch(type) {
        case "success":
            src = "audio/success.mp3"; /*funzione */
            break;

        case "wordError":
            src = "audio/error_word.mp3"; /* non funziona */
            break;

        case "syllableError":
            src = "audio/error_syllable.mp3"; /* funziona */
            break;
    }

    const audio = new Audio(src);
    audio.play().catch(err => console.log("Errore audio:", err));
}


function handleDropEffect(char, sourceId, bgColor, target, isTouch = false) {
    const sourceEl = document.getElementById(sourceId);

    if (target.textContent.trim() !== "") {
        const oldChar = target.textContent.trim();
        const oldSourceId = target.dataset.sourceId;
        const oldBg = target.dataset.originalBg;

        const oldOriginEl = document.getElementById(oldSourceId);
        if (oldOriginEl) {
            oldOriginEl.textContent = oldChar;
            oldOriginEl.style.backgroundColor = oldBg || "#fdd835";
        }
    }

    target.textContent = char;
    target.style.backgroundColor = bgColor;
    target.dataset.sourceId = sourceId;
    target.dataset.originalBg = bgColor;

    if (sourceEl) {
        setTimeout(() => {
            sourceEl.textContent = "";
            sourceEl.style.backgroundColor = "white";
        }, 0);
    }

    updateDisplayedText();
}

function setupDrop(target) {
    // --- MOUSE ---
    target.ondragover = e => e.preventDefault();
    target.ondrop = e => {
        const char = e.dataTransfer.getData("text");
        const sourceId = e.dataTransfer.getData("sourceId");
        const bgColor = e.dataTransfer.getData("bgColor");
        handleDropEffect(char, sourceId, bgColor, target, false);
    };

}

// Drag globali
document.addEventListener("dragstart", e => {
    const el = e.target;
    if (!el || !el.textContent.trim()) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.setData("text", el.textContent.trim());
    e.dataTransfer.setData("sourceId", el.id);
    e.dataTransfer.setData("bgColor", window.getComputedStyle(el).backgroundColor);
});

// Touch globali
// --- GESTIONE TRASCINAMENTO (VERSIONE OTTIMIZZATA PER AUDIO) ---
document.addEventListener("touchstart", e => {
    const target = e.target;

    // 🛑 AGGIUNTA FONDAMENTALE: Se tocchiamo un bottone o i suoi figli, 
    // usciamo subito senza fare nulla. Questo sblocca l'audio.
    if (target.closest("button") || target.closest(".buttonBar")) {
        return; 
    }

    // Filtro per gli elementi trascinabili (tua logica originale)
    if (!target.classList.contains("letter") &&
        !target.classList.contains("slot") &&
        !target.classList.contains("syllable-cell") &&
        !target.classList.contains("separator-slot")) return;

    if (target.textContent.trim() !== "") {
        touchedElement = target;
        target.style.opacity = "0.6";
        // NON mettiamo e.preventDefault() qui, altrimenti blocchiamo i bottoni
    }
}, { passive: true }); // passive: true permette ai bottoni di rispondere meglio

document.addEventListener("touchmove", e => {
    // Solo se stiamo davvero trascinando qualcosa blocchiamo lo scroll
    if (touchedElement) {
        if (e.cancelable) e.preventDefault();
    }
}, { passive: false });

document.addEventListener("touchend", e => {
    if (!touchedElement) return;

    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(
        touch.clientX,
        touch.clientY
    )?.closest(".slot, .syllable-cell, .separator-slot");

    if (target &&
        (target.classList.contains("slot") ||
         target.classList.contains("syllable-cell") ||
         target.classList.contains("separator-slot"))) {

        const char = touchedElement.textContent.trim();
        const sourceId = touchedElement.id;
        const bgColor = window.getComputedStyle(touchedElement).backgroundColor;

        handleDropEffect(char, sourceId, bgColor, target, true);
    }

    touchedElement.style.opacity = "1";
    touchedElement = null;
});

function generateSlots() {
    const container = document.getElementById("slots");
    container.innerHTML = "";
    for (let i = 0; i < slotCount; i++) {
        const slot = document.createElement("div");
        slot.className = "slot";
        slot.id = `slot-${i}`;
        slot.draggable = true;
        setupDrop(slot);
        container.appendChild(slot);
    }
    updateDisplayedText();
}

function generateLetters() {
    const container = document.getElementById("letters");
    container.innerHTML = "";
    const shuffled = [...currentWord].sort(() => Math.random() - 0.5);
    shuffled.forEach((char, i) => {
        const letter = document.createElement("div");
        letter.className = "letter";
        letter.textContent = uppercaseMode ? char.toUpperCase() : char.toLowerCase();
        letter.draggable = true;
        letter.id = `letter-${i}`;
        setupDrop(letter);
        container.appendChild(letter);
    });
    /*enableUniversalDrag();*/
}
function loadWord(index) {
    const entry = wordBank[index];      // parola corrente
    currentWordData = entry;            // ⭐ importante!

    currentWordIndex = index;
    document.getElementById("syllableControls").style.display = "none";
    document.getElementById("syllableArea").innerHTML = "";

    currentWord = entry.word;
    slotCount = currentWord.length;

    document.getElementById("wordTitle").textContent = "Componi la parola";
    document.getElementById("iconDisplay").textContent = entry.icon;

    // --- gestione media ---
    const imgEl = document.getElementById("wordImage");
    const vidEl = document.getElementById("wordVideo");
    const audEl = document.getElementById("wordAudio");

    [vidEl, audEl].forEach(media => {
        if (media) {
            media.pause();
            media.currentTime = 0;
            media.style.display = "none";
            media.removeAttribute("src");
            media.load();
        }
    });

    imgEl.style.display = "none";

    if (entry.image) {
        imgEl.src = entry.image;
        imgEl.style.display = "block";
    } else if (entry.video) {
        vidEl.src = entry.video;
        vidEl.style.display = "block";
        vidEl.autoplay = true;
        vidEl.loop = false;
        vidEl.muted = false;
        vidEl.play().catch(err => console.log("Errore video:", err));
    } else if (entry.audio) {
        audEl.src = entry.audio;
        audEl.style.display = "block";
        audEl.autoplay = true;
        audEl.play().catch(err => console.log("Errore audio:", err));
    }

    // --- immagine lettera iniziale ---
    const letterEl = document.getElementById("letterImage");
    if (currentWord) {
        const baseLetter = currentWord[0].toUpperCase();

        const fileName = uppercaseMode
            ? `${baseLetter}.png`
            : `${baseLetter}_lower.png`;

        letterEl.src = `letters/${fileName}`;
        letterEl.style.display = "block";
    } else {
        letterEl.style.display = "none";
    }

    generateSlots();
    generateLetters();
}

function renderWordBatch() {
    const menu = document.getElementById("wordMenu");
    menu.innerHTML = "";

    const batch = wordBank.slice(currentBatchStart, currentBatchStart + batchSize);
    batch.forEach((entry, i) => {
        const btn = document.createElement("button");
        btn.textContent = entry.icon || "🔤";
        btn.style.fontSize = "32px";

        if (playedWords.has(entry.word)) {
            btn.style.backgroundColor = "#ffe082";
            btn.disabled = true;
        }

        btn.onclick = () => {
            if (!playedWords.has(entry.word)) {
                loadWord(currentBatchStart + i);
            }
        };

        menu.appendChild(btn);
    });

    document.getElementById("iconDisplay").textContent = "";
}

function addNavigationButtons() {
    const menu = document.getElementById("wordMenu");

    if (currentBatchStart >= batchSize) {
        const backBtn = document.createElement("button");
        backBtn.textContent = "⬅️";
        backBtn.onclick = () => {
            currentBatchStart -= batchSize;
            renderWordBatch();
            addNavigationButtons();
        };
        menu.appendChild(backBtn);
    }

    if (currentBatchStart + batchSize < wordBank.length) {
        const nextBtn = document.createElement("button");
        nextBtn.textContent = "➡️";
        nextBtn.onclick = () => {
            currentBatchStart += batchSize;
            renderWordBatch();
            addNavigationButtons();
        };
        menu.appendChild(nextBtn);
    }
}

function updateScoreDisplay() {
    document.getElementById("scoreStar").textContent = `⭐ ${score}`;
}

function showSyllableButton() {
    const area = document.getElementById("syllableArea");
    area.innerHTML = "";

    const btn = document.createElement("button");
    btn.textContent = "✅ dividi in sillabe";
    btn.id = "syllableCheckBtn";
    btn.className = "syllable-button";
    btn.onclick = () => generateSyllableGrid();
    area.appendChild(btn);
}

document.getElementById("verifyBtn").onclick = () => {
    const slots = document.querySelectorAll(".slot");
    const composed = Array.from(slots).map(s => s.textContent.trim()).join("");
    speak(composed);
    updateDisplayedText();

    const mascot = document.getElementById("mascot");
    const isCorrect = composed.toUpperCase() === currentWord.toUpperCase();
    const isLastWord = currentWordIndex === wordBank.length - 1;

    playedWords.add(currentWord);

    if (isCorrect) {
        showReward("word");
        score += 2;
        updateScoreDisplay();
        mascot.textContent = "🎉🐥🎉";
        playSound("success");

        if (isLastWord) {
            showSyllableButton();
            setTimeout(() => window.celebrate(), 300);
        } else {
            showSyllableButton();
        }

    } else {
        score -= 1;
        updateScoreDisplay();
        mascot.textContent = "😕🐥";
        playSound("wordError");
        document.getElementById("syllableArea").innerHTML = "";
    }

    mascot.style.display = "block";
    renderWordBatch();
    addNavigationButtons();
};
// --- Bacchetta magica ---
// --- Bacchetta magica (Versione Definitiva per PC e Tablet) ---
const mb = document.getElementById("magicBtn");
if (mb) {
    mb.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. PRIORITÀ ASSOLUTA: Parla prima di fare calcoli
        speak(currentWord);

        // 2. RITARDO CALCOLATO: Esegui la grafica dopo 50ms
        setTimeout(() => {
            const slots = document.querySelectorAll(".slot");
            const initialState = Array.from(slots).map(slot => ({
                text: slot.textContent.trim(),
                bg: slot.style.backgroundColor,
                sourceId: slot.dataset.sourceId || null
            }));

            const alreadyCorrect = Array.from(slots).map((slot, i) =>
                slot.textContent.trim().toUpperCase() === currentWord[i].toUpperCase()
            );

            slots.forEach((slot, i) => {
                if (!alreadyCorrect[i]) {
                    slot.textContent = uppercaseMode ? currentWord[i].toUpperCase() : currentWord[i].toLowerCase();
                    slot.style.backgroundColor = "#fdd835";
                }
            });

            updateDisplayedText();

            // Ritorno allo stato originale dopo il suggerimento
            setTimeout(() => {
                slots.forEach((slot, i) => {
                    if (!alreadyCorrect[i]) {
                        slot.textContent = "";
                        slot.style.backgroundColor = "white";
                        const prev = initialState[i];
                        if (prev && prev.text && prev.sourceId) {
                            const origin = document.getElementById(prev.sourceId);
                            if (origin) {
                                origin.textContent = prev.text;
                                origin.style.backgroundColor = prev.bg || "#fdd835";
                            }
                        }
                    }
                });
                updateDisplayedText();
            }, 900);
        }, 50); // Questo piccolo delay salva l'audio sui tablet Android
    };
}

// --- Sillabazione ---
function generateSyllableGrid() {
    const area = document.getElementById("syllableArea");
    area.innerHTML = "";

    const entry = wordBank.find(w => w.word === currentWord);
    if (!entry || !entry.syllables || !Array.isArray(entry.syllables)) return;

    const letterCount = currentWord.length;
    const separatorCount = entry.syllables.length - 1;
    const totalCells = letterCount + separatorCount;

    const grid = document.createElement("div");
    grid.className = "syllable-grid";

    for (let i = 0; i < totalCells; i++) {
        const cell = document.createElement("div");
        cell.className = "syllable-cell";
        cell.id = `syll-cell-${i}`;
        cell.draggable = true;
        setupDrop(cell);
        grid.appendChild(cell);
    }

    area.appendChild(grid);
    createSeparatorSlot();

    // Bottone aiuto
    const helpBtn = document.createElement("button");
    helpBtn.id = "syllHelpBtn";
    helpBtn.textContent = "🎓";
    helpBtn.style.fontSize = "28px";
    helpBtn.style.marginRight = "30px";
    helpBtn.style.display = "none";
    helpBtn.onclick = () => showCorrectSyllabation();
    area.appendChild(helpBtn);

    const verifyBtn = document.createElement("button");
    verifyBtn.textContent = "✅ Verifica sillabazione";
    verifyBtn.className = "syllable-button";
    verifyBtn.onclick = () => verifySyllabation();
    area.appendChild(verifyBtn);
}

function createSeparatorSlot() {
    const area = document.getElementById("syllableArea");

    const slot = document.createElement("div");
    slot.className = "separator-slot";
    slot.textContent = "/";
    slot.draggable = true;
    slot.id = "separator";
    setupDrop(slot);

    // Dragend (PC)
    slot.addEventListener("dragend", () => {
        setTimeout(() => {
            if (!slot.textContent.trim()) {
                slot.remove();
                createSeparatorSlot();
            }
        }, 100);
    });

    // Touchend (Android)
    slot.addEventListener("touchend", () => {
        setTimeout(() => {
            if (!slot.textContent.trim()) {
                slot.remove();
                createSeparatorSlot();
            }
        }, 50); // piccolo delay per sicurezza
    });

    area.appendChild(slot);
}


function verifySyllabation() {
    const cells = document.querySelectorAll(".syllable-cell");
    const sequence = Array.from(cells).map(c => c.textContent.trim()).filter(Boolean);

    let current = "";
    let groupIndices = [];
    let groups = [];

    for (let i = 0; i < sequence.length; i++) {
        const char = sequence[i];
        if (char === "/") {
            if (current) {
                groups.push({ text: current, indices: [...groupIndices] });
                current = "";
                groupIndices = [];
            }
        } else {
            current += char;
            groupIndices.push(i);
        }
    }
    if (current) groups.push({ text: current, indices: [...groupIndices] });

    const entry = wordBank.find(w => w.word === currentWord);
    const correct = entry?.syllables || [];
    const mascot = document.getElementById("mascot");

    let allCorrect = true;

    groups.forEach((group, i) => {
        const isCorrect = group.text.toLowerCase() === (correct[i] || "").toLowerCase();
        group.indices.forEach(idx => {
            const cell = document.getElementById(`syll-cell-${idx}`);
            cell.style.backgroundColor = isCorrect ? "#c8f7c5" : "#f8d7da";
        });
        if (!isCorrect) allCorrect = false;
    });

    const helpBtn = document.getElementById("syllHelpBtn");
    if (allCorrect && groups.length === correct.length) {
        showReward("syllable");
        score += 2;
        mascot.textContent = "🎊🐥 Sillabazione corretta!";
        playSound("success");
        if (helpBtn) helpBtn.style.display = "none";
    } else {
        score -= 1;
        mascot.textContent = "😓🐥 Sillabazione errata.";
        playSound("syllableError");
        if (helpBtn) helpBtn.style.display = "inline-block";
    }

    updateScoreDisplay();
    mascot.style.display = "block";
    updateDisplayedText();
}




// --- Shuffle array
function shuffleArray(array) {
    return array.map(v => ({value:v, sort: Math.random()}))
                .sort((a,b)=> a.sort - b.sort)
                .map(({value})=>value);
}

/* =========================
   DRAG UNIVERSALE LIM SAFE
========================= */

function enableUniversalDrag() {

  let dragged = null;
  let offsetX = 0;
  let offsetY = 0;

  document.querySelectorAll(".letter").forEach(el => {

    el.onpointerdown = e => {

      dragged = el;

      const rect = el.getBoundingClientRect();

      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      el.style.position = "fixed";
      el.style.zIndex = "9999";
      el.style.pointerEvents = "none";

      moveAt(e.clientX, e.clientY);
    };
  });

  function moveAt(x, y) {
    if (!dragged) return;
    dragged.style.left = (x - offsetX) + "px";
    dragged.style.top = (y - offsetY) + "px";
  }

  document.onpointermove = e => {
    if (!dragged) return;
    moveAt(e.clientX, e.clientY);
  };

  document.onpointerup = e => {
    if (!dragged) return;

    const dropTarget = document.elementFromPoint(e.clientX, e.clientY);

    if (dropTarget && dropTarget.classList.contains("slot")) {
      dropTarget.textContent = dragged.textContent;
      dropTarget.style.background = "#c8e6c9";
    }

    dragged.style.position = "";
    dragged.style.left = "";
    dragged.style.top = "";
    dragged.style.zIndex = "";
    dragged.style.pointerEvents = "";

    dragged = null;
  };
}
// --- Inizializzazione gioco
function initGame() {
    // 1. Mischia e prepara il gioco
    wordBank = shuffleArray(wordBank);
    currentBatchStart = 0;
    renderWordBatch();
    addNavigationButtons();
    
    // 2. Forza il caricamento delle voci (essenziale per Android)
    speechSynthesis.getVoices();
	populateVoiceList();

    // 3. Gestione BOTTONE ASCOLTA (VERSIONE CORRETTA PER TABLET)
    const lb = document.getElementById("listenBtn");
    if (lb) {
        lb.addEventListener("click", (e) => {
            e.preventDefault();
            speak(currentWord);   // CLICK = gesture valida su tablet
        });
    }

    // 4. Gestione PRONUNCIA SILLABE (VERSIONE CORRETTA PER TABLET)
    const syllBtn = document.getElementById("syllableSpeakBtn");
    if (syllBtn) {
        syllBtn.addEventListener("click", (e) => {
            e.preventDefault();
            speakSyllables();   // CLICK = gesture valida
        });
    }
}

window.onload = initGame;

// --- Maiuscole / minuscole
function updateDisplayedText() {
    document.querySelectorAll(".letter, .slot, .syllable-cell").forEach(el => {
        if (el.textContent.trim()) {
            el.textContent = uppercaseMode
                ? el.textContent.toUpperCase()
                : el.textContent.toLowerCase();
        }
    });
}

function updateLetterImage() {
    const letterEl = document.getElementById("letterImage");
    if (!letterEl || !currentWord) return;

    const baseLetter = currentWord[0].toUpperCase();

    const fileName = uppercaseMode
        ? `${baseLetter}.png`
        : `${baseLetter}_lower.png`;   // 🔥 minuscola

    letterEl.src = `letters/${fileName}`;
}


// --- Blocca menu contestuale (tocco prolungato)
document.addEventListener('contextmenu', e => e.preventDefault());
// --- Bacchetta magica (VERSIONE CORRETTA PER TABLET) ---
const mb_fixed = document.getElementById("magicBtn");
if (mb_fixed) {
    mb_fixed.addEventListener("click", (e) => {
        e.preventDefault();

        // 1. Parla subito (CLICK = gesture valida su tablet)
        speak(currentWord);

        // 2. Effetto grafico dopo un piccolo delay
        setTimeout(() => {
            const slots = document.querySelectorAll(".slot");
            const initialState = Array.from(slots).map(slot => ({
                text: slot.textContent.trim(),
                bg: slot.style.backgroundColor,
                sourceId: slot.dataset.sourceId || null
            }));

            const alreadyCorrect = Array.from(slots).map((slot, i) =>
                slot.textContent.trim().toUpperCase() === currentWord[i].toUpperCase()
            );

            slots.forEach((slot, i) => {
                if (!alreadyCorrect[i]) {
                    slot.textContent = uppercaseMode
                        ? currentWord[i].toUpperCase()
                        : currentWord[i].toLowerCase();
                    slot.style.backgroundColor = "#fdd835";
                }
            });

            updateDisplayedText();

            // Ripristino dopo 900ms
            setTimeout(() => {
                slots.forEach((slot, i) => {
                    if (!alreadyCorrect[i]) {
                        slot.textContent = "";
                        slot.style.backgroundColor = "white";
                        const prev = initialState[i];
                        if (prev && prev.text && prev.sourceId) {
                            const origin = document.getElementById(prev.sourceId);
                            if (origin) {
                                origin.textContent = prev.text;
                                origin.style.backgroundColor = prev.bg || "#fdd835";
                            }
                        }
                    }
                });
                updateDisplayedText();
            }, 900);

        }, 50);
    });
}

// --- Reward visivo (già presente, lasciato identico)
function showReward(type) {
    const reward = document.createElement("div");
    reward.className = "visual-reward";
    reward.textContent = type === "word" ? "🌟 Benissimo! 🌟" : "🧩 Super! 🧩";
    document.body.appendChild(reward);

    setTimeout(()=> reward.remove(), 2000);
}

// --- Blocca menu contestuale (tocco prolungato)
document.addEventListener('contextmenu', e => e.preventDefault());
