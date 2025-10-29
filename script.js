/* Brainrot Slots — linear payouts, ~65% base RTP, ramp→peak→decay luck, music toggle */
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
const wait = (ms)=> new Promise(r=>setTimeout(r, ms));
const round3 = (n)=> Math.round((n + Number.EPSILON) * 1000) / 1000;
const fmtTok = (n)=>{ const s=(round3(n)).toFixed(3); return s.replace(/\.?0+$/,''); };
function fmtBurst(n){ const v=Math.max(0,round3(n)); const d=Math.floor(v).toString().length; const k=Math.max(0,3-d); let s=v.toFixed(k); if(v<1&&!s.startsWith('0')) s='0'+s; return s; }

(() => {
  // ===== CONFIG =====
  const MIN_DEPOSIT = 5;
  const PASSCODE = "1111";
  const TARGET_RTP = 0.65;      // base expectation before luck shaping

  // Luck shape (tune to taste)
  const RAMP_UP_SPINS = 12;     // gradual increase to peak
  const PEAK_SPINS    = 3;      // short insane window
  const DECAY_SPINS   = 60;     // slow falloff to “bad”

  // Symbols (two bottom pay 0)
  const ITEMS_BASE = [
    { k:"strawberryelephant", file:"Strawberryelephant.webp",          label:"Strawberry Elephant",  short:"Elephant",   weight:7,  value_x:0.66 },
    { k:"dragoncanneloni",    file:"Dragoncanneloni.webp",             label:"Dragon Canneloni",     short:"Dragon",     weight:9,  value_x:0.36 },
    { k:"garamadundung",      file:"Garamadundung.webp",               label:"Garama",               short:"Garama",     weight:14, value_x:0.24 },
    { k:"carti",              file:"Carti.webp",                       label:"La Grande",            short:"La Grande",  weight:16, value_x:0.17 },
    { k:"saturnita",          file:"La_Vaccca_Saturno_Saturnita.webp", label:"Saturnita",            short:"Saturnita",  weight:18, value_x:0.12 },
    { k:"tralalero",          file:"TralaleroTralala.webp",            label:"Tralalero Tralala",    short:"Tralalero",  weight:20, value_x:0.09 },
    { k:"sgedrftdikou",       file:"Sgedrftdikou.webp",                label:"Ballerina Cappuccino", short:"Cappuccino", weight:16, value_x:0.00 },
    { k:"noobini",            file:"Noobini_Pizzanini_NEW.webp",       label:"Noobini Pizzanini",    short:"Noobini",    weight:17, value_x:0.00 },
  ];

  // Scale payouts to target RTP (per reel EV = TARGET_RTP/3)
  const TW = ITEMS_BASE.reduce((s,x)=>s+x.weight,0);
  const avgBase = ITEMS_BASE.reduce((s,x)=> s + x.value_x * (x.weight/TW), 0);
  const SCALE = avgBase>0 ? ((TARGET_RTP/3)/avgBase) : 1;
  const ITEMS_VALS = ITEMS_BASE.map(x=>({...x, value_x:x.value_x*SCALE}));

  // Multipliers by phase
  const MULT_BASE = {strawberryelephant:1, dragoncanneloni:1, garamadundung:1, carti:1, saturnita:1, tralalero:1, sgedrftdikou:1, noobini:1};
  const MULT_PEAK = { // very hot
    strawberryelephant: 3.8, dragoncanneloni: 2.4, garamadundung:1.6, carti:1.3,
    saturnita:1.0, tralalero:0.9, sgedrftdikou:0.7, noobini:0.7
  };
  const MULT_BAD = { // tight
    strawberryelephant:0.55, dragoncanneloni:0.75, garamadundung:0.9, carti:1.0,
    saturnita:1.25, tralalero:1.45, sgedrftdikou:2.1, noobini:2.1
  };

  // Helpers
  const lerp = (a,b,t)=> a + (b-a)*t;
  const mix = (A,B,t)=> {
    const out={}; for(const k in A){ out[k]=lerp(A[k], B[k], t); } return out;
  };

  // Build per-spin weight multipliers for the ramp→peak→decay curve
  function phaseMultipliers(spinIdx, ramp, peak, decay){
    if (spinIdx < ramp){
      // rising from BASE to PEAK
      const t = Math.max(0, Math.min(1, spinIdx / Math.max(1, ramp)));
      return mix(MULT_BASE, MULT_PEAK, t);
    }
    if (spinIdx < ramp + peak){
      return MULT_PEAK; // hold peak
    }
    const post = spinIdx - (ramp + peak);
    if (post >= decay) return MULT_BAD;
    const t = Math.max(0, Math.min(1, post / Math.max(1, decay)));
    // fall from PEAK to BAD
    return mix(MULT_PEAK, MULT_BAD, t);
  }

  function weightedSet(spinIdx){
    const m = phaseMultipliers(spinIdx, RAMP_UP_SPINS, PEAK_SPINS, DECAY_SPINS);
    const items = ITEMS_VALS.map(it=>({...it, weight: it.weight * (m[it.k]||1)}));
    const total = items.reduce((s,x)=>s+x.weight,0);
    return {items,total};
  }
  function pick(items,total){ let r=Math.random()*total; for(const s of items){ if((r-=s.weight)<=0) return s; } return items[items.length-1]; }

  // ===== STATE =====
  const USERS = ["Will","Isaac","Faisal","Muhammed"];
  const STORE = "brainrot-slots-linear-v9";
  const baseUser = ()=>({ tokens:0, earned:0, spent:0, spinCount:0 });
  const load = ()=>{
    try{
      const raw = JSON.parse(localStorage.getItem(STORE)||"{}");
      for(const u of USERS) if(!raw[u]) raw[u]=baseUser();
      return raw;
    }catch{ return Object.fromEntries(USERS.map(u=>[u,baseUser()])); }
  };
  let stats = load();
  const save = ()=> localStorage.setItem(STORE, JSON.stringify(stats));

  let currentUser = USERS.includes(localStorage.getItem("br-user")) ? localStorage.getItem("br-user") : "Will";
  let fastMode = localStorage.getItem("br-fast")==="1";

  // ===== DOM =====
  const machine=document.getElementById("machine");
  const reelEls=[1,2,3].map(i=>document.getElementById(`reel-${i}`));
  const spinBtn=document.getElementById("spinBtn");
  const fastChk=document.getElementById("fastChk");
  const depositBtn=document.getElementById("convertBtn");
  const cashoutBtn=document.getElementById("cashoutBtn");
  const messageEl=document.getElementById("message");
  const userSelect=document.getElementById("userSelect");
  const tokenBalanceEl=document.getElementById("tokenBalance");
  const machineBetEl=document.getElementById("machineBet");
  const betInput=document.getElementById("betInput");
  const betSlider=document.getElementById("betSlider");
  const ptGrid=document.getElementById("ptGrid");
  const ptBet=document.getElementById("ptBet");
  const winModal=document.getElementById("winModal");
  const winAmtEl=document.getElementById("winAmt");
  const winLineEl=document.getElementById("winLine");
  const adminToggle=document.getElementById("adminToggle");
  const adminPanel=document.getElementById("adminPanel");
  const adminUserLabel=document.getElementById("adminUserLabel");
  const adminAdd=document.getElementById("adminAdd");
  const adminGive=document.getElementById("adminGive");
  const closeAdmin=document.getElementById("closeAdmin");
  const dimEl=document.getElementById("dim");

  // Music
  const bgm=document.getElementById("bgm");
  const musicBtn=document.getElementById("musicBtn");
  let musicWanted=false;
  async function ensureMusic(){
    if(!bgm) return;
    try{
      bgm.volume = 0.45;
      if(musicWanted) await bgm.play();
    }catch{} // autoplay policies
  }
  musicBtn?.addEventListener('click', async ()=>{
    musicWanted = !musicWanted;
    musicBtn.setAttribute('aria-pressed', String(musicWanted));
    if(musicWanted){ await bgm.play().catch(()=>{}); } else { bgm.pause(); }
  });

  const showDim = async (ms)=>{ if(!dimEl) return; dimEl.classList.add('show'); await wait(ms); dimEl.classList.remove('show'); };

  // Helpers
  const CELL_H=156;
  const imgHTML=(file,alt)=>`<img src="./${file}" alt="${alt}">`;
  const makeCell=(inner,isMid=false)=>{ const d=document.createElement("div"); d.className="cell"+(isMid?" mid":""); d.innerHTML=inner; return d; };
  function initReelTrack(reel){ const t=reel.querySelector(".track"); t.innerHTML=""; for(let i=0;i<6;i++) t.appendChild(makeCell(imgHTML(ITEMS_VALS[i%ITEMS_VALS.length].file,"sym"),i===1)); }

  async function scrollReelTo(reel, finalCol, totalRows, fakeHops, durationMs){
    const speed=fastMode?0.38:1, hops=fastMode?Math.max(0,fakeHops-1):fakeHops, rows=fastMode?Math.floor(totalRows*0.6):totalRows, dur=Math.max(360,Math.floor(durationMs*speed));
    const track=reel.querySelector(".track");
    reel.classList.remove("stopped"); track.innerHTML="";
    const filler=Math.max(3,rows-3);
    for(let i=0;i<filler;i++) track.appendChild(makeCell(imgHTML(ITEMS_VALS[i%ITEMS_VALS.length].file,"sym")));
    track.appendChild(makeCell(imgHTML(finalCol.top.file, finalCol.top.label)));
    track.appendChild(makeCell(imgHTML(finalCol.mid.file, finalCol.mid.label), true));
    track.appendChild(makeCell(imgHTML(finalCol.bot.file, finalCol.bot.label)));
    track.style.transform="translateY(0px)"; track.style.transition="none"; void track.offsetHeight;
    const distance=-(CELL_H*(rows-3));
    track.style.transition=`transform ${dur}ms cubic-bezier(.12,.86,.16,1)`; track.style.transform=`translateY(${distance}px)`; await wait(dur);
    for(let i=0;i<hops;i++){ track.style.transition="transform 130ms ease-out"; track.style.transform=`translateY(${distance+18}px)`; await wait(130); track.style.transition="transform 150ms ease-in"; track.style.transform=`translateY(${distance}px)`; await wait(150); }
    reel.classList.add("stopped");
  }

  // Always show burst, even for +0
  async function burstOnReel(reelEl, amount){
    showDim(1000).catch(()=>{});
    const b=document.createElement("div"); b.className="burst"; b.textContent=`+${fmtBurst(Math.max(0,amount))}`;
    reelEl.appendChild(b); setTimeout(()=>b.remove(), 940);
  }

  function getBet(){ const v=Number(betInput.value)||0.5; const max=Math.max(0.01, stats[currentUser].tokens||0.01); const cl=Math.min(Math.max(v,0.01),max); if(cl!==v) betInput.value=String(cl); return cl; }
  function setBetDisplay(){ const bet=getBet(); machineBetEl.textContent=`${fmtTok(bet)}🪙`; ptBet.textContent=`${fmtTok(bet)}🪙`; renderPaytable(); }
  function renderBalance(){
    const bal=stats[currentUser].tokens||0;
    tokenBalanceEl.textContent=`${fmtTok(bal)}🪙`;
    const max=Math.max(0.01, bal||0.01);
    betInput.max=String(max); betSlider.max=String(Math.max(max,1)); betSlider.value=String(getBet());
    spinBtn.disabled=(bal+1e-9)<getBet();
  }
  function renderPaytable(){
    const bet=getBet();
    ptGrid.innerHTML = ITEMS_VALS.map(it=>{
      const coins=round3(it.value_x*bet);
      return `<div class="pt-item"><img src="${it.file}" alt="${it.label}"><div class="nm">${it.short}</div><div class="vx">+ ${fmtTok(coins)} 🪙</div></div>`;
    }).join("");
  }
  function showWin(win, midRow, bet){
    winAmtEl.textContent=`+${fmtTok(win)}`;
    winLineEl.textContent = midRow.map(m=>`${m.short} (+${fmtTok(m.value_x*bet)})`).join("  •  ");
    winModal.classList.remove("hidden"); setTimeout(()=>winModal.classList.add("show"),10);
  }
  function hideWin(){ winModal.classList.remove("show"); setTimeout(()=>winModal.classList.add("hidden"),220); }

  const lockables=()=>[spinBtn,fastChk,depositBtn,cashoutBtn,userSelect,betInput,betSlider,adminToggle];
  function setLocked(v){ lockables().forEach(el=>{ if(el) el.disabled=!!v; }); window.onkeydown = v ? (e)=>{ if(e.code==="Space") e.preventDefault(); } : null; }

  // ===== SPIN =====
  let spinning=false;
  async function doSpin(){
    if(spinning) return;
    await ensureMusic(); // start music once on first interaction if enabled

    const s=stats[currentUser];
    const bet=getBet();
    if((s.tokens||0)+1e-9<bet){ messageEl.textContent="Insufficient tokens. Deposit a character ≥ 5🪙."; return; }

    const {items:W,total:T} = weightedSet(s.spinCount);

    spinning=true; setLocked(true); machine.classList.add("spinning");
    s.tokens=round3((s.tokens||0)-bet); s.spent=round3((s.spent||0)+bet);
    save(); renderBalance(); setBetDisplay();

    const midRow=[pick(W,T), pick(W,T), pick(W,T)];
    const finals=[
      {top:pick(W,T), mid:midRow[0], bot:pick(W,T)},
      {top:pick(W,T), mid:midRow[1], bot:pick(W,T)},
      {top:pick(W,T), mid:midRow[2], bot:pick(W,T)},
    ];

    await scrollReelTo(reelEls[0], finals[0], 64, 1, 4200); await burstOnReel(reelEls[0], midRow[0].value_x*bet); await wait(fastMode?60:120);
    await scrollReelTo(reelEls[1], finals[1], 84, 1, 5800); await burstOnReel(reelEls[1], midRow[1].value_x*bet); await wait(fastMode?80:160);
    await scrollReelTo(reelEls[2], finals[2],112, 2, 8200); await burstOnReel(reelEls[2], midRow[2].value_x*bet);

    const win=round3((midRow[0].value_x+midRow[1].value_x+midRow[2].value_x)*bet);
    await wait(fastMode?500:900);

    if(win>0){ s.tokens=round3((s.tokens||0)+win); s.earned=round3((s.earned||0)+win); messageEl.textContent=`+${fmtTok(win)}🪙`; showWin(win, midRow, bet); setTimeout(()=>{ hideWin(); setLocked(false); }, fastMode?1400:2200); }
    else { messageEl.textContent="—"; setLocked(false); }

    s.spinCount=(s.spinCount||0)+1;
    save(); renderBalance(); setBetDisplay();
    machine.classList.remove("spinning"); spinning=false;
  }

  // Buttons
  spinBtn.addEventListener("click", doSpin);
  window.addEventListener("keydown",(e)=>{ if(e.code==="Space" && !spinBtn.disabled){ e.preventDefault(); doSpin(); } });

  fastChk.checked=fastMode;
  fastChk.addEventListener("change", ()=>{ fastMode=fastChk.checked; localStorage.setItem("br-fast", fastMode?"1":"0"); });

  const syncFromNumber=()=>{ betSlider.value=String(getBet()); setBetDisplay(); renderBalance(); };
  const syncFromSlider =()=>{ betInput.value=String(Number(betSlider.value)); setBetDisplay(); renderBalance(); };
  betInput.addEventListener("input", syncFromNumber);
  betSlider.addEventListener("input", syncFromSlider);
  betInput.addEventListener("wheel",(e)=>{ e.preventDefault(); const step=Number(betInput.step)||0.01; const nv=Number(betInput.value||"0")+(e.deltaY>0?-step:step); betInput.value=String(Math.max(0.01, round3(nv))); syncFromNumber(); });

  // Deposit / Cashout (unchanged)
  depositBtn?.addEventListener("click", ()=>{
    const pass=prompt("Enter passcode to deposit:"); if(pass!==PASSCODE){ alert("Incorrect passcode."); return; }
    const s=stats[currentUser]; const val=prompt(`Enter character production (M/s). Minimum ${MIN_DEPOSIT}. 1 M/s = 1🪙`, `${Math.max(MIN_DEPOSIT,5)}`); if(val==null) return;
    const tokens=Number(val); if(!Number.isFinite(tokens)||tokens<MIN_DEPOSIT){ alert(`Minimum deposit is ${MIN_DEPOSIT} tokens.`); return; }
    s.tokens=round3((s.tokens||0)+tokens); save(); renderBalance(); messageEl.textContent=`Deposited ${fmtTok(tokens)}🪙`;
  });

  cashoutBtn?.addEventListener("click", ()=>{
    const pass=prompt("Enter passcode to cash out:"); if(pass!==PASSCODE){ alert("Incorrect passcode."); return; }
    const s=stats[currentUser]; const bal=round3(Math.max(0,s.tokens||0)); if(bal<=0){ alert("Nothing to cash out."); return; }
    if(confirm(`Cash out ${fmtTok(bal)}🪙 → ${fmtTok(bal)}M/s Brainrot?`)){ alert(`Cashed out: ${fmtTok(bal)}M/s Brainrot`); s.tokens=0; save(); renderBalance(); setBetDisplay(); }
  });

  adminToggle?.addEventListener("click", ()=>{ adminUserLabel.textContent=currentUser; adminPanel.classList.remove("hidden"); });
  closeAdmin?.addEventListener("click", ()=> adminPanel.classList.add("hidden"));
  adminGive?.addEventListener("click", ()=>{ const s=stats[currentUser]; const amt=Math.max(0, Number(adminAdd.value||"0")); if(!Number.isFinite(amt)||amt<=0) return; s.tokens=round3((s.tokens||0)+amt); save(); renderBalance(); setBetDisplay(); adminAdd.value=""; messageEl.textContent=`Admin +${fmtTok(amt)}🪙`; });

  userSelect.value=currentUser;
  userSelect.addEventListener("change", ()=>{ currentUser=userSelect.value; localStorage.setItem("br-user", currentUser); renderBalance(); setBetDisplay(); adminUserLabel&&(adminUserLabel.textContent=currentUser); });

  // Init
  reelEls.forEach(initReelTrack);
  renderPaytable(); renderBalance(); setBetDisplay();
})();
