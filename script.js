/* Lucky Lemons — 3×3 Cylinder Edition (v11)
   Updates:
   - Big red NO WIN modal
   - More frequent small wins (6¢ any pair, 12¢ exactly two cherries)
   - Admin “Odds (Tight ⇄ Loose)” slider (0–200). 100 = neutral.
     Boosts pairs & mid-tier triples; diamonds are NOT buffed.
   - Long spins: ~5s, ~7s, ~10s; start with 0 spins.
   - SVG icons (crisp)
*/
(() => {
  // ---------- Config ----------
  const USERS = ["Will", "Isaac"];
  const DEFAULT_SPINS = 0; // start at zero

  // Payouts (per 25¢). 10¢ = ×0.4
  const BASE_PAY_3 = {
    diamond: 4.50,
    seven:   2.80,
    star:    1.70,
    bell:    1.20,
    grape:   1.00,
    orange:  0.82,
    lemon:   0.65,
    cherry:  0.55
  };
  // Small wins target: 6¢ & 12¢ at 25¢ bet
  const BASE_PAY_2_CHERRY = 0.12; // exactly two cherries
  const BASE_PAY_2_OTHER  = 0.06; // any other 2-of-a-kind

  // Symbol weights (sum 100). Diamonds fixed at 5%.
  const SYMBOLS = [
    { k: "cherry",  weight: 20, rank: 1 },
    { k: "lemon",   weight: 18, rank: 2 },
    { k: "orange",  weight: 16, rank: 3 },
    { k: "grape",   weight: 14, rank: 4 },
    { k: "bell",    weight: 12, rank: 5 },
    { k: "star",    weight: 10, rank: 6 },
    { k: "seven",   weight:  5, rank: 7 },
    { k: "diamond", weight:  5, rank: 8 }, // do not change
  ];
  const TOTAL_WEIGHT = SYMBOLS.reduce((s,x)=>s+x.weight,0);

  // SVG icons (crisp)
  const ICON_SVGS = {
    diamond: `<svg viewBox="0 0 100 100" class="ico-base ico-diamond"><defs><linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></linearGradient></defs><polygon points="20,15 80,15 95,40 50,90 5,40" fill="url(#gd)" stroke="#aee3ff" stroke-width="4" stroke-linejoin="round"/><polyline points="20,15 50,50 80,15" fill="none" stroke="#dff4ff" stroke-width="2" opacity=".7"/></svg>`,
    seven: `<svg viewBox="0 0 100 100" class="ico-base ico-seven"><defs><linearGradient id="g7" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></linearGradient></defs><path d="M20 20 H82 L44 86 H22 L58 32 H20 Z" fill="url(#g7)" stroke="#0c3b35" stroke-width="6" stroke-linejoin="round"/></svg>`,
    star: `<svg viewBox="0 0 100 100" class="ico-base ico-star"><defs><linearGradient id="gs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></linearGradient></defs><path d="M50 8 L61 36 L91 36 L66 54 L75 84 L50 66 L25 84 L34 54 L9 36 L39 36 Z" fill="url(#gs)" stroke="#3a2a00" stroke-width="5" stroke-linejoin="round"/></svg>`,
    bell: `<svg viewBox="0 0 100 100" class="ico-base ico-bell"><defs><linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></linearGradient></defs><path d="M50 16c-12 0-22 9-22 20v14c0 8-5 13-10 18h64c-5-5-10-10-10-18V36c0-11-10-20-22-20z" fill="url(#gb)" stroke="#6d4c00" stroke-width="5" /><circle cx="50" cy="78" r="6" fill="#ffecb3" stroke="#6d4c00" stroke-width="4"/></svg>`,
    grape: `<svg viewBox="0 0 100 100" class="ico-base ico-grape"><defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></linearGradient></defs><circle cx="50" cy="18" r="6" fill="#6fbf73"/><rect x="48" y="18" width="4" height="10" fill="#4e8b56"/><g fill="url(#gg)" stroke="#3b2666" stroke-width="4"><circle cx="35" cy="50" r="11"/><circle cx="50" cy="50" r="11"/><circle cx="65" cy="50" r="11"/><circle cx="42" cy="64" r="11"/><circle cx="58" cy="64" r="11"/></g></svg>`,
    orange: `<svg viewBox="0 0 100 100" class="ico-base ico-orange"><defs><linearGradient id="go" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></linearGradient></defs><circle cx="50" cy="55" r="26" fill="url(#go)" stroke="#6e2a00" stroke-width="5"/><path d="M52 28c10-6 16-6 22-2-6 2-12 5-22 2z" fill="#7ac96d" stroke="#2b5e2c" stroke-width="3"/></svg>`,
    lemon: `<svg viewBox="0 0 100 100" class="ico-base ico-lemon"><defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></linearGradient></defs><ellipse cx="52" cy="55" rx="30" ry="22" fill="url(#gl)" stroke="#7a6200" stroke-width="5"/><circle cx="33" cy="55" r="3" fill="#fff" opacity=".5"/><path d="M48 28c-9-5-15-5-21-2 6 2 11 5 21 2z" fill="#7ac96d" stroke="#2b5e2c" stroke-width="3"/></svg>`,
    cherry: `<svg viewBox="0 0 100 100" class="ico-base ico-cherry"><defs><linearGradient id="gc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--a)"/><stop offset="1" stop-color="var(--b)"/></linearGradient></defs><path d="M32 34c10 10 22 8 32 0" fill="none" stroke="#2b5e2c" stroke-width="5"/><circle cx="36" cy="62" r="12" fill="url(#gc)" stroke="#5c0b0b" stroke-width="5"/><circle cx="58" cy="62" r="12" fill="url(#gc)" stroke="#5c0b0b" stroke-width="5"/><path d="M50 30 c8-8 16-10 24-10" fill="none" stroke="#2b5e2c" stroke-width="5"/></svg>`
  };

  // ---------- State ----------
  const storeKey = "lucky-lemons-v11-stats";
  let stats = loadStats();
  let currentUser = USERS.includes(localStorage.getItem("ll-v11-user")) ? localStorage.getItem("ll-v11-user") : USERS[0];
  let betCents = Number(localStorage.getItem("ll-v11-bet")) || 25;
  if (![10,25].includes(betCents)) betCents = 25;

  function loadStats(){
    try{
      const raw = JSON.parse(localStorage.getItem(storeKey)||"{}");
      for (const u of USERS) {
        if (!raw[u]) raw[u] = { spins: DEFAULT_SPINS, earned: 0, spent: 0, luck: 0, odds: 100 };
        if (raw[u].odds==null) raw[u].odds = 100;
        ["spins","earned","spent","luck","odds"].forEach(k=>{
          if (!Number.isFinite(raw[u][k])) raw[u][k] = (k==="spins")?DEFAULT_SPINS:(k==="odds"?100:0);
        });
      }
      return raw;
    }catch{
      return Object.fromEntries(USERS.map(u=>[u,{spins:DEFAULT_SPINS,earned:0,spent:0,luck:0,odds:100}]));
    }
  }
  function saveStats(){ localStorage.setItem(storeKey, JSON.stringify(stats)); }

  // ---------- DOM ----------
  const machine = document.getElementById("machine");
  const reelEls = [1,2,3].map(i => document.getElementById(`reel-${i}`));
  const spinBtn = document.getElementById("spinBtn");
  const messageEl = document.getElementById("message");
  const winBanner = document.getElementById("winBanner");
  const winModal  = document.getElementById("winModal");
  const winBox    = document.getElementById("winBox");
  const winTitle  = document.getElementById("winTitle");
  const winAmount = document.getElementById("winAmount");
  const flashOverlay = document.getElementById("flashOverlay");
  const noWinModal = document.getElementById("noWinModal");

  const userSelect = document.getElementById("userSelect");
  const spinsLeftEl = document.getElementById("spinsLeft");
  const totalEarnedEl = document.getElementById("totalEarned");
  const totalSpentEl  = document.getElementById("totalSpent");
  const machineBetEl  = document.getElementById("machineBet");

  const adminToggle  = document.getElementById("adminToggle");
  const adminPanel   = document.getElementById("adminPanel");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminSpins   = document.getElementById("adminSpins");
  const adminEarned  = document.getElementById("adminEarned");
  const adminSpent   = document.getElementById("adminSpent");
  const adminLuck    = document.getElementById("adminLuck");
  const adminOdds    = document.getElementById("adminOdds");
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

  // FX
  const confettiCanvas = document.getElementById("confettiCanvas");
  const ctx = confettiCanvas.getContext("2d");
  const balloonLayer = document.getElementById("balloonLayer");
  resizeCanvas(); window.addEventListener("resize", resizeCanvas);

  // ---------- Init ----------
  userSelect.value = currentUser;
  markBet(); renderStats(); renderPaytable(); renderBaseChances(); refreshOdds(); updateSpinEnabled();
  reelEls.forEach(initReelTrack);

  // ---------- RNG & Odds ----------
  function pickBase(){
    let r = Math.random() * TOTAL_WEIGHT;
    for (const s of SYMBOLS) { if ((r -= s.weight) <= 0) return s; }
    return SYMBOLS[SYMBOLS.length-1];
  }
  function effectiveLuck(){
    // base boost at 10¢ so it doesn’t feel cold
    const base = (betCents===10 ? 14 : 0);
    // odds slider → extra “luck-like” bias
    const odds = stats[currentUser].odds ?? 100; // 0..200
    const extra = (odds - 100) * 0.9;            // +/- 90 points at extremes
    return Math.max(0, Math.min(100, stats[currentUser].luck + base + extra));
  }
  function pickBiased(luck){
    const L = Math.max(0, Math.min(100, luck));
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

  // Pair/triple upgrade — scaled by Odds; diamonds never upgraded to triple
  function upgradeRow(row, luck){
    const L = Math.max(0, Math.min(100, luck));
    const oddsScale = (stats[currentUser].odds ?? 100) / 100; // 0..2
    const u  = Math.min(0.55, (L/120) * oddsScale); // make a pair
    let   u2 = Math.min(0.28, (L/280) * (0.8 + 0.4*oddsScale)); // upgrade pair→triple

    // Bias triples toward non-diamond mid-tier when generous
    const preferNonDiamond = true;

    const k = row.map(r=>r.k);
    const counts={}; k.forEach(x=>counts[x]=(counts[x]||0)+1);
    const hasThree = Object.values(counts).some(c=>c===3);
    const hasPair  = Object.values(counts).some(c=>c===2);

    if (!hasPair && !hasThree && Math.random()<u){
      // create a pair — prefer lower/mid symbols
      const pool = row.slice().sort((a,b)=>a.rank-b.rank);
      let pick = pool[0];
      if (preferNonDiamond && pick.k==="diamond") pick = pool[1]||pick;
      row[2] = pick;
    } else if (hasPair && !hasThree && Math.random()<u2){
      let sym = Object.entries(counts).find(([_,c])=>c===2)[0];
      if (sym==="diamond") {
        // do NOT promote diamond pairs to triple
      } else {
        for (let i=0;i<3;i++) if (row[i].k!==sym) row[i]=row.find(r=>r.k===sym);
      }
    }
    return row;
  }

  // ---------- UI ----------
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
    totalEarnedEl.textContent = `$${s.earned.toFixed(2)}`;
    totalSpentEl.textContent  = `$${s.spent.toFixed(2)}`;
    adminUserLabel.textContent = currentUser;
    adminSpins.value = s.spins;
    adminEarned.value = s.earned.toFixed(2);
    adminSpent.value  = s.spent.toFixed(2);
    adminLuck.value   = s.luck;
    adminOdds.value   = s.odds ?? 100;
    updateSpinEnabled();
  }
  function markBet(){
    bet10.classList.toggle("active", betCents===10);
    bet25.classList.toggle("active", betCents===25);
    machineBetEl.textContent = betCents===25 ? "25¢" : "10¢";
  }
  function updateSpinEnabled(){ spinBtn.disabled = stats[currentUser].spins <= 0; }

  // ---------- Reel building & smooth scroll ----------
  const CELL_H = 150 + 6;
  function icon(k){ return ICON_SVGS[k]; }
  function initReelTrack(reel){
    const track = reel.querySelector(".track");
    track.innerHTML = "";
    for (let i=0;i<6;i++) track.appendChild(makeCell(icon(randSymbol().k), i===1));
  }
  function makeCell(svg, isMid=false){
    const d = document.createElement("div");
    d.className = "cell" + (isMid ? " mid" : "");
    d.innerHTML = svg;
    return d;
  }
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
      track.style.transition = "transform 180ms ease-out";
      track.style.transform = `translateY(${distance + 18}px)`; await wait(180);
      track.style.transition = "transform 210ms ease-in";
      track.style.transform = `translateY(${distance}px)`; await wait(210);
    }
    reel.classList.add("stopped");
  }

  // ---------- Spin flow ----------
  let spinning=false;

  async function doSpin(){
    if (spinning) return;
    const s = stats[currentUser];
    if (s.spins <= 0) { flash("No spins left. Add more in Admin."); return; }

    spinning=true; machine.classList.add("spinning");
    reelEls.forEach(r=>r.classList.remove("stopped"));

    s.spins -= 1; s.spent = +(s.spent + betCents/100).toFixed(2); saveStats(); renderStats();

    const L = effectiveLuck();
    let midRow = [pickBiased(L), pickBiased(L), pickBiased(L)];
    midRow = upgradeRow(midRow, L);

    const finals = [
      {top: randSymbol(), mid: midRow[0], bot: randSymbol()},
      {top: randSymbol(), mid: midRow[1], bot: randSymbol()},
      {top: randSymbol(), mid: midRow[2], bot: randSymbol()},
    ];

    // Long spins: ~5s, ~7s, ~10s
    await scrollReelTo(reelEls[0], finals[0], 70, 1, 5000);
    await wait(350);
    await scrollReelTo(reelEls[1], finals[1], 90, 1, 7000);
    await wait(450);
    await scrollReelTo(reelEls[2], finals[2], 120, 2, 10000);

    const win = calcWinRow(midRow);
    const symTriple = (midRow[0].k===midRow[1].k && midRow[1].k===midRow[2].k) ? midRow[0].k : null;

    if (win>0){
      stats[currentUser].earned = +(stats[currentUser].earned + win).toFixed(2);
      saveStats(); renderStats();
      celebrate(win);
      if (symTriple==="diamond") jackpotBlast(win);
      else if (win >= 1.50) showWinModal("MEGA WIN", win);
      else showWinModal("BIG WIN", win);
      flash(`Win $${win.toFixed(2)} on the middle row!`);
    } else {
      showNoWinModal();
      flash("No win. Try again!");
    }

    machine.classList.remove("spinning");
    spinning=false;
  }

  function flash(t){ messageEl.textContent = t; }
  const wait = (ms)=> new Promise(r=>setTimeout(r, ms));

  // ---------- Celebrations ----------
  function celebrate(amount){
    const tier = amount>=3 ? "JACKPOT" : amount>=1.5 ? "MEGA WIN" : "BIG WIN";
    winBanner.textContent = `✨ ${tier}! You won $${amount.toFixed(2)} ✨`;
    winBanner.classList.add("show");
    messageEl.classList.add("win");
    burstConfetti(1400);
    launchBalloons(18);
    setTimeout(()=> winBanner.classList.remove("show"), 2800);
    setTimeout(()=> messageEl.classList.remove("win"), 1600);
  }
  function showWinModal(title, amount){
    winTitle.textContent = title;
    winAmount.textContent = `$${amount.toFixed(2)}`;
    winBox.classList.remove("shake");
    winModal.classList.add("show");
    winModal.classList.remove("hidden");
    setTimeout(()=>{ winModal.classList.remove("show"); setTimeout(()=>winModal.classList.add("hidden"), 250); }, 3000);
    winModal.addEventListener("click", ()=>{ winModal.classList.remove("show"); setTimeout(()=>winModal.classList.add("hidden"), 250); }, { once:true });
  }
  function showNoWinModal(){
    noWinModal.classList.add("show");
    noWinModal.classList.remove("hidden");
    setTimeout(()=>{ noWinModal.classList.remove("show"); setTimeout(()=>noWinModal.classList.add("hidden"), 220); }, 1600);
    noWinModal.addEventListener("click", ()=>{ noWinModal.classList.remove("show"); setTimeout(()=>noWinModal.classList.add("hidden"), 220); }, { once:true });
  }
  function jackpotBlast(amount){
    flashOverlay.classList.remove("hidden");
    flashOverlay.classList.add("show");
    document.body.classList.add("shake");
    burstConfetti(2000);
    setTimeout(()=>{ flashOverlay.classList.remove("show"); setTimeout(()=>flashOverlay.classList.add("hidden"), 200); document.body.classList.remove("shake"); }, 900);
  }

  function resizeCanvas(){ confettiCanvas.width=innerWidth; confettiCanvas.height=innerHeight; }
  let confettiAnim=null;
  function burstConfetti(durationMs=1200){
    const colors=["#ffd166","#ffe082","#ff8a65","#4dd0e1","#81c784","#ba68c8","#fff59d"];
    const parts=[]; const count=280;
    for(let i=0;i<count;i++){
      parts.push({x:innerWidth*(0.2+Math.random()*0.6),y:innerHeight*0.34,vx:(Math.random()-0.5)*7,vy:-(3+Math.random()*7),s:4+Math.random()*6,c:colors[(Math.random()*colors.length)|0],r:Math.random()*Math.PI,vr:(Math.random()-0.5)*0.2,ay:0.16});
    }
    let start=null; confettiCanvas.classList.remove("hidden");
    function step(ts){
      if(!start) start=ts; const e=ts-start; ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
      for(const p of parts){ p.x+=p.vx; p.y+=p.vy; p.vy+=p.ay; p.r+=p.vr; ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s); ctx.restore(); }
      if(e<durationMs){ confettiAnim=requestAnimationFrame(step); }
      else{ ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height); confettiCanvas.classList.add("hidden"); cancelAnimationFrame(confettiAnim); confettiAnim=null; }
    }
    confettiAnim=requestAnimationFrame(step);
  }
  function launchBalloons(count=16){
    balloonLayer.classList.remove("hidden");
    const colors=["#ff8a80","#ffd166","#81c784","#64b5f6","#ba68c8","#fff59d"];
    for (let i=0;i<count;i++){
      const b=document.createElement("div");
      b.className="balloon";
      b.style.left = `${6+Math.random()*88}vw`;
      b.style.setProperty("--balloonColor", colors[(Math.random()*colors.length)|0]);
      b.style.setProperty("--t", `${4+Math.random()*3}s`);
      balloonLayer.appendChild(b);
      setTimeout(()=> b.remove(), 5200);
    }
    setTimeout(()=> balloonLayer.classList.add("hidden"), 5400);
  }

  // ---------- Admin & Odds ----------
  let adminUnlocked=false;
  adminToggle.addEventListener("click", ()=>{
    if(!adminUnlocked){
      const code = prompt("Enter admin passcode:");
      if(code==="1111"){ adminUnlocked=true; showAdmin(); refreshOdds(); }
      else alert("Incorrect passcode.");
    } else {
      adminPanel.classList.contains("hidden") ? (showAdmin(), refreshOdds()) : hideAdmin();
    }
  });
  function showAdmin(){ adminPanel.classList.remove("hidden"); adminPanel.setAttribute("aria-hidden","false"); }
  function hideAdmin(){ adminPanel.classList.add("hidden"); adminPanel.setAttribute("aria-hidden","true"); }

  saveAdmin.addEventListener("click", ()=>{
    const spins  = Math.max(0, Math.floor(Number(adminSpins.value)));
    const earned = Math.max(0, Number(adminEarned.value));
    const spent  = Math.max(0, Number(adminSpent.value));
    let luck     = Math.max(0, Math.min(100, Math.floor(Number(adminLuck.value))));
    let odds     = Math.max(0, Math.min(200, Math.floor(Number(adminOdds.value))));
    if(!Number.isFinite(spins)||!Number.isFinite(earned)||!Number.isFinite(spent)||!Number.isFinite(luck)||!Number.isFinite(odds)){ alert("Invalid values."); return; }
    stats[currentUser].spins=spins; stats[currentUser].earned=+earned.toFixed(2);
    stats[currentUser].spent=+spent.toFixed(2); stats[currentUser].luck=luck; stats[currentUser].odds=odds;
    saveStats(); renderStats(); refreshOdds(); hideAdmin();
  });
  add10Spins.addEventListener("click", ()=>{ stats[currentUser].spins += 10; saveStats(); renderStats(); refreshOdds(); });
  resetStatsBtn.addEventListener("click", ()=>{
    if(confirm(`Reset stats for ${currentUser}?`)){
      stats[currentUser] = {spins:DEFAULT_SPINS, earned:0, spent:0, luck:0, odds:100};
      saveStats(); renderStats(); refreshOdds();
    }
  });

  userSelect.addEventListener("change", ()=>{ currentUser=userSelect.value; localStorage.setItem("ll-v11-user", currentUser); renderStats(); refreshOdds(); hideAdmin(); });
  bet10.addEventListener("click", ()=>{ betCents=10; localStorage.setItem("ll-v11-bet","10"); markBet(); renderPaytable(); refreshOdds(); });
  bet25.addEventListener("click", ()=>{ betCents=25; localStorage.setItem("ll-v11-bet","25"); markBet(); renderPaytable(); refreshOdds(); });

  // Base chances (from weights)
  function renderBaseChances(){
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
  function labelFor(k){
    return {diamond:"💎",seven:"7️⃣",star:"⭐",bell:"🔔",grape:"🍇",orange:"🍊",lemon:"🍋",cherry:"🍒"}[k];
  }

  // Monte-Carlo odds + RTP
  function refreshOdds(){
    const L = effectiveLuck();
    const trials = 16000;
    let c3 = {diamond:0, seven:0, star:0, bell:0, grape:0, orange:0, lemon:0, cherry:0};
    let twoCherry=0, twoOther=0, none=0;
    let totalPaid=0;
    for(let i=0;i<trials;i++){
      let row=[pickBiased(L), pickBiased(L), pickBiased(L)];
      row = upgradeRow(row, L);
      const [a,b,c]=row.map(x=>x.k);
      const p = calcWinRow(row);
      totalPaid += p;
      if (a===b && b===c){ c3[a]++; continue; }
      const cherries=[a,b,c].filter(k=>k==="cherry").length;
      if (cherries===2) twoCherry++;
      else if (a===b || a===c || b===c) twoOther++;
      else none++;
    }
    const makeRow = (label, valPct) => {
      const pct = (100*valPct/trials);
      return `
        <div class="odds-row">
          <div class="odds-line"><span>${label}</span><span>${pct.toFixed(2)}%</span></div>
          <div class="odds-bar"><span style="width:${pct}%;"></span></div>
        </div>`;
    };
    oddsGrid.innerHTML =
      makeRow("💎💎💎", c3.diamond) +
      makeRow("7️⃣7️⃣7️⃣", c3.seven) +
      makeRow("⭐⭐⭐", c3.star) +
      makeRow("🔔🔔🔔", c3.bell) +
      makeRow("🍇🍇🍇", c3.grape) +
      makeRow("🍊🍊🍊", c3.orange) +
      makeRow("🍋🍋🍋", c3.lemon) +
      makeRow("🍒🍒🍒", c3.cherry) +
      makeRow("🍒🍒X (exactly two)", twoCherry) +
      makeRow("Any other 2-of-a-kind", twoOther) +
      makeRow("No win", none);

    const bet = betCents/100;
    const rtp = 100 * (totalPaid / trials) / bet;
    const hitRate = 100 * (trials - none) / trials;
    rtpStats.innerHTML = `Estimated Hit Rate: <b>${hitRate.toFixed(1)}%</b> · Estimated RTP (demo tuning): <b>${rtp.toFixed(1)}%</b> · Odds: <b>${stats[currentUser].odds}%</b>`;
  }

  // Controls
  spinBtn.addEventListener("click", ()=> doSpin());
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); } });
})();
