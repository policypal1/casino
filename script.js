/* Lucky Lemons — 3-Reel Slot
   - Two bet modes (10¢ / 25¢) with auto-scaled payouts
   - Luck Bias (0–100) in Admin (1111) that favors higher symbols
   - Rainbow overload, side spotlights, lever, all-start spin with sequential stops
   - Upgraded celebration: banner + confetti + balloons
*/
(() => {
  // ----- Config -----
  const USERS = ["Will", "Isaac"];
  const DEFAULT_SPINS = 20;

  // Base payouts are for a 25¢ bet; 10¢ scales by 0.4
  const BASE_PAY_3 = {
    diamond: 8.75, seven: 5.25, star: 2.80, bell: 1.75,
    grape: 1.23, orange: 0.88, lemon: 0.70, cherry: 0.53
  };
  const BASE_PAY_2_CHERRY = 0.14;
  const BASE_PAY_2_OTHER  = 0.07;

  // Reel symbols + baseline weights (house edge baked in)
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
  const totalWeight = SYMBOLS.reduce((s, x) => s + x.weight, 0);

  // ----- State -----
  const storeKey = "lucky-lemons-v4-stats";
  let stats = loadStats();
  let currentUser = USERS.includes(localStorage.getItem("ll-v4-user")) ? localStorage.getItem("ll-v4-user") : USERS[0];
  let betCents = Number(localStorage.getItem("ll-v4-bet")) || 25; // 10 or 25
  if (![10,25].includes(betCents)) betCents = 25;

  function loadStats() {
    try {
      const raw = JSON.parse(localStorage.getItem(storeKey) || "{}");
      for (const u of USERS) {
        if (!raw[u]) raw[u] = { spins: DEFAULT_SPINS, earned: 0, luck: 0 };
        if (!Number.isFinite(raw[u].spins)) raw[u].spins = DEFAULT_SPINS;
        if (!Number.isFinite(raw[u].earned)) raw[u].earned = 0;
        if (!Number.isFinite(raw[u].luck)) raw[u].luck = 0;
      }
      return raw;
    } catch {
      return Object.fromEntries(USERS.map(u => [u, { spins: DEFAULT_SPINS, earned: 0, luck: 0 }]));
    }
  }
  function saveStats(){ localStorage.setItem(storeKey, JSON.stringify(stats)); }

  // ----- DOM -----
  const app = document.getElementById("appRoot");
  const machine = document.getElementById("machine");
  const reelEls = [1,2,3].map(i => document.getElementById(`reel-${i}`));
  const messageEl = document.getElementById("message");
  const spinBtn = document.getElementById("spinBtn");
  const lever = document.getElementById("lever");
  const userSelect = document.getElementById("userSelect");
  const spinsLeftEl = document.getElementById("spinsLeft");
  const totalEarnedEl = document.getElementById("totalEarned");
  const adminToggle = document.getElementById("adminToggle");
  const adminPanel = document.getElementById("adminPanel");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminSpins = document.getElementById("adminSpins");
  const adminEarned = document.getElementById("adminEarned");
  const adminLuck = document.getElementById("adminLuck");
  const saveAdmin = document.getElementById("saveAdmin");
  const add10Spins = document.getElementById("add10Spins");
  const resetStatsBtn = document.getElementById("resetStats");
  const winBanner = document.getElementById("winBanner");
  const payRows = document.getElementById("payRows");
  const payNote = document.getElementById("payNote");
  const bet10 = document.getElementById("bet10");
  const bet25 = document.getElementById("bet25");

  // Confetti + balloons
  const confettiCanvas = document.getElementById("confettiCanvas");
  const ctx = confettiCanvas.getContext("2d");
  const balloonLayer = document.getElementById("balloonLayer");

  // ----- Init -----
  userSelect.value = currentUser;
  markBet();
  renderStats();
  renderPaytable();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // ----- Helpers -----
  function pickBase() {
    let r = Math.random() * totalWeight;
    for (const s of SYMBOLS) { if ((r -= s.weight) <= 0) return s; }
    return SYMBOLS.at(-1);
  }
  // Luck bias: 0–100. Higher = more chance to select a higher-rank symbol.
  function pickBiased(luck) {
    if (!luck) return pickBase();
    const p = Math.min(Math.max(luck, 0), 100) / 100;
    const a = pickBase(), b = pickBase();
    // with probability p, choose the higher rank (rarer/better) of two picks
    return Math.random() < p ? (a.rank > b.rank ? a : b) : (a.rank > b.rank ? b : a);
  }

  function currentPayouts() {
    const scale = betCents === 25 ? 1 : 0.4; // 10c is 40% of 25c
    const PAY_3 = {};
    for (const k in BASE_PAY_3) PAY_3[k] = +(BASE_PAY_3[k] * scale).toFixed(2);
    const P2C = +(BASE_PAY_2_CHERRY * scale).toFixed(2);
    const P2O = +(BASE_PAY_2_OTHER * scale).toFixed(2);
    return { PAY_3, P2C, P2O };
  }

  function calcWin(results) {
    const { PAY_3, P2C, P2O } = currentPayouts();
    const a = results[0].k, b = results[1].k, c = results[2].k;
    if (a === b && b === c) return +(PAY_3[a] || 0).toFixed(2);
    const cherries = [a,b,c].filter(k => k === "cherry").length;
    if (cherries === 2) return P2C;
    if (a===b || a===c || b===c) return P2O;
    return 0;
  }

  function renderPaytable() {
    const { PAY_3, P2C, P2O } = currentPayouts();
    payNote.textContent = betCents === 25 ? "per 25¢ bet" : "per 10¢ bet";
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
    adminUserLabel.textContent = currentUser;
    adminSpins.value = s.spins;
    adminEarned.value = s.earned.toFixed(2);
    adminLuck.value = s.luck;
  }

  function markBet(){
    bet10.classList.toggle("active", betCents===10);
    bet25.classList.toggle("active", betCents===25);
  }

  // ----- Spin flow -----
  let spinning = false;

  async function doSpin(){
    if (spinning) return;
    const s = stats[currentUser];
    if (s.spins <= 0) { flash("No spins left. Ask admin to add more."); nudge(spinBtn); return; }

    spinning = true;
    machine.classList.add("spinning");
    lever.classList.add("pull");
    setTimeout(()=>lever.classList.remove("pull"), 420);

    s.spins -= 1; saveStats(); renderStats();

    // Pre-pick finals with luck bias
    const finals = [pickBiased(s.luck), pickBiased(s.luck), pickBiased(s.luck)];

    // Start all reels at once; stop 1→2→3 by giving different totals
    const totals = [
      28 + Math.floor(Math.random()*6),
      34 + Math.floor(Math.random()*6),
      40 + Math.floor(Math.random()*6)
    ];
    const promises = reelEls.map((el, idx) => spinReel(el, finals[idx], totals[idx], idx));
    // Wait for all to complete
    await Promise.all(promises);

    const win = calcWin(finals);
    clearWinClasses();
    if (win > 0) {
      s.earned = +(s.earned + win).toFixed(2); saveStats(); renderStats();
      highlightWinners(finals);
      celebrate(win);
    } else {
      flash("No win. Try again!");
    }

    machine.classList.remove("spinning");
    spinning = false;
  }

  // Reel animation (crisp, ramp→slow, pop on stop)
  async function spinReel(el, finalSymbol, totalSwaps, reelIndex) {
    el.classList.add("spinning");
    const symEl = el.querySelector(".symbol");
    for (let i = 0; i < totalSwaps; i++) {
      symEl.textContent = pickBase().glyph; // show random symbols while spinning
      const t = i / totalSwaps;
      const ease = 30 + 12*t + 260*t*t; // quadratic slowdown
      await wait(ease);
    }
    symEl.textContent = finalSymbol.glyph;
    el.classList.remove("spinning");
    el.classList.add("stop");
    await wait(160);
    el.classList.remove("stop");
  }

  function highlightWinners([a,b,c]) {
    if (a.k === b.k && b.k === c.k) { reelEls.forEach(el => el.classList.add("win")); return; }
    const arr = [a.k,b.k,c.k];
    const cherryCount = arr.filter(k => k === "cherry").length;
    if (cherryCount === 2) { arr.forEach((k,i)=>{ if(k==="cherry") reelEls[i].classList.add("win"); }); return; }
    for (let i=0;i<3;i++) for (let j=i+1;j<3;j++) if (arr[i]===arr[j]) { reelEls[i].classList.add("win"); reelEls[j].classList.add("win"); }
  }
  function clearWinClasses(){ reelEls.forEach(el=>el.classList.remove("win")); }

  function lock(on){ spinBtn.disabled = !!on; }
  function flash(text){ messageEl.textContent = text; }
  function nudge(el){ el.animate([{transform:"translateX(0)"},{transform:"translateX(4px)"},{transform:"translateX(0)"}],{duration:180}); }
  const wait = (ms)=> new Promise(r=>setTimeout(r, ms));

  // ----- Celebration -----
  function celebrate(amount){
    winBanner.textContent = `🎉 You won $${amount.toFixed(2)}! 🎉`;
    winBanner.classList.add("show");
    messageEl.textContent = `You won $${amount.toFixed(2)}!`;
    messageEl.classList.add("win");
    setTimeout(()=> winBanner.classList.remove("show"), 2400);
    setTimeout(()=> messageEl.classList.remove("win"), 1600);
    burstConfetti(700);
    launchBalloons(12);
  }

  // Confetti (lightweight)
  let confettiAnim = null;
  function resizeCanvas(){ confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight; }
  function burstConfetti(durationMs=700){
    const colors = ["#ffd166","#ffe082","#ff8a65","#4dd0e1","#81c784","#ba68c8","#fff59d"];
    const particles = []; const count = 140;
    for (let i=0;i<count;i++){
      particles.push({
        x: innerWidth*(0.3+Math.random()*0.4), y: innerHeight*0.35,
        vx:(Math.random()-0.5)*6, vy:-(3+Math.random()*6),
        s:4+Math.random()*6, c:colors[(Math.random()*colors.length)|0],
        r: Math.random()*Math.PI, vr:(Math.random()-0.5)*0.2, ay:0.15
      });
    }
    let start=null; confettiCanvas.classList.remove("hidden");
    function step(ts){
      if(!start) start=ts; const e=ts-start;
      ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
      for(const p of particles){
        p.x+=p.vx; p.y+=p.vy; p.vy+=p.ay; p.r+=p.vr;
        ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r);
        ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s); ctx.restore();
      }
      if(e<durationMs){ confettiAnim=requestAnimationFrame(step); }
      else{ ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height); confettiCanvas.classList.add("hidden"); cancelAnimationFrame(confettiAnim); confettiAnim=null; }
    }
    confettiAnim=requestAnimationFrame(step);
  }

  function launchBalloons(count=10){
    balloonLayer.classList.remove("hidden");
    const colors = ["#ff8a80","#ffd166","#81c784","#64b5f6","#ba68c8","#fff59d"];
    for (let i=0;i<count;i++){
      const b = document.createElement("div");
      b.className = "balloon";
      const x = 10 + Math.random()*80;
      b.style.left = `${x}vw`;
      b.style.setProperty("--balloonColor", colors[(Math.random()*colors.length)|0]);
      b.style.setProperty("--t", `${4+Math.random()*3}s`);
      balloonLayer.appendChild(b);
      setTimeout(()=> b.remove(), 4500);
    }
    setTimeout(()=> balloonLayer.classList.add("hidden"), 4600);
  }

  // ----- User & Admin -----
  userSelect.addEventListener("change", ()=>{
    currentUser = userSelect.value;
    localStorage.setItem("ll-v4-user", currentUser);
    renderStats(); hideAdmin();
  });

  bet10.addEventListener("click", ()=>{ betCents=10; localStorage.setItem("ll-v4-bet","10"); markBet(); renderPaytable(); });
  bet25.addEventListener("click", ()=>{ betCents=25; localStorage.setItem("ll-v4-bet","25"); markBet(); renderPaytable(); });

  let adminUnlocked=false;
  adminToggle.addEventListener("click", ()=>{
    if(!adminUnlocked){
      const code = prompt("Enter admin passcode:");
      if(code==="1111"){ adminUnlocked=true; showAdmin(); }
      else alert("Incorrect passcode.");
    }else{ adminPanel.classList.contains("hidden") ? showAdmin() : hideAdmin(); }
  });
  function showAdmin(){ adminPanel.classList.remove("hidden"); adminPanel.setAttribute("aria-hidden","false"); }
  function hideAdmin(){ adminPanel.classList.add("hidden"); adminPanel.setAttribute("aria-hidden","true"); }

  saveAdmin.addEventListener("click", ()=>{
    const spins = Math.max(0, Math.floor(Number(adminSpins.value)));
    const earned = Math.max(0, Number(adminEarned.value));
    let luck = Math.max(0, Math.min(100, Math.floor(Number(adminLuck.value))));
    if(!Number.isFinite(spins) || !Number.isFinite(earned) || !Number.isFinite(luck)){ alert("Invalid values."); return; }
    stats[currentUser].spins = spins;
    stats[currentUser].earned = +earned.toFixed(2);
    stats[currentUser].luck = luck;
    saveStats(); renderStats();
  });
  add10Spins.addEventListener("click", ()=>{ stats[currentUser].spins += 10; saveStats(); renderStats(); });
  resetStatsBtn.addEventListener("click", ()=>{
    if(confirm(`Reset stats for ${currentUser}?`)){
      stats[currentUser] = { spins: DEFAULT_SPINS, earned: 0, luck: 0 };
      saveStats(); renderStats();
    }
  });

  // Lever, button, keyboard
  lever.addEventListener("click", ()=> doSpin());
  spinBtn.addEventListener("click", ()=> doSpin());
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); } });

})();
