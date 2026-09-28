/**
 * NAMASTE HINDI - FULL APPLICATION LOGIC & GALAXY S24 ULTRA OPTIMIZATIONS
 * Supports:
 * - 100% Offline execution on any Android device
 * - Samsung Galaxy S24 Ultra S-Pen Stylus pressure sensitivity & palm rejection
 * - 120Hz smooth animations & One UI bottom navigation
 * - Native Android Text-To-Speech bridge with Web Speech API fallback
 * - Tactile haptic feedback for card flips, SRS reviews, and quizzes
 * - Client-side Spaced Repetition System (SRS) and quiz question generator
 */

// -----------------------------------------------------------------------------
// OFFLINE STORAGE & DATA PERSISTENCE
// -----------------------------------------------------------------------------
const OfflineStore = {
  getTheme() {
    return localStorage.getItem("namaste_theme") || "light";
  },
  setTheme(theme) {
    localStorage.setItem("namaste_theme", theme);
  },
  getUsers() {
    const raw = localStorage.getItem("namaste_users");
    if (!raw) {
      const def = [{ id: 1, username: "Default Learner", streak: 1, last_active: new Date().toISOString() }];
      localStorage.setItem("namaste_users", JSON.stringify(def));
      return def;
    }
    try { return JSON.parse(raw); } catch { return [{ id: 1, username: "Default Learner", streak: 1 }]; }
  },
  createUser(username) {
    const users = this.getUsers();
    const newUser = { id: Date.now(), username, streak: 1, last_active: new Date().toISOString() };
    users.push(newUser);
    localStorage.setItem("namaste_users", JSON.stringify(users));
    return newUser;
  },
  getLetterProgress(userId) {
    const raw = localStorage.getItem(`namaste_letter_prog_${userId}`);
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  },
  saveLetterProgress(userId, letterId, status, isDrawn = false) {
    const prog = this.getLetterProgress(userId);
    if (!prog[letterId]) {
      prog[letterId] = { status: "unseen", times_drawn: 0 };
    }
    if (status) prog[letterId].status = status;
    if (isDrawn) prog[letterId].times_drawn = (prog[letterId].times_drawn || 0) + 1;
    localStorage.setItem(`namaste_letter_prog_${userId}`, JSON.stringify(prog));
    return prog[letterId];
  },
  getWordProgress(userId) {
    const raw = localStorage.getItem(`namaste_word_prog_${userId}`);
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  },
  saveWordProgress(userId, wordId, rating) {
    const prog = this.getWordProgress(userId);
    const status = rating === "again" ? "learning" : "mastered";
    prog[wordId] = { rating, status, updated_at: new Date().toISOString() };
    localStorage.setItem(`namaste_word_prog_${userId}`, JSON.stringify(prog));
    return prog[wordId];
  },
  getQuizLogs(userId) {
    const raw = localStorage.getItem(`namaste_quiz_logs_${userId}`);
    try { return raw ? JSON.parse(raw) : []; } catch { return []; }
  },
  saveQuizLog(userId, session_type, total, correct) {
    const logs = this.getQuizLogs(userId);
    logs.push({ session_type, total, correct, timestamp: new Date().toISOString() });
    localStorage.setItem(`namaste_quiz_logs_${userId}`, JSON.stringify(logs));
  },
  getCustomWords() {
    const raw = localStorage.getItem("namaste_custom_words");
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  },
  saveCustomWords(words) {
    localStorage.setItem("namaste_custom_words", JSON.stringify(words));
  },
  addCustomWords(newWords) {
    const existing = this.getCustomWords();
    const merged = [...existing, ...newWords];
    this.saveCustomWords(merged);
    return merged;
  },
  clearCustomWords() {
    localStorage.removeItem("namaste_custom_words");
  },
  getCustomDecks() {
    const raw = localStorage.getItem("namaste_custom_decks");
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  },
  saveCustomDecks(decks) {
    localStorage.setItem("namaste_custom_decks", JSON.stringify(decks));
  },
  createCustomDeck(title) {
    const decks = this.getCustomDecks();
    let maxId = 20;
    decks.forEach(d => { if (d.deck > maxId) maxId = d.deck; });
    const newDeck = {
      deck: maxId + 1,
      title: title || `Custom Deck ${maxId + 1}`,
      created_at: new Date().toISOString()
    };
    decks.push(newDeck);
    this.saveCustomDecks(decks);
    return newDeck;
  },
  clearCustomDecks() {
    localStorage.removeItem("namaste_custom_decks");
  }
};

// -----------------------------------------------------------------------------
// APPLICATION STATE
// -----------------------------------------------------------------------------
const AppState = {
  currentUserId: 1,
  currentUserName: "Default Learner",
  activeTab: "letters",

  // Letters state
  allLetters: [],
  filteredLetters: [],
  activeLetterCategory: "all",
  letterCardIndex: 0,
  selectedLetterForModal: null,

  // Canvas & S-Pen state
  activeCanvasLetter: null,
  canvasHistory: [],
  isDrawing: false,
  isSPenActive: false,
  palmRejectionEnabled: false,
  lastPointerX: 0,
  lastPointerY: 0,

  // Words state
  allStaticWords: null,
  allDecks: [],
  currentDeck: 1,
  deckWords: [],
  filteredWords: [],
  wordSearchQuery: "",
  wordCardIndex: 0,

  // Quiz state
  activeQuizType: "letters",
  quizQuestions: [],
  currentQuizIndex: 0,
  quizScore: 0,
  quizAnswered: false
};

// -----------------------------------------------------------------------------
// HARDWARE BRIDGE: TEXT-TO-SPEECH & HAPTICS
// -----------------------------------------------------------------------------
function speakHindi(text) {
  if (!text) return;

  // 1. Native Android TTS Bridge (Zero-latency offline high-definition audio)
  if (window.AndroidBridge && typeof window.AndroidBridge.speakHindi === "function") {
    window.AndroidBridge.speakHindi(text);
    return;
  }

  // 2. Web Speech API fallback
  if (!('speechSynthesis' in window)) {
    console.warn("Speech synthesis not supported in this browser.");
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "hi-IN";
  utterance.rate = 0.85;
  utterance.pitch = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const hindiVoice = voices.find(v => v.lang.includes("hi") || v.name.toLowerCase().includes("hindi"));
  if (hindiVoice) {
    utterance.voice = hindiVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function triggerHaptic(type = "click") {
  if (window.AndroidBridge && typeof window.AndroidBridge.vibrate === "function") {
    window.AndroidBridge.vibrate(type);
  } else if (navigator.vibrate) {
    if (type === "success") navigator.vibrate([25, 40, 25]);
    else if (type === "error") navigator.vibrate([50, 40, 50]);
    else navigator.vibrate(15);
  }
}

// -----------------------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  setupNavigation();
  setupUserManagement();
  setupSettingsManagement();
  setupCanvas();
  setupLettersView();
  setupWordsView();
  setupQuizEngine();
  checkHardwareCapabilities();

  // Load initial datasets
  await loadUserData();
  await loadLetters();
  await loadDecks();
  await loadWordsForCurrentDeck();
  await updateDashboard();

  // Listen for screen resize & device orientation change (Foldables, Tablets, Rotation)
  window.addEventListener("resize", () => {
    clearTimeout(window._resizeTimer);
    window._resizeTimer = setTimeout(() => {
      if (AppState.activeTab === "canvas") {
        resizeCanvasIfNeeded();
      }
    }, 150);
  });

  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      if (AppState.activeTab === "canvas") {
        resizeCanvasIfNeeded();
      }
    }, 250);
  });
});

// Detect Samsung Galaxy S24 Ultra & S-Pen hardware
function checkHardwareCapabilities() {
  const spenBadge = document.getElementById("spenBadge");
  const isAndroid = !!window.AndroidBridge;

  if (isAndroid && spenBadge) {
    const isS24U = window.AndroidBridge.isGalaxyS24Ultra && window.AndroidBridge.isGalaxyS24Ultra();
    const isSPen = window.AndroidBridge.isSPenSupported && window.AndroidBridge.isSPenSupported();
    if (isS24U) {
      spenBadge.textContent = "✍️ S24 Ultra S-Pen (120Hz)";
      spenBadge.title = "Optimized for Galaxy S24 Ultra Dynamic AMOLED 2X";
    } else if (isSPen) {
      spenBadge.textContent = "✍️ S-Pen Stylus Ready";
    }
  }
}

// -----------------------------------------------------------------------------
// THEME & AMOLED TRUE DARK MODE
// -----------------------------------------------------------------------------
function initTheme() {
  const savedTheme = OfflineStore.getTheme();
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme === "dark" || (savedTheme !== "light" && prefersDark);

  applyTheme(isDark);

  const btn = document.getElementById("btnToggleTheme");
  if (btn) {
    btn.addEventListener("click", () => {
      const nowDark = document.body.classList.toggle("dark-mode");
      OfflineStore.setTheme(nowDark ? "dark" : "light");
      updateThemeIcon(nowDark);
      triggerHaptic("click");
    });
  }
}

