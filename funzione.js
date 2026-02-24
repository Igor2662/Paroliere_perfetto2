async function speakSyllables() {
  if (!currentWordData || !currentWordData.syllables) return;

  speechSynthesis.cancel();
  if (!itVoice) loadItalianVoice();

  for (let i = 0; i < currentWordData.syllables.length; i++) {
    let syl = currentWordData.syllables[i].toLowerCase().trim();
    let sound = syl;

    // 1. Definizione dei gruppi complessi
    const gruppiComplessi = /sc|gn|gl|ch|gh|st|tr|br|pr|gr|fr|dr/;

    if (gruppiComplessi.test(syl)) {
      // --- LOGICA GRUPPI COMPLESSI ---
      // Gestione specifica per PESCE: SCE/SCI devono suonare dolci
      if (syl.includes('sce')) {
        sound = syl.replace('sce', 'shè');
      } else if (syl.includes('sci')) {
        sound = syl.replace('sci', 'shì');
      } else {
        // Altri gruppi complessi: solo accento per evitare spelling
        sound = syl.replace('a', 'à')
                   .replace('e', 'è')
                   .replace('i', 'ì')
                   .replace('o', 'ò')
                   .replace('u', 'ù');
      }
    } else {
      // --- LOGICA SILLABE SEMPLICI (Tua versione con H) ---
      if (syl.endsWith('a')) {
        sound = syl.replace('a', 'hà');
      } else if (syl.endsWith('e')) {
        sound = syl.replace('e', 'hè');
      } else if (syl.endsWith('i')) {
        sound = syl.replace('i', 'hì');
      } else if (syl.endsWith('o')) {
        sound = syl.replace('o', 'hò');
      } else if (syl.endsWith('u')) {
        sound = syl.replace('u', 'hù');
      }
    }

    // 2. Creazione dell'istanza di parlato
    const utter = new SpeechSynthesisUtterance(sound + " ");
    
    if (itVoice) utter.voice = itVoice;
    utter.lang = "it-IT";

    // 3. Parametri (Ho mantenuto i tuoi valori rate 2.0 e pitch 3)
    // Nota: se la voce sembra troppo "paperino", abbassa il pitch a 1.2 o 1.5
    utter.rate = 2.0; 
    utter.pitch = 3.0;

    utter.onstart = () => {
      if (typeof highlightSyllable === "function") highlightSyllable(i);
    };

    speechSynthesis.speak(utter);

    // 4. Gestione della pausa tra sillabe
    await new Promise(resolve => {
      utter.onend = () => setTimeout(resolve, 500);
      // Fail-safe per evitare che il programma si blocchi se l'audio fallisce
      setTimeout(resolve, 1200);
    });
  }
}