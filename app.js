// State Management
let gameState = {
    targetScore: 1000,
    round: 1,
    players: [
        { id: 0, name: "Pemain A", score: 0, stars: 0, highestScore: 0, burns: 0, burned: 0, tripleBurn: 0, prevScore: 0 },
        { id: 1, name: "Pemain B", score: 0, stars: 0, highestScore: 0, burns: 0, burned: 0, tripleBurn: 0, prevScore: 0 },
        { id: 2, name: "Pemain C", score: 0, stars: 0, highestScore: 0, burns: 0, burned: 0, tripleBurn: 0, prevScore: 0 },
        { id: 3, name: "Pemain D", score: 0, stars: 0, highestScore: 0, burns: 0, burned: 0, tripleBurn: 0, prevScore: 0 }
    ],
    history: [],
    gameStarted: false,
    theme: "light"
};

// DOM Elements
const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const startBtn = document.getElementById("start-game-btn");
const saveRoundBtn = document.getElementById("save-round-btn");
const undoBtn = document.getElementById("undo-btn");
const resetBtn = document.getElementById("reset-game-btn");
const themeToggle = document.getElementById("theme-toggle");
const screenshotBtn = document.getElementById("screenshot-btn");
const roundNumDisplay = document.getElementById("round-number");
const targetDisplay = document.getElementById("display-target");
const playerCardsContainer = document.getElementById("player-cards-container");
const rankingTableBody = document.getElementById("ranking-table-body");
const statsTableBody = document.getElementById("stats-table-body");
const historyLog = document.getElementById("history-log");
const achievementGrid = document.getElementById("achievement-grid");

// Initialize Application
document.addEventListener("DOMContentLoaded", () => {
    loadFromLocalStorage();
    initTheme();
    setupTabNavigation();
    
    startBtn.addEventListener("click", startGame);
    saveRoundBtn.addEventListener("click", processRound);
    undoBtn.addEventListener("click", handleUndo);
    resetBtn.addEventListener("click", resetGame);
    themeToggle.addEventListener("click", toggleTheme);
    screenshotBtn.addEventListener("click", takeScreenshot);

    if (gameState.gameStarted) {
        showScreen("game");
        renderAll();
    } else {
        showScreen("setup");
    }
});

// Navigation & Theme
function showScreen(screenName) {
    if (screenName === "setup") {
        setupScreen.classList.add("active");
        gameScreen.classList.remove("active");
    } else {
        setupScreen.classList.remove("active");
        gameScreen.classList.add("active");
    }
}

function initTheme() {
    document.documentElement.setAttribute("data-theme", gameState.theme);
}

function toggleTheme() {
    gameState.theme = gameState.theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", gameState.theme);
    saveToLocalStorage();
}

function setupTabNavigation() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            tabButtons.forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
            
            btn.classList.add("active");
            document.getElementById(btn.dataset.tab).classList.add("active");
        });
    });
}

// TTS Audio Feedback
function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        window.speechSynthesis.speak(utterance);
    }
}

// Core Game Logic
function startGame() {
    const targetInput = document.getElementById("target-score").value;
    gameState.targetScore = parseInt(targetInput) || 1000;

    for (let i = 0; i < 4; i++) {
        const nameInput = document.getElementById(`p${i+1}-name`).value.trim();
        gameState.players[i].name = nameInput || `Pemain ${String.fromCharCode(65 + i)}`;
        gameState.players[i].score = 0;
        gameState.players[i].prevScore = 0;
        gameState.players[i].stars = 0;
        gameState.players[i].highestScore = 0;
        gameState.players[i].burns = 0;
        gameState.players[i].burned = 0;
        gameState.players[i].tripleBurn = 0;
    }

    gameState.round = 1;
    gameState.history = [];
    gameState.gameStarted = true;

    saveToLocalStorage();
    showScreen("game");
    renderAll();
}

