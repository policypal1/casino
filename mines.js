/* Brainrot Mines — 5x5, variable mines, fair combinatoric multipliers with house edge */
const wait = (ms)=> new Promise(r=>setTimeout(r, ms));
const round3 = (n)=> Math.round((n + Number.EPSILON) * 1000) / 1000;
const fmtTok = (n)=> {
  const s = (round3(n)).toFixed(3);
  return s.replace(/\.?0+$/,'');
};

(() => {
  // ===== CONFIG =====
  const BOARD_SIZE = 25;   // 5x5
  const COLS = 5;
  const HOUSE_EDGE = 0.97; // overall RTP factor (1.00 = no edge). Tune as you like.

  // ===== STATE =====
  const USERS = ["Will","Isaac","Faisal","Muhammed"];
  const STORE = "brainrot-mines-v1";
  const baseUser = ()=>({ tokens:0, earned:0, spent:0 });
  function load(){
    try{
      const raw = JSON.parse(localStorage.getItem(STORE)||"{}");
      for(const u of USERS) if(!raw[u]) raw[u]=baseUser();
      return raw;
    }catch{ return Object.fromEntries(USERS.map(u=>[u,baseUser()])); }
  }
  let stats = load();
  function save(){ localStorage.setItem(STORE, JSON.stringify(stats)); }

  let currentUser = USERS.includes(localStorage.getItem("br-user")) ? localStorage.getItem("br-user") : "Will";

  // round state
  let roundActive = false;
  let mines = new Set();        // indices with bombs
  let revealedSafe = 0;         // number of safe hits
  let chosenMines = 3;          // UI-selected mines
  let bet = 0.50;

  // ===== DOM =====
  const userSelect = document.getElementById("userSelect");
  const tokenBalanceEl = document.getElementById("tokenBalance");
  const betInput = document.getElementById("betInput");
  const mineCount = document.getElementById("mineCount");
  const mineCountVal = document.getElementById("mineCountVal");
  const revealedCount = document.getElementById("revealedCount");
  const multiplierEl = document.getElementById("multiplier");
  const cashoutValueEl = document.getElementById("cashoutValue");
  const messageEl = document.getElementById("message");
  const boardEl = document.getElementById("board");
  const startBtn = document.getElementById("startBtn");
  const cashoutBtn = document.getElementById("cashoutBtn");
  const resetBtn = document.getElementById("resetBtn");

  const adminToggle = document.getElementById("adminToggle");
  const adminPanel = document.getElementById("adminPanel");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminAdd = document.getElementById("adminAdd");
  const adminGive = document.getElementById("adminGive");
  const closeAdmin = document.getElementById("closeAdmin");

  // ===== INIT =====
  userSelect.value = currentUser;
  mineCountVal.textContent = mineCount.value;
  renderBalance();
  syncBet();
  buildBoard();
  updateRoundUI();

  // ===== HELPERS =====
  function renderBalance(){
    const bal = stats[currentUser]?.tokens || 0;
    tokenBalanceEl.textContent = `${fmtTok(bal)}🪙`;
  }
  function syncBet(){
    const v = Number(betInput.value)||0.5;
    bet = Math.max(0.01, round3(v));
    betInput.value = String(bet);
  }
  function setMessage(msg){ messageEl.textContent = msg || ""; }

  function buildBoard(){
    boardEl.innerHTML = "";
    for(let i=0;i<BOARD_SIZE;i++){
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.type = "button";
      cell.dataset.idx = String(i);
      cell.addEventListener("click", onCellClick);
      boardEl.appendChild(cell);
    }
  }

  function sampleMines(count){
    const picks = new Set();
    while(picks.size < count){
      picks.add(Math.floor(Math.random()*BOARD_SIZE));
    }
    return picks;
  }

  // Combinatoric fair multiplier:
  // Each safe reveal multiplies by (remaining cells) / (remaining safe cells).
  // Overall multiply by HOUSE_EDGE.
  function currentMultiplier(revealed, totalMines){
    if (revealed<=0) return 1.0;
    let mult = 1.0;
    for (let i=0;i<revealed;i++){
      const remaining = BOARD_SIZE - i;
      const remainingSafe = (BOARD_SIZE - totalMines) - i;
      mult *= remaining / remainingSafe;
    }
    return mult * HOUSE_EDGE;
  }

  function updateRoundUI(){
    revealedCount.textContent = String(revealedSafe);
    const mult = currentMultiplier(revealedSafe, chosenMines);
    multiplierEl.textContent = `${mult.toFixed(2)}×`;
    const cashVal = revealedSafe>0 ? round3(bet * mult) : 0;
    cashoutValueEl.textContent = `${fmtTok(cashVal)}🪙`;

    // buttons
    startBtn.disabled = roundActive;
    resetBtn.disabled = !roundActive;
    cashoutBtn.disabled = !(roundActive && revealedSafe>0);
    mineCount.disabled = roundActive;
    betInput.disabled = roundActive;
    userSelect.disabled = roundActive;
  }

  function endRound(win){
    roundActive = false;
    if (win > 0){
      stats[currentUser].tokens = round3((stats[currentUser].tokens||0) + win);
      stats[currentUser].earned = round3((stats[currentUser].earned||0) + win);
      setMessage(`Cashed out +${fmtTok(win)}🪙`);
    }
    save(); renderBalance(); updateRoundUI();
  }

  function revealAllBombs(){
    document.querySelectorAll(".cell").forEach(cell=>{
      const idx = Number(cell.dataset.idx);
      if (mines.has(idx)){
        cell.classList.add("revealed","bomb");
        cell.innerHTML = `<span class="mark" aria-hidden="true">💣</span>`;
      }
      cell.disabled = true;
    });
  }

  function markSafe(cell){
    cell.classList.add("revealed","safe");
    cell.innerHTML = `<img src="./Strawberryelephant.webp" alt="Strawberry Elephant" />`;
    cell.disabled = true;
  }

  // ===== EVENTS =====
  userSelect.addEventListener("change", ()=>{
    currentUser = userSelect.value;
    localStorage.setItem("br-user", currentUser);
    renderBalance();
  });

  betInput.addEventListener("input", ()=>{
    syncBet();
    updateRoundUI();
  });

  mineCount.addEventListener("input", ()=>{
    mineCountVal.textContent = mineCount.value;
    chosenMines = Number(mineCount.value);
    updateRoundUI();
  });

  startBtn.addEventListener("click", ()=>{
    syncBet();
    const bal = stats[currentUser]?.tokens || 0;
    if (bal + 1e-9 < bet){
      setMessage("Insufficient tokens. Use Admin to add coins for testing.");
      return;
    }
    // Deduct bet and start
    stats[currentUser].tokens = round3(bal - bet);
    stats[currentUser].spent = round3((stats[currentUser].spent||0) + bet);
    save(); renderBalance();

    chosenMines = Number(mineCount.value);
    mines = sampleMines(chosenMines);
    revealedSafe = 0;
    roundActive = true;
    setMessage("Round started. Pick a tile!");
    document.querySelectorAll(".cell").forEach(c=>{
      c.className = "cell";
      c.innerHTML = "";
      c.disabled = false;
    });
    updateRoundUI();
  });

  cashoutBtn.addEventListener("click", ()=>{
    if (!roundActive || revealedSafe<=0) return;
    const mult = currentMultiplier(revealedSafe, chosenMines);
    const win = round3(bet * mult);
    // finish round & pay
    document.querySelectorAll(".cell").forEach(c=> c.disabled = true);
    endRound(win);
  });

  resetBtn.addEventListener("click", ()=>{
    roundActive = false;
    mines.clear();
    revealedSafe = 0;
    setMessage("");
    buildBoard();
    updateRoundUI();
  });

  async function onCellClick(e){
    if (!roundActive) return;
    const cell = e.currentTarget;
    const idx = Number(cell.dataset.idx);
    // Bomb?
    if (mines.has(idx)){
      // Lose: reveal bombs, disable clicks
      cell.classList.add("revealed","bomb");
      cell.innerHTML = `<span class="mark" aria-hidden="true">💣</span>`;
      await wait(120);
      revealAllBombs();
      setMessage("💥 Boom! You hit a bomb. Bet lost.");
      roundActive = false;
      updateRoundUI();
      return;
    }
    // Safe hit
    markSafe(cell);
    revealedSafe++;
    const mult = currentMultiplier(revealedSafe, chosenMines);
    const cashVal = round3(bet * mult);
    setMessage(`Safe! Multiplier: ${mult.toFixed(2)}× — Cashout: +${fmtTok(cashVal)}🪙`);
    updateRoundUI();
  }

  // ===== Admin (local balance) =====
  adminToggle?.addEventListener("click", ()=>{
    adminUserLabel.textContent = currentUser;
    adminPanel.classList.remove("hidden");
  });
  closeAdmin?.addEventListener("click", ()=> adminPanel.classList.add("hidden"));
  adminGive?.addEventListener("click", ()=>{
    const s=stats[currentUser];
    const amt = Math.max(0, Number(adminAdd.value||"0"));
    if (!Number.isFinite(amt) || amt<=0) return;
    s.tokens = round3((s.tokens||0) + amt);
    save(); renderBalance();
    adminAdd.value="";
    setMessage(`Admin +${fmtTok(amt)}🪙`);
  });
})();