function applyTheme(isDark) {
  document.body.classList.toggle("dark-mode", isDark);
  updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
  const btn = document.getElementById("btnToggleTheme");
  const meta = document.getElementById("metaThemeColor");
  if (btn) btn.textContent = isDark ? "☀️" : "🌙";
  if (meta) meta.content = isDark ? "#06090f" : "#1a365d";
}

// -----------------------------------------------------------------------------
// NAVIGATION (TOP TABS & ONE UI MOBILE BOTTOM NAVIGATION)
// -----------------------------------------------------------------------------
function setupNavigation() {
  // Top navigation tabs
  document.querySelectorAll(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  // One UI Mobile bottom navigation
  document.querySelectorAll(".bnav-tab").forEach(tab => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });
}

function switchTab(tabId) {
  if (AppState.activeTab === tabId) return;
  AppState.activeTab = tabId;
  triggerHaptic("click");

  // Sync top nav
  document.querySelectorAll(".nav-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tabId);
  });

  // Sync bottom nav
  document.querySelectorAll(".bnav-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === tabId);
  });

  // Show active pane
  document.querySelectorAll(".tab-pane").forEach(pane => {
    pane.classList.toggle("active", pane.id === `tab-${tabId}`);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (tabId === "dashboard") {
    updateDashboard();
  } else if (tabId === "canvas") {
    setTimeout(() => resizeCanvasIfNeeded(), 60);
  }
}

// Android Back Button handler
window.handleAndroidBack = function() {
  const letterModal = document.getElementById("letterDetailModal");
  if (letterModal && letterModal.classList.contains("active")) {
    letterModal.classList.remove("active");
    return "handled";
  }

  const userModal = document.getElementById("userModal");
  if (userModal && userModal.classList.contains("active")) {
    userModal.classList.remove("active");
    return "handled";
  }

  const quizPlay = document.getElementById("quizPlayScreen");
  if (quizPlay && quizPlay.style.display === "block") {
    document.getElementById("quizPlayScreen").style.display = "none";
    document.getElementById("quizSetupScreen").style.display = "block";
    return "handled";
  }

  if (AppState.activeTab !== "letters") {
    switchTab("letters");
    return "handled";
  }

  return "exit";
};

// -----------------------------------------------------------------------------
// USER MANAGEMENT & PROFILE
// -----------------------------------------------------------------------------
async function setupUserManagement() {
  const switchBtn = document.getElementById("btnSwitchUser");
  const modal = document.getElementById("userModal");
  const closeBtn = document.getElementById("btnCloseUserModal");
  const createBtn = document.getElementById("btnCreateUser");
  const usernameInput = document.getElementById("newUsernameInput");

  switchBtn.addEventListener("click", async () => {
    triggerHaptic("click");
    await renderUsersModalList();
    modal.classList.add("active");
  });

  closeBtn.addEventListener("click", () => modal.classList.remove("active"));

  createBtn.addEventListener("click", async () => {
    const val = usernameInput.value.trim();
    if (!val) return;

    let newUser = null;
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: val })
      });
      if (res.ok) newUser = await res.json();
    } catch {}

    if (!newUser) {
      newUser = OfflineStore.createUser(val);
    }

    AppState.currentUserId = newUser.id;
    AppState.currentUserName = newUser.username;
    document.getElementById("activeUserName").textContent = newUser.username;
    usernameInput.value = "";
    modal.classList.remove("active");
    triggerHaptic("success");
    refreshAllData();
  });
}

async function loadUserData() {
  let users = null;
  try {
    const res = await fetch("/api/users");
    if (res.ok) users = await res.json();
  } catch {}

  if (!users || users.length === 0) {
    users = OfflineStore.getUsers();
  }

  if (users && users.length > 0) {
    AppState.currentUserId = users[0].id;
    AppState.currentUserName = users[0].username;
    document.getElementById("activeUserName").textContent = users[0].username;
    document.getElementById("userStreak").textContent = users[0].streak || 1;
  }
}

async function renderUsersModalList() {
  const container = document.getElementById("modalUserList");
  container.innerHTML = "";

  let users = null;
  try {
    const res = await fetch("/api/users");
    if (res.ok) users = await res.json();
  } catch {}

  if (!users || users.length === 0) {
    users = OfflineStore.getUsers();
  }

  users.forEach(u => {
    const div = document.createElement("div");
    div.className = `user-item ${u.id === AppState.currentUserId ? "active" : ""}`;
    div.innerHTML = `<span>${u.username}</span> <small>${u.id === AppState.currentUserId ? "Active" : "Switch"}</small>`;
    div.onclick = () => {
      AppState.currentUserId = u.id;
      AppState.currentUserName = u.username;
      document.getElementById("activeUserName").textContent = u.username;
      document.getElementById("userStreak").textContent = u.streak || 1;
      document.getElementById("userModal").classList.remove("active");
      triggerHaptic("click");
      refreshAllData();
    };
    container.appendChild(div);
  });
}

function setupSettingsManagement() {
  const btnOpen = document.getElementById("btnOpenSettings");
  const modal = document.getElementById("settingsModal");
  const btnClose = document.getElementById("btnCloseSettingsModal");

  const fileInput = document.getElementById("importFileInput");
  const btnSelect = document.getElementById("btnSelectImportFile");
  const btnExport = document.getElementById("btnExportWords");
  const btnAddSingle = document.getElementById("btnAddSingleWord");
  const btnClearCustom = document.getElementById("btnClearCustomWords");
  const btnCreateDeck = document.getElementById("btnCreateCustomDeck");
  const newDeckInput = document.getElementById("newDeckTitleInput");
  const statusMsg = document.getElementById("importStatusMessage");

  populateAddWordDeckSelect();

  if (btnOpen) {
    btnOpen.addEventListener("click", () => {
      triggerHaptic("click");
      updateCustomWordsSummary();
      populateAddWordDeckSelect();
      if (modal) modal.classList.add("active");
    });
  }

  if (btnClose && modal) {
    btnClose.addEventListener("click", () => modal.classList.remove("active"));
  }

  if (btnCreateDeck && newDeckInput) {
    btnCreateDeck.addEventListener("click", () => {
      const title = newDeckInput.value.trim();
      if (!title) {
        statusMsg.textContent = "⚠️ Please enter a deck title.";
        statusMsg.className = "import-status error";
        return;
      }
      const newDeck = OfflineStore.createCustomDeck(title);
      newDeckInput.value = "";
      statusMsg.textContent = `✓ Created Deck ${newDeck.deck}: "${newDeck.title}"!`;
      statusMsg.className = "import-status success";
      triggerHaptic("success");
      refreshAllData();
      populateAddWordDeckSelect();
    });
  }

  if (btnSelect && fileInput) {
    btnSelect.addEventListener("click", () => fileInput.click());

    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          let imported = JSON.parse(event.target.result);
          if (!Array.isArray(imported)) {
            if (typeof imported === "object" && (imported.hindi || imported.english)) {
              imported = [imported];
            } else {
              throw new Error("Invalid format");
            }
          }

          const startId = Date.now();
          const validWords = imported.filter(w => w && (w.hindi || w.english)).map((w, index) => ({
            id: w.id || (startId + index),
            rank: w.rank || (startId + index),
            hindi: w.hindi || "—",
            transliteration: w.transliteration || w.translit || "",
            english: w.english || w.meaning || "—",
            part_of_speech: w.part_of_speech || w.pos || "custom",
            deck: parseInt(w.deck) || 1,
            example_hindi: w.example_hindi || w.ex_hindi || "",
            example_transliteration: w.example_transliteration || w.ex_translit || "",
            example_english: w.example_english || w.ex_english || ""
          }));

          if (validWords.length === 0) {
            statusMsg.textContent = "❌ No valid word entries found in JSON file.";
            statusMsg.className = "import-status error";
            return;
          }

          const customDecks = OfflineStore.getCustomDecks();
          const existingDeckIds = new Set([
            ...Array.from({length: 20}, (_, i) => i + 1),
            ...customDecks.map(d => d.deck)
          ]);
          validWords.forEach(w => {
            if (w.deck > 20 && !existingDeckIds.has(w.deck)) {
              existingDeckIds.add(w.deck);
              OfflineStore.createCustomDeck(`Imported Deck ${w.deck}`);
            }
          });

          OfflineStore.addCustomWords(validWords);
          statusMsg.textContent = `✓ Successfully imported ${validWords.length} custom word(s)!`;
          statusMsg.className = "import-status success";
          updateCustomWordsSummary();
          triggerHaptic("success");
          refreshAllData();
          populateAddWordDeckSelect();
        } catch (err) {
          statusMsg.textContent = "❌ Failed to parse JSON file. Please verify syntax.";
          statusMsg.className = "import-status error";
        }
      };
      reader.readAsText(file);
      fileInput.value = "";
    });
  }

  if (btnExport) {
    btnExport.addEventListener("click", () => {
      const customWords = OfflineStore.getCustomWords();
      const allWords = [...(AppState.allStaticWords || []), ...customWords];
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allWords, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "namaste_hindi_vocabulary_decks.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      triggerHaptic("click");
    });
  }

  if (btnAddSingle) {
    btnAddSingle.addEventListener("click", () => {
      const hindi = document.getElementById("addHindi").value.trim();
      const translit = document.getElementById("addTranslit").value.trim();
      const english = document.getElementById("addEnglish").value.trim();
      const deck = parseInt(document.getElementById("addDeckSelect").value) || 1;

      if (!hindi || !english) {
        statusMsg.textContent = "⚠️ Please fill in Hindi word and English translation.";
        statusMsg.className = "import-status error";
        return;
      }

      const newWord = {
        id: Date.now(),
        rank: Date.now(),
        hindi,
        transliteration: translit,
        english,
        part_of_speech: "custom",
        deck,
        example_hindi: "",
        example_transliteration: "",
        example_english: ""
      };

      OfflineStore.addCustomWords([newWord]);
      statusMsg.textContent = `✓ Added "${hindi}" to Deck ${deck}!`;
      statusMsg.className = "import-status success";

      document.getElementById("addHindi").value = "";
      document.getElementById("addTranslit").value = "";
      document.getElementById("addEnglish").value = "";

      updateCustomWordsSummary();
      triggerHaptic("success");
      refreshAllData();
    });
  }

  if (btnClearCustom) {
    btnClearCustom.addEventListener("click", () => {
      const count = OfflineStore.getCustomWords().length;
      if (count === 0) return;
      if (confirm(`Are you sure you want to delete all ${count} imported custom words and custom decks?`)) {
        OfflineStore.clearCustomWords();
        OfflineStore.clearCustomDecks();
        updateCustomWordsSummary();
        statusMsg.textContent = "✓ Custom words and custom decks cleared.";
        statusMsg.className = "import-status success";
        triggerHaptic("tick");
        refreshAllData();
        populateAddWordDeckSelect();
      }
    });
  }
}

