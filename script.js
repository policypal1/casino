/* Lucky Lemons — Clean Rainbow Border Edition
   - Bigger reels; no lever; static thick rainbow border
   - 10¢ / 25¢ bets; per-user spins/earned/spent/luck
   - Luck bias improved + upgrade mechanic (still keeps house edge)
   - Sequential stops with bigger gaps + fake-out slow stop
   - Admin Save closes panel; Admin shows estimated outcome odds (%)
   - Spin disabled when spins = 0
*/
(() => {
  // ---------- Config ----------
  const USERS = ["Will", "Isaac"];
  const DEFAULT_SPINS = 20;

  // Base payouts for 25¢; 10¢ scales by 0.4
  const BASE_PAY_3 = {
    diamond: 8.75, seven: 5.25, star: 2.80, bell: 1.75,
    grape: 1.23, orange: 0.88, lemon: 0.70, cherry: 0.53
  };
  const BASE_PAY_2_CHERRY = 0.14;
  const BASE_PAY_2_OTHER  = 0.07;

  const SYMBOLS = [
    { k: "cherry",  glyph: "🍒", weight: 25, rank: 1 },
    { k: "lemon",   glyph: "🍋", weight: 20, rank: 2 },
    { k: "orange",  glyph: "🍊", weight: 15, rank: 3 },
    { k: "grape",   glyph: "🍇", weight: 12, rank: 4 },
    { k: "bell",    glyph: "🔔", weight: 10, rank: 5 },
    { k: "star",    glyph: "⭐", weight:  8, rank: 6 },
    { k: "seven",   glyph: "7️⃣", weight:  6, rank: 7 },
    { k: "diamond", glyph: "💎", weight:  4, rank: 8 },
  ];
  const TOTAL_WEIGHT = SYMBOLS.reduce((s,x)=>s+x.weight,0);

  // ---------- State ----------
  const storeKey = "lucky-lemons-v6-stats";
  let stats = loadStats();
  let currentUser = USERS.includes(localStorage.getItem("ll-v6-user")) ? localStorage.getItem("ll-v6-user") : USERS[0];
  let betCents = Number(localStorage.getItem("ll-v6-bet")) || 25;
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
  const reelEls = [1,2,3].map(i=>document.getElementById(`reel-${i}`));
  const spinBtn = document.getElementById("spinBtn");
  const messageEl = document.getElementById("message");
  const winBanner = document.getElementById("winBanner");

  const userSelect = document.getElementById("userSelect");
  const spinsLeftEl = document.getElementById("spinsLeft");
  const totalEarnedEl = document.getElementById("totalEarned");
  const totalSpentEl  = document.getElementById("totalSpent");

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
  markBet(); renderStats(); renderPaytable(); updateSpinEnabled(); // disable if needed

  // ---------- RNG & Luck ----------
  function pickBase(){
    let r = Math.random() * TOTAL_WEIGHT;
    for (const s of SYMBOLS) { if ((r -= s.weight) <= 0) return s; }
    return SYMBOLS[SYMBOLS.length-1];
  }
  // Tournament selection: more luck → more candidates → higher rank wins
  function pickBiased(luck){
    const L = Math.max(0, Math.min(100, luck));
    const candidates = 1 + Math.floor(L / 25); // 0..100 => 1..5
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
  function calcWin(results){
    const {PAY_3,P2C,P2O} = currentPayouts();
    const a=results[0].k, b=results[1].k, c=results[2].k;
    if (a===b && b===c) return +(PAY_3[a]||0).toFixed(2);
    const ch=[a,b,c].filter(k=>k==="cherry").length;
    if (ch===2) return P2C;
    if (a===b || a===c || b===c) return P2O;
    return 0;
  }
  // Upgrade pass to ensure payouts occur sometimes (while preserving edge)
  function upgradeOutcome(results, luck){
    const L = Math.max(0, Math.min(100, luck));
    const u  = Math.min(0.38, L/180); // chance to force a pair
    const u2 = Math.min(0.16, L/400); // chance to upgrade pair to triple
    const k = results.map(r=>r.k);
    const counts={}; k.forEach(x=>counts[x]=(counts[x]||0)+1);
    const hasThree = Object.values(counts).some(c=>c===3);
    const hasPair  = Object.values(counts).some(c=>c===2);

    if (!hasPair && !hasThree && Math.random()<u){
      // force 2-kind by matching reel 3 with the better of 1 or 2
      const best = results[0].rank >= results[1].rank ? results[0] : results[1];
      results[2] = best;
    } else if (hasPair && !hasThree && Math.random()<u2){
      const sym = Object.entries(counts).find(([_,c])=>c===2)[0];
      for (let i=0;i<3;i++) if (results[i].k!==sym) results[i]=results.find(r=>r.k===sym);
    }
    return results;
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
  }
  function updateSpinEnabled(){
    const s = stats[currentUser];
    spinBtn.disabled = s.spins <= 0;
  }

  // ---------- Spin flow ----------
  let spinning=false;

  async function doSpin(){
    if (spinning) return;
    const s = stats[currentUser];
    if (s.spins <= 0) { flash("No spins left. Add more in Admin."); return; }

    spinning=true; machine.classList.add("spinning");
    s.spins -= 1; s.spent = +(s.spent + betCents/100).toFixed(2); saveStats(); renderStats();

    // Pre-pick with luck + upgrade
    let finals = [pickBiased(s.luck), pickBiased(s.luck), pickBiased(s.luck)];
    finals = upgradeOutcome(finals, s.luck);

    // Start all; stop 1→2→3 with bigger gaps + fake-out
    await spinReel(reelEls[0], finals[0], 34, true); // first
    await spinReel(reelEls[1], finals[1], 42, true); // second (later)
    await spinReel(reelEls[2], finals[2], 52, true); // third (latest)

    const win = calcWin(finals);
    clearWin();
    if (win>0){
      s.earned = +(s.earned + win).toFixed(2); saveStats(); renderStats();
      highlightWin(finals);
      celebrate(win);
    } else {
      flash("No win. Try again!");
    }

    machine.classList.remove("spinning");
    spinning=false;
  }

  async function spinReel(el, finalSymbol, totalSwaps, fakeout){
    el.classList.add("stopping"); // raised look while it's about to stop
    const symEl = el.querySelector(".symbol");
    const FAKE_EXTRA = fakeout ? 2 : 0; // 1–2 extra “almost stop” hops
    for (let i=0;i<totalSwaps;i++){
      symEl.textContent = SYMBOLS[(Math.random()*SYMBOLS.length)|0].glyph;
      const t = i/totalSwaps;
      const ease = 28 + 18*t + 360*t*t; // gradual slowdown
      await wait(ease);
    }
    for (let j=0;j<FAKE_EXTRA;j++){
      symEl.textContent = SYMBOLS[(Math.random()*SYMBOLS.length)|0].glyph;
      await wait(220 + j*60); // tease
    }
    symEl.textContent = finalSymbol.glyph;
    el.classList.remove("stopping");
    el.classList.add("stop");
    await wait(160);
    el.classList.remove("stop");
  }

  function highlightWin([a,b,c]){
    if (a.k===b.k && b.k===c.k){ reelEls.forEach(el=>el.classList.add("win")); return; }
    const arr=[a.k,b.k,c.k]; const cherries=arr.filter(k=>k==="cherry").length;
    if (cherries===2){ arr.forEach((k,i)=>{ if(k==="cherry") reelEls[i].classList.add("win"); }); return; }
    for (let i=0;i<3;i++) for (let j=i+1;j<3;j++) if (arr[i]===arr[j]) { reelEls[i].classList.add("win"); reelEls[j].classList.add("win"); }
  }
  function clearWin(){ reelEls.forEach(el=>el.classList.remove("win")); }

  function flash(t){ messageEl.textContent = t; }
  const wait = (ms)=> new Promise(r=>setTimeout(r, ms));

  // ---------- Celebrations ----------
  function celebrate(amount){
    const tier = amount>=5 ? "JACKPOT" : amount>=2 ? "MEGA WIN" : "BIG WIN";
    winBanner.textContent = `✨ ${tier}! You won $${amount.toFixed(2)} ✨`;
    winBanner.classList.add("show");
    messageEl.textContent = `You won $${amount.toFixed(2)}!`;
    messageEl.classList.add("win");
    burstConfetti(900);
    launchBalloons(12);
    setTimeout(()=>winBanner.classList.remove("show"), 2400);
    setTimeout(()=>messageEl.classList.remove("win"), 1600);
  }

  function resizeCanvas(){ confettiCanvas.width=innerWidth; confettiCanvas.height=innerHeight; }
  let confettiAnim=null;
  function burstConfetti(durationMs=900){
    const colors=["#ffd166","#ffe082","#ff8a65","#4dd0e1","#81c784","#ba68c8","#fff59d"];
    const parts=[]; const count=160;
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

  function launchBalloons(count=12){
    balloonLayer.classList.remove("hidden");
    const colors=["#ff8a80","#ffd166","#81c784","#64b5f6","#ba68c8","#fff59d"];
    for(let i=0;i<count;i++){
      const b=document.createElement("div"); b.className="balloon";
      b.style.left = `${6+Math.random()*88}vw`;
      b.style.setProperty("--balloonColor", colors[(Math.random()*colors.length)|0]);
      b.style.setProperty("--t", `${4+Math.random()*3}s`);
      balloonLayer.appendChild(b);
      setTimeout(()=>b.remove(), 4800);
    }
    setTimeout(()=>balloonLayer.classList.add("hidden"), 5000);
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
    saveStats(); renderStats(); refreshOdds(); hideAdmin(); // CLOSE after save
  });
  add10Spins.addEventListener("click", ()=>{ stats[currentUser].spins += 10; saveStats(); renderStats(); refreshOdds(); });
  resetStatsBtn.addEventListener("click", ()=>{
    if(confirm(`Reset stats for ${currentUser}?`)){
      stats[currentUser] = {spins:DEFAULT_SPINS, earned:0, spent:0, luck:0};
      saveStats(); renderStats(); refreshOdds();
    }
  });

  userSelect.addEventListener("change", ()=>{ currentUser=userSelect.value; localStorage.setItem("ll-v6-user", currentUser); renderStats(); refreshOdds(); hideAdmin(); });
  bet10.addEventListener("click", ()=>{ betCents=10; localStorage.setItem("ll-v6-bet","10"); markBet(); renderPaytable(); refreshOdds(); });
  bet25.addEventListener("click", ()=>{ betCents=25; localStorage.setItem("ll-v6-bet","25"); markBet(); renderPaytable(); refreshOdds(); });

  // Quick Monte-Carlo to approximate odds with current luck & bet
  function refreshOdds(){
    const s = stats[currentUser];
    const trials = 20000; // fast but decent
    let c3 = {diamond:0, seven:0, star:0, bell:0, grape:0, orange:0, lemon:0, cherry:0};
    let twoCherry=0, twoOther=0, none=0;
    for(let i=0;i<trials;i++){
      let r=[pickBiased(s.luck), pickBiased(s.luck), pickBiased(s.luck)];
      r = upgradeOutcome(r, s.luck);
      const a=r[0].k,b=r[1].k,c=r[2].k;
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
      row("🍒🍒X", twoCherry) +
      row("Any other 2-kind", twoOther) +
      row("No win", none);
  }

  // Controls
  spinBtn.addEventListener("click", ()=> doSpin());
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); } });

})();