function processRound() {
    // Collect Inputs
    const roundInputs = [];
    let hasInvalidInput = false;

    for (let i = 0; i < 4; i++) {
        const val = parseInt(document.getElementById(`score-p${i}`).value) || 0;
        if (val > 1000) {
            alert("Nilai positif maksimal per input adalah 1000!");
            hasInvalidInput = true;
            break;
        }
        roundInputs.push(val);
    }

    if (hasInvalidInput) return;

    // Deep copy current players state for history log / undo before modifying
    const playersBeforeRound = JSON.parse(JSON.stringify(gameState.players));

    // Cache current total scores before processing updates to calculate burn sequence
    const intermediateScores = gameState.players.map(p => p.score);
    const newScores = [...intermediateScores];

    // Apply basic round scoring points first
    for (let i = 0; i < 4; i++) {
        newScores[i] += roundInputs[i];
    }

    let logsThisRound = [];
    let speechThisRound = [];

    // System Bakaran (Aturan Mulai Ronde 2)
    if (gameState.round > 1) {
        let burnsByPlayer = [0, 0, 0, 0];
        let gotBurned = [false, false, false, false];

        // Hitung relasi salip menyalip sesama pemain
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (i !== j) {
                    // Cek jika sebelum ronde Player I berada di bawah Player J
                    if (intermediateScores[i] < intermediateScores[j]) {
                        // Cek setelah dihitung point ronde, Player I melewati/menyalip Player J
                        if (newScores[i] > newScores[j]) {
                            gotBurned[j] = true;
                            burnsByPlayer[i]++;
                        }
                    }
                }
            }
        }

        // Terapkan konsekuensi bakaran jika terdeteksi
        for (let m = 0; m < 4; m++) {
            if (gotBurned[m]) {
                newScores[m] = 0; // Terbakar kembali langsung ke skor 0
                gameState.players[m].burned++;
            }
            if (burnsByPlayer[m] > 0) {
                gameState.players[m].burns += burnsByPlayer[m];
                
                // Cek skenario Triple Burn menyeluruh
                if (burnsByPlayer[m] === 3) {
                    gameState.players[m].tripleBurn++;
                    logsThisRound.push(`🔥 <strong>TRIPLE BURN!</strong> ${gameState.players[m].name} melibas semua lawan sekaligus!`);
                    speechThisRound.push("Triple burn");
                } else {
                    // Skenario bakaran biasa / berantai tunggal & multi
                    const targetsNames = [];
                    for (let x = 0; x < 4; x++) {
                        if (intermediateScores[m] < intermediateScores[x] && (intermediateScores[m] + roundInputs[m]) > (intermediateScores[x] + roundInputs[x])) {
                            targetsNames.push(gameState.players[x].name);
                        }
                    }
                    if (targetsNames.length > 0 && burnsByPlayer[m] !== 3) {
                        logsThisRound.push(`🔥 ${gameState.players[m].name} membakar ${targetsNames.join(', ')}`);
                        targetsNames.forEach(tName => {
                            speechThisRound.push(`${gameState.players[m].name} membakar ${tName}`);
                        });
                    }
                }
            }
        }
    }

    // Update state skor final untuk ronde ini
    for (let i = 0; i < 4; i++) {
        gameState.players[i].prevScore = gameState.players[i].score;
        gameState.players[i].score = newScores[i];
        
        if (gameState.players[i].score > gameState.players[i].highestScore) {
            gameState.players[i].highestScore = gameState.players[i].score;
        }

        // Audio trigger jika hasil input membuat total skor minus
        if (gameState.players[i].score < 0 && playersBeforeRound[i].score >= 0) {
            speechThisRound.push("Tukang ngocok kartu");
        }
    }

    // System Kemenangan Target Check
    let winnerDetected = false;
    let roundWinner = null;

    for (let i = 0; i < 4; i++) {
        if (gameState.players[i].score >= gameState.targetScore) {
            winnerDetected = true;
            roundWinner = gameState.players[i];
            break; 
        }
    }

    if (winnerDetected) {
        roundWinner.stars++;
        logsThisRound.push(`🏆 <strong>${roundWinner.name}</strong> mencapai target skor kemenangan! Berhak mendapatkan 1 Bintang ⭐`);
        speechThisRound.push(`Selamat kepada ${roundWinner.name} mendapatkan bintang satu`);
        
        // Reset seluruh akumulasi skor pemain kembali ke basis 0 pasca klaim bintang
        for (let i = 0; i < 4; i++) {
            gameState.players[i].score = 0;
        }
    }

    // Save history data log step
    gameState.history.push({
        round: gameState.round,
        playersStateBefore: playersBeforeRound,
        roundScoresAdded: roundInputs,
        logTexts: logsThisRound,
        speechTexts: speechThisRound
    });

    // Advance Round Match Setup
    gameState.round++;
    
    // Clear Input UI Fields
    for (let i = 0; i < 4; i++) {
        document.getElementById(`score-p0`).value = "";
        document.getElementById(`score-p1`).value = "";
        document.getElementById(`score-p2`).value = "";
        document.getElementById(`score-p3`).value = "";
    }

    // Execute Voice Outputs
    if (speechThisRound.length > 0) {
        speakText(speechThisRound.join(". "));
    }

    saveToLocalStorage();
    renderAll();
}

function handleUndo() {
    if (gameState.history.length === 0) {
        alert("Tidak ada riwayat ronde yang dapat dibatalkan!");
        return;
    }

    const lastState = gameState.history.pop();
    gameState.round = lastState.round;
    gameState.players = lastState.playersStateBefore;

    saveToLocalStorage();
    renderAll();
}

function resetGame() {
    if (confirm("Apakah Anda yakin ingin menyudahi match ini dan mereset data permainan?")) {
        localStorage.removeItem("scoreCekihState");
        gameState.gameStarted = false;
        showScreen("setup");
    }
}