function populateAddWordDeckSelect() {
  const addDeckSelect = document.getElementById("addDeckSelect");
  if (!addDeckSelect) return;
  addDeckSelect.innerHTML = "";

  const allDecks = AppState.allDecks && AppState.allDecks.length > 0 ? AppState.allDecks : [];
  if (allDecks.length === 0) {
    for (let i = 1; i <= 20; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = `Deck ${i}`;
      addDeckSelect.appendChild(opt);
    }
  } else {
    allDecks.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.deck;
      opt.textContent = `Deck ${d.deck}: ${d.title}`;
      addDeckSelect.appendChild(opt);
    });
  }
}

function updateCustomWordsSummary() {
  const count = OfflineStore.getCustomWords().length;
  const countSpan = document.getElementById("customWordsCount");
  if (countSpan) {
    countSpan.textContent = `${count} custom word(s) imported`;
  }
}

function refreshAllData() {
  loadLetters();
  loadDecks();
  loadWordsForCurrentDeck();
  updateDashboard();
}

// -----------------------------------------------------------------------------
// MOBILE TOUCH & SWIPE GESTURES FOR ALL ANDROID DEVICES
// -----------------------------------------------------------------------------
function addSwipeGesture(element, onSwipeLeft, onSwipeRight) {
  if (!element) return;
  let startX = 0;
  let startY = 0;
  let startTime = 0;

  element.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length === 1) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }
  }, { passive: true });

  element.addEventListener("touchend", (e) => {
    if (e.changedTouches && e.changedTouches.length === 1) {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;
      const duration = Date.now() - startTime;

      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.3 && duration < 600) {
        if (diffX < 0 && onSwipeLeft) {
          triggerHaptic("click");
          onSwipeLeft();
        } else if (diffX > 0 && onSwipeRight) {
          triggerHaptic("click");
          onSwipeRight();
        }
      }
    }
  }, { passive: true });
}

// -----------------------------------------------------------------------------
// TAB 1: LETTERS & DEVANAGARI SCRIPT
// -----------------------------------------------------------------------------
function setupLettersView() {
  const btnGrid = document.getElementById("btnLetterViewGrid");
  const btnFlash = document.getElementById("btnLetterViewFlashcard");
  const gridView = document.getElementById("lettersGridView");
  const flashView = document.getElementById("lettersFlashcardView");

  btnGrid.addEventListener("click", () => {
    triggerHaptic("click");
    btnGrid.classList.add("active");
    btnFlash.classList.remove("active");
    gridView.style.display = "grid";
    flashView.style.display = "none";
  });

  btnFlash.addEventListener("click", () => {
    triggerHaptic("click");
    btnFlash.classList.add("active");
    btnGrid.classList.remove("active");
    gridView.style.display = "none";
    flashView.style.display = "flex";
    updateLetterFlashcard();
  });

  // Category filter pills
  document.querySelectorAll("#letterCategories .pill").forEach(pill => {
    pill.addEventListener("click", () => {
      triggerHaptic("click");
      document.querySelectorAll("#letterCategories .pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      AppState.activeLetterCategory = pill.dataset.cat;
      filterAndRenderLetters();
    });
  });

  // Flashcard Flip & Controls
  const letterCard = document.getElementById("letterCard");
  letterCard.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    triggerHaptic("click");
    letterCard.classList.toggle("flipped");
  });

  // Swipe Left -> Next, Swipe Right -> Prev
  addSwipeGesture(letterCard, () => {
    const nextBtn = document.getElementById("btnNextLetterCard");
    if (nextBtn) nextBtn.click();
  }, () => {
    const prevBtn = document.getElementById("btnPrevLetterCard");
    if (prevBtn) prevBtn.click();
  });

  document.getElementById("lfcAudioBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const l = AppState.filteredLetters[AppState.letterCardIndex];
    if (l) speakHindi(l.audio_text || l.char);
  });

  document.getElementById("btnPrevLetterCard").addEventListener("click", () => {
    if (AppState.letterCardIndex > 0) {
      triggerHaptic("click");
      AppState.letterCardIndex--;
      updateLetterFlashcard();
    }
  });

  document.getElementById("btnNextLetterCard").addEventListener("click", () => {
    if (AppState.letterCardIndex < AppState.filteredLetters.length - 1) {
      triggerHaptic("click");
      AppState.letterCardIndex++;
      updateLetterFlashcard();
    }
  });

  document.getElementById("btnLetterMarkMastered").addEventListener("click", async () => {
    const l = AppState.filteredLetters[AppState.letterCardIndex];
    if (l) {
      triggerHaptic("success");
      await updateLetterStatus(l.id, "mastered");
      if (AppState.letterCardIndex < AppState.filteredLetters.length - 1) {
        AppState.letterCardIndex++;
        updateLetterFlashcard();
      }
    }
  });

  document.getElementById("btnLetterMarkNeed").addEventListener("click", async () => {
    const l = AppState.filteredLetters[AppState.letterCardIndex];
    if (l) {
      triggerHaptic("click");
      await updateLetterStatus(l.id, "learning");
      if (AppState.letterCardIndex < AppState.filteredLetters.length - 1) {
        AppState.letterCardIndex++;
        updateLetterFlashcard();
      }
    }
  });

  // Modal actions
  const modal = document.getElementById("letterDetailModal");
  document.getElementById("btnCloseLetterModal").addEventListener("click", () => modal.classList.remove("active"));
  document.getElementById("btnModalSpeakLetter").addEventListener("click", () => {
    if (AppState.selectedLetterForModal) speakHindi(AppState.selectedLetterForModal.audio_text || AppState.selectedLetterForModal.char);
  });
  document.getElementById("btnModalGoDraw").addEventListener("click", () => {
    modal.classList.remove("active");
    if (AppState.selectedLetterForModal) {
      selectLetterForCanvas(AppState.selectedLetterForModal);
      switchTab("canvas");
    }
  });

  document.getElementById("btnOpenStrokeFromCard").addEventListener("click", (e) => {
    e.stopPropagation();
    const l = AppState.filteredLetters[AppState.letterCardIndex];
    if (l) {
      selectLetterForCanvas(l);
      switchTab("canvas");
    }
  });
}

async function loadLetters() {
  let loaded = false;
  try {
    const res = await fetch(`/api/users/${AppState.currentUserId}/letters`);
    if (res.ok) {
      AppState.allLetters = await res.json();
      loaded = true;
    }
  } catch {}

  if (!loaded) {
    try {
      const res = await fetch("./letters.json");
      if (res.ok) {
        AppState.allLetters = await res.json();
        loaded = true;
      }
    } catch {}
  }

  if (!loaded) {
    try {
      const res = await fetch("/static/letters.json");
      if (res.ok) AppState.allLetters = await res.json();
    } catch (e) {
      console.error("Failed to load letters:", e);
    }
  }

  // Decorate with local progress if available
  const localProg = OfflineStore.getLetterProgress(AppState.currentUserId);
  AppState.allLetters.forEach(l => {
    if (localProg[l.id]) {
      l.user_status = localProg[l.id].status;
      l.times_drawn = localProg[l.id].times_drawn;
    } else if (!l.user_status) {
      l.user_status = "unseen";
    }
  });

  filterAndRenderLetters();
  populateCanvasLetterSelectors();
}

