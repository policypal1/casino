(() => {
  const SPIN_COST = 0.25;
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
  const PAY_3 = {
    cherry: 0.53, lemon: 0.70, orange: 0.88, grape: 1.23,
    bell: 1.75, star: 2.80, seven: 5.25, diamond: 8.75
  };
  const PAY_2_CHERRY = 0.14;
  const PAY_2_OTHER  = 0.07;

  const totalWeight = SYMBOLS.reduce((s, x) => s + x.weight, 0);
  function pickSymbol() {
    let r = Math.random() * totalWeight;
    for (const s of SYMBOLS) { if ((r -= s.weight) <= 0) return s; }
    return SYMBOLS[SYMBOLS.length - 1];
  }

  const reelEls = [1,2,3].map(i => document.getElementById(`reel-${i}`));
  const balanceEl = document.getElementById("balance");
  const msgEl = document.getElementById("message");
  const spinBtn = document.getElementById("spinBtn");
  const addBtn = document.getElementById("addBtn");
  const resetBtn = document.getElementById("resetBtn");

  const storeKey = "lucky-lemons-balance-v1";
  let balance = Number(localStorage.getItem(storeKey));
  if (!Number.isFinite(balance) || balance <= 0) balance = 10.00;
  renderBalance();

  addBtn.addEventListener("click", () => {
    balance = +(balance + 1).toFixed(2);
    persist();
    flash(`Added $1.00. Good luck!`);
  });

  resetBtn.addEventListener("click", () => {
    balance = 10.00;
    persist();
    flash(`Balance reset to $10.00`);
  });

  spinBtn.addEventListener("click", async () => {
    if (balance < SPIN_COST) { flash(`Not enough credits. Click “+ Add $1.00”.`); return; }
    lock(true);
    balance = +(balance - SPIN_COST).toFixed(2);
    renderBalance();

    const results = [];
    for (let i = 0; i < 3; i++) {
      reelEls[i].classList.add("spinning");
      await wait(120 + i * 140);
      const sym = pickSymbol();
      results.push(sym);
      setReel(reelEls[i], sym.glyph);
      await wait(240);
      reelEls[i].classList.remove("spinning");
    }

    const win = calcWin(results);
    if (win > 0) {
      balance = +(balance + win).toFixed(2);
      persist();
      flash(`You won $${win.toFixed(2)}!`);
    } else {
      flash(`No win. Try again!`);
    }
    lock(false);
  });

  function setReel(el, glyph) {
    el.querySelector(".symbol").textContent = glyph;
  }

  function calcWin([a,b,c]) {
    const x=a.k, y=b.k, z=c.k;
    if (x===y && y===z) return +(PAY_3[x]||0).toFixed(2);
    const cherryCount = [x,y,z].filter(t => t==="cherry").length;
    if (cherryCount === 2) return PAY_2_CHERRY;
    if (x===y || x===z || y===z) return PAY_2_OTHER;
    return 0;
  }

  function lock(on){ spinBtn.disabled = on; resetBtn.disabled = on; addBtn.disabled = false; }
  function renderBalance(){ balanceEl.textContent = `$${balance.toFixed(2)}`; }
  function persist(){ localStorage.setItem(storeKey, String(balance)); renderBalance(); }
  function flash(t){ msgEl.textContent = t; }
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  window.addEventListener("keydown", (e) => { if (e.code === "Space") { e.preventDefault(); spinBtn.click(); }});
})();