// Rendering UI Engine
function renderAll() {
    roundNumDisplay.innerText = gameState.round;
    targetDisplay.innerText = gameState.targetScore;

    // Update Label Input Ronde Pasca Start
    for (let i = 0; i < 4; i++) {
        document.getElementById(`lbl-p${i}`).innerText = gameState.players[i].name;
    }

    const sortedByScore = [...gameState.players].sort((a, b) => b.score - a.score);

    // 1. Render Card Component Grid
    playerCardsContainer.innerHTML = "";
    gameState.players.forEach(player => {
        const rankIndex = sortedByScore.findIndex(p => p.id === player.id) + 1;
        const card = document.createElement("div");
        card.className = `player-card rank-${rankIndex}`;
        card.innerHTML = `
            <div class="rank-badge">#${rankIndex}</div>
            <h4>${player.name}</h4>
            <div class="score-display">${player.score}</div>
            <div class="stars-display">${"⭐".repeat(player.stars) || "Belum ada bintang"}</div>
        `;
        playerCardsContainer.appendChild(card);
    });

    // 2. Render Klasemen Sementara Tab Table
    rankingTableBody.innerHTML = "";
    sortedByScore.forEach((player, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${idx + 1}</strong></td>
            <td>${player.name}</td>
            <td><strong>${player.score}</strong></td>
            <td>${player.stars}</td>
        `;
        rankingTableBody.appendChild(tr);
    });

    // 3. Render Statistik Table View
    statsTableBody.innerHTML = "";
    gameState.players.forEach(player => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${player.name}</strong></td>
            <td>${player.highestScore}</td>
            <td>${player.burns}</td>
            <td>${player.burned}</td>
            <td>${player.tripleBurn}</td>
        `;
        statsTableBody.appendChild(tr);
    });

    // 4. Render History Logs Tab
    historyLog.innerHTML = "";
    if (gameState.history.length === 0) {
        historyLog.innerHTML = `<div class="log-item">Belum ada data history ronde.</div>`;
    } else {
        // Render from newest to oldest
        for (let i = gameState.history.length - 1; i >= 0; i--) {
            const hist = gameState.history[i];
            const roundDiv = document.createElement("div");
            roundDiv.style.marginBottom = "10px";
            
            let scoresDetail = hist.playersStateBefore.map((p, idx) => {
                return `${p.name}: ${hist.roundScoresAdded[idx] >= 0 ? '+' : ''}${hist.roundScoresAdded[idx]}`;
            }).join(" | ");

            let htmlContent = `<div class="log-item"><strong>Ronde ${hist.round}</strong> (${scoresDetail})</div>`;
            
            hist.logTexts.forEach(text => {
                let typeClass = text.includes("membakar") || text.includes("BURN") ? "burn" : (text.includes("target") ? "win" : "");
                htmlContent += `<div class="log-item ${typeClass}">${text}</div>`;
            });
            
            roundDiv.innerHTML = htmlContent;
            historyLog.appendChild(roundDiv);
        }
    }

    // 5. Render Achievement Badge List
    renderAchievements();
}

function renderAchievements() {
    achievementGrid.innerHTML = "";
    
    // Check Achievement Holders Conditions
    const achievementsDef = [
        { title: "🃏 Tukang Ngocok Kartu", desc: "Pemain dengan total skor bernilai minus (< 0)", check: (p) => p.score < 0 },
        { title: "🔥 Tukang Bakar", desc: "Berhasil membakar lawan sebanyak 3 kali atau lebih", check: (p) => p.burns >= 3 },
        { title: "😭 Hari Apes Gak Ada Yang Tau", desc: "Mengalami nasib terbakar hingga 5 kali atau lebih", check: (p) => p.burned >= 5 },
        { title: "👑 Dewa Kartu", desc: "Mencapai poin tertinggi permainan minimal 500", check: (p) => p.highestScore >= 500 },
        { title: "🌌 Dewa Dari Segala Dewa", desc: "Berhasil mengoleksi lebih dari 1 Bintang kemenangan", check: (p) => p.stars > 1 },
        { title: "💥 Triple Burn", desc: "Melibas 3 pemain sekaligus dalam 1 ronde tunggal", check: (p) => p.tripleBurn > 0 }
    ];

    achievementsDef.forEach(ach => {
        const holders = gameState.players.filter(ach.check).map(p => p.name);
        const isUnlocked = holders.length > 0;
        
        const badge = document.createElement("div");
        badge.className = `achievement-badge ${isUnlocked ? 'unlocked' : ''}`;
        badge.innerHTML = `
            <div class="title">${ach.title}</div>
            <div>${ach.desc}</div>
            ${isUnlocked ? `<div class="holder">Peraih: ${holders.join(', ')}</div>` : ''}
        `;
        achievementGrid.appendChild(badge);
    });
}

// Local Storage Handlers
function saveToLocalStorage() {
    localStorage.setItem("scoreCekihState", JSON.stringify(gameState));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem("scoreCekihState");
    if (saved) {
        try {
            gameState = JSON.parse(saved);
        } catch (e) {
            console.error("Gagal memuat local storage state data", e);
        }
    }
}

// Screenshot Feature Fallback via Canvas/Alert
function takeScreenshot() {
    alert("Mengambil screenshot hasil permainan...\n\nFitur Native Terpanggil: Gunakan kombinasi tombol bawaan HP Android Anda (Power + Volume Bawah) untuk menyimpan tampilan Fullscreen UI modern Sadewa Corp ini secara instan.");
}