function filterAndRenderLetters() {
  const cat = AppState.activeLetterCategory;
  if (cat === "all") {
    AppState.filteredLetters = [...AppState.allLetters];
  } else {
    AppState.filteredLetters = AppState.allLetters.filter(l => l.category === cat);
  }

  AppState.letterCardIndex = 0;
  renderLettersGrid();
  updateLetterFlashcard();
}

function renderLettersGrid() {
  const container = document.getElementById("lettersGridView");
  container.innerHTML = "";

  AppState.filteredLetters.forEach(l => {
    const card = document.createElement("div");
    card.className = "letter-card";
    card.innerHTML = `
      <div class="card-corner-status ${l.user_status}"></div>
      <div class="char">${l.char}</div>
      <div class="translit">${l.transliteration}</div>
      <div class="category-tag">${l.subgroup || l.category}</div>
    `;

    card.addEventListener("click", () => {
      triggerHaptic("click");
      openLetterModal(l);
    });

    container.appendChild(card);
  });
}

function openLetterModal(letter) {
  AppState.selectedLetterForModal = letter;
  document.getElementById("modalLetterChar").textContent = letter.char;
  document.getElementById("modalLetterTranslit").textContent = letter.transliteration;
  document.getElementById("modalLetterCategory").textContent = `${letter.category} • ${letter.subgroup || ''}`;
  document.getElementById("modalLetterGuide").textContent = letter.pronunciation_guide || "Standard Devanagari sound";
  document.getElementById("modalLetterStroke").textContent = letter.stroke_hints || "Follow standard stroke sequence from left to right.";
  document.getElementById("modalLetterExWord").textContent = letter.example_word || "";
  document.getElementById("modalLetterExTranslit").textContent = letter.example_transliteration ? `(${letter.example_transliteration})` : "";
  document.getElementById("modalLetterExTrans").textContent = letter.example_translation ? `— ${letter.example_translation}` : "";

  document.getElementById("letterDetailModal").classList.add("active");
  speakHindi(letter.audio_text || letter.char);
}

function updateLetterFlashcard() {
  const list = AppState.filteredLetters;
  if (!list || list.length === 0) return;

  const idx = AppState.letterCardIndex;
  const l = list[idx];
  const card = document.getElementById("letterCard");
  card.classList.remove("flipped");

  document.getElementById("letterCardIndex").textContent = `Card ${idx + 1} of ${list.length}`;
  const pct = Math.round(((idx + 1) / list.length) * 100);
  document.getElementById("letterCardProgressBar").style.width = `${pct}%`;

  document.getElementById("lfcCategory").textContent = l.category;
  document.getElementById("lfcChar").textContent = l.char;
  document.getElementById("lfcSubgroup").textContent = l.subgroup || l.category;
  document.getElementById("lfcTranslit").textContent = l.transliteration;
  document.getElementById("lfcGuide").textContent = l.pronunciation_guide || "";
  document.getElementById("lfcExHindi").textContent = l.example_word || "";
  document.getElementById("lfcExTranslit").textContent = l.example_transliteration ? `(${l.example_transliteration})` : "";
  document.getElementById("lfcExMeaning").textContent = l.example_translation ? `— ${l.example_translation}` : "";
}

async function updateLetterStatus(letterId, status) {
  try {
    await fetch(`/api/users/${AppState.currentUserId}/letters/${letterId}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
  } catch {}

  // Update local store
  OfflineStore.saveLetterProgress(AppState.currentUserId, letterId, status, false);

  const item = AppState.allLetters.find(x => x.id === letterId);
  if (item) item.user_status = status;
  renderLettersGrid();
}

// -----------------------------------------------------------------------------
// TAB 2: STROKE CANVAS WITH SAMSUNG S-PEN & PRESSURE SENSITIVITY
// -----------------------------------------------------------------------------
function setupCanvas() {
  const canvas = document.getElementById("paintCanvas");
  const ctx = canvas.getContext("2d");
  const watermark = document.getElementById("canvasWatermark");
  const chkGuide = document.getElementById("chkShowGuide");
  const colorPicker = document.getElementById("paintColor");
  const brushSlider = document.getElementById("brushSize");
  const brushDisplay = document.getElementById("brushSizeDisplay");
  const clearBtn = document.getElementById("btnClearCanvas");
  const undoBtn = document.getElementById("btnUndoCanvas");
  const saveBtn = document.getElementById("btnSaveDrawProgress");
  const speakBtn = document.getElementById("btnSpeakCanvasLetter");
  const select = document.getElementById("canvasLetterSelect");
  const spenBadge = document.getElementById("spenBadge");
  const chkPalm = document.getElementById("chkPalmRejection");

  if (chkPalm) {
    chkPalm.addEventListener("change", () => {
      AppState.palmRejectionEnabled = chkPalm.checked;
      triggerHaptic("click");
    });
  }

  function saveState() {
    if (AppState.canvasHistory.length > 25) AppState.canvasHistory.shift();
    AppState.canvasHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }

  function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: (e.pressure !== undefined && e.pressure > 0) ? e.pressure : 0.5,
      pointerType: e.pointerType || "touch"
    };
  }

  // Pointer event handlers supporting Galaxy S24 Ultra S-Pen stylus
  canvas.addEventListener("pointerdown", (e) => {
    // S-Pen Palm Rejection: If palm rejection is enabled, reject non-pen touch
    if (AppState.palmRejectionEnabled && e.pointerType === "touch") {
      return;
    }

    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    saveState();
    AppState.isDrawing = true;

    const coords = getCanvasCoordinates(e);
    AppState.lastPointerX = coords.x;
    AppState.lastPointerY = coords.y;

    if (spenBadge && coords.pointerType === "pen") {
      spenBadge.classList.add("drawing-active");
    }

    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colorPicker.value;

    // Stylus pressure-sensitive stroke width
    const baseWidth = parseFloat(brushSlider.value);
    const dynamicWidth = coords.pointerType === "pen" 
      ? baseWidth * (0.35 + 1.3 * coords.pressure)
      : baseWidth;

    ctx.lineWidth = dynamicWidth;
    ctx.moveTo(coords.x, coords.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!AppState.isDrawing) return;
    if (AppState.palmRejectionEnabled && e.pointerType === "touch") return;

    e.preventDefault();
    const coords = getCanvasCoordinates(e);

    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colorPicker.value;

    // Smooth quadratic curve interpolation for 120Hz LTPO display
    const midX = (AppState.lastPointerX + coords.x) / 2;
    const midY = (AppState.lastPointerY + coords.y) / 2;

    const baseWidth = parseFloat(brushSlider.value);
    const dynamicWidth = coords.pointerType === "pen"
      ? baseWidth * (0.35 + 1.3 * coords.pressure)
      : baseWidth;

    ctx.lineWidth = dynamicWidth;
    ctx.moveTo(AppState.lastPointerX, AppState.lastPointerY);
    ctx.quadraticCurveTo(AppState.lastPointerX, AppState.lastPointerY, midX, midY);
    ctx.stroke();

    AppState.lastPointerX = coords.x;
    AppState.lastPointerY = coords.y;
  });

  function stopDrawing(e) {
    if (AppState.isDrawing) {
      AppState.isDrawing = false;
      if (spenBadge) spenBadge.classList.remove("drawing-active");
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    }
  }

  canvas.addEventListener("pointerup", stopDrawing);
  canvas.addEventListener("pointercancel", stopDrawing);

  brushSlider.addEventListener("input", () => {
    brushDisplay.textContent = `${brushSlider.value}px`;
  });

  chkGuide.addEventListener("change", () => {
    watermark.style.display = chkGuide.checked ? "block" : "none";
  });

  clearBtn.addEventListener("click", () => {
    triggerHaptic("click");
    saveState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  undoBtn.addEventListener("click", () => {
    triggerHaptic("click");
    if (AppState.canvasHistory.length > 0) {
      const prev = AppState.canvasHistory.pop();
      ctx.putImageData(prev, 0, 0);
    }
  });

  speakBtn.addEventListener("click", () => {
    if (AppState.activeCanvasLetter) {
      speakHindi(AppState.activeCanvasLetter.audio_text || AppState.activeCanvasLetter.char);
    }
  });

  select.addEventListener("change", () => {
    const l = AppState.allLetters.find(x => x.id === parseInt(select.value));
    if (l) selectLetterForCanvas(l);
  });

  saveBtn.addEventListener("click", async () => {
    if (AppState.activeCanvasLetter) {
      triggerHaptic("success");
      try {
        await fetch(`/api/users/${AppState.currentUserId}/letters/${AppState.activeCanvasLetter.id}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "drawn" })
        });
      } catch {}

      OfflineStore.saveLetterProgress(AppState.currentUserId, AppState.activeCanvasLetter.id, null, true);

      saveBtn.textContent = "Saved! ✓";
      setTimeout(() => saveBtn.textContent = "✓ Done Practicing", 1500);
    }
  });
}

