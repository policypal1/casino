/* Lucky Lemons — 3×3 Cylinder (v17 generous)
   - Forced triple-diamond rate (default 3%)
   - Pity escalator after dry spins
   - RTP governor to target ~92% by default
   - Admin at bottom, passcode 1111
*/

function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
const wait = (ms)=> new Promise(r=>setTimeout(r, ms));

(() => {
  // ===== TUNING KNOBS (edit these defaults) =====
  const DEFAULT_RTP_TARGET = 92;     // % paid back long-run (set 95 for lighter edge)
  const DEFAULT_RTP_GAIN   = 120;    // strength of auto-correction (0–200)
  const FORCED_DIAMOND_PCT = 0.03;   // 0.00–0.05 => 0–5% forced 💎💎💎
  const PITY_START_SPINS   = 2;      // after this many dry spins, start pity
  const PITY_STEP_LUCK     = 14;     // extra luck added per dry spin
  const DEFAULT_ODDS       = 150;    // 100 neutral; >100 looser (more wins)
  const DEFAULT_LUCK       = 18;     // flat bias (0–100)
  // ==============================================

  const USERS = ["Will","Isaac"];
  const DEFAULT_SPINS = 0;

  // Payouts (per 25¢). 10¢ = ×0.4
  const BASE_PAY_3 = { diamond:4.50, seven:2.80, star:1.70, bell:1.20, grape:1.00, orange:0.82, lemon:0.65, cherry:0.55 };
  const BASE_PAY_2_CHERRY = 0.12;
  const BASE_PAY_2_OTHER  = 0.06;

  // Base symbol weights (≈ diamond ~5% raw pick)
  const SYMBOLS = [
    { k:"cherry",  weight:20, rank:1 },
    { k:"lemon",   weight:18, rank:2 },
    { k:"orange",  weight:16, rank:3 },
    { k:"grape",   weight:14, rank:4 },
    { k:"bell",    weight:12, rank:5 },
    { k:"star",    weight:10, rank:6 },
    { k:"seven",   weight: 5, rank:7 },
    { k:"diamond", weight: 5, rank:8 },
  ];
  const TOTAL_WEIGHT = SYMBOLS.reduce((s,x)=>s+x.weight,0);
  const DIAMOND = SYMBOLS.find(s=>s.k==="diamond");

  // SVGs (polished)
  const ICON_SVGS = {
    diamond:`<svg viewBox="0 0 100 100" class="ico-base ico-diamond"><defs><linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#1e90ff"/></linearGradient></defs><polygon points="20,15 80,15 95,40 50,90 5,40" fill="url(#gd)" stroke="#aee3ff" stroke-width="4" stroke-linejoin="round"/><polyline points="20,15 50,50 80,15" fill="none" stroke="#dff4ff" stroke-width="2" opacity=".7"/></svg>`,
    seven:`<svg viewBox="0 0 100 100" class="ico-base ico-seven"><defs><linearGradient id="g7" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b2f5ea"/><stop offset="1" stop-color="#14b8a6"/></linearGradient></defs><path d="M20 20 H82 L44 86 H22 L58 32 H20 Z" fill="url(#g7)" stroke="#0c3b35" stroke-width="6" stroke-linejoin="round"/></svg>`,
    star:`<svg viewBox="0 0 100 100" class="ico-base ico-star"><defs><linearGradient id="gs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe082"/><stop offset="1" stop-color="#ffca28"/></linearGradient></defs><path d="M50 8 L61 36 L91 36 L66 54 L75 84 L50 66 L25 84 L34 54 L9 36 L39 36 Z" fill="url(#gs)" stroke="#3a2a00" stroke-width="5" stroke-linejoin="round"/></svg>`,
    bell:`<svg viewBox="0 0 100 100" class="ico-base ico-bell"><defs><linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd54f"/><stop offset="1" stop-color="#f6c342"/></linearGradient></defs><path d="M50 16c-12 0-22 9-22 20v14c0 8-5 13-10 18h64c-5-5-10-10-10-18V36c0-11-10-20-22-20z" fill="url(#gb)" stroke="#6d4c00" stroke-width="5" /><circle cx="50" cy="78" r="6" fill="#ffecb3" stroke="#6d4c00" stroke-width="4"/></svg>`,
    grape:`<svg viewBox="0 0 100 100" class="ico-base ico-grape"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b39ddb"/><stop offset="1" stop-color="#7e57c2"/></linearGradient></defs><circle cx="50" cy="18" r="6" fill="#6fbf73"/><rect x="48" y="18" width="4" height="10" fill="#4e8b56"/><g fill="url(#gg)" stroke="#3b2666" stroke-width="4"><circle cx="35" cy="50" r="11"/><circle cx="50" cy="50" r="11"/><circle cx="65" cy="50" r="11"/><circle cx="42" cy="64" r="11"/><circle cx="58" cy="64" r="11"/></g></svg>`,
    orange:`<svg viewBox="0 0 100 100" class="ico-base ico-orange"><defs><linearGradient id="go" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffab66"/><stop offset="1" stop-color="#ff784e"/></linearGradient></defs><circle cx="50" cy="55" r="26" fill="url(#go)" stroke="#6e2a00" stroke-width="5"/><path d="M52 28c10-6 16-6 22-2-6 2-12 5-22 2z" fill="#7ac96d" stroke="#2b5e2c" stroke-width="3"/></svg>`,
    lemon:`<svg viewBox="0 0 100 100" class="ico-base ico-lemon"><defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe082"/><stop offset="1" stop-color="#ffd54f"/></linearGradient></defs><ellipse cx="52" cy="55" rx="30" ry="22" fill="url(#gl)" stroke="#7a6200" stroke-width="5"/><circle cx="33" cy="55" r="3" fill="#fff" opacity=".5"/><path d="M48 28c-9-5-15-5-21-2 6 2 11 5 21 2z" fill="#7ac96d" stroke="#2b5e2c" stroke-width="3"/></svg>`,
    cherry:`<svg viewBox="0 0 100 100" class="ico-base ico-cherry"><defs><linearGradient id="gc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a80"/><stop offset="1" stop-color="#e53935"/></linearGradient></defs><path d="M32 34c10 10 22 8 32 0" fill="none" stroke="#2b5e2c" stroke-width="5"/><circle cx="36" cy="62" r="12" fill="url(#gc)" stroke="#5c0b0b" stroke-width="5"/><circle cx="58" cy="62" r="12" fill="url(#gc)" stroke="#5c0b0b" stroke-width="5"/><path d="M50 30 c8-8 16-10 24-10" fill="none" stroke="#2b5e2c" stroke-width="5"/></svg>`
  };

  // ----- State -----
  const storeKey = "lucky-lemons-v17-stats";
  let stats = loadStats();
  let currentUser = ["Will","Isaac"].includes(localStorage.getItem("ll-v17-user")) ? localStorage.getItem("ll-v17-user") : "Will";
  let betCents = Number(localStorage.getItem("ll-v17-bet")) || 25;
  if (![10,25].includes(betCents)) betCents = 25;

  function loadStats(){
    try{
      const raw = JSON.parse(localStorage.getItem(storeKey)||"{}");
      for (const u of USERS){
        if (!raw[u]) raw[u] = {spins:DEFAULT_SPINS, earned:0, spent:0, luck:DEFAULT_LUCK, odds:DEFAULT_ODDS, rtpTarget:DEFAULT_RTP_TARGET, rtpGain:DEFAULT_RTP_GAIN, dry:0, diamond3:FORCED_DIAMOND_PCT};
        if (raw[u].odds==null) raw[u].odds = DEFAULT_ODDS;
        if (raw[u].rtpTarget==null) raw[u].rtpTarget = DEFAULT_RTP_TARGET;
        if (raw[u].rtpGain==null) raw[u].rtpGain = DEFAULT_RTP_GAIN;
        if (raw[u].luck==null) raw[u].luck = DEFAULT_LUCK;
        if (raw[u].dry==null) raw[u].dry = 0;
        if (raw[u].diamond3==null) raw[u].diamond3 = FORCED_DIAMOND_PCT;
      }
      return raw;
    }catch{
      const base = {spins:DEFAULT_SPINS, earned:0, spent:0, luck:DEFAULT_LUCK, odds:DEFAULT_ODDS, rtpTarget:DEFAULT_RTP_TARGET, rtpGain:DEFAULT_RTP_GAIN, dry:0, diamond3:FORCED_DIAMOND_PCT};
      return Object.fromEntries(USERS.map(u=>[u, {...base}]));
    }
  }
  function saveStats(){ localStorage.setItem(storeKey, JSON.stringify(stats)); }

  // ----- DOM -----
  const machine = document.getElementById("machine");
  const reelEls = [1,2,3].map(i => document.getElementById(`reel-${i}`));
  const spinBtn = document.getElementById("spinBtn");
  const convertBtn = document.getElementById("convertBtn");
  const cashoutBtn = document.getElementById("cashoutBtn");
  const messageEl = document.getElementById("message");
  const winBanner = document.getElementById("winBanner");
  const winModal  = document.getElementById("winModal");
  const winTitle  = document.getElementById("winTitle");
  const winAmount = document.getElementById("winAmount");
  const noWinModal = document.getElementById("noWinModal");

  const userSelect = document.getElementById("userSelect");
  const spinsLeftEl = document.getElementById("spinsLeft");
  const totalEarnedEl = document.getElementById("totalEarned");
  const totalSpentEl  = document.getElementById("totalSpent");
  const machineBetEl  = document.getElementById("machineBet");

  const adminToggle  = document.getElementById("adminToggle");
  const adminPanel   = document.getElementById("adminPanel");
  const closeAdmin   = document.getElementById("closeAdmin");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminSpins   = document.getElementById("adminSpins");
  const adminEarned  = document.getElementById("adminEarned");
  const adminSpent   = document.getElementById("adminSpent");
  const adminLuck    = document.getElementById("adminLuck");
  const adminOdds    = document.getElementById("adminOdds");
  const rtpTargetEl  = document.getElementById("rtpTarget");
  const rtpGainEl    = document.getElementById("rtpGain");
  const diamond3El   = document.getElementById("diamond3Pct");
  const pityStartEl  = document.getElementById("pityStart");
  const pityStepEl   = document.getElementById("pityStep");
  const dryLabel     = document.getElementById("dryLabel");
  const autoTuneBtn  = document.getElementById("autoTune");
  const saveAdmin    = document.getElementById("saveAdmin");
  const add10Spins   = document.getElementById("add10Spins");
  const resetStatsBtn= document.getElementById("resetStats");
  const oddsGrid     = document.getElementById("oddsGrid");
  const baseChances  = document.getElementById("baseChances");
  const rtpStats     = document.getElementById("rtpStats");

  const bet10 = document.getElementById("bet10");
  const bet25 = document.getElementById("bet25");
  const payRows = document.getElementById("payRows");
  const payNote = document.getElementById("payNote");

  // FX canvas (null-safe)
  const confettiCanvas = document.getElementById("confettiCanvas");
  const ctx = confettiCanvas ? confettiCanvas.getContext("2d") : null;
  function resizeCanvas(){ if (!confettiCanvas) return; confettiCanvas.width=innerWidth; confettiCanvas.height=innerHeight; }
  resizeCanvas(); window.addEventListener("resize", resizeCanvas);

  // ----- Init -----
  userSelect.value = currentUser;
  markBet(); renderStats(); renderPaytable(); renderBaseChances(); refreshOdds(); updateSpinEnabled();
  reelEls.forEach(initReelTrack);

  // ----- RNG & Odds -----
  function pickBase(){
    let r = Math.random() * TOTAL_WEIGHT;
    for (const s of SYMBOLS){ if ((r -= s.weight) <= 0) return s; }
    return SYMBOLS[SYMBOLS.length-1];
  }
  function effectiveLuck(overrideOdds=null){
    const base = (betCents===10 ? 14 : 0);
    const odds = (overrideOdds==null) ? (stats[currentUser].odds ?? DEFAULT_ODDS) : overrideOdds;
    const extra = (odds - 100) * 0.9;
    return clamp((stats[currentUser].luck ?? DEFAULT_LUCK) + base + extra, 0, 100);
  }
  function pityBonusLuck(){
    const dry = stats[currentUser].dry || 0;
    if (dry <= PITY_START_SPINS) return 0;
    const steps = dry - PITY_START_SPINS;
    return clamp(steps * PITY_STEP_LUCK, 0, 60);
  }
  function pickBiased(luck){
    const L = clamp(luck,0,100);
    const candidates = 1 + Math.floor(L / 18);
    let best = pickBase();
    for (let i=1;i<candidates;i++){ const c = pickBase(); if (c.rank > best.rank) best = c; }
    return best;
  }
  function currentPayouts(){
    const scale = betCents===25 ? 1 : 0.4;
    const PAY_3 = {}; for (const k in BASE_PAY_3) PAY_3[k] = +(BASE_PAY_3[k]*scale).toFixed(2);
    const P2C = +(BASE_PAY_2_CHERRY*scale).toFixed(2);
    const P2O = +(BASE_PAY_2_OTHER *scale).toFixed(2);
    return {PAY_3,P2C,P2O,scale};
  }
  function calcWinRow(row){
    const {PAY_3,P2C,P2O} = currentPayouts();
    const [a,b,c] = row.map(x=>x.k);
    if (a===b && b===c) return +(PAY_3[a]||0).toFixed(2);
    const ch=[a,b,c].filter(k=>k==="cherry").length;
    if (ch===2) return P2C;
    if (a===b || a===c || b===c) return P2O;
    return 0;
  }
  // Governor factor based on live RTP vs target
  function governorBoost(){
    const s = stats[currentUser];
    const spent = s.spent || 0;
    const earned = s.earned || 0;
    const target = s.rtpTarget ?? DEFAULT_RTP_TARGET;
    const gain   = s.rtpGain   ?? DEFAULT_RTP_GAIN;
    if (spent <= 0) return 1 + (gain/600); // be generous early
    const rtp = 100 * earned / spent;
    const diff = target - rtp; // + => we are too tight; - => paying too much
    // Convert diff (±%) into 0.7–1.4 multiplier depending on gain
    const mult = 1 + clamp(diff/100, -0.25, 0.25) * (gain/100);
    return clamp(mult, 0.7, 1.4);
  }
  function upgradeRow(row, luck){
    const L = clamp(luck,0,100);
    const g = governorBoost();         // governor multiplier
    const oddsScale = (stats[currentUser].odds ?? DEFAULT_ODDS)/100;

    // Base upgrade chances (boosted from earlier versions)
    let u  = 0.28 * g + (L/110) * 0.9 * oddsScale; // create a 2-kind
    let u2 = 0.14 * g + (L/260) * 0.7 * (0.9 + 0.4*oddsScale); // upgrade 2-kind to 3-kind
    u = clamp(u, 0, 0.85); u2 = clamp(u2, 0, 0.60);

    const k = row.map(r=>r.k);
    const counts={}; k.forEach(x=>counts[x]=(counts[x]||0)+1);
    const hasThree = Object.values(counts).some(c=>c===3);
    const hasPair  = Object.values(counts).some(c=>c===2);

    if (!hasPair && !hasThree && Math.random()<u){
      // pick best of row (avoid diamond here so diamond rate stays under admin control)
      const pool = row.slice().sort((a,b)=>a.rank-b.rank);
      let pick = pool[0]; if (pick.k==="diamond") pick = pool[1]||pick;
      row[2] = pick;
    } else if (hasPair && !hasThree && Math.random()<u2){
      let sym = Object.entries(counts).find(([_,c])=>c===2)[0];
      // Allow diamond upgrade occasionally but not always
      if (sym==="diamond" && Math.random()<0.5) return row;
      for (let i=0;i<3;i++) if (row[i].k!==sym) row[i]=row.find(r=>r.k===sym);
    }
    return row;
  }

  // ----- UI -----
  function renderPaytable(){
    const {PAY_3,P2C,P2O} = currentPayouts();
    payNote.textContent = betCents===25 ? "per 25¢ bet" : "per 10¢ bet";
    const rows = [
      ["💎💎💎", `$${PAY_3.diamond.toFixed(2)}`],
      ["7️⃣7️⃣7️⃣", `$${PAY_3.seven.toFixed(2)}`],
      ["⭐⭐⭐", `$${PAY_3.star.toFixed(2)}`],
      ["🔔🔔🔔", `$${PAY_3.bell.toFixed(2)}`],
      ["🍇🍇🍇", `$${PAY_3.grape.toFixed(2)}`],
      ["🍊🍊🍊", `$${PAY_3.orange.toFixed(2)}`],
      ["🍋🍋🍋", `$${PAY_3.lemon.toFixed(2)}`],
      ["🍒🍒🍒", `$${PAY_3.cherry.toFixed(2)}`],
      ["🍒🍒X (exactly two)", `$${P2C.toFixed(2)}`, true],
      ["Any other 2-of-a-kind", `$${P2O.toFixed(2)}`, true],
    ];
    payRows.innerHTML = rows.map(([l,v,sub]) =>
      `<div class="pt-row${sub?' sub':''}"><span>${l}</span><b>${v}</b></div>`
    ).join("");
  }
  function renderStats(){
    const s = stats[currentUser];
    spinsLeftEl.textContent = s.spins.toString();
    totalEarnedEl.textContent = `$${(s.earned||0).toFixed(2)}`;
    totalSpentEl.textContent  = `$${(s.spent||0).toFixed(2)}`;
    adminUserLabel && (adminUserLabel.textContent = currentUser);
    adminSpins    && (adminSpins.value = s.spins);
    adminEarned   && (adminEarned.value = (s.earned||0).toFixed(2));
    adminSpent    && (adminSpent.value  = (s.spent ||0).toFixed(2));
    adminLuck     && (adminLuck.value   = s.luck ?? DEFAULT_LUCK);
    adminOdds     && (adminOdds.value   = s.odds ?? DEFAULT_ODDS);
    rtpTargetEl   && (rtpTargetEl.value = s.rtpTarget ?? DEFAULT_RTP_TARGET);
    rtpGainEl     && (rtpGainEl.value   = s.rtpGain   ?? DEFAULT_RTP_GAIN);
    diamond3El    && (diamond3El.value  = 100*(s.diamond3 ?? FORCED_DIAMOND_PCT));
    pityStartEl   && (pityStartEl.value = PITY_START_SPINS);
    pityStepEl    && (pityStepEl.value  = PITY_STEP_LUCK);
    dryLabel      && (dryLabel.textContent = s.dry ?? 0);
    updateSpinEnabled();
  }
  function markBet(){
    bet10.classList.toggle("active", betCents===10);
    bet25.classList.toggle("active", betCents===25);
    machineBetEl.textContent = betCents===25 ? "25¢" : "10¢";
  }
  function updateSpinEnabled(){ if (spinBtn) spinBtn.disabled = (stats[currentUser].spins || 0) <= 0; }

  // ----- Reels -----
  const CELL_H = 156;
  function icon(k){ return ICON_SVGS[k]; }
  function initReelTrack(reel){
    const track = reel.querySelector(".track");
    track.innerHTML = "";
    for (let i=0;i<6;i++) track.appendChild(makeCell(icon(randSymbol().k), i===1));
  }
  function makeCell(svg, isMid=false){ const d=document.createElement("div"); d.className="cell"+(isMid?" mid":""); d.innerHTML=svg; return d; }
  function randSymbol(){ return SYMBOLS[(Math.random()*SYMBOLS.length)|0]; }

  async function scrollReelTo(reel, finalCol, totalRows, fakeHops, durationMs){
    const track = reel.querySelector(".track");
    reel.classList.remove("stopped");
    track.innerHTML = "";
    const filler = Math.max(3, totalRows - 3);
    for (let i=0;i<filler;i++) track.appendChild(makeCell(icon(randSymbol().k), false));
    track.appendChild(makeCell(icon(finalCol.top.k), false));
    track.appendChild(makeCell(icon(finalCol.mid.k), true));
    track.appendChild(makeCell(icon(finalCol.bot.k), false));
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

  // ----- Spin -----
  let spinning=false;
  async function doSpin(){
    if (spinning) return;
    const s = stats[currentUser];
    if ((s.spins||0) <= 0){ messageEl.textContent = "No spins left. Convert cash or add spins in Admin."; return; }

    spinning=true; machine.classList.add("spinning");
    reelEls.forEach(r=>r.classList.remove("stopped"));

    s.spins -= 1; s.spent = +((s.spent||0) + betCents/100).toFixed(2); saveStats(); renderStats();

    // Build row with luck + pity bonus, then governor upgrades
    const luck = effectiveLuck() + pityBonusLuck();
    let midRow;

    // Forced 💎💎💎 rate
    if (Math.random() < (s.diamond3 ?? FORCED_DIAMOND_PCT)){
      midRow = [DIAMOND, DIAMOND, DIAMOND];
    } else {
      midRow = [pickBiased(luck), pickBiased(luck), pickBiased(luck)];
      midRow = upgradeRow(midRow, luck);
    }

    const finals = [
      {top: randSymbol(), mid: midRow[0], bot: randSymbol()},
      {top: randSymbol(), mid: midRow[1], bot: randSymbol()},
      {top: randSymbol(), mid: midRow[2], bot: randSymbol()},
    ];

    await scrollReelTo(reelEls[0], finals[0], 70, 1, 5000);
    await wait(350);
    await scrollReelTo(reelEls[1], finals[1], 90, 1, 7000);
    await wait(450);
    await scrollReelTo(reelEls[2], finals[2], 120, 2, 10000);

    const win = calcWinRow(midRow);
    if (win>0){
      s.earned = +((s.earned||0) + win).toFixed(2);
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
    winAmount && (winAmount.textContent = `$${win.toFixed(2)}`);
    const triple = (row[0].k===row[1].k && row[1].k===row[2].k) ? row[0].k : null;
    winTitle && (winTitle.textContent = (triple==="diamond") ? "JACKPOT!" : (win>=1.5 ? "MEGA WIN!" : "BIG WIN!"));
    if (winModal){ winModal.classList.remove("hidden"); winModal.classList.add("show"); setTimeout(()=>{ winModal.classList.remove("show"); setTimeout(()=>winModal.classList.add("hidden"), 250); }, 3000); }
    if (winBanner){ winBanner.textContent = `✨ You won $${win.toFixed(2)} ✨`; winBanner.classList.add("show"); setTimeout(()=> winBanner.classList.remove("show"), 2800); }
  }
  function showNoWin(){
    if (!noWinModal) return;
    noWinModal.classList.remove("hidden"); noWinModal.classList.add("show");
    setTimeout(()=>{ noWinModal.classList.remove("show"); setTimeout(()=>noWinModal.classList.add("hidden"), 220); }, 1400);
  }

  // ----- Money -----
  convertBtn.addEventListener("click", ()=>{
    const s = stats[currentUser];
    if ((s.earned||0) <= 0){ alert("No cash available to convert."); return; }
    const bet = betCents/100;
    const val = prompt(`Convert how much to spins? ($${(s.earned||0).toFixed(2)} available)\nCurrent bet: $${bet.toFixed(2)} per spin`, (s.earned||0).toFixed(2));
    if (val==null) return;
    const dollars = Math.max(0, Number(val));
    if (!Number.isFinite(dollars)) return;
    const spinsToAdd = Math.floor(dollars / bet);
    if (spinsToAdd <= 0){ alert("Amount too small for one spin at current bet."); return; }
    const cost = +(spinsToAdd * bet).toFixed(2);
    if (cost > (s.earned||0)){ alert("Insufficient funds."); return; }
    s.earned = +((s.earned||0) - cost).toFixed(2);
    s.spins  = (s.spins||0) + spinsToAdd;
    saveStats(); renderStats();
  });

  cashoutBtn.addEventListener("click", ()=>{
    const s = stats[currentUser];
    if ((s.earned||0) <= 0){ alert("Nothing to cash out."); return; }
    if (confirm(`Cash out $${(s.earned||0).toFixed(2)}? This will reset Earned to $0.00.`)){
      s.earned = 0; saveStats(); renderStats();
    }
  });

  // ----- Admin -----
  let adminUnlocked = localStorage.getItem("ll-v17-admin") === "1";
  adminToggle && adminToggle.addEventListener("click", ()=>{
    if(!adminUnlocked){
      const code = prompt("Enter admin passcode:");
      if(code==="1111"){ adminUnlocked=true; localStorage.setItem("ll-v17-admin","1"); showAdmin(); }
      else alert("Incorrect passcode.");
    } else { adminPanel.classList.contains("hidden") ? showAdmin() : hideAdmin(); }
  });
  function showAdmin(){ adminPanel.classList.remove("hidden"); adminPanel.setAttribute("aria-hidden","false"); adminToggle.setAttribute("aria-expanded","true"); adminPanel.focus({preventScroll:true}); refreshOdds(); }
  function hideAdmin(){ adminPanel.classList.add("hidden"); adminPanel.setAttribute("aria-hidden","true"); adminToggle.setAttribute("aria-expanded","false"); }
  closeAdmin && closeAdmin.addEventListener("click", hideAdmin);

  saveAdmin && saveAdmin.addEventListener("click", ()=>{
    const s = stats[currentUser];
    const spins  = Math.max(0, Math.floor(Number(adminSpins.value)));
    const earned = Math.max(0, Number(adminEarned.value));
    const spent  = Math.max(0, Number(adminSpent.value));
    let luck     = clamp(Math.floor(Number(adminLuck.value)),0,100);
    let odds     = clamp(Math.floor(Number(adminOdds.value)),0,200);
    let rtpt     = clamp(Math.floor(Number(rtpTargetEl.value)),70,98);
    let rGain    = clamp(Math.floor(Number(rtpGainEl.value)),0,200);
    let d3pct    = clamp(Number(diamond3El.value)/100, 0, 0.05);
    s.spins=spins; s.earned=+earned.toFixed(2); s.spent=+spent.toFixed(2);
    s.luck=luck; s.odds=odds; s.rtpTarget=rtpt; s.rtpGain=rGain; s.diamond3=d3pct;
    saveStats(); renderStats(); refreshOdds(); hideAdmin();
  });

  add10Spins && add10Spins.addEventListener("click", ()=>{ stats[currentUser].spins = (stats[currentUser].spins||0)+10; saveStats(); renderStats(); refreshOdds(); });
  resetStatsBtn && resetStatsBtn.addEventListener("click", ()=>{
    if(confirm(`Reset stats for ${currentUser}?`)){
      stats[currentUser] = {spins:DEFAULT_SPINS, earned:0, spent:0, luck:DEFAULT_LUCK, odds:DEFAULT_ODDS, rtpTarget:DEFAULT_RTP_TARGET, rtpGain:DEFAULT_RTP_GAIN, dry:0, diamond3:FORCED_DIAMOND_PCT};
      saveStats(); renderStats(); refreshOdds();
    }
  });

  userSelect.addEventListener("change", ()=>{ currentUser=userSelect.value; localStorage.setItem("ll-v17-user", currentUser); renderStats(); refreshOdds(); hideAdmin(); });

  // Bet toggle
  bet10.addEventListener("click", ()=>{ betCents=10; localStorage.setItem("ll-v17-bet","10"); markBet(); renderPaytable(); refreshOdds(); });
  bet25.addEventListener("click", ()=>{ betCents=25; localStorage.setItem("ll-v17-bet","25"); markBet(); renderPaytable(); refreshOdds(); });

  // Base chances / Odds display
  function renderBaseChances(){
    if (!baseChances) return;
    const rows = SYMBOLS.slice().reverse().map(s=>{
      const pct = (100*s.weight/TOTAL_WEIGHT);
      return `
        <div class="odds-row">
          <div class="odds-line"><span>${icon(s.k)} ${labelFor(s.k)}</span><span>${pct.toFixed(2)}%</span></div>
          <div class="odds-bar"><span style="width:${pct}%"></span></div>
        </div>`;
    }).join("");
    baseChances.innerHTML = rows;
  }
  function labelFor(k){ return {diamond:"💎",seven:"7️⃣",star:"⭐",bell:"🔔",grape:"🍇",orange:"🍊",lemon:"🍋",cherry:"🍒"}[k]; }

  function refreshOdds(){
    if (!oddsGrid) return;
    const s = stats[currentUser];
    const trials = 8000;
    let c3 = {diamond:0, seven:0, star:0, bell:0, grape:0, orange:0, lemon:0, cherry:0};
    let twoCherry=0, twoOther=0, none=0, totalPaid=0;
    const d3 = s.diamond3 ?? FORCED_DIAMOND_PCT;
    for(let i=0;i<trials;i++){
      let midRow;
      if (Math.random()<d3){
        midRow=[DIAMOND,DIAMOND,DIAMOND];
      } else {
        const L = effectiveLuck() + pityBonusLuck();
        let row=[pickBiased(L), pickBiased(L), pickBiased(L)];
        row = upgradeRow(row, L);
        midRow=row;
      }
      const p = calcWinRow(midRow);
      totalPaid += p;
      const [a,b,c]=midRow.map(x=>x.k);
      if (a===b && b===c){ c3[a]++; continue; }
      const cherries=[a,b,c].filter(k=>k==="cherry").length;
      if (cherries===2) twoCherry++;
      else if (a===b || a===c || b===c) twoOther++;
      else none++;
    }
    const makeRow = (label, val) => {
      const pct = (100*val/trials);
      return `<div class="odds-row"><div class="odds-line"><span>${label}</span><span>${pct.toFixed(2)}%</span></div><div class="odds-bar"><span style="width:${pct}%"></span></div></div>`;
    };
    oddsGrid.innerHTML =
      makeRow("💎💎💎", c3.diamond) + makeRow("7️⃣7️⃣7️⃣", c3.seven) + makeRow("⭐⭐⭐", c3.star) +
      makeRow("🔔🔔🔔", c3.bell) + makeRow("🍇🍇🍇", c3.grape) + makeRow("🍊🍊🍊", c3.orange) +
      makeRow("🍋🍋🍋", c3.lemon) + makeRow("🍒🍒🍒", c3.cherry) +
      makeRow("🍒🍒X (exactly two)", twoCherry) + makeRow("Any other 2-of-a-kind", twoOther) +
      makeRow("No win", none);

    const bet = betCents/100;
    const rtp = 100 * (totalPaid / trials) / bet;
    const hitRate = 100 * (trials - none) / trials;
    rtpStats && (rtpStats.innerHTML = `Estimated Hit Rate: <b>${hitRate.toFixed(1)}%</b> · Estimated RTP: <b>${rtp.toFixed(1)}%</b> · Target: <b>${s.rtpTarget ?? DEFAULT_RTP_TARGET}%</b> · Odds: <b>${s.odds ?? DEFAULT_ODDS}%</b> · Diamond 3×: <b>${((s.diamond3 ?? FORCED_DIAMOND_PCT)*100).toFixed(1)}%</b>`);
  }

  // Controls
  spinBtn.addEventListener("click", ()=> doSpin());
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); } });
})();
