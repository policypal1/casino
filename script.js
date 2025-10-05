/* Lucky Lemons — 3×3 Cylinder Edition (polished)
   - Static rainbow frame; bigger reels; smooth scroll (no flashing)
   - As each reel stops, middle cell lifts with gold highlight and stays until next spin
   - Diamonds target ~3% per symbol appearance; payouts reduced to keep edge
   - Bet 10¢/25¢; per-user spins/earned/spent/luck; odds estimator
*/
(() => {
  // ---------- Config ----------
  const USERS = ["Will", "Isaac"];
  const DEFAULT_SPINS = 20;

  // Payouts (25¢). 10¢ = ×0.4
  const BASE_PAY_3 = {
    diamond: 4.25,  // lowered
    seven:   3.10,
    star:    1.85,
    bell:    1.20,
    grape:   0.95,
    orange:  0.75,
    lemon:   0.60,
    cherry:  0.50
  };
  const BASE_PAY_2_CHERRY = 0.12;
  const BASE_PAY_2_OTHER  = 0.06;

  // Symbol set — weights sum to ~100, diamond ≈ 3%
  const SYMBOLS = [
    { k: "cherry",  glyph: "🍒", weight: 23, rank: 1 },
    { k: "lemon",   glyph: "🍋", weight: 19, rank: 2 },
    { k: "orange",  glyph: "🍊", weight: 16, rank: 3 },
    { k: "grape",   glyph: "🍇", weight: 14, rank: 4 },
    { k: "bell",    glyph: "🔔", weight: 11, rank: 5 },
    { k: "star",    glyph: "⭐", weight:  9, rank: 6 },
    { k: "seven",   glyph: "7️⃣", weight:  5, rank: 7 },
    { k: "diamond", glyph: "💎", weight:  3, rank: 8 },
  ];
  const TOTAL_WEIGHT = SYMBOLS.reduce((s,x)=>s+x.weight,0);

  // ---------- State ----------
  const storeKey = "lucky-lemons-v8-stats";
  let stats = loadStats();
  let currentUser = USERS.includes(localStorage.getItem("ll-v8-user")) ? localStorage.getItem("ll-v8-user") : USERS[0];
  let betCents = Number(localStorage.getItem("ll-v8-bet")) || 25;
  if (![10,25].includes(betCents)) betCents = 25;

  function loadStats(){
    try{
      const raw = JSON.parse(localStorage.getItem(storeKey)||"{}");
      for (const u of USERS) {
        if (!raw[u]) raw[u] = { spins: DEFAULT_SPINS, earned: 0, spent: 0, luck: 0 };
        ["spins","earned","spent","luck"].forEach(k=>{
          if (!Number.isFinite(raw[u][k])) raw[u][k] = (k==="spins")?DEFAULT_SPINS:0;
        });
      }
      return raw;
    }catch{
      return Object.fromEntries(USERS.map(u=>[u,{spins:DEFAULT_SPINS,earned:0,spent:0,luck:0}]));
    }
  }
  function saveStats(){ localStorage.setItem(storeKey, JSON.stringify(stats)); }

  // ---------- DOM ----------
  const machine = document.getElementById("machine");
  const reelEls = [1,2,3].map(i => document.getElementById(`reel-${i}`));
  const spinBtn = document.getElementById("spinBtn");
  const messageEl = document.getElementById("message");
  const winBanner = document.getElementById("winBanner");

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
  const saveAdmin    = document.getElementById("saveAdmin");
  const add10Spins   = document.getElementById("add10Spins");
  const resetStatsBtn= document.getElementById("resetStats");
  const oddsGrid     = document.getElementById("oddsGrid");

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
  markBet(); renderStats(); renderPaytable(); refreshOdds(); updateSpinEnabled();
  // Seed tracks initially
  reelEls.forEach(initReelTrack);

  // ---------- RNG & Luck ----------
  function pickBase(){
    let r = Math.random() * TOTAL_WEIGHT;
    for (const s of SYMBOLS) { if ((r -= s.weight) <= 0) return s; }
    return SYMBOLS[SYMBOLS.length-1];
  }
  function pickBiased(luck){
    const L = Math.max(0, Math.min(100, luck));
    const candidates = 1 + Math.floor(L / 20);
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
  function upgradeRow(row, luck){
    const L = Math.max(0, Math.min(100, luck));
    const u  = Math.min(0.40, L/160); // pair
    const u2 = Math.min(0.18, L/360); // triple
    const k = row.map(r=>r.k);
    const counts={}; k.forEach(x=>counts[x]=(counts[x]||0)+1);
    const hasThree = Object.values(counts).some(c=>c===3);
    const hasPair  = Object.values(counts).some(c=>c===2);
    if (!hasPair && !hasThree && Math.random()<u){
      const best = row[0].rank >= row[1].rank ? row[0] : row[1];
      row[2] = best;
    } else if (hasPair && !hasThree && Math.random()<u2){
      const sym = Object.entries(counts).find(([_,c])=>c===2)[0];
      for (let i=0;i<3;i++) if (row[i].k!==sym) row[i]=row.find(r=>r.k===sym);
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
    updateSpinEnabled();
  }
  function markBet(){
    bet10.classList.toggle("active", betCents===10);
    bet25.classList.toggle("active", betCents===25);
    machineBetEl.textContent = betCents===25 ? "25¢" : "10¢";
  }
  function updateSpinEnabled(){
    spinBtn.disabled = stats[currentUser].spins <= 0;
  }

  // ---------- Reel building & smooth scroll ----------
  const CELL_H = 120 + 6; // match CSS var(--cell-h) + gap

  function initReelTrack(reel){
    const track = reel.querySelector(".track");
    track.innerHTML = "";
    // seed with 6 randoms so wheel isn't empty
    for (let i=0;i<6;i++) track.appendChild(makeCell(randSymbol().glyph, i===1));
  }
  function makeCell(glyph, isMid=false){
    const d = document.createElement("div");
    d.className = "cell" + (isMid ? " mid" : "");
    d.textContent = glyph;
    return d;
  }
  function randSymbol(){ return SYMBOLS[(Math.random()*SYMBOLS.length)|0]; }

  // Spin one reel with smooth translateY
  async function scrollReelTo(reel, finalCol, totalRows, fakeHops){
    const track = reel.querySelector(".track");
    reel.classList.remove("stopped");

    // Build sequence: many randoms + final (top, mid, bot)
    track.innerHTML = "";
    const filler = totalRows - 3; // rows before final trio
    for (let i=0;i<filler;i++) track.appendChild(makeCell(randSymbol().glyph, false));
    track.appendChild(makeCell(finalCol.top.glyph, false));
    track.appendChild(makeCell(finalCol.mid.glyph, true));   // mid visible end
    track.appendChild(makeCell(finalCol.bot.glyph, false));

    // Start position
    track.style.transform = `translateY(0px)`;
    track.style.transition = "none";
    // Reflow
    void track.offsetHeight;

    // Slow-down scroll to the end
    const distance = -(CELL_H * (totalRows - 3));
    track.style.transition = "transform 1200ms cubic-bezier(.12,.86,.16,1)";
    track.style.transform  = `translateY(${distance}px)`;
    await wait(1200);

    // Fake-out hops (tiny extra steps)
    for (let i=0;i<fakeHops;i++){
      track.style.transition = "transform 160ms ease-out";
      track.style.transform = `translateY(${distance + 18}px)`; await wait(160);
      track.style.transition = "transform 190ms ease-in";
      track.style.transform = `translateY(${distance}px)`; await wait(190);
    }

    // Raise & gold-highlight this reel's middle cell
    reel.classList.add("stopped");
  }

  // ---------- Spin flow ----------
  let spinning=false;
  reelEls.forEach(r=>r.classList.remove("stopped"));

  async function doSpin(){
    if (spinning) return;
    const s = stats[currentUser];
    if (s.spins <= 0) { flash("No spins left. Add more in Admin."); return; }

    spinning=true; machine.classList.add("spinning");
    // clear previous highlights
    reelEls.forEach(r=>r.classList.remove("stopped"));

    s.spins -= 1; s.spent = +(s.spent + betCents/100).toFixed(2); saveStats(); renderStats();

    // Pre-pick final middle-row results with luck
    let midRow = [pickBiased(s.luck), pickBiased(s.luck), pickBiased(s.luck)];
    midRow = upgradeRow(midRow, s.luck);

    // Final columns (neighbors random)
    const finals = [
      {top: randSymbol(), mid: midRow[0], bot: randSymbol()},
      {top: randSymbol(), mid: midRow[1], bot: randSymbol()},
      {top: randSymbol(), mid: midRow[2], bot: randSymbol()},
    ];

    // Start all together; stop 1→2→3 with longer gaps & fake-out
    await scrollReelTo(reelEls[0], finals[0], 28, 1);
    await wait(180);
    await scrollReelTo(reelEls[1], finals[1], 34, 1);
    await wait(240);
    await scrollReelTo(reelEls[2], finals[2], 40, 2);

    // Score using middle row only
    const win = calcWinRow(midRow);

    if (win>0){
      stats[currentUser].earned = +(stats[currentUser].earned + win).toFixed(2);
      saveStats(); renderStats();
      celebrate(win);
      flash(`Win $${win.toFixed(2)} on the middle row!`);
    } else {
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
    burstConfetti(1100);
    launchBalloons(16);
    setTimeout(()=> winBanner.classList.remove("show"), 2600);
    setTimeout(()=> messageEl.classList.remove("win"), 1600);
  }

  function resizeCanvas(){ confettiCanvas.width=innerWidth; confettiCanvas.height=innerHeight; }
  let confettiAnim=null;
  function burstConfetti(durationMs=1100){
    const colors=["#ffd166","#ffe082","#ff8a65","#4dd0e1","#81c784","#ba68c8","#fff59d"];
    const parts=[]; const count=200;
    for(let i=0;i<count;i++){
      parts.push({x:innerWidth*(0.25+Math.random()*0.5),y:innerHeight*0.34,vx:(Math.random()-0.5)*7,vy:-(3+Math.random()*7),s:4+Math.random()*6,c:colors[(Math.random()*colors.length)|0],r:Math.random()*Math.PI,vr:(Math.random()-0.5)*0.2,ay:0.16});
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
  function launchBalloons(count=14){
    balloonLayer.classList.remove("hidden");
    const colors=["#ff8a80","#ffd166","#81c784","#64b5f6","#ba68c8","#fff59d"];
    for (let i=0;i<count;i++){
      const b=document.createElement("div");
      b.className="balloon";
      b.style.left = `${6+Math.random()*88}vw`;
      b.style.setProperty("--balloonColor", colors[(Math.random()*colors.length)|0]);
      b.style.setProperty("--t", `${4+Math.random()*3}s`);
      balloonLayer.appendChild(b);
      setTimeout(()=> b.remove(), 5000);
    }
    setTimeout(()=> balloonLayer.classList.add("hidden"), 5200);
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
    if(!Number.isFinite(spins)||!Number.isFinite(earned)||!Number.isFinite(spent)||!Number.isFinite(luck)){ alert("Invalid values."); return; }
    stats[currentUser].spins=spins; stats[currentUser].earned=+earned.toFixed(2);
    stats[currentUser].spent=+spent.toFixed(2); stats[currentUser].luck=luck;
    saveStats(); renderStats(); refreshOdds(); hideAdmin();
  });
  add10Spins.addEventListener("click", ()=>{ stats[currentUser].spins += 10; saveStats(); renderStats(); refreshOdds(); });
  resetStatsBtn.addEventListener("click", ()=>{
    if(confirm(`Reset stats for ${currentUser}?`)){
      stats[currentUser] = {spins:DEFAULT_SPINS, earned:0, spent:0, luck:0};
      saveStats(); renderStats(); refreshOdds();
    }
  });

  userSelect.addEventListener("change", ()=>{ currentUser=userSelect.value; localStorage.setItem("ll-v8-user", currentUser); renderStats(); refreshOdds(); hideAdmin(); });
  bet10.addEventListener("click", ()=>{ betCents=10; localStorage.setItem("ll-v8-bet","10"); markBet(); renderPaytable(); refreshOdds(); });
  bet25.addEventListener("click", ()=>{ betCents=25; localStorage.setItem("ll-v8-bet","25"); markBet(); renderPaytable(); refreshOdds(); });

  // Monte-Carlo odds for middle row with current luck
  function refreshOdds(){
    const s = stats[currentUser];
    const trials = 15000;
    let c3 = {diamond:0, seven:0, star:0, bell:0, grape:0, orange:0, lemon:0, cherry:0};
    let twoCherry=0, twoOther=0, none=0;
    for(let i=0;i<trials;i++){
      let row=[pickBiased(s.luck), pickBiased(s.luck), pickBiased(s.luck)];
      row = upgradeRow(row, s.luck);
      const [a,b,c]=row.map(x=>x.k);
      if (a===b && b===c){ c3[a]++; continue; }
      const cherries=[a,b,c].filter(k=>k==="cherry").length;
      if (cherries===2) twoCherry++;
      else if (a===b || a===c || b===c) twoOther++;
      else none++;
    }
    const row = (label, val) => `<div class="odds-row"><span>${label}</span><b>${(100*val/trials).toFixed(2)}%</b></div>`;
    oddsGrid.innerHTML =
      row("💎💎💎", c3.diamond) +
      row("7️⃣7️⃣7️⃣", c3.seven) +
      row("⭐⭐⭐", c3.star) +
      row("🔔🔔🔔", c3.bell) +
      row("🍇🍇🍇", c3.grape) +
      row("🍊🍊🍊", c3.orange) +
      row("🍋🍋🍋", c3.lemon) +
      row("🍒🍒🍒", c3.cherry) +
      row("🍒🍒X (exactly two)", twoCherry) +
      row("Any other 2-of-a-kind", twoOther) +
      row("No win", none);
  }

  // Controls
  spinBtn.addEventListener("click", ()=> doSpin());
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); } });
})();