function resizeCanvasIfNeeded() {
  const canvas = document.getElementById("paintCanvas");
  if (!canvas) return;

  // Use crisp DPR scaling for Quad HD+ (3120x1440) on S24 Ultra & high density screens
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;

  const targetWidth = Math.round(rect.width * dpr) || 480;
  const targetHeight = Math.round(rect.height * dpr) || 480;

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    let tempCanvas = null;
    if (canvas.width > 0 && canvas.height > 0) {
      tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext("2d");
      tCtx.drawImage(canvas, 0, 0);
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    if (tempCanvas) {
      const ctx = canvas.getContext("2d");
      ctx.drawImage(tempCanvas, 0, 0, targetWidth, targetHeight);
    }
  }
}

function populateCanvasLetterSelectors() {
  const select = document.getElementById("canvasLetterSelect");
  const quickGrid = document.getElementById("quickLetterGrid");
  if (!select || !quickGrid) return;

  select.innerHTML = "";
  quickGrid.innerHTML = "";

  AppState.allLetters.forEach((l, idx) => {
    const opt = document.createElement("option");
    opt.value = l.id;
    opt.textContent = `${l.char} - ${l.transliteration} (${l.subgroup || l.category})`;
    select.appendChild(opt);

    const btn = document.createElement("button");
    btn.className = `strip-btn ${idx === 0 ? "active" : ""}`;
    btn.textContent = l.char;
    btn.title = `${l.transliteration} - ${l.example_word || ''}`;
    btn.onclick = () => {
      triggerHaptic("click");
      selectLetterForCanvas(l);
    };
    quickGrid.appendChild(btn);
  });

  if (AppState.allLetters.length > 0 && !AppState.activeCanvasLetter) {
    selectLetterForCanvas(AppState.allLetters[0]);
  }
}

function selectLetterForCanvas(letter) {
  AppState.activeCanvasLetter = letter;
  const sel = document.getElementById("canvasLetterSelect");
  if (sel) sel.value = letter.id;

  document.getElementById("canvasCharTitle").innerHTML = `Character: <strong>${letter.char} (${letter.transliteration})</strong>`;
  document.getElementById("canvasStrokeHint").textContent = letter.stroke_hints || "Trace carefully following the watermark guidance.";
  document.getElementById("canvasWatermark").textContent = letter.char;

  const canvas = document.getElementById("paintCanvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  AppState.canvasHistory = [];

  document.querySelectorAll(".strip-btn").forEach(btn => {
    btn.classList.toggle("active", btn.textContent === letter.char);
  });

  speakHindi(letter.audio_text || letter.char);
}

// -----------------------------------------------------------------------------
// TAB 3: 1000 WORDS & SPACED REPETITION (SRS)
// -----------------------------------------------------------------------------
function setupWordsView() {
  const deckSelect = document.getElementById("deckSelect");
  const searchInput = document.getElementById("wordSearchInput");
  const btnClearSearch = document.getElementById("btnClearSearch");

  const btnList = document.getElementById("btnWordViewList");
  const btnSRS = document.getElementById("btnWordViewSRS");
  const listView = document.getElementById("wordsListView");
  const srsView = document.getElementById("wordsSRSView");

  btnList.addEventListener("click", () => {
    triggerHaptic("click");
    btnList.classList.add("active");
    btnSRS.classList.remove("active");
    listView.style.display = "grid";
    srsView.style.display = "none";
  });

  btnSRS.addEventListener("click", () => {
    triggerHaptic("click");
    btnSRS.classList.add("active");
    btnList.classList.remove("active");
    listView.style.display = "none";
    srsView.style.display = "flex";
    AppState.wordCardIndex = 0;
    updateWordFlashcard();
  });

  deckSelect.addEventListener("change", async () => {
    triggerHaptic("click");
    AppState.currentDeck = parseInt(deckSelect.value);
    await loadWordsForCurrentDeck();
  });

  searchInput.addEventListener("input", (e) => {
    AppState.wordSearchQuery = e.target.value.toLowerCase().trim();
    filterWords();
  });

  btnClearSearch.addEventListener("click", () => {
    triggerHaptic("click");
    searchInput.value = "";
    AppState.wordSearchQuery = "";
    filterWords();
  });

  // Word Flashcard 3D flip
  const wordCard = document.getElementById("wordCard");
  wordCard.addEventListener("click", (e) => {
    if (e.target.closest("button")) return;
    triggerHaptic("click");
    wordCard.classList.toggle("flipped");
  });

  // Swipe Left -> Next Word, Swipe Right -> Prev Word
  addSwipeGesture(wordCard, () => {
    const nextBtn = document.getElementById("btnNextWordCard");
    if (nextBtn) nextBtn.click();
  }, () => {
    const prevBtn = document.getElementById("btnPrevWordCard");
    if (prevBtn) prevBtn.click();
  });

  document.getElementById("wfcAudioBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const w = AppState.filteredWords[AppState.wordCardIndex];
    if (w) speakHindi(w.audio_text || w.hindi);
  });

  document.getElementById("wfcAudioExBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const w = AppState.filteredWords[AppState.wordCardIndex];
    if (w && w.example_hindi) speakHindi(w.example_hindi);
  });

  // SRS ratings
  document.getElementById("btnSRSAgain").addEventListener("click", () => handleSRSReview("again"));
  document.getElementById("btnSRSGood").addEventListener("click", () => handleSRSReview("good"));
  document.getElementById("btnSRSEasy").addEventListener("click", () => handleSRSReview("easy"));

  document.getElementById("btnPrevWordCard").addEventListener("click", () => {
    if (AppState.wordCardIndex > 0) {
      triggerHaptic("click");
      AppState.wordCardIndex--;
      updateWordFlashcard();
    }
  });

  document.getElementById("btnNextWordCard").addEventListener("click", () => {
    if (AppState.wordCardIndex < AppState.filteredWords.length - 1) {
      triggerHaptic("click");
      AppState.wordCardIndex++;
      updateWordFlashcard();
    }
  });
}

async function loadDecks() {
  let loaded = false;
  try {
    const res = await fetch(`/api/decks?user_id=${AppState.currentUserId}`);
    if (res.ok) {
      AppState.allDecks = await res.json();
      loaded = true;
    }
  } catch {}

  if (!loaded) {
    AppState.allDecks = [];
    const deckTitles = [
      "Core Pronouns & Essentials", "Foundational Daily Verbs", "Time, Directions & Adverbs",
      "Family, People & Descriptions", "Food, Groceries & Kitchen", "House, Living & Objects",
      "Body Parts, Health & Feelings", "City, Transport & Travel", "Nature, Animals & Weather",
      "Education, Study & Work", "Money, Numbers & Quantities", "Colors, Shapes & Senses",
      "Society, Culture & Festivals", "Technology & Modern Life", "Action Verbs & Routine",
      "Thoughts, Logic & Values", "Environment & Geography", "Safety, Law & Agriculture",
      "Advanced Connectors & Phrases", "Wisdom, Sayings & Expressions"
    ];

    const wordProg = OfflineStore.getWordProgress(AppState.currentUserId);

    const customWords = OfflineStore.getCustomWords();
    const customDecks = OfflineStore.getCustomDecks();
    const allWords = [...(AppState.allStaticWords || []), ...customWords];

    for (let d = 1; d <= 20; d++) {
      let mastered = 0;
      let learning = 0;
      const startRank = (d - 1) * 50 + 1;
      const endRank = d * 50;

      const deckItems = allWords.filter(w => w.deck === d);
      deckItems.forEach(w => {
        const p = wordProg[w.id];
        if (p) {
          if (p.status === "mastered") mastered++;
          else if (p.status === "learning") learning++;
        }
      });

      const total = deckItems.length;
      AppState.allDecks.push({
        deck: d,
        title: deckTitles[d - 1] || `Deck ${d}`,
        range: `${startRank}–${endRank}`,
        total_words: total,
        mastered,
        learning,
        unseen: Math.max(0, total - mastered - learning)
      });
    }

    customDecks.forEach(cd => {
      let mastered = 0;
      let learning = 0;
      const deckItems = allWords.filter(w => w.deck === cd.deck);
      deckItems.forEach(w => {
        const p = wordProg[w.id];
        if (p) {
          if (p.status === "mastered") mastered++;
          else if (p.status === "learning") learning++;
        }
      });
      const total = deckItems.length;
      AppState.allDecks.push({
        deck: cd.deck,
        title: cd.title,
        range: `Custom Deck ${cd.deck}`,
        total_words: total,
        mastered,
        learning,
        unseen: Math.max(0, total - mastered - learning)
      });
    });
  }

  const deckSelect = document.getElementById("deckSelect");
  deckSelect.innerHTML = "";

  AppState.allDecks.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.deck;
    opt.textContent = `Deck ${d.deck}: ${d.title}`;
    if (d.deck === AppState.currentDeck) opt.selected = true;
    deckSelect.appendChild(opt);
  });

  updateDeckStatsHeader();
  populateQuizDeckSelectors();
}

