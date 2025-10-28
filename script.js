/* Brainrot Slots — 3×3 (v22: decimal payouts + bet cycler + tight edge)
   - Economy: 1 token = 1M/s; min deposit 5 tokens
   - Bet cycler: 0.05 → 0.10 → 0.25 → 0.50 → 1 → 2 → 5 (loops)
   - Decimal wins (down to 0.001🪙 precision)
   - Much tighter: RTP target ~35% (≈65/35 house/player)
   - Simple Admin: add tokens only; users include Faisal & Muhammed
*/

function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
const wait = (ms)=> new Promise(r=>setTimeout(r, ms));
const round3 = (n)=> Math.round((n + Number.EPSILON) * 1000) / 1000;
const fmtTok = (n)=> {
  const s = (round3(n)).toFixed(3);
  return s.replace(/\.?0+$/,'');
};

(() => {
  // ===== INTERNAL EDGE =====
  const DEFAULT_RTP_TARGET = 35;     // % returned to player (tight)
  const DEFAULT_RTP_GAIN   = 120;
  const FORCED_TOP_PCT     = 0.002;  // 0.2% forced triple-top
  const PITY_START_SPINS   = 4;
  const PITY_STEP_LUCK     = 8;
  const DEFAULT_ODDS       = 70;     // <100 = tighter
  const DEFAULT_LUCK       = 4;
  const MIN_DEPOSIT        = 5;      // tokens = M/s

  // === Items best→least (files at repo root) ===
  const ITEMS = [
    { k:"strawberryelephant", file:"Strawberryelephant.webp",         label:"Strawberry Elephant", weight:5,  rank:8 },
    { k:"dragoncanneloni",    file:"Dragoncanneloni.webp",            label:"Dragon Canneloni",    weight:5,  rank:7 },
    { k:"garamadundung",      file:"Garamadundung.webp",              label:"Garamadundung",       weight:10, rank:6 },
    { k:"carti",              file:"Carti.webp",                      label:"Carti",               weight:12, rank:5 },
    { k:"saturnita",          file:"La_Vaccca_Saturno_Saturnita.webp",label:"Saturnita",           weight:14, rank:4 },
    { k:"tralalero",          file:"TralaleroTralala.webp",           label:"Tralalero Tralala",   weight:16, rank:3 },
    { k:"sgedrftdikou",       file:"Sgedrftdikou.webp",               label:"Sgedrftdikou",        weight:18, rank:2 },
    { k:"noobini",            file:"Noobini_Pizzanini_NEW.webp",      label:"Noobini Pizzanini",   weight:20, rank:1 },
  ];
  const TOTAL_WEIGHT = ITEMS.reduce((s,x)=>s+x.weight,0);
  const TOP = ITEMS[0];

  // Payout multipliers (per 1🪙 bet) — **decimals + tight**
  const PAYX_3 = {
    strawberryelephant: 5.0,
    dragoncanneloni:    2.5,
    garamadundung:      1.5,
    carti:              1.0,
    saturnita:          0.7,
    tralalero:          0.5,
    sgedrftdikou:       0.3,
    noobini:            0.2,
  };
  // exact two-of-a-kind (any symbol)
  const PAYX_PAIR = 0.05;

  const USERS = ["Will","Isaac","Faisal","Muhammed"];
  const DEFAULT_TOKENS = 0;

  // ----- State -----
  const storeKey = "brainrot-slots-v22";
  let stats = loadStats();
  let currentUser = USERS.includes(localStorage.getItem("br22-user")) ? localStorage.getItem("br22-user") : "Will";
  const BET_STEPS = [0.05, 0.10, 0.25, 0.50, 1, 2, 5];
  let betTokens = Number(localStorage.getItem("br22-bet")) || 0.5;
  if (!BET_STEPS.includes(betTokens)) betTokens = 0.5;

  function baseUser(){
    return {tokens:DEFAULT_TOKENS, earned:0, spent:0, luck:DEFAULT_LUCK, odds:DEFAULT_ODDS, rtpTarget:DEFAULT_RTP_TARGET, rtpGain:DEFAULT_RTP_GAIN, dry:0, diamond3:FORCED_TOP_PCT};
  }
  function loadStats(){
    try{
      const raw = JSON.parse(localStorage.getItem(storeKey)||"{}");
      for (const u of USERS) if (!raw[u]) raw[u] = baseUser();
      return raw;
    }catch{
      return Object.fromEntries(USERS.map(u=>[u, baseUser()]));
    }
  }
  function saveStats(){ localStorage.setItem(storeKey, JSON.stringify(stats)); }

  // ----- DOM -----
  const machine = document.getElementById("machine");
  const reelEls = [1,2,3].map(i => document.getElementById(`reel-${i}`));
  const spinBtn = document.getElementById("spinBtn");
  const depositBtn = document.getElementById("depositBtn");
  const cashoutBtn = document.getElementById("cashoutBtn");
  const messageEl = document.getElementById("message");
  const winBanner = document.getElementById("winBanner");
  const winModal  = document.getElementById("winModal");
  const winTitle  = document.getElementById("winTitle");
  const winAmount = document.getElementById("winAmount");
  const noWinModal = document.getElementById("noWinModal");

  const userSelect = document.getElementById("userSelect");
  const tokenBalanceEl = document.getElementById("tokenBalance");
  const machineBetEl  = document.getElementById("machineBet");
  const betCycleBtn   = document.getElementById("betCycle");
  const betLabel      = document.getElementById("betLabel");

  const adminToggle  = document.getElementById("adminToggle");
  const adminPanel   = document.getElementById("adminPanel");
  const closeAdmin   = document.getElementById("closeAdmin");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminAddTokens = document.getElementById("adminAddTokens");
  const adminAddBtn    = document.getElementById("adminAddBtn");
  const adminBalance   = document.getElementById("adminBalance");
  const resetStatsBtn  = document.getElementById("resetStats");

  // ----- Helpers -----
  const CELL_H = 156;
  const imgHTML = (file, alt)=> `<img src="./${file}" alt="${alt}">`;
  function makeCell(inner, isMid=false){ const d=document.createElement("div"); d.className="cell"+(isMid?" mid":""); d.innerHTML=inner; return d; }
  function randItem(){ return ITEMS[(Math.random()*ITEMS.length)|0]; }
  function initReelTrack(reel){
    const track = reel.querySelector(".track"); track.innerHTML = "";
    for (let i=0;i<6;i++) track.appendChild(makeCell(imgHTML(randItem().file, "sym"), i===1));
  }

  function pickBase(){
    let r = Math.random() * TOTAL_WEIGHT;
    for (const s of ITEMS){ if ((r -= s.weight) <= 0) return s; }
    return ITEMS[ITEMS.length-1];
  }
  function effectiveLuck(){ const s = stats[currentUser]; const extra=(s.odds-100)*0.9; return clamp(s.luck+extra,0,100); }
  function pityBonusLuck(){
    const dry = stats[currentUser].dry || 0;
    if (dry <= PITY_START_SPINS) return 0;
    const steps = dry - PITY_START_SPINS;
    return clamp(steps * PITY_STEP_LUCK, 0, 40);
  }
  function pickBiased(luck){
    const L = clamp(luck,0,100);
    const candidates = 1 + Math.floor(L / 26);
    let best = pickBase();
    for (let i=1;i<candidates;i++){ const c = pickBase(); if (c.rank > best.rank) best = c; }
    return best;
  }
  function calcWinRow(row){
    const [a,b,c] = row.map(x=>x.k);
    if (a===b && b===c) return PAYX_3[a];
    if (a===b || a===c || b===c) return PAYX_PAIR;
    return 0;
  }
  function governorBoost(){
    const s = stats[currentUser];
    const spent = s.spent || 0;
    const earned = s.earned || 0;
    if (spent <= 0) return 1 + (s.rtpGain/900);
    const rtp = 100 * earned / spent;
    const diff = (s.rtpTarget) - rtp;
    const mult = 1 + clamp(diff/100, -0.35, 0.35) * (s.rtpGain/100);
    return clamp(mult, 0.65, 1.30);
  }
  function upgradeRow(row, luck){
    const L = clamp(luck,0,100);
    const g = governorBoost();
    let u  = 0.12 * g + (L/180) * 0.55;             // make a pair (lower)
    let u2 = 0.06 * g + (L/360) * 0.45 * 0.85;      // pair→three (lower)
    u = clamp(u, 0, 0.40); u2 = clamp(u2, 0, 0.28);

    const k = row.map(r=>r.k);
    const counts={}; k.forEach(x=>counts[x]=(counts[x]||0)+1);
    const hasThree = Object.values(counts).some(c=>c===3);
    const hasPair  = Object.values(counts).some(c=>c===2);

    if (!hasPair && !hasThree && Math.random()<u){
      const pool = row.slice().sort((a,b)=>a.rank-b.rank);
      let pick = pool[0]; if (pick.k===TOP.k) pick = pool[1]||pick;
      row[2] = pick;
    } else if (hasPair && !hasThree && Math.random()<u2){
      let sym = Object.entries(counts).find(([_,c])=>c===2)[0];
      if (sym===TOP.k && Math.random()<0.75) return row; // make jackpots rarer
      for (let i=0;i<3;i++) if (row[i].k!==sym) row[i]=row.find(r=>r.k===sym);
    }
    return row;
  }

  // ----- UI -----
  function renderStats(){
    const s = stats[currentUser];
    tokenBalanceEl.textContent = `${fmtTok(s.tokens||0)}🪙`;
    adminUserLabel && (adminUserLabel.textContent = currentUser);
    adminBalance && (adminBalance.textContent = `${fmtTok(s.tokens||0)}🪙`);
    updateSpinEnabled();
  }

  function renderPaytable(){
    const rows = [
      [`<span class="triple">${imgHTML(TOP.file, TOP.label).repeat(3)}</span>`, `${fmtTok(PAYX_3[TOP.k])}🪙`],
      [`<span class="triple">${imgHTML("Dragoncanneloni.webp","Dragon").repeat(3)}</span>`, `${fmtTok(PAYX_3.dragoncanneloni)}🪙`],
      [`<span class="triple">${imgHTML("Garamadundung.webp","Garamadundung").repeat(3)}</span>`, `${fmtTok(PAYX_3.garamadundung)}🪙`],
      [`<span class="triple">${imgHTML("Carti.webp","Carti").repeat(3)}</span>`, `${fmtTok(PAYX_3.carti)}🪙`],
      [`<span class="triple">${imgHTML("La_Vaccca_Saturno_Saturnita.webp","Saturnita").repeat(3)}</span>`, `${fmtTok(PAYX_3.saturnita)}🪙`],
      [`<span class="triple">${imgHTML("TralaleroTralala.webp","Tralalero").repeat(3)}</span>`, `${fmtTok(PAYX_3.tralalero)}🪙`],
      [`<span class="triple">${imgHTML("Sgedrftdikou.webp","Sgedrftdikou").repeat(3)}</span>`, `${fmtTok(PAYX_3.sgedrftdikou)}🪙`],
      [`<span class="triple">${imgHTML("Noobini_Pizzanini_NEW.webp","Noobini").repeat(3)}</span>`, `${fmtTok(PAYX_3.noobini)}🪙`],
      [`Any 2-of-a-kind`, `${fmtTok(PAYX_PAIR)}🪙`],
    ];
    const payRows = document.getElementById("payRows");
    payRows.innerHTML = rows.map(([l,v],i) =>
      `<div class="pt-row">
         <div class="pt-sym">${l}</div>
         <div class="muted">${i<8 ? '3× match' : ''}</div>
         <b>${v}</b>
       </div>`
    ).join("");
  }

  function markBet(){
    document.getElementById("machineBet").textContent = `${fmtTok(betTokens)}🪙`;
    document.getElementById("betLabel").textContent   = `${fmtTok(betTokens)}🪙`;
  }
  function updateSpinEnabled(){
    const s = stats[currentUser];
    if (spinBtn) spinBtn.disabled = ((s.tokens||0) + 1e-9) < betTokens;
  }

  // Bet cycler
  function cycleBet(){
    const idx = BET_STEPS.indexOf(betTokens);
    betTokens = BET_STEPS[(idx + 1) % BET_STEPS.length];
    localStorage.setItem("br22-bet", String(betTokens));
    markBet(); updateSpinEnabled();
  }
  betCycleBtn.addEventListener("click", cycleBet);

  // Spinning visuals
  async function scrollReelTo(reel, finalCol, totalRows, fakeHops, durationMs){
    const track = reel.querySelector(".track");
    reel.classList.remove("stopped");
    track.innerHTML = "";
    const filler = Math.max(3, totalRows - 3);
    for (let i=0;i<filler;i++) track.appendChild(makeCell(imgHTML(randItem().file,"sym"), false));
    track.appendChild(makeCell(imgHTML(finalCol.top.file, finalCol.top.label), false));
    track.appendChild(makeCell(imgHTML(finalCol.mid.file, finalCol.mid.label), true));
    track.appendChild(makeCell(imgHTML(finalCol.bot.file, finalCol.bot.label), false));
    track.style.transform = `translateY(0px)`; track.style.transition = "none";
    void track.offsetHeight;
    const distance = -(CELL_H * (totalRows - 3));
    track.style.transition = `transform ${durationMs}ms cubic-bezier(.12,.86,.16,1)`;
    track.style.transform  = `translateY(${distance}px)`;
    await wait(durationMs);
    for (let i=0;i<fakeHops;i++){
      track.style.transition = "transform 180ms ease-out"; track.style.transform = `translateY(${distance + 18}px)`; await wait(180);
      track.style.transition = "transform 210ms ease-in";  track.style.transform = `translateY(${distance}px)`;       await wait(210);
    }
    reel.classList.add("stopped");
  }

  // Spin flow
  let spinning=false;
  async function doSpin(){
    if (spinning) return;
    const s = stats[currentUser];
    if ((s.tokens||0) + 1e-9 < betTokens){
      messageEl.textContent = "Insufficient tokens. Deposit a chatcher (≥ 5🪙).";
      return;
    }

    spinning=true; machine.classList.add("spinning");
    reelEls.forEach(r=>r.classList.remove("stopped"));

    // Take bet (decimals)
    s.tokens = round3((s.tokens||0) - betTokens);
    s.spent  = round3((s.spent ||0) + betTokens);
    saveStats(); renderStats();

    const luck = effectiveLuck() + pityBonusLuck();
    let midRow;

    if (Math.random() < (s.diamond3 ?? FORCED_TOP_PCT)){
      midRow = [TOP, TOP, TOP];
    } else {
      midRow = [pickBiased(luck), pickBiased(luck), pickBiased(luck)];
      midRow = upgradeRow(midRow, luck);
    }

    const finals = [
      {top: randItem(), mid: midRow[0], bot: randItem()},
      {top: randItem(), mid: midRow[1], bot: randItem()},
      {top: randItem(), mid: midRow[2], bot: randItem()},
    ];

    await scrollReelTo(reelEls[0], finals[0], 64, 1, 4200);
    await wait(280);
    await scrollReelTo(reelEls[1], finals[1], 84, 1, 5800);
    await wait(360);
    await scrollReelTo(reelEls[2], finals[2], 112, 2, 8200);

    const mult = calcWinRow(midRow);
    const win  = round3(mult * betTokens);
    if (win>0){
      s.tokens = round3((s.tokens||0) + win);
      s.earned = round3((s.earned||0) + win);
      s.dry = 0;
      showWin(win, midRow);
    }else{
      s.dry = (s.dry||0) + 1;
      showNoWin();
    }
    saveStats(); renderStats();
    machine.classList.remove("spinning");
    spinning=false;
  }

  function showWin(win, row){
    winAmount && (winAmount.textContent = `+${fmtTok(win)}🪙`);
    const triple = (row[0].k===row[1].k && row[1].k===row[2].k) ? row[0].k : null;
    winTitle && (winTitle.textContent = (triple===TOP.k) ? "JACKPOT!" : (win>=2 ? "MEGA WIN!" : "BIG WIN!"));
    if (winModal){ winModal.classList.remove("hidden"); winModal.classList.add("show"); setTimeout(()=>{ winModal.classList.remove("show"); setTimeout(()=>winModal.classList.add("hidden"), 250); }, 2200); }
    if (winBanner){ winBanner.textContent = `✨ +${fmtTok(win)}🪙 ✨`; winBanner.classList.add("show"); setTimeout(()=> winBanner.classList.remove("show"), 1800); }
  }
  function showNoWin(){
    if (!noWinModal) return;
    noWinModal.classList.remove("hidden"); noWinModal.classList.add("show");
    setTimeout(()=>{ noWinModal.classList.remove("show"); setTimeout(()=>noWinModal.classList.add("hidden"), 220); }, 1100);
  }

  // Economy buttons
  depositBtn.addEventListener("click", ()=>{
    const s = stats[currentUser];
    const val = prompt(`Enter your chatcher's production (M/s). Minimum ${MIN_DEPOSIT}. 1 M/s = 1🪙`, `${Math.max(MIN_DEPOSIT, 5)}`);
    if (val==null) return;
    const tokens = Number(val);
    if (!Number.isFinite(tokens) || tokens < MIN_DEPOSIT){
      alert(`Minimum deposit is ${MIN_DEPOSIT} tokens (i.e., ${MIN_DEPOSIT}M/s chatcher).`);
      return;
    }
    s.tokens = round3((s.tokens||0) + tokens);
    messageEl.textContent = `Deposited ${fmtTok(tokens)}🪙 (from ${fmtTok(tokens)}M/s chatcher).`;
    saveStats(); renderStats();
  });

  cashoutBtn.addEventListener("click", ()=>{
    const s = stats[currentUser];
    const bal = round3(Math.max(0, s.tokens||0));
    if (bal <= 0){ alert("Nothing to cash out."); return; }
    if (confirm(`Cash out ${fmtTok(bal)}🪙 → ${fmtTok(bal)}M/s Brainrot?`)){
      alert(`Cashed out: ${fmtTok(bal)}M/s Brainrot awarded!`);
      s.tokens = 0; saveStats(); renderStats();
    }
  });

  // Simple admin
  let adminUnlocked = localStorage.getItem("br22-admin") === "1";
  adminToggle?.addEventListener("click", ()=>{
    if(!adminUnlocked){
      const code = prompt("Enter admin passcode:");
      if(code==="1111"){ adminUnlocked=true; localStorage.setItem("br22-admin","1"); showAdmin(); }
      else alert("Incorrect passcode.");
    } else { adminPanel.classList.contains("hidden") ? showAdmin() : hideAdmin(); }
  });
  function showAdmin(){ adminPanel.classList.remove("hidden"); adminPanel.setAttribute("aria-hidden","false"); adminBalance.textContent = `${fmtTok(stats[currentUser].tokens||0)}🪙`; }
  function hideAdmin(){ adminPanel.classList.add("hidden"); adminPanel.setAttribute("aria-hidden","true"); }
  closeAdmin?.addEventListener("click", hideAdmin);

  adminAddBtn?.addEventListener("click", ()=>{
    const amt = Math.max(0.001, Number(adminAddTokens.value)||0);
    stats[currentUser].tokens = round3((stats[currentUser].tokens||0) + amt);
    saveStats(); renderStats();
  });

  resetStatsBtn?.addEventListener("click", ()=>{
    if(confirm(`Reset stats for ${currentUser}?`)){
      stats[currentUser] = baseUser();
      saveStats(); renderStats();
    }
  });

  userSelect.addEventListener("change", ()=>{ currentUser=userSelect.value; localStorage.setItem("br22-user", currentUser); renderStats(); hideAdmin(); });

  // Init
  userSelect.value = currentUser;
  [1,2,3].forEach(i=>initReelTrack(document.getElementById(`reel-${i}`)));
  renderStats(); renderPaytable(); markBet(); updateSpinEnabled();

  // Controls
  spinBtn.addEventListener("click", ()=> doSpin());
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); } });
})();
