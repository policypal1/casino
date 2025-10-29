/* Brainrot Slots — Binary payouts (2x or 0) with ramp→peak→decay luck
   Top 4 symbols pay 2x bet per reel; bottom 4 pay 0. Sum across 3 reels.
   Base RTP ≈ 72% (house edge), brief hot peak > 100% then decays to tight.
*/

function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
const wait   = (ms)=> new Promise(r=>setTimeout(r, ms));
const r3     = (n)=> Math.round((n + Number.EPSILON) * 1000) / 1000;
const fmtTok = (n)=>{ const s=(r3(n)).toFixed(3); return s.replace(/\.?0+$/,''); };

// Short popup numbers (≤3 total digits) with leading zero under 1
function fmtBurst(n){
  const v = Math.max(0, r3(n));
  const intDigits = Math.floor(v).toString().length;
  const keepDec = Math.max(0, 3 - intDigits);
  let s = v.toFixed(keepDec);
  if (v < 1 && !s.startsWith('0')) s = '0' + s;
  return s;
}

(() => {
  // ===== CONFIG =====
  const MIN_DEPOSIT = 5;
  const PASSCODE    = "1111";

  // Luck curve: ramp up to a short insane window, then long falloff
  const RAMP_UP_SPINS = 8;   // smooth climb to hot
  const PEAK_SPINS    = 3;   // brief “insane” window
  const DECAY_SPINS   = 60;  // long falloff to tight

  // ===== BINARY PAYOUT SETUP (no scaling; exact 2x or 0) =====
  // Base weights target ~12% chance of TOP per reel → per-reel EV ≈ 0.24 → RTP ≈ 0.72
  const ITEMS_BASE = [
    // TOP (double per reel)
    { k:"strawberryelephant", file:"Strawberryelephant.webp",          label:"Strawberry Elephant",  short:"Elephant",   weight:3,  value_x:2.0 },
    { k:"dragoncanneloni",    file:"Dragoncanneloni.webp",             label:"Dragon Canneloni",     short:"Dragon",     weight:3,  value_x:2.0 },
    { k:"garamadundung",      file:"Garamadundung.webp",               label:"Garama",               short:"Garama",     weight:3,  value_x:2.0 },
    { k:"carti",              file:"Carti.webp",                       label:"La Grande",            short:"La Grande",  weight:3,  value_x:2.0 },

    // BOTTOM (zero)
    { k:"saturnita",          file:"La_Vaccca_Saturno_Saturnita.webp", label:"Saturnita",            short:"Saturnita",  weight:22, value_x:0.0 },
    { k:"tralalero",          file:"TralaleroTralala.webp",            label:"Tralalero Tralala",    short:"Tralalero",  weight:22, value_x:0.0 },
    { k:"sgedrftdikou",       file:"Sgedrftdikou.webp",                label:"Ballerina Cappuccino", short:"Cappuccino", weight:22, value_x:0.0 },
    { k:"noobini",            file:"Noobini_Pizzanini_NEW.webp",       label:"Noobini Pizzanini",    short:"Noobini",    weight:22, value_x:0.0 },
  ];
  const ITEMS_VALS = ITEMS_BASE.slice(); // keep exact payout values

  // Identify TOP vs BOTTOM by value_x
  const isTop = (it)=> it.value_x >= 2;

  // Multipliers by class across phases (weights-only shaping)
  // Base ≈ 12% TOP; Peak ≈ ~23–25% TOP (brief heater); Bad ≈ ~9–10% TOP
  const MULT_BASE = { TOP: 1.00, BOTTOM: 1.00 };
  const MULT_PEAK = { TOP: 2.20, BOTTOM: 0.80 };
  const MULT_BAD  = { TOP: 0.70, BOTTOM: 1.20 };

  const lerp = (a,b,t)=> a + (b-a)*t;
  const mix  = (A,B,t)=> { const out={}; for(const k in A){ out[k]=lerp(A[k],B[k],t); } return out; };

  function phaseMultipliers(spinIdx){
    if (spinIdx < RAMP_UP_SPINS){
      const t = Math.max(0, Math.min(1, spinIdx / Math.max(1, RAMP_UP_SPINS)));
      return mix(MULT_BASE, MULT_PEAK, t);          // rising to peak
    }
    if (spinIdx < RAMP_UP_SPINS + PEAK_SPINS){
      return MULT_PEAK;                              // hold peak briefly
    }
    const post = spinIdx - (RAMP_UP_SPINS + PEAK_SPINS);
    if (post >= DECAY_SPINS) return MULT_BAD;       // fully tight
    const t = Math.max(0, Math.min(1, post / Math.max(1, DECAY_SPINS)));
    return mix(MULT_PEAK, MULT_BAD, t);             // fall to tight
  }

  function weightedSet(spinIdx){
    const M = phaseMultipliers(spinIdx);
    const items = ITEMS_VALS.map(it => ({
      ...it,
      weight: it.weight * (isTop(it) ? M.TOP : M.BOTTOM)
    }));
    const total = items.reduce((s,x)=> s + x.weight, 0);
    return { items, total };
  }
  function pick(items,total){
    let r = Math.random()*total;
    for (const s of items){ if((r -= s.weight) <= 0) return s; }
    return items[items.length-1];
  }

  // ===== STATE =====
  const USERS = ["Will","Isaac","Faisal","Muhammed"];
  const STORE = "brainrot-slots-binary-v1";
  const baseUser = ()=>({ tokens:0, earned:0, spent:0, spinCount:0 });

  function load(){
    try{
      const raw = JSON.parse(localStorage.getItem(STORE)||"{}");
      for(const u of USERS) if(!raw[u]) raw[u]=baseUser();
      return raw;
    }catch{
      return Object.fromEntries(USERS.map(u=>[u,baseUser()]));
    }
  }
  let stats = load();
  const save = ()=> localStorage.setItem(STORE, JSON.stringify(stats));

  let currentUser = USERS.includes(localStorage.getItem("br-user")) ? localStorage.getItem("br-user") : "Will";
  let fastMode    = localStorage.getItem("br-fast")==="1";

  // ===== DOM =====
  const machine   = document.getElementById("machine");
  const reelEls   = [1,2,3].map(i=>document.getElementById(`reel-${i}`));
  const spinBtn   = document.getElementById("spinBtn");
  const fastChk   = document.getElementById("fastChk");
  const depositBtn= document.getElementById("convertBtn");
  const cashoutBtn= document.getElementById("cashoutBtn");
  const messageEl = document.getElementById("message");

  const userSelect= document.getElementById("userSelect");
  const tokenBalanceEl = document.getElementById("tokenBalance");
  const machineBetEl   = document.getElementById("machineBet");

  const betInput  = document.getElementById("betInput");
  const betSlider = document.getElementById("betSlider");

  const ptGrid = document.getElementById("ptGrid");
  const ptBet  = document.getElementById("ptBet");

  const winModal = document.getElementById("winModal");
  const winAmtEl = document.getElementById("winAmt");
  const winLineEl= document.getElementById("winLine");

  const adminToggle = document.getElementById("adminToggle");
  const adminPanel  = document.getElementById("adminPanel");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminAdd    = document.getElementById("adminAdd");
  const adminGive   = document.getElementById("adminGive");
  const closeAdmin  = document.getElementById("closeAdmin");

  // Optional music controls (safe if missing)
  const bgm      = document.getElementById("bgm");
  const musicBtn = document.getElementById("musicBtn");
  let musicWanted = JSON.parse(localStorage.getItem("br-music-wanted") || "false");
  function setMusicWanted(on){
    musicWanted = !!on;
    localStorage.setItem("br-music-wanted", JSON.stringify(musicWanted));
    musicBtn?.setAttribute("aria-pressed", String(musicWanted));
    if (!bgm) return;
    if (musicWanted) bgm.play().catch(()=>{}); else bgm.pause();
  }
  async function playIfWanted(){
    if (!bgm) return;
    try{ bgm.volume = 0.45; if (musicWanted) await bgm.play(); }catch{}
  }
  musicBtn?.addEventListener("click", ()=> setMusicWanted(!musicWanted));
  musicBtn?.setAttribute("aria-pressed", String(musicWanted));

  // Dim overlay during burst
  const dimEl = document.getElementById("dim");
  const showDim = async (ms)=> {
    if (!dimEl) return;
    dimEl.classList.add('show');
    await wait(ms);
    dimEl.classList.remove('show');
  };

  // ===== helpers =====
  const CELL_H = 156;
  const imgHTML = (file, alt)=> `<img src="./${file}" alt="${alt}">`;
  function makeCell(inner,isMid=false){ const d=document.createElement("div"); d.className="cell"+(isMid?" mid":""); d.innerHTML=inner; return d; }

  function initReelTrack(reel){
    const t = reel.querySelector(".track"); t.innerHTML="";
    for(let i=0;i<6;i++){ t.appendChild(makeCell(imgHTML(ITEMS_VALS[i%ITEMS_VALS.length].file,"sym"), i===1)); }
  }

  async function scrollReelTo(reel, finalCol, totalRows, fakeHops, durationMs){
    const speed = fastMode ? 0.38 : 1;
    const hops  = fastMode ? Math.max(0,fakeHops-1) : fakeHops;
    const rows  = fastMode ? Math.floor(totalRows*0.6) : totalRows;
    const dur   = Math.max(360, Math.floor(durationMs*speed));

    const track = reel.querySelector(".track");
    reel.classList.remove("stopped");
    track.innerHTML="";
    const filler=Math.max(3, rows-3);
    for(let i=0;i<filler;i++) track.appendChild(makeCell(imgHTML(ITEMS_VALS[i%ITEMS_VALS.length].file,"sym")));
    track.appendChild(makeCell(imgHTML(finalCol.top.file, finalCol.top.label)));
    track.appendChild(makeCell(imgHTML(finalCol.mid.file, finalCol.mid.label), true));
    track.appendChild(makeCell(imgHTML(finalCol.bot.file, finalCol.bot.label)));
    track.style.transform="translateY(0px)"; track.style.transition="none";
    void track.offsetHeight;
    const distance=-(CELL_H*(rows-3));
    track.style.transition=`transform ${dur}ms cubic-bezier(.12,.86,.16,1)`;
    track.style.transform=`translateY(${distance}px)`;
    await wait(dur);
    for(let i=0;i<hops;i++){
      track.style.transition="transform 130ms ease-out"; track.style.transform=`translateY(${distance+18}px)`; await wait(130);
      track.style.transition="transform 150ms ease-in";  track.style.transform=`translateY(${distance}px)`;     await wait(150);
    }
    reel.classList.add("stopped");
  }

  // Always show burst (even for +0) and briefly dim for readability
  async function burstOnReel(reelEl, amount){
    showDim(900).catch(()=>{});
    const b = document.createElement("div");
    b.className = "burst";
    b.textContent = `+${fmtBurst(Math.max(0, amount))}`;
    reelEl.appendChild(b);
    setTimeout(()=> b.remove(), 940);
  }

  function getBet(){
    const v = Number(betInput.value)||0.5;
    const max = Math.max(0.01, stats[currentUser].tokens||0.01);
    const cl = Math.min(Math.max(v,0.01), max);
    if (cl !== v) betInput.value = String(cl);
    return cl;
  }
  function setBetDisplay(){
    const bet = getBet();
    machineBetEl.textContent = `${fmtTok(bet)}🪙`;
    ptBet.textContent        = `${fmtTok(bet)}🪙`;
    renderPaytable();
  }
  function renderBalance(){
    const bal = stats[currentUser].tokens||0;
    tokenBalanceEl.textContent = `${fmtTok(bal)}🪙`;
    const max = Math.max(0.01, bal || 0.01);
    betInput.max  = String(max);
    betSlider.max = String(Math.max(max, 1));
    betSlider.value = String(getBet());
    spinBtn.disabled = (bal + 1e-9) < getBet();
  }
  function renderPaytable(){
    const bet = getBet();
    ptGrid.innerHTML = ITEMS_VALS.map(it=>{
      const coins = r3(it.value_x * bet); // 2x*bet or 0
      return `
        <div class="pt-item">
          <img src="${it.file}" alt="${it.label}">
          <div class="nm">${it.short}</div>
          <div class="vx">+ ${fmtTok(coins)} 🪙</div>
        </div>`;
    }).join("");
  }

  function showWin(win, midRow, bet){
    winAmtEl.textContent = `+${fmtTok(win)}`;
    const parts = midRow.map(m=>`${m.short} (+${fmtTok(m.value_x*bet)})`).join("  •  ");
    winLineEl.textContent = parts;
    winModal.classList.remove("hidden");
    setTimeout(()=> winModal.classList.add("show"), 10);
  }
  function hideWin(){
    winModal.classList.remove("show");
    setTimeout(()=>winModal.classList.add("hidden"), 220);
  }

  const lockables = () => [
    spinBtn, fastChk, depositBtn, cashoutBtn, userSelect, betInput, betSlider, adminToggle
  ];
  function setLocked(locked){
    lockables().forEach(el=>{ if(el){ el.disabled = !!locked; } });
    window.onkeydown = locked ? (e)=>{ if(e.code==="Space") e.preventDefault(); } : null;
  }

  // ===== SPIN =====
  let spinning=false;
  async function doSpin(){
    if (spinning) return;
    await playIfWanted(); // start music on first interaction if enabled

    const s = stats[currentUser];
    const bet = getBet();
    if ((s.tokens||0) + 1e-9 < bet){
      messageEl.textContent = "Insufficient tokens. Deposit a character ≥ 5🪙.";
      return;
    }

    // Dynamic weights for this spin
    const { items: W, total: T } = weightedSet(s.spinCount);

    spinning=true; setLocked(true); machine.classList.add("spinning");
    s.tokens = r3((s.tokens||0) - bet);
    s.spent  = r3((s.spent ||0) + bet);
    save(); renderBalance(); setBetDisplay();

    // Roll 3 independent mids with dynamic weights
    const midRow = [ pick(W,T), pick(W,T), pick(W,T) ];
    const finals = [
      {top:pick(W,T), mid:midRow[0], bot:pick(W,T)},
      {top:pick(W,T), mid:midRow[1], bot:pick(W,T)},
      {top:pick(W,T), mid:midRow[2], bot:pick(W,T)},
    ];

    // Reel 1
    await scrollReelTo(reelEls[0], finals[0], 64, 1, 4200);
    await burstOnReel(reelEls[0], midRow[0].value_x * bet);
    await wait(fastMode?60:120);

    // Reel 2
    await scrollReelTo(reelEls[1], finals[1], 84, 1, 5800);
    await burstOnReel(reelEls[1], midRow[1].value_x * bet);
    await wait(fastMode?80:160);

    // Reel 3
    await scrollReelTo(reelEls[2], finals[2], 112, 2, 8200);
    await burstOnReel(reelEls[2], midRow[2].value_x * bet);

    const win = r3((midRow[0].value_x + midRow[1].value_x + midRow[2].value_x) * bet);

    await wait((fastMode?500:900));

    if (win>0){
      s.tokens = r3((s.tokens||0) + win);
      s.earned = r3((s.earned||0) + win);
      messageEl.textContent = `+${fmtTok(win)}🪙`;
      showWin(win, midRow, bet);
      setTimeout(()=>{ hideWin(); setLocked(false); }, fastMode?1400:2200);
    } else {
      messageEl.textContent = `—`;
      setLocked(false);
    }

    s.spinCount = (s.spinCount||0) + 1; // advance luck curve
    save(); renderBalance(); setBetDisplay();
    machine.classList.remove("spinning");
    spinning=false;
  }

  // ===== Buttons / Inputs =====
  spinBtn.addEventListener("click", doSpin);
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space" && !spinBtn.disabled){ e.preventDefault(); doSpin(); } });

  fastChk.checked = fastMode;
  fastChk.addEventListener("change", ()=>{ fastMode = fastChk.checked; localStorage.setItem("br-fast", fastMode?"1":"0"); });

  const syncFromNumber = ()=>{ betSlider.value = String(getBet()); setBetDisplay(); renderBalance(); };
  const syncFromSlider = ()=>{ betInput.value = String(Number(betSlider.value)); setBetDisplay(); renderBalance(); };
  betInput.addEventListener("input", syncFromNumber);
  betSlider.addEventListener("input", syncFromSlider);
  betInput.addEventListener("wheel", (e)=>{ 
    e.preventDefault();
    const step = Number(betInput.step)||0.01;
    const newV = Number(betInput.value||"0") + (e.deltaY>0 ? -step : step);
    betInput.value = String(Math.max(0.01, r3(newV)));
    syncFromNumber();
  });

  // Passcode-gated deposit
  depositBtn?.addEventListener("click", ()=>{
    const pass = prompt("Enter passcode to deposit:");
    if (pass !== PASSCODE){ alert("Incorrect passcode."); return; }
    const s = stats[currentUser];
    const val = prompt(`Enter character production (M/s). Minimum ${MIN_DEPOSIT}. 1 M/s = 1🪙`, `${Math.max(MIN_DEPOSIT, 5)}`);
    if (val==null) return;
    const tokens = Number(val);
    if (!Number.isFinite(tokens) || tokens<MIN_DEPOSIT){ alert(`Minimum deposit is ${MIN_DEPOSIT} tokens.`); return; }
    s.tokens = r3((s.tokens||0) + tokens);
    save(); renderBalance(); messageEl.textContent = `Deposited ${fmtTok(tokens)}🪙`;
  });

  // Passcode-gated cashout
  cashoutBtn?.addEventListener("click", ()=>{
    const pass = prompt("Enter passcode to cash out:");
    if (pass !== PASSCODE){ alert("Incorrect passcode."); return; }
    const s=stats[currentUser]; const bal=r3(Math.max(0,s.tokens||0));
    if(bal<=0){ alert("Nothing to cash out."); return; }
    if(confirm(`Cash out ${fmtTok(bal)}🪙 → ${fmtTok(bal)}M/s Brainrot?`)){
      alert(`Cashed out: ${fmtTok(bal)}M/s Brainrot`);
      s.tokens=0; save(); renderBalance(); setBetDisplay();
    }
  });

  // Admin (coins only)
  adminToggle?.addEventListener("click", ()=>{
    adminUserLabel.textContent = currentUser;
    adminPanel.classList.remove("hidden");
  });
  closeAdmin?.addEventListener("click", ()=> adminPanel.classList.add("hidden"));
  adminGive?.addEventListener("click", ()=>{
    const s=stats[currentUser];
    const amt = Math.max(0, Number(adminAdd.value||"0"));
    if (!Number.isFinite(amt) || amt<=0) return;
    s.tokens = r3((s.tokens||0) + amt);
    save(); renderBalance(); setBetDisplay();
    adminAdd.value=""; messageEl.textContent = `Admin +${fmtTok(amt)}🪙`;
  });

  // User select
  userSelect.value = currentUser;
  userSelect.addEventListener("change", ()=>{
    currentUser = userSelect.value;
    localStorage.setItem("br-user", currentUser);
    renderBalance(); setBetDisplay();
    adminUserLabel && (adminUserLabel.textContent = currentUser);
  });

  // ===== Init =====
  reelEls.forEach(initReelTrack);
  renderPaytable(); renderBalance(); setBetDisplay();
})();