async function loadWordsForCurrentDeck() {
  let loaded = false;
  try {
    const res = await fetch(`/api/words?deck=${AppState.currentDeck}&user_id=${AppState.currentUserId}&limit=50`);
    if (res.ok) {
      AppState.deckWords = await res.json();
      loaded = true;
    }
  } catch {}

  if (!loaded) {
    if (!AppState.allStaticWords) {
      try {
        let res = await fetch("./words.json");
        if (!res.ok) res = await fetch("/static/words.json");
        AppState.allStaticWords = await res.json();
      } catch (e) {
        console.error("Static words load failed:", e);
      }
    }
    const customWords = OfflineStore.getCustomWords();
    const allWords = [...(AppState.allStaticWords || []), ...customWords];
    AppState.deckWords = allWords.filter(w => w.deck === AppState.currentDeck);
  }

  // Decorate with local word progress
  const wordProg = OfflineStore.getWordProgress(AppState.currentUserId);
  AppState.deckWords.forEach(w => {
    if (wordProg[w.id]) {
      w.user_status = wordProg[w.id].status;
    } else if (!w.user_status) {
      w.user_status = "unseen";
    }
  });

  filterWords();
  updateDeckStatsHeader();
}

function filterWords() {
  const q = AppState.wordSearchQuery;
  if (!q) {
    AppState.filteredWords = [...AppState.deckWords];
  } else {
    AppState.filteredWords = AppState.deckWords.filter(w =>
      w.hindi.includes(q) ||
      w.transliteration.toLowerCase().includes(q) ||
      w.english.toLowerCase().includes(q)
    );
  }

  AppState.wordCardIndex = 0;
  renderWordsList();
  updateWordFlashcard();
}

function renderWordsList() {
  const container = document.getElementById("wordsListView");
  container.innerHTML = "";

  if (AppState.filteredWords.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem;">No words match your search.</div>`;
    return;
  }

  AppState.filteredWords.forEach(w => {
    const card = document.createElement("div");
    card.className = "word-card";
    card.innerHTML = `
      <div class="word-card-top">
        <span class="word-rank">#${w.rank}</span>
        <span class="pos-badge">${w.part_of_speech || 'word'}</span>
      </div>
      <div>
        <div class="word-main">
          <span class="word-hindi">${w.hindi}</span>
          <span class="word-translit">${w.transliteration}</span>
        </div>
        <div class="word-english">${w.english}</div>
      </div>
      ${w.example_hindi ? `
      <div class="word-example">
        <span class="ex-hi">${w.example_hindi}</span>
        <span class="ex-en">${w.example_english || ''}</span>
      </div>` : ''}
      <div class="word-card-actions">
        <span class="count-tag ${w.user_status}">${w.user_status}</span>
        <button class="btn-audio btn-listen-word" data-word="${w.hindi}">🔊 Listen</button>
      </div>
    `;

    card.querySelector(".btn-listen-word").onclick = (e) => {
      e.stopPropagation();
      speakHindi(w.audio_text || w.hindi);
    };

    container.appendChild(card);
  });
}

function updateWordFlashcard() {
  const list = AppState.filteredWords;
  if (!list || list.length === 0) return;

  const idx = AppState.wordCardIndex;
  const w = list[idx];
  const card = document.getElementById("wordCard");
  card.classList.remove("flipped");

  document.getElementById("wordCardIndex").textContent = `Word ${idx + 1} of ${list.length}`;
  const pct = Math.round(((idx + 1) / list.length) * 100);
  document.getElementById("wordCardProgressBar").style.width = `${pct}%`;

  document.getElementById("wfcRank").textContent = `#${w.rank}`;
  document.getElementById("wfcHindi").textContent = w.hindi;
  document.getElementById("wfcTranslit").textContent = w.transliteration;
  document.getElementById("wfcPOS").textContent = w.part_of_speech || "word";
  document.getElementById("wfcEnglish").textContent = w.english;
  document.getElementById("wfcExHindi").textContent = w.example_hindi || "";
  document.getElementById("wfcExTranslit").textContent = w.example_transliteration || "";
  document.getElementById("wfcExEnglish").textContent = w.example_english ? `"${w.example_english}"` : "";
}

