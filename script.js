/* Lucky Lemons — 3-Reel Slot (no balance, user stats, fancy win effects) */
(() => {
  // ---------- Game Config ----------
  const USERS = ["Will", "Isaac"];
  const DEFAULT_SPINS = 20;

  const SYMBOLS = [
    { k: "cherry",  glyph: "🍒", weight: 25 },
    { k: "lemon",   glyph: "🍋", weight: 20 },
    { k: "orange",  glyph: "🍊", weight: 15 },
    { k: "grape",   glyph: "🍇", weight: 12 },
    { k: "bell",    glyph: "🔔", weight: 10 },
    { k: "star",    glyph: "⭐", weight:  8 },
    { k: "seven",   glyph: "7️⃣", weight:  6 },
    { k: "diamond", glyph: "💎", weight:  4 },
  ];

  // Payouts (same as before, per spin)
  const PAY_3 = {
    cherry: 0.53, lemon: 0.70, orange: 0.88, grape: 1.23,
    bell: 1.75, star: 2.80, seven: 5.25, diamond: 8.75
  };
  const PAY_2_CHERRY = 0.14;
  const PAY_2_OTHER  = 0.07;

  // ---------- State & Persistence ----------
  const storeKey = "lucky-lemons-v2-stats";
  let stats = loadStats();
  let currentUser = USERS.includes(localStorage.getItem("ll-v2-user")) ? localStorage.getItem("ll-v2-user") : USERS[0];

  function loadStats() {
    try {
      const raw = JSON.parse(localStorage.getItem(storeKey) || "{}");
      for (const u of USERS) {
        if (!raw[u]) raw[u] = { spins: DEFAULT_SPINS, earned: 0 };
        if (!Number.isFinite(raw[u].spins)) raw[u].spins = DEFAULT_SPINS;
        if (!Number.isFinite(raw[u].earned)) raw[u].earned = 0;
      }
      return raw;
    } catch {
      return Object.fromEntries(USERS.map(u => [u, { spins: DEFAULT_SPINS, earned: 0 }]));
    }
  }
  function saveStats() {
    localStorage.setItem(storeKey, JSON.stringify(stats));
  }

  // ---------- DOM ----------
  const reelEls = [1,2,3].map(i => document.getElementById(`reel-${i}`));
  const messageEl = document.getElementById("message");
  const spinBtn = document.getElementById("spinBtn");
  const userSelect = document.getElementById("userSelect");
  const spinsLeftEl = document.getElementById("spinsLeft");
  const totalEarnedEl = document.getElementById("totalEarned");
  const adminToggle = document.getElementById("adminToggle");
  const adminPanel = document.getElementById("adminPanel");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminSpins = document.getElementById("adminSpins");
  const adminEarned = document.getElementById("adminEarned");
  const saveAdmin = document.getElementById("saveAdmin");
  const add10Spins = document.getElementById("add10Spins");
  const resetStatsBtn = document.getElementById("resetStats");
  const winBanner = document.getElementById("winBanner");

  // Confetti
  const confettiCanvas = document.getElementById("confettiCanvas");
  const ctx = confettiCanvas.getContext("2d");

  // ---------- Init ----------
  userSelect.value = currentUser;
  renderStats();
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // ---------- RNG helpers ----------
  const totalWeight = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  function pickSymbol() {
    let r = Math.random() * totalWeight;
    for (const s of SYMBOLS) { if ((r -= s.weight) <= 0) return s; }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  // ---------- Spin Flow ----------
  spinBtn.addEventListener("click", async () => {
    const s = stats[currentUser];
    if (s.spins <= 0) { flash("No spins left. Ask admin to add more."); shakeButton(); return; }

    lock(true);
    s.spins -= 1;
    saveStats();
    renderStats();

    // Pre-pick final symbols
    const results = [pickSymbol(), pickSymbol(), pickSymbol()];

    // Spin reels with slowdown
    for (let i = 0; i < 3; i++) {
      await spinReel(reelEls[i], results[i], i);
    }

    // Evaluate
    const win = calcWin(results);
    clearWinClasses();
    if (win > 0) {
      s.earned = +(s.earned + win).toFixed(2);
      saveStats();
      renderStats();
      highlightWinners(results);
      celebrate(win);
    } else {
      flash("No win. Try again!");
    }

    lock(false);
  });

  function calcWin(results) {
    const a = results[0].k, b = results[1].k, c = results[2].k;
    // 3 of a kind
    if (a === b && b === c) return +(PAY_3[a] || 0).toFixed(2);
    // exactly 2 cherries
    const cherries = [a,b,c].filter(k => k === "cherry").length;
    if (cherries === 2) return PAY_2_CHERRY;
    // any other 2 of a kind
    if (a===b || a===c || b===c) return PAY_2_OTHER;
    return 0;
  }

  async function spinReel(el, finalSymbol, reelIndex) {
    el.classList.add("spinning");
    const symEl = el.querySelector(".symbol");

    // variable cycles for drama
    const baseCycles = 14 + Math.floor(Math.random() * 8);
    for (let i = 0; i < baseCycles; i++) {
      const temp = pickSymbol();
      symEl.textContent = temp.glyph;
      // Slow down toward the end
      const delay = 60 + i * 18 + reelIndex * 80; // stagger reels
      await wait(delay);
    }
    // Final landing
    symEl.textContent = finalSymbol.glyph;
    await wait(120 + reelIndex * 80);
    el.classList.remove("spinning");
  }

  function highlightWinners([a,b,c]) {
    // 3 of a kind
    if (a.k === b.k && b.k === c.k) {
      reelEls.forEach(el => el.classList.add("win"));
      return;
    }
    // exactly 2 cherries
    const arr = [a.k,b.k,c.k];
    const cherryCount = arr.filter(k => k === "cherry").length;
    if (cherryCount === 2) {
      arr.forEach((k, idx) => { if (k === "cherry") reelEls[idx].classList.add("win"); });
      return;
    }
    // any other 2 of a kind
    for (let i=0;i<3;i++){
      for (let j=i+1;j<3;j++){
        if (arr[i] === arr[j]) {
          reelEls[i].classList.add("win");
          reelEls[j].classList.add("win");
        }
      }
    }
  }

  function clearWinClasses() { reelEls.forEach(el => el.classList.remove("win")); }

  function lock(on){ spinBtn.disabled = !!on; }
  function flash(text){
    messageEl.textContent = text;
  }
  function shakeButton(){
    spinBtn.style.transform = "translateX(3px)"; setTimeout(()=>spinBtn.style.transform="",150);
  }
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  // ---------- Win Effects (banner + confetti) ----------
  function celebrate(amount) {
    // Banner
    winBanner.textContent = `🎉 You won $${amount.toFixed(2)}! 🎉`;
    winBanner.classList.add("show");
    messageEl.textContent = `You won $${amount.toFixed(2)}!`;
    messageEl.classList.add("win");
    setTimeout(() => { winBanner.classList.remove("show"); }, 2000);
    setTimeout(() => { messageEl.classList.remove("win"); }, 1400);

    // Confetti
    burstConfetti(500); // duration ms
  }

  // ---------- Confetti (lightweight) ----------
  let confettiAnim = null;
  function resizeCanvas() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
  }

  function burstConfetti(durationMs=700) {
    const colors = ["#ffd166","#ffe082","#ff8a65","#4dd0e1","#81c784","#ba68c8","#fff59d"];
    const particles = [];
    const count = 120;

    // initialize particles above top center-ish
    for (let i = 0; i < count; i++) {
      particles.push({
        x: window.innerWidth * (0.3 + Math.random()*0.4),
        y: window.innerHeight * 0.35,
        vx: (Math.random() - 0.5) * 6,
        vy: - (3 + Math.random() * 6),
        size: 4 + Math.random() * 6,
        color: colors[(Math.random()*colors.length)|0],
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
        ay: 0.15
      });
    }

    let start = null;
    confettiCanvas.classList.remove("hidden");

    function step(ts) {
      if (!start) start = ts;
      const elapsed = ts - start;
      ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.ay;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.restore();
      }

      if (elapsed < durationMs) {
        confettiAnim = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0,0,confettiCanvas.width,confettiCanvas.height);
        confettiCanvas.classList.add("hidden");
        cancelAnimationFrame(confettiAnim);
        confettiAnim = null;
      }
    }
    confettiAnim = requestAnimationFrame(step);
  }

  // ---------- User Switching ----------
  userSelect.addEventListener("change", () => {
    currentUser = userSelect.value;
    localStorage.setItem("ll-v2-user", currentUser);
    renderStats();
    // Hide admin panel if visible; keep it safer
    hideAdmin();
  });

  function renderStats() {
    const s = stats[currentUser];
    spinsLeftEl.textContent = s.spins.toString();
    totalEarnedEl.textContent = `$${s.earned.toFixed(2)}`;
    adminUserLabel.textContent = currentUser;
    adminSpins.value = s.spins;
    adminEarned.value = s.earned.toFixed(2);
  }

  // ---------- Admin Panel ----------
  let adminUnlocked = false;
  adminToggle.addEventListener("click", () => {
    if (!adminUnlocked) {
      const code = prompt("Enter admin passcode:");
      if (code === "1111") {
        adminUnlocked = true;
        showAdmin();
      } else {
        alert("Incorrect passcode.");
      }
    } else {
      if (adminPanel.classList.contains("hidden")) showAdmin(); else hideAdmin();
    }
  });

  function showAdmin(){ adminPanel.classList.remove("hidden"); adminPanel.setAttribute("aria-hidden","false"); }
  function hideAdmin(){ adminPanel.classList.add("hidden"); adminPanel.setAttribute("aria-hidden","true"); }

  saveAdmin.addEventListener("click", () => {
    const spins = Math.max(0, Math.floor(Number(adminSpins.value)));
    const earned = Math.max(0, Number(adminEarned.value));
    if (!Number.isFinite(spins) || !Number.isFinite(earned)) { alert("Invalid values."); return; }
    stats[currentUser].spins = spins;
    stats[currentUser].earned = +earned.toFixed(2);
    saveStats(); renderStats();
  });

  add10Spins.addEventListener("click", () => {
    stats[currentUser].spins += 10;
    saveStats(); renderStats();
  });

  resetStatsBtn.addEventListener("click", () => {
    if (confirm(`Reset stats for ${currentUser}?`)) {
      stats[currentUser] = { spins: DEFAULT_SPINS, earned: 0 };
      saveStats(); renderStats();
    }
  });

})();
