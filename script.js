/* Brainrot Slots — linear payouts, 49% RTP, per-reel win bursts, passcodes, full UI lock while spinning */
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
const wait = (ms)=> new Promise(r=>setTimeout(r, ms));
const round2 = (n)=> Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n)=> Math.round((n + Number.EPSILON) * 1000) / 1000;
const fmtTok = (n)=>{ const s=(round3(n)).toFixed(3); return s.replace(/\.?0+$/,''); };

(() => {
  // ===== CONFIG =====
  const MIN_DEPOSIT = 5;
  const PASSCODE = "1111";
  const TARGET_RTP = 0.49; // player

  // Items (best → least). Keep full label, plus short label for UI/paytable.
  const ITEMS_BASE = [
    { k:"strawberryelephant", file:"Strawberryelephant.webp",         label:"Strawberry Elephant",  short:"Elephant",   weight:5,  value_x:0.79  },
    { k:"dragoncanneloni",    file:"Dragoncanneloni.webp",            label:"Dragon Canneloni",     short:"Dragon",     weight:5,  value_x:0.394 },
    { k:"garamadundung",      file:"Garamadundung.webp",              label:"Garama",               short:"Garama",     weight:10, value_x:0.237 },
    { k:"carti",              file:"Carti.webp",                      label:"La Grande",            short:"La Grande",  weight:12, value_x:0.158 },
    { k:"saturnita",          file:"La_Vaccca_Saturno_Saturnita.webp",label:"Saturnita",            short:"Saturnita",  weight:14, value_x:0.110 },
    { k:"tralalero",          file:"TralaleroTralala.webp",           label:"Tralalero Tralala",    short:"Tralalero",  weight:16, value_x:0.084 },
    { k:"sgedrftdikou",       file:"Sgedrftdikou.webp",               label:"Ballerina Cappuccino", short:"Cappuccino", weight:18, value_x:0.067 },
    { k:"noobini",            file:"Noobini_Pizzanini_NEW.webp",      label:"Noobini Pizzanini",    short:"Noobini",    weight:20, value_x:0.054 },
  ];

  // Scale to hit RTP
  const TOTAL_WEIGHT = ITEMS_BASE.reduce((s,x)=>s+x.weight,0);
  const avgBase = ITEMS_BASE.reduce((s,x)=> s + x.value_x * (x.weight/TOTAL_WEIGHT), 0);
  const targetAvg = TARGET_RTP / 3;
  const SCALE = targetAvg / avgBase;
  const ITEMS = ITEMS_BASE.map(x => ({...x, value_x: x.value_x * SCALE}));

  // ===== STATE =====
  const USERS = ["Will","Isaac","Faisal","Muhammed"];
  const STORE = "brainrot-slots-linear-v6";
  const baseUser = ()=>({ tokens:0, earned:0, spent:0 });
  function load(){
    try{
      const raw = JSON.parse(localStorage.getItem(STORE)||"{}");
      for(const u of USERS) if(!raw[u]) raw[u]=baseUser();
      return raw;
    }catch{ return Object.fromEntries(USERS.map(u=>[u,baseUser()])); }
  }
  let stats = load();
  function save(){ localStorage.setItem(STORE, JSON.stringify(stats)); }

  let currentUser = USERS.includes(localStorage.getItem("br-user")) ? localStorage.getItem("br-user") : "Will";
  let fastMode = localStorage.getItem("br-fast")==="1";

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

  const betInput       = document.getElementById("betInput");
  const betSlider      = document.getElementById("betSlider");

  const ptGrid   = document.getElementById("ptGrid");
  const ptBet    = document.getElementById("ptBet");

  const winModal = document.getElementById("winModal");
  const winAmtEl = document.getElementById("winAmt");
  const winLineEl= document.getElementById("winLine");

  const adminToggle = document.getElementById("adminToggle");
  const adminPanel  = document.getElementById("adminPanel");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminAdd    = document.getElementById("adminAdd");
  const adminGive   = document.getElementById("adminGive");
  const closeAdmin  = document.getElementById("closeAdmin");

  // ===== helpers =====
  const CELL_H = 156;
  const imgHTML = (file, alt)=> `<img src="./${file}" alt="${alt}">`;
  function makeCell(inner,isMid=false){ const d=document.createElement("div"); d.className="cell"+(isMid?" mid":""); d.innerHTML=inner; return d; }
  function randItem(){ let r=Math.random()*TOTAL_WEIGHT; for(const s of ITEMS){ if((r-=s.weight)<=0) return s; } return ITEMS[ITEMS.length-1]; }

  function initReelTrack(reel){
    const t=reel.querySelector(".track"); t.innerHTML="";
    for(let i=0;i<6;i++){ t.appendChild(makeCell(imgHTML(randItem().file,"sym"), i===1)); }
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
    for(let i=0;i<filler;i++) track.appendChild(makeCell(imgHTML(randItem().file,"sym")));
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

  // Per-reel burst
  function burstOnReel(reelEl, amount){
    if (amount <= 0) return 0;
    const b = document.createElement("div");
    b.className = "burst";
    b.textContent = `+${Math.round(amount)}`;
    reelEl.appendChild(b);
    const life = 900;
    setTimeout(()=> b.remove(), life+30);
    return life;
  }

  function getBet(){
    const v = Number(betInput.value)||0.5;
    const max = Math.max(0.01, stats[currentUser].tokens||0.01);
    const cl = clamp(v, 0.01, max);
    if (cl !== v) betInput.value = String(cl);
    return cl;
  }
  function setBetDisplay(){
    const bet = getBet();
    machineBetEl.textContent = `${fmtTok(bet)}🪙`;
    ptBet.textContent = `${fmtTok(bet)}🪙`;
    renderPaytable();
  }
  function renderBalance(){
    const bal = stats[currentUser].tokens||0;
    tokenBalanceEl.textContent = `${fmtTok(bal)}🪙`;
    const max = Math.max(0.01, bal || 0.01);
    betInput.max = String(max);
    betSlider.max = String(Math.max(max, 1));
    betSlider.value = String(getBet());
    spinBtn.disabled = (bal + 1e-9) < getBet();
  }
  function renderPaytable(){
    const bet = getBet();
    ptGrid.innerHTML = ITEMS.map(it=>{
      const coins = round3(it.value_x * bet);
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
    const s = stats[currentUser];
    const bet = getBet();
    if ((s.tokens||0) + 1e-9 < bet){
      messageEl.textContent = "Insufficient tokens. Deposit a character ≥ 5🪙.";
      return;
    }

    spinning=true; setLocked(true); machine.classList.add("spinning");
    s.tokens = round3((s.tokens||0) - bet);
    s.spent  = round3((s.spent ||0) + bet);
    save(); renderBalance(); setBetDisplay();

    const midRow = [randItem(), randItem(), randItem()];
    const finals = [
      {top:randItem(), mid:midRow[0], bot:randItem()},
      {top:randItem(), mid:midRow[1], bot:randItem()},
      {top:randItem(), mid:midRow[2], bot:randItem()},
    ];

    // Reel 1
    await scrollReelTo(reelEls[0], finals[0], 64, 1, 4200);
    const a1 = midRow[0].value_x * bet;
    const life1 = burstOnReel(reelEls[0], a1);
    await wait(fastMode?60:120);

    // Reel 2
    await scrollReelTo(reelEls[1], finals[1], 84, 1, 5800);
    const a2 = midRow[1].value_x * bet;
    const life2 = burstOnReel(reelEls[1], a2);
    await wait(fastMode?80:160);

    // Reel 3
    await scrollReelTo(reelEls[2], finals[2], 112, 2, 8200);
    const a3 = midRow[2].value_x * bet;
    const life3 = burstOnReel(reelEls[2], a3);

    const totalX = midRow[0].value_x + midRow[1].value_x + midRow[2].value_x;
    const win = round3(totalX * bet);

    // Wait for last burst to finish before showing modal
    await wait((fastMode?500:900));

    if (win>0){
      s.tokens = round3((s.tokens||0) + win);
      s.earned = round3((s.earned||0) + win);
      messageEl.textContent = `+${fmtTok(win)}🪙`;
      showWin(win, midRow, bet);
      setTimeout(()=>{ hideWin(); setLocked(false); }, fastMode?1400:2200);
    } else {
      messageEl.textContent = `—`;
      setLocked(false);
    }

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
    betInput.value = String(Math.max(0.01, round3(newV)));
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
    s.tokens = round3((s.tokens||0) + tokens);
    save(); renderBalance(); messageEl.textContent = `Deposited ${fmtTok(tokens)}🪙`;
  });

  // Passcode-gated cashout
  cashoutBtn?.addEventListener("click", ()=>{
    const pass = prompt("Enter passcode to cash out:");
    if (pass !== PASSCODE){ alert("Incorrect passcode."); return; }
    const s=stats[currentUser]; const bal=round3(Math.max(0,s.tokens||0));
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
    s.tokens = round3((s.tokens||0) + amt);
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