async function handleSRSReview(rating) {
  const w = AppState.filteredWords[AppState.wordCardIndex];
  if (!w) return;

  triggerHaptic(rating === "again" ? "click" : "success");

  try {
    await fetch(`/api/users/${AppState.currentUserId}/words/${w.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating })
    });
  } catch {}

  // Local offline update
  OfflineStore.saveWordProgress(AppState.currentUserId, w.id, rating);
  w.user_status = rating === "again" ? "learning" : "mastered";

  if (AppState.wordCardIndex < AppState.filteredWords.length - 1) {
    AppState.wordCardIndex++;
    updateWordFlashcard();
  } else {
    alert("अभिनंदन! (Congratulations!) Deck session complete.");
  }

  renderWordsList();
  loadDecks();
}

function updateDeckStatsHeader() {
  const current = AppState.allDecks.find(d => d.deck === AppState.currentDeck);
  if (!current) return;

  document.getElementById("currentDeckTitle").textContent = `Deck ${current.deck}: ${current.title}`;
  document.getElementById("deckMasteredCount").textContent = current.mastered;
  document.getElementById("deckLearningCount").textContent = current.learning;
  document.getElementById("deckUnseenCount").textContent = current.unseen;
}

// -----------------------------------------------------------------------------
// TAB 4: QUIZ ARENA (CLIENT & OFFLINE QUESTION GENERATOR)
// -----------------------------------------------------------------------------
const DECK_TITLES_FALLBACK = [
  "Core Pronouns & Essentials", "Foundational Daily Verbs", "Time, Directions & Adverbs",
  "Family, People & Descriptions", "Food, Groceries & Kitchen", "House, Living & Objects",
  "Body Parts, Health & Feelings", "City, Transport & Travel", "Nature, Animals & Weather",
  "Education, Study & Work", "Money, Numbers & Quantities", "Colors, Shapes & Senses",
  "Society, Culture & Festivals", "Technology & Modern Life", "Action Verbs & Routine",
  "Thoughts, Logic & Values", "Environment & Geography", "Safety, Law & Agriculture",
  "Advanced Connectors & Phrases", "Wisdom, Sayings & Expressions"
];

async function ensureStaticWordsLoaded() {
  if (AppState.allStaticWords && AppState.allStaticWords.length >= 1000) {
    return AppState.allStaticWords;
  }
  try {
    let res = await fetch("./words.json");
    if (!res.ok) res = await fetch("/static/words.json");
    if (res.ok) {
      AppState.allStaticWords = await res.json();
      return AppState.allStaticWords;
    }
  } catch (e) {
    console.warn("ensureStaticWordsLoaded:", e);
  }
  return AppState.deckWords || [];
}

function populateQuizDeckSelectors() {
  const quizDeckSel = document.getElementById("quizDeckSelect");
  const chipsBox = document.getElementById("quizDeckChips");

  if (quizDeckSel) {
    quizDeckSel.innerHTML = "";

    // 1. ALL DECKS COMBINED (Default Option)
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.selected = true;
    optAll.textContent = "🌟 All Decks Combined (Decks 1–20 • 1000 Words Mixed)";
    quizDeckSel.appendChild(optAll);

    // 2. Individual Decks 1 to 20
    for (let i = 1; i <= 20; i++) {
      const opt = document.createElement("option");
      opt.value = i;
      const title = (AppState.allDecks && AppState.allDecks[i - 1])
        ? AppState.allDecks[i - 1].title
        : (DECK_TITLES_FALLBACK[i - 1] || `Deck ${i}`);
      const range = `${(i - 1) * 50 + 1}–${i * 50}`;
      opt.textContent = `Deck ${i}: ${title} (${range})`;
      quizDeckSel.appendChild(opt);
    }

    quizDeckSel.onchange = () => {
      triggerHaptic("click");
      syncQuizDeckChips(quizDeckSel.value);
    };
  }

  if (chipsBox) {
    chipsBox.innerHTML = "";

    const chipAll = document.createElement("button");
    chipAll.type = "button";
    chipAll.className = "quiz-chip active";
    chipAll.dataset.deck = "all";
    chipAll.innerHTML = "🌟 All Decks (1000)";
    chipAll.onclick = () => selectQuizDeckChip("all");
    chipsBox.appendChild(chipAll);

    for (let i = 1; i <= 20; i++) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "quiz-chip";
      chip.dataset.deck = i;
      chip.textContent = `Deck ${i}`;
      chip.onclick = () => selectQuizDeckChip(i);
      chipsBox.appendChild(chip);
    }
  }

  syncQuizDeckChips("all");
}

function selectQuizDeckChip(deckValue) {
  triggerHaptic("click");
  const quizDeckSel = document.getElementById("quizDeckSelect");
  if (quizDeckSel) {
    quizDeckSel.value = deckValue;
  }
  syncQuizDeckChips(deckValue);
}

function syncQuizDeckChips(deckValue) {
  document.querySelectorAll(".quiz-chip").forEach(c => {
    c.classList.toggle("active", c.dataset.deck == deckValue);
  });
  const indicator = document.getElementById("deckSelectionIndicator");
  if (indicator) {
    if (deckValue === "all" || !deckValue) {
      indicator.textContent = "🌟 All 20 Decks Active (1000 Words)";
      indicator.className = "deck-selection-indicator all-active";
    } else {
      const title = (AppState.allDecks && AppState.allDecks[deckValue - 1])
        ? AppState.allDecks[deckValue - 1].title
        : (DECK_TITLES_FALLBACK[deckValue - 1] || `Deck ${deckValue}`);
      indicator.textContent = `Deck ${deckValue}: ${title}`;
      indicator.className = "deck-selection-indicator single-active";
    }
  }
}

function setupQuizEngine() {
  document.querySelectorAll(".quiz-option-card").forEach(card => {
    card.addEventListener("click", () => {
      triggerHaptic("click");
      document.querySelectorAll(".quiz-option-card").forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      AppState.activeQuizType = card.dataset.type;

      const isWords = AppState.activeQuizType === "words";
      const deckField = document.getElementById("quizDeckField");
      if (deckField) deckField.style.display = isWords ? "flex" : "none";

      const chipsBox = document.getElementById("quizDeckChipsContainer");
      if (chipsBox) chipsBox.style.display = isWords ? "block" : "none";

      const letterField = document.getElementById("quizLetterField");
      if (letterField) letterField.style.display = isWords ? "none" : "flex";
    });
  });

  populateQuizDeckSelectors();

  document.getElementById("btnStartQuiz").addEventListener("click", startQuiz);
  document.getElementById("btnNextQuizQuestion").addEventListener("click", nextQuizQuestion);
  document.getElementById("btnRestartQuiz").addEventListener("click", () => {
    triggerHaptic("click");
    document.getElementById("quizResultScreen").style.display = "none";
    document.getElementById("quizSetupScreen").style.display = "block";
  });
  document.getElementById("btnViewDashboardFromQuiz").addEventListener("click", () => {
    switchTab("dashboard");
  });

  document.getElementById("btnQuizPlayAudio").addEventListener("click", () => {
    const q = AppState.quizQuestions[AppState.currentQuizIndex];
    if (q) speakHindi(q.audio_text || q.target_char || q.hindi);
  });
}

async function startQuiz() {
  triggerHaptic("click");
  const count = parseInt(document.getElementById("quizQuestionCount").value) || 10;
  const deckVal = document.getElementById("quizDeckSelect") ? document.getElementById("quizDeckSelect").value : "all";
  const isAllDecks = !deckVal || deckVal === "all" || deckVal === "0";
  const deck = isAllDecks ? null : parseInt(deckVal, 10);
  const letterCat = document.getElementById("quizLetterCategorySelect") ? document.getElementById("quizLetterCategorySelect").value : "all";

  if (AppState.activeQuizType === "words") {
    await ensureStaticWordsLoaded();
  }

  let loaded = false;
  let url = AppState.activeQuizType === "letters"
    ? `/api/letters/quiz?count=${count}${letterCat !== "all" ? `&category=${letterCat}` : ""}`
    : (deck ? `/api/words/quiz?count=${count}&deck=${deck}` : `/api/words/quiz?count=${count}`);

  try {
    const res = await fetch(url);
    if (res.ok) {
      AppState.quizQuestions = await res.json();
      if (AppState.quizQuestions && AppState.quizQuestions.length > 0) {
        loaded = true;
      }
    }
  } catch {}

  // Generate offline quiz client-side if API is unavailable or offline
  if (!loaded || !AppState.quizQuestions || AppState.quizQuestions.length === 0) {
    AppState.quizQuestions = generateClientQuiz(
      AppState.activeQuizType,
      count,
      isAllDecks ? "all" : deck,
      letterCat
    );
  }

  if (!AppState.quizQuestions || AppState.quizQuestions.length === 0) {
    alert("Could not prepare quiz questions. Please make sure data is loaded.");
    return;
  }

  AppState.currentQuizIndex = 0;
  AppState.quizScore = 0;
  AppState.quizAnswered = false;

  document.getElementById("quizSetupScreen").style.display = "none";
  document.getElementById("quizPlayScreen").style.display = "block";
  document.getElementById("quizResultScreen").style.display = "none";

  renderCurrentQuizQuestion();
}

function generateClientQuiz(type, count, deck, letterCategory = "all") {
  const questions = [];

  if (type === "letters") {
    let letters = [...AppState.allLetters];
    if (letterCategory && letterCategory !== "all") {
      const filtered = letters.filter(l => l.category === letterCategory);
      if (filtered.length >= 4) {
        letters = filtered;
      }
    }
    if (letters.length < 4) return [];

    const shuffledTargets = [...letters];
    shuffleArray(shuffledTargets);
    const selected = shuffledTargets.slice(0, Math.min(count, letters.length));

    for (let i = 0; i < selected.length; i++) {
      const target = selected[i];
      const otherLetters = letters.filter(l => l.id !== target.id);
      shuffleArray(otherLetters);
      const distractors = otherLetters.slice(0, 3);

      const qType = Math.random() > 0.4 ? "char_to_translit" : "audio_meaning";
      if (qType === "char_to_translit") {
        const options = shuffleArray([target.transliteration, ...distractors.map(d => d.transliteration)]);
        questions.push({
          type: "char_to_translit",
          question: `What is the pronunciation of this Devanagari character?`,
          target_char: target.char,
          audio_text: target.audio_text || target.char,
          options,
          correct_answer: target.transliteration,
          category: target.category
        });
      } else {
        const options = shuffleArray([target.char, ...distractors.map(d => d.char)]);
        questions.push({
          type: "audio_meaning",
          question: `Listen carefully: Which character is spoken?`,
          audio_text: target.audio_text || target.char,
          options,
          correct_answer: target.char,
          category: target.category
        });
      }
    }
  } else {
    // Words quiz
    let wordsSource = AppState.allStaticWords;
    if (!wordsSource || wordsSource.length === 0) {
      wordsSource = AppState.deckWords || [];
    }
    if (!wordsSource || wordsSource.length === 0) return [];

    const isAll = !deck || deck === "all" || deck === 0;
    const pool = isAll ? wordsSource : wordsSource.filter(w => w.deck === Number(deck));
    if (pool.length < 4) return [];

    const shuffledPool = [...pool];
    shuffleArray(shuffledPool);
    const selectedTargets = shuffledPool.slice(0, Math.min(count, pool.length));

    for (let i = 0; i < selectedTargets.length; i++) {
      const target = selectedTargets[i];
      const others = wordsSource.filter(w => w.id !== target.id);
      shuffleArray(others);
      const distractors = others.slice(0, 3);

      const roll = Math.random();
      if (roll < 0.35) {
        // Hindi -> English meaning
        const options = shuffleArray([target.english, ...distractors.map(d => d.english)]);
        questions.push({
          type: "word_meaning",
          question: `What does the word "${target.hindi}" (${target.transliteration}) mean?`,
          hindi: target.hindi,
          audio_text: target.audio_text || target.hindi,
          options,
          correct_answer: target.english,
          deck: target.deck
        });
      } else if (roll < 0.70) {
        // English -> Hindi
        const options = shuffleArray([
          `${target.hindi} (${target.transliteration})`,
          ...distractors.map(d => `${d.hindi} (${d.transliteration})`)
        ]);
        questions.push({
          type: "word_translation",
          question: `Which Hindi word corresponds to: "${target.english}"?`,
          audio_text: target.audio_text || target.hindi,
          options,
          correct_answer: `${target.hindi} (${target.transliteration})`,
          deck: target.deck
        });
      } else {
        // Audio listening test
        const options = shuffleArray([
          `${target.hindi} (${target.english})`,
          ...distractors.map(d => `${d.hindi} (${d.english})`)
        ]);
        questions.push({
          type: "audio_meaning",
          question: `Listen to the pronunciation: Which word was spoken?`,
          audio_text: target.audio_text || target.hindi,
          options,
          correct_answer: `${target.hindi} (${target.english})`,
          deck: target.deck
        });
      }
    }
  }

  return questions;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderCurrentQuizQuestion() {
  const q = AppState.quizQuestions[AppState.currentQuizIndex];
  const total = AppState.quizQuestions.length;
  AppState.quizAnswered = false;

  document.getElementById("quizQuestionNumber").textContent = `Question ${AppState.currentQuizIndex + 1} of ${total}`;
  document.getElementById("quizCurrentScore").textContent = AppState.quizScore;
  
  let headerHtml = q.question;
  if (q.deck) {
    headerHtml = `<span class="quiz-deck-tag">🎴 Deck ${q.deck}</span> ` + headerHtml;
  } else if (q.category) {
    headerHtml = `<span class="quiz-deck-tag">🔤 ${q.category}</span> ` + headerHtml;
  }
  document.getElementById("quizQuestionTitle").innerHTML = headerHtml;
  document.getElementById("btnNextQuizQuestion").style.display = "none";

  const feedbackBox = document.getElementById("quizFeedbackBox");
  feedbackBox.style.display = "none";

  const targetCharEl = document.getElementById("quizTargetChar");
  const audioPrompt = document.getElementById("quizAudioPrompt");

  if (q.target_char && q.type === "char_to_translit") {
    targetCharEl.textContent = q.target_char;
    targetCharEl.style.display = "block";
    audioPrompt.style.display = "none";
  } else if (q.type === "audio_meaning") {
    targetCharEl.style.display = "none";
    audioPrompt.style.display = "block";
    speakHindi(q.audio_text || q.hindi);
  } else {
    targetCharEl.style.display = "none";
    audioPrompt.style.display = "none";
  }

  const container = document.getElementById("quizOptionsContainer");
  container.innerHTML = "";

  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "quiz-btn-option";
    btn.textContent = opt;
    btn.onclick = () => handleQuizOptionClick(btn, opt, q.correct_answer);
    container.appendChild(btn);
  });
}

function handleQuizOptionClick(selectedBtn, chosenAnswer, correctAnswer) {
  if (AppState.quizAnswered) return;
  AppState.quizAnswered = true;

  const isCorrect = chosenAnswer === correctAnswer;
  const feedbackBox = document.getElementById("quizFeedbackBox");

  document.querySelectorAll(".quiz-btn-option").forEach(btn => {
    if (btn.textContent === correctAnswer) {
      btn.classList.add("correct");
    } else if (btn === selectedBtn && !isCorrect) {
      btn.classList.add("incorrect");
    }
  });

  if (isCorrect) {
    triggerHaptic("success");
    AppState.quizScore++;
    document.getElementById("quizCurrentScore").textContent = AppState.quizScore;
    feedbackBox.className = "quiz-feedback-box correct";
    feedbackBox.innerHTML = `<strong>✓ सही है! (Correct!)</strong> Great job!`;
  } else {
    triggerHaptic("error");
    feedbackBox.className = "quiz-feedback-box incorrect";
    feedbackBox.innerHTML = `<strong>✗ गलत (Incorrect)</strong> The correct answer is: <em>${correctAnswer}</em>`;
  }

  feedbackBox.style.display = "block";
  document.getElementById("btnNextQuizQuestion").style.display = "inline-flex";
}

async function nextQuizQuestion() {
  triggerHaptic("click");
  if (AppState.currentQuizIndex < AppState.quizQuestions.length - 1) {
    AppState.currentQuizIndex++;
    renderCurrentQuizQuestion();
  } else {
    // Finish Quiz
    document.getElementById("quizPlayScreen").style.display = "none";
    document.getElementById("quizResultScreen").style.display = "block";

    const total = AppState.quizQuestions.length;
    const score = AppState.quizScore;
    const pct = Math.round((score / total) * 100);

    document.getElementById("resultScoreText").textContent = `${score} / ${total}`;
    document.getElementById("resultPercentText").textContent = `${pct}% Accuracy`;

    let message = "बहुत बढ़िया! (Very good! Keep practicing!)";
    if (pct >= 90) message = "अद्भुत! (Exceptional performance! Master level!)";
    else if (pct < 60) message = "अभ्यास करते रहिए! (Keep practicing, you will improve!)";
    document.getElementById("resultEncouragement").textContent = message;

    // Log to backend if available
    try {
      await fetch(`/api/users/${AppState.currentUserId}/quiz-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_type: AppState.activeQuizType === "letters" ? "letter_quiz" : "word_quiz",
          total_questions: total,
          correct_answers: score
        })
      });
    } catch {}

    // Offline quiz log
    OfflineStore.saveQuizLog(AppState.currentUserId, AppState.activeQuizType === "letters" ? "letter_quiz" : "word_quiz", total, score);
  }
}

