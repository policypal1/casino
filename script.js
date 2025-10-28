/* Brainrot Slots — 3×3 (v20; item images)
   - Uses 8 game items (best→least) from repo root .webp files
   - Economy: 1 token = 1M/s; min deposit 5 tokens
   - RTP governor targets ~47% (≈53/47 house/player)
   - Admin passcode 1111; “Top Symbol 3× Chance %” controls forced triple-top rate
*/

function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
const wait = (ms)=> new Promise(r=>setTimeout(r, ms));

(() => {
  // ===== ECONOMY / EDGE TUNING =====
  const DEFAULT_RTP_TARGET = 47;     // % returned to player
  const DEFAULT_RTP_GAIN   = 120;    // governor strength (0–200)
  const FORCED_TOP_PCT     = 0.005;  // 0–0.02 (up to 2% forced top 3×)
  const PITY_START_SPINS   = 3;
  const PITY_STEP_LUCK     = 10;
  const DEFAULT_ODDS       = 85;     // <100 = tighter
  const DEFAULT_LUCK       = 6;
  const MIN_DEPOSIT        = 5;      // tokens = M/s

  // === Brainrot items (best→least) ===
  // weights tuned like your prior table (rarer at top)
  const ITEMS = [
    { k:"strawberryelephant", file:"Strawberryelephant.webp",         label:"Strawberry Elephant", weight:5,  rank:8 }, // top
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

  // Payout multipliers (per 1🪙 bet) — integers
  const PAYX_3 = {
    strawberryelephant: 20,
    dragoncanneloni:    12,
    garamadundung:       8,
    carti:               6,
    saturnita:           5,
    tralalero:           4,
    sgedrftdikou:        3,
    noobini:             2,
  };
  const PAYX_2_CHERRY = 1; // “exactly two of a kind” special (we keep it for juice)
  const PAYX_2_OTHER  = 1;

  const USERS = ["Will","Isaac"];
  const DEFAULT_TOKENS = 0;

  // ----- State -----
  const storeKey = "brainrot-slots-v20";
  let stats = loadStats();
  let currentUser = ["Will","Isaac"].includes(localStorage.getItem("br20-user")) ? localStorage.getItem("br20-user") : "Will";
  let betTokens = Number(localStorage.getItem("br20-bet")) || 1;
  if (![1,5].includes(betTokens)) betTokens = 1;

  function baseUser(){
    return {tokens:DEFAULT_TOKENS, earned:0, spent:0, luck:DEFAULT_LUCK, odds:DEFAULT_ODDS, rtpTarget:DEFAULT_RTP_TARGET, rtpGain:DEFAULT_RTP_GAIN, dry:0, diamond3:FORCED_TOP_PCT};
  }
  function loadStats(){
    try{
      const raw = JSON.parse(localStorage.getItem(storeKey)||"{}");
      for (const u of USERS){
        if (!raw[u]) raw[u] = baseUser();
        const s = raw[u];
        if (s.tokens==null) s.tokens = 0;
        if (s.earned==null) s.earned = 0;
        if (s.spent==null)  s.spent  = 0;
        if (s.luck==null)   s.luck   = DEFAULT_LUCK;
        if (s.odds==null)   s.odds   = DEFAULT_ODDS;
        if (s.rtpTarget==null) s.rtpTarget = DEFAULT_RTP_TARGET;
        if (s.rtpGain==null)   s.rtpGain   = DEFAULT_RTP_GAIN;
        if (s.dry==null)    s.dry    = 0;
        if (s.diamond3==null) s.diamond3 = FORCED_TOP_PCT; // reuse key
      }
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
  const totalEarnedEl = document.getElementById("totalEarned");
  const totalSpentEl  = document.getElementById("totalSpent");
  const machineBetEl  = document.getElementById("machineBet");

  const adminToggle  = document.getElementById("adminToggle");
  const adminPanel   = document.getElementById("adminPanel");
  const closeAdmin   = document.getElementById("closeAdmin");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminTokens  = document.getElementById("adminTokens");
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
  const saveAdmin    = document.getElementById("saveAdmin");
  const add10Tokens  = document.getElementById("add10Tokens");
  const resetStatsBtn= document.getElementById("resetStats");
  const oddsGrid     = document.getElementById("oddsGrid");
  const baseChances  = document.getElementById("baseChances");
  const rtpStats     = document.getElementById("rtpStats");

  const bet1 = document.getElementById("bet1");
  const bet5 = document.getElementById("bet5");

  // ----- Helpers -----
  const CELL_H = 156;
  const imgHTML = (file, alt)=> `<img src="./${file}" alt="${alt}">`;
  function makeCell(inner, isMid=false){ const d=document.createElement("div"); d.className="cell"+(isMid?" mid":""); d.innerHTML=inner; return d; }
  function randItem(){ return ITEMS[(Math.random()*ITEMS.length)|0]; }
  function initReelTrack(reel){
    const track = reel.querySelector(".track"); track.innerHTML = "";
    for (let i=0;i<6;i++) track.appendChild(makeCell(imgHTML(randItem().file, "sym"), i===1));
  }

  // RNG & odds
  function pickBase(){
    let r = Math.random() * TOTAL_WEIGHT;
    for (const s of ITEMS){ if ((r -= s.weight) <= 0) return s; }
    return ITEMS[ITEMS.length-1];
  }
  function effectiveLuck(overrideOdds=null){
    const odds = (overrideOdds==null) ? (stats[currentUser].odds ?? DEFAULT_ODDS) : overrideOdds;
    const extra = (odds - 100) * 0.9;
    return clamp((stats[currentUser].luck ?? DEFAULT_LUCK) + extra, 0, 100);
  }
  function pityBonusLuck(){
    const dry = stats[currentUser].dry || 0;
    if (dry <= PITY_START_SPINS) return 0;
    const steps = dry - PITY_START_SPINS;
    return clamp(steps * PITY_STEP_LUCK, 0, 50);
  }
  function pickBiased(luck){
    const L = clamp(luck,0,100);
    const candidates = 1 + Math.floor(L / 22);
    let best = pickBase();
    for (let i=1;i<candidates;i++){ const c = pickBase(); if (c.rank > best.rank) best = c; }
    return best;
  }

  function calcWinRow(row){
    const [a,b,c] = row.map(x=>x.k);
    if (a===b && b===c) return PAYX_3[a];
    const counts = { [a]:1, [b]:(a===b?2:1), [c]:(a===c?2:(b===c?2:1)) };
    // “exactly two” — detect any pair
    const hasPair = counts[a]===2 || counts[b]===2 || counts[c]===2;
    if (hasPair){
      // give 2× if it's the noobini pair? We keep uniform: 1× for any pair;
      // special: if the pair is TOP, let governor handle rarity.
      return (a===b && b===c) ? 0 : PAYX_2_OTHER;
    }
    return 0;
  }

  function governorBoost(){
    const s = stats[currentUser];
    const spent = s.spent || 0;
    const earned = s.earned || 0;
    const target = s.rtpTarget ?? DEFAULT_RTP_TARGET;
    const gain   = s.rtpGain   ?? DEFAULT_RTP_GAIN;
    if (spent <= 0) return 1 + (gain/800);
    const rtp = 100 * earned / spent;
    const diff = target - rtp;
    const mult = 1 + clamp(diff/100, -0.3, 0.3) * (gain/100);
    return clamp(mult, 0.7, 1.35);
  }

  function upgradeRow(row, luck){
    const L = clamp(luck,0,100);
    const g = governorBoost();
    const oddsScale = (stats[currentUser].odds ?? DEFAULT_ODDS)/100;

    // tighter than your generous build
    let u  = 0.18 * g + (L/140) * 0.7 * oddsScale;             // make a pair
    let u2 = 0.09 * g + (L/320) * 0.6 * (0.8 + 0.3*oddsScale); // pair→three
    u = clamp(u, 0, 0.55); u2 = clamp(u2, 0, 0.42);

    const k = row.map(r=>r.k);
    const counts={}; k.forEach(x=>counts[x]=(counts[x]||0)+1);
    const hasThree = Object.values(counts).some(c=>c===3);
    const hasPair  = Object.values(counts).some(c=>c===2);

    if (!hasPair && !hasThree && Math.random()<u){
      const pool = row.slice().sort((a,b)=>a.rank-b.rank);
      let pick = pool[0]; if (pick.k===TOP.k) pick = pool[1]||pick; // avoid inflating top rate
      row[2] = pick;
    } else if (hasPair && !hasThree && Math.random()<u2){
      let sym = Object.entries(counts).find(([_,c])=>c===2)[0];
      if (sym===TOP.k && Math.random()<0.6) return row;           // resist upgrading to top 3×
      for (let i=0;i<3;i++) if (row[i].k!==sym) row[i]=row.find(r=>r.k===sym);
    }
    return row;
  }

  // UI
  function renderStats(){
    const s = stats[currentUser];
    tokenBalanceEl.textContent = `${(s.tokens||0)}🪙`;
    totalEarnedEl.textContent  = `${(s.earned||0)}🪙`;
    totalSpentEl.textContent   = `${(s.spent ||0)}🪙`;
    adminUserLabel && (adminUserLabel.textContent = currentUser);
    adminTokens    && (adminTokens.value = s.tokens);
    adminEarned    && (adminEarned.value = (s.earned||0));
    adminSpent     && (adminSpent.value  = (s.spent ||0));
    adminLuck      && (adminLuck.value   = s.luck ?? DEFAULT_LUCK);
    adminOdds      && (adminOdds.value   = s.odds ?? DEFAULT_ODDS);
    rtpTargetEl    && (rtpTargetEl.value = s.rtpTarget ?? DEFAULT_RTP_TARGET);
    rtpGainEl      && (rtpGainEl.value   = s.rtpGain   ?? DEFAULT_RTP_GAIN);
    diamond3El     && (diamond3El.value  = 100*(s.diamond3 ?? FORCED_TOP_PCT));
    pityStartEl    && (pityStartEl.value = PITY_START_SPINS);
    pityStepEl     && (pityStepEl.value  = PITY_STEP_LUCK);
    dryLabel       && (dryLabel.textContent = s.dry ?? 0);
    updateSpinEnabled();
  }
  function renderPaytable(){
    const rows = [
      [imgHTML(TOP.file, TOP.label).replace('">','" style="vertical-align:middle">').repeat(3), `${PAYX_3[TOP.k]}🪙`],
      [imgHTML("Dragoncanneloni.webp","Dragon Canneloni").repeat(3), `${PAYX_3.dragoncanneloni}🪙`],
      [imgHTML("Garamadundung.webp","Garamadundung").repeat(3), `${PAYX_3.garamadundung}🪙`],
      [imgHTML("Carti.webp","Carti").repeat(3), `${PAYX_3.carti}🪙`],
      [imgHTML("La_Vaccca_Saturno_Saturnita.webp","Saturnita").repeat(3), `${PAYX_3.saturnita}🪙`],
      [imgHTML("TralaleroTralala.webp","Tralalero").repeat(3), `${PAYX_3.tralalero}🪙`],
      [imgHTML("Sgedrftdikou.webp","Sgedrftdikou").repeat(3), `${PAYX_3.sgedrftdikou}🪙`],
      [imgHTML("Noobini_Pizzanini_NEW.webp","Noobini").repeat(3), `${PAYX_3.noobini}🪙`],
      ["Exactly two of a kind", `${PAYX_2_OTHER}🪙`, true],
    ];
    const payRows = document.getElementById("payRows");
    payRows.innerHTML = rows.map(([l,v,sub]) =>
      `<div class="pt-row${sub?' sub':''}"><span class="pt-sym">${l}</span><b>${v}</b></div>`
    ).join("");
  }
  function renderBaseChances(){
    if (!baseChances) return;
    const rows = ITEMS.slice().map(s=>{
      const pct = (100*s.weight/TOTAL_WEIGHT);
      return `
        <div class="odds-row">
          <div class="odds-line"><span>${imgHTML(s.file, s.label)} ${s.label}</span><span>${pct.toFixed(2)}%</span></div>
          <div class="odds-bar"><span style="width:${pct}%"></span></div>
        </div>`;
    }).join("");
    baseChances.innerHTML = rows;
  }
  function markBet(){
    document.getElementById("bet1").classList.toggle("active", betTokens===1);
    document.getElementById("bet5").classList.toggle("active", betTokens===5);
    document.getElementById("machineBet").textContent = `${betTokens}🪙`;
  }
  function updateSpinEnabled(){
    const s = stats[currentUser];
    if (spinBtn) spinBtn.disabled = ((s.tokens||0) < betTokens);
  }

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
    if ((s.tokens||0) < betTokens){
      messageEl.textContent = "Insufficient tokens. Deposit a chatcher (≥ 5🪙).";
      return;
    }

    spinning=true; machine.classList.add("spinning");
    reelEls.forEach(r=>r.classList.remove("stopped"));

    // Take bet
    s.tokens -= betTokens;
    s.spent  = Math.round((s.spent||0) + betTokens);
    saveStats(); renderStats();

    // Build row (luck + pity), with optional forced top 3×
    const luck = effectiveLuck() + pityBonusLuck();
    let midRow;

    if (Math.random() < (s.diamond3 ?? FORCED_TOP_PCT)){ // reuse storage key
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
    const win  = Math.round(mult * betTokens);
    if (win>0){
      s.tokens = Math.round((s.tokens||0) + win);
      s.earned = Math.round((s.earned||0) + win);
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
    winAmount && (winAmount.textContent = `+${win}🪙`);
    const triple = (row[0].k===row[1].k && row[1].k===row[2].k) ? row[0].k : null;
    winTitle && (winTitle.textContent = (triple===TOP.k) ? "JACKPOT!" : (win>=8 ? "MEGA WIN!" : "BIG WIN!"));
    if (winModal){ winModal.classList.remove("hidden"); winModal.classList.add("show"); setTimeout(()=>{ winModal.classList.remove("show"); setTimeout(()=>winModal.classList.add("hidden"), 250); }, 2400); }
    if (winBanner){ winBanner.textContent = `✨ You won +${win}🪙 ✨`; winBanner.classList.add("show"); setTimeout(()=> winBanner.classList.remove("show"), 2000); }
  }
  function showNoWin(){
    if (!noWinModal) return;
    noWinModal.classList.remove("hidden"); noWinModal.classList.add("show");
    setTimeout(()=>{ noWinModal.classList.remove("show"); setTimeout(()=>noWinModal.classList.add("hidden"), 220); }, 1200);
  }

  // Economy buttons
  depositBtn.addEventListener("click", ()=>{
    const s = stats[currentUser];
    const val = prompt(`Enter your chatcher's production (M/s). Minimum ${MIN_DEPOSIT} (converts 1:1 to tokens).`, `${Math.max(MIN_DEPOSIT, 5)}`);
    if (val==null) return;
    const tokens = Math.floor(Number(val) || 0);
    if (!Number.isFinite(tokens) || tokens < MIN_DEPOSIT){
      alert(`Minimum deposit is ${MIN_DEPOSIT} tokens (i.e., ${MIN_DEPOSIT}M/s chatcher).`);
      return;
    }
    s.tokens = Math.round((s.tokens||0) + tokens);
    messageEl.textContent = `Deposited ${tokens}🪙 (from ${tokens}M/s chatcher).`;
    saveStats(); renderStats();
  });

  cashoutBtn.addEventListener("click", ()=>{
    const s = stats[currentUser];
    const bal = Math.max(0, Math.floor(s.tokens||0));
    if (bal <= 0){ alert("Nothing to cash out."); return; }
    if (confirm(`Cash out ${bal}🪙 → ${bal}M/s Brainrot? Your in-game payout will be a ${bal}M/s Brainrot. Continue?`)){
      alert(`Cashed out: ${bal}M/s Brainrot awarded!`);
      s.tokens = 0; saveStats(); renderStats();
    }
  });

  // Admin
  let adminUnlocked = localStorage.getItem("br20-admin") === "1";
  document.getElementById("adminToggle")?.addEventListener("click", ()=>{
    if(!adminUnlocked){
      const code = prompt("Enter admin passcode:");
      if(code==="1111"){ adminUnlocked=true; localStorage.setItem("br20-admin","1"); showAdmin(); }
      else alert("Incorrect passcode.");
    } else { adminPanel.classList.contains("hidden") ? showAdmin() : hideAdmin(); }
  });
  function showAdmin(){ adminPanel.classList.remove("hidden"); adminPanel.setAttribute("aria-hidden","false"); rtpStats && refreshOdds(); }
  function hideAdmin(){ adminPanel.classList.add("hidden"); adminPanel.setAttribute("aria-hidden","true"); }
  closeAdmin && closeAdmin.addEventListener("click", hideAdmin);

  saveAdmin && saveAdmin.addEventListener("click", ()=>{
    const s = stats[currentUser];
    const tokens = Math.max(0, Math.floor(Number(adminTokens.value)));
    const earned = Math.max(0, Math.floor(Number(adminEarned.value)));
    const spent  = Math.max(0, Math.floor(Number(adminSpent.value)));
    let luck     = clamp(Math.floor(Number(adminLuck.value)),0,100);
    let odds     = clamp(Math.floor(Number(adminOdds.value)),0,200);
    let rtpt     = clamp(Math.floor(Number(rtpTargetEl.value)),35,70);
    let rGain    = clamp(Math.floor(Number(rtpGainEl.value)),0,200);
    let topPct   = clamp(Number(diamond3El.value)/100, 0, 0.02);
    s.tokens=tokens; s.earned=earned; s.spent=spent;
    s.luck=luck; s.odds=odds; s.rtpTarget=rtpt; s.rtpGain=rGain; s.diamond3=topPct;
    saveStats(); renderStats(); refreshOdds(); hideAdmin();
  });

  add10Tokens && add10Tokens.addEventListener("click", ()=>{ stats[currentUser].tokens = (stats[currentUser].tokens||0)+10; saveStats(); renderStats(); refreshOdds(); });
  resetStatsBtn && resetStatsBtn.addEventListener("click", ()=>{
    if(confirm(`Reset stats for ${currentUser}?`)){
      stats[currentUser] = {tokens:DEFAULT_TOKENS, earned:0, spent:0, luck:DEFAULT_LUCK, odds:DEFAULT_ODDS, rtpTarget:DEFAULT_RTP_TARGET, rtpGain:DEFAULT_RTP_GAIN, dry:0, diamond3:FORCED_TOP_PCT};
      saveStats(); renderStats(); refreshOdds();
    }
  });

  userSelect.addEventListener("change", ()=>{ currentUser=userSelect.value; localStorage.setItem("br20-user", currentUser); renderStats(); refreshOdds(); hideAdmin(); });

  // Bet toggle
  bet1.addEventListener("click", ()=>{ betTokens=1; localStorage.setItem("br20-bet","1"); markBet(); refreshOdds(); updateSpinEnabled(); });
  bet5.addEventListener("click", ()=>{ betTokens=5; localStorage.setItem("br20-bet","5"); markBet(); refreshOdds(); updateSpinEnabled(); });

  // Odds preview (admin)
  function refreshOdds(){
    if (!oddsGrid) return;
    const s = stats[currentUser];
    const trials = 6000;
    let c3 = Object.fromEntries(ITEMS.map(x=>[x.k,0]));
    let pairs=0, none=0, totalPaid=0;
    const top3 = s.diamond3 ?? FORCED_TOP_PCT;

    for(let i=0;i<trials;i++){
      let midRow;
      if (Math.random()<top3){
        midRow=[TOP,TOP,TOP];
      } else {
        const L = effectiveLuck() + pityBonusLuck();
        let row=[pickBiased(L), pickBiased(L), pickBiased(L)];
        row = upgradeRow(row, L);
        midRow=row;
      }
      const p = calcWinRow(midRow);
      totalPaid += p;
      const [a,b,c]=midRow.map(x=>x.k);
      if (a===b && b===c){ c3[a]++; }
      else if (a===b || a===c || b===c) pairs++;
      else none++;
    }
    const makeRow = (label, val, file) => {
      const pct = (100*val/trials);
      return `<div class="odds-row"><div class="odds-line"><span>${imgHTML(file,label)} ${label}</span><span>${pct.toFixed(2)}%</span></div><div class="odds-bar"><span style="width:${pct}%"></span></div></div>`;
    };
    oddsGrid.innerHTML =
      ITEMS.map(s=>makeRow(s.label, c3[s.k], s.file)).join("") +
      makeRow("Any 2-of-a-kind", pairs, ITEMS[ITEMS.length-1].file) +
      makeRow("No win", none, ITEMS[ITEMS.length-2].file);

    const rtp = 100 * (totalPaid / trials); // per 1🪙 bet
    const hitRate = 100 * (trials - none) / trials;
    rtpStats && (rtpStats.innerHTML = `Estimated Hit Rate: <b>${hitRate.toFixed(1)}%</b> · Estimated RTP: <b>${rtp.toFixed(1)}%</b> · Target: <b>${s.rtpTarget ?? DEFAULT_RTP_TARGET}%</b> · Odds: <b>${s.odds ?? DEFAULT_ODDS}%</b> · Top 3×: <b>${((top3)*100).toFixed(2)}%</b>`);
  }

  // Init
  userSelect.value = currentUser;
  [1,2,3].forEach(i=>initReelTrack(document.getElementById(`reel-${i}`)));
  renderStats(); renderPaytable(); renderBaseChances(); markBet(); updateSpinEnabled();

  // Controls
  spinBtn.addEventListener("click", ()=> doSpin());
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); } });
})();