// -----------------------------------------------------------------------------
// TAB 5: DASHBOARD & ANALYTICS
// -----------------------------------------------------------------------------
async function updateDashboard() {
  let data = null;
  try {
    const res = await fetch(`/api/users/${AppState.currentUserId}/stats`);
    if (res.ok) data = await res.json();
  } catch {}

  // Compute local stats if offline
  if (!data) {
    const letterProg = OfflineStore.getLetterProgress(AppState.currentUserId);
    const wordProg = OfflineStore.getWordProgress(AppState.currentUserId);
    const quizLogs = OfflineStore.getQuizLogs(AppState.currentUserId);

    let lettersMastered = 0;
    let lettersLearned = 0;
    let lettersDrawn = 0;
    Object.values(letterProg).forEach(p => {
      if (p.status === "mastered") lettersMastered++;
      if (p.status === "learning") lettersLearned++;
      if (p.times_drawn) lettersDrawn += p.times_drawn;
    });

    let wordsMastered = 0;
    let wordsLearning = 0;
    Object.values(wordProg).forEach(p => {
      if (p.status === "mastered") wordsMastered++;
      if (p.status === "learning") wordsLearning++;
    });

    let totalQ = 0;
    let correctQ = 0;
    quizLogs.forEach(l => {
      totalQ += l.total;
      correctQ += l.correct;
    });

    const accuracy = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : 0;

    data = {
      user: { streak: 1 },
      letters: {
        total: AppState.allLetters.length || 79,
        mastered: lettersMastered,
        learned: lettersLearned,
        times_drawn: lettersDrawn
      },
      words: {
        total: 1000,
        mastered: wordsMastered,
        learning: wordsLearning,
        unseen: Math.max(0, 1000 - wordsMastered - wordsLearning)
      },
      quizzes: {
        total_questions: totalQ,
        correct_questions: correctQ,
        sessions: quizLogs.length,
        accuracy_percent: accuracy
      }
    };
  }

  // Letters stats
  document.getElementById("dashLettersMastered").textContent = data.letters.mastered;
  const letPct = Math.round((data.letters.mastered / data.letters.total) * 100) || 0;
  document.getElementById("dashLettersBar").style.width = `${letPct}%`;
  document.getElementById("dashLettersDetail").textContent =
    `${data.letters.learned} in learning • ${data.letters.times_drawn} stroke practices`;

  // Words stats
  document.getElementById("dashWordsMastered").textContent = data.words.mastered;
  const wordPct = Math.round((data.words.mastered / data.words.total) * 100) || 0;
  document.getElementById("dashWordsBar").style.width = `${wordPct}%`;
  document.getElementById("dashWordsDetail").textContent =
    `${data.words.learning} in active learning • ${data.words.unseen} to discover`;

  // Quizzes stats
  document.getElementById("dashQuizAccuracy").textContent = `${data.quizzes.accuracy_percent}%`;
  document.getElementById("dashQuizDetail").textContent =
    `${data.quizzes.correct_questions} of ${data.quizzes.total_questions} correct across ${data.quizzes.sessions} sessions`;

  document.getElementById("dashStreak").textContent = data.user.streak || 1;

  // Render decks overview table
  const tableBody = document.querySelector("#dashDecksTable tbody");
  tableBody.innerHTML = "";

  AppState.allDecks.forEach(d => {
    const tr = document.createElement("tr");
    const pct = Math.round((d.mastered / d.total_words) * 100) || 0;
    tr.innerHTML = `
      <td><strong>Deck ${d.deck}</strong></td>
      <td>${d.title}</td>
      <td>${d.range}</td>
      <td><span class="count-tag mastered">${d.mastered}</span></td>
      <td><span class="count-tag learning">${d.learning}</span></td>
      <td style="width: 140px;">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <small>${pct}%</small>
      </td>
      <td>
        <button class="btn-outline btn-study-deck" data-deck="${d.deck}">Study</button>
      </td>
    `;

    tr.querySelector(".btn-study-deck").onclick = () => {
      triggerHaptic("click");
      AppState.currentDeck = d.deck;
      document.getElementById("deckSelect").value = d.deck;
      loadWordsForCurrentDeck();
      switchTab("words");
    };

    tableBody.appendChild(tr);
  });
}
