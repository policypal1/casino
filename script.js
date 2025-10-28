/* Brainrot Slots — per-character values (linear payouts, RTP ~47%) */

function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
const wait = (ms)=> new Promise(r=>setTimeout(r, ms));
const round3 = (n)=> Math.round((n + Number.EPSILON) * 1000) / 1000;
const fmtTok = (n)=> { const s=(round3(n)).toFixed(3); return s.replace(/\.?0+$/,''); };

(() => {
  // ===== ECONOMY =====
  const MIN_DEPOSIT = 5;            // 5 M/s -> 5 coins
  let fastMode = localStorage.getItem("br-fast")==="1";

  // Symbols (best -> least), with fixed values PER 1-coin bet
  // win for that symbol = bet * value_x
  // Weights control how often each shows in the middle row
  const ITEMS = [
    { k:"strawberryelephant", file:"Strawberryelephant.webp",         label:"Strawberry Elephant", weight:5,  value_x:0.79 },
    { k:"dragoncanneloni",    file:"Dragoncanneloni.webp",            label:"Dragon Canneloni",    weight:5,  value_x:0.394 },
    { k:"garamadundung",      file:"Garamadundung.webp",              label:"Garamadundung",       weight:10, value_x:0.237 },
    { k:"carti",              file:"Carti.webp",                      label:"Carti",               weight:12, value_x:0.158 },
    { k:"saturnita",          file:"La_Vaccca_Saturno_Saturnita.webp",label:"Saturnita",           weight:14, value_x:0.110 },
    { k:"tralalero",          file:"TralaleroTralala.webp",           label:"Tralalero Tralala",   weight:16, value_x:0.084 },
    { k:"sgedrftdikou",       file:"Sgedrftdikou.webp",               label:"Sgedrftdikou",        weight:18, value_x:0.067 },
    { k:"noobini",            file:"Noobini_Pizzanini_NEW.webp",      label:"Noobini Pizzanini",   weight:20, value_x:0.054 },
  ];
  const TOTAL_WEIGHT = ITEMS.reduce((s,x)=>s+x.weight,0);

  // ===== STATE / STORAGE =====
  const USERS = ["Will","Isaac","Faisal","Muhammed"];
  const storeKey = "brainrot-slots-linear-v1";
  function baseUser(){ return { tokens:0, earned:0, spent:0 }; }
  function loadStats(){
    try{ const raw=JSON.parse(localStorage.getItem(storeKey)||"{}");
      for(const u of USERS) if(!raw[u]) raw[u]=baseUser(); return raw;
    }catch{ return Object.fromEntries(USERS.map(u=>[u,baseUser()])); }
  }
  let stats = loadStats();
  function save(){ localStorage.setItem(storeKey, JSON.stringify(stats)); }

  let currentUser = USERS.includes(localStorage.getItem("br-user"))
    ? localStorage.getItem("br-user") : "Will";

  // ===== DOM =====
  const reelEls = [1,2,3].map(i=>document.getElementById(`reel-${i}`));
  const spinBtn = document.getElementById("spinBtn");
  const fastBtn = document.getElementById("fastBtn");   // optional
  const depositBtn = document.getElementById("depositBtn") || document.getElementById("convertBtn");
  const cashoutBtn = document.getElementById("cashoutBtn");
  const messageEl = document.getElementById("message");

  const userSelect = document.getElementById("userSelect");
  const tokenBalanceEl = document.getElementById("tokenBalance") || document.getElementById("totalEarned");
  const machineBetEl = document.getElementById("machineBet");
  const betRange = document.getElementById("betRange");   // optional (if you added slider)
  const betInput = document.getElementById("betInput");   // optional (number box)

  // If you don’t use the slider/number input, we’ll default to 0.50
  function getBet(){
    if (betInput)  return clamp(Number(betInput.value)||0.5, 0.01, (stats[currentUser].tokens||0));
    if (betRange)  return clamp(Number(betRange.value)||0.5, 0.01, (stats[currentUser].tokens||0));
    return 0.5;
  }
  function setBet(v){
    const max = Math.max(0.01, stats[currentUser].tokens||0);
    const val = clamp(Number(v)||0.5, 0.01, max);
    if (betInput){ betInput.max=String(max); betInput.value = String(val); }
    if (betRange){ betRange.max=String(max); betRange.value = String(val); }
    if (machineBetEl) machineBetEl.textContent = `${fmtTok(val)}🪙`;
    spinBtn.disabled = (stats[currentUser].tokens||0) + 1e-9 < val;
  }

  // ===== REEL HELPERS =====
  const CELL_H = 156;
  const imgHTML = (file, alt)=> `<img src="./${file}" alt="${alt}">`;
  function makeCell(inner,isMid=false){ const d=document.createElement("div"); d.className="cell"+(isMid?" mid":""); d.innerHTML=inner; return d; }
  function randItem(){ let r=Math.random()*TOTAL_WEIGHT; for(const s of ITEMS){ if((r-=s.weight)<=0) return s; } return ITEMS[ITEMS.length-1]; }
  function initReelTrack(reel){
    const t=reel.querySelector(".track"); t.innerHTML="";
    for(let i=0;i<6;i++){ t.appendChild(makeCell(imgHTML(randItem().file,"sym"), i===1)); }
  }

  async function scrollReelTo(reel, finalCol, totalRows, fakeHops, durationMs){
    const speed = fastMode ? 0.35 : 1;                 // ~65% faster in fast mode
    const hops  = fastMode ? Math.max(0,fakeHops-1) : fakeHops;
    const rows  = fastMode ? Math.floor(totalRows*0.6) : totalRows;
    const dur   = Math.max(380, Math.floor(durationMs*speed));

    const track=reel.querySelector(".track");
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
      track.style.transition="transform 140ms ease-out"; track.style.transform=`translateY(${distance+18}px)`; await wait(140);
      track.style.transition="transform 160ms ease-in";  track.style.transform=`translateY(${distance}px)`;     await wait(160);
    }
    reel.classList.add("stopped");
  }

  // ===== RENDER =====
  function renderBalance(){
    if (!tokenBalanceEl) return;
    // Some older UIs used $ display; we show 🪙 neatly
    const bal = stats[currentUser].tokens||0;
    tokenBalanceEl.textContent = /🪙/.test(tokenBalanceEl.textContent||"")
      ? `${fmtTok(bal)}🪙` : `${fmtTok(bal)}🪙`;
  }
  function refreshUI(){ renderBalance(); setBet(getBet()); }

  // ===== SPIN =====
  let spinning=false;
  async function doSpin(){
    if (spinning) return;
    const s=stats[currentUser];
    const bet = getBet();
    if ((s.tokens||0) + 1e-9 < bet){
      messageEl && (messageEl.textContent = "Insufficient tokens. Deposit a character ≥ 5🪙.");
      return;
    }

    spinning=true;
    s.tokens = round3((s.tokens||0) - bet);
    s.spent  = round3((s.spent ||0) + bet);
    save(); refreshUI();

    // middle row: 3 independent items
    const midRow = [randItem(), randItem(), randItem()];
    const finals = [
      {top:randItem(), mid:midRow[0], bot:randItem()},
      {top:randItem(), mid:midRow[1], bot:randItem()},
      {top:randItem(), mid:midRow[2], bot:randItem()},
    ];

    await scrollReelTo(reelEls[0], finals[0], 64, 1, 4200);
    await wait(fastMode?100:260);
    await scrollReelTo(reelEls[1], finals[1], 84, 1, 5800);
    await wait(fastMode?120:340);
    await scrollReelTo(reelEls[2], finals[2], 112, 2, 8200);

    // Linear payout: sum of values * bet
    const totalX = midRow[0].value_x + midRow[1].value_x + midRow[2].value_x;
    const win = round3(totalX * bet);

    if (win>0){
      s.tokens = round3((s.tokens||0) + win);
      s.earned = round3((s.earned||0) + win);
      messageEl && (messageEl.textContent = `+${fmtTok(win)}🪙`);
    } else {
      messageEl && (messageEl.textContent = `—`);
    }
    save(); refreshUI();
    spinning=false;
  }

  // ===== ECONOMY BUTTONS =====
  if (depositBtn){
    depositBtn.addEventListener("click", ()=>{
      const s=stats[currentUser];
      const val=prompt(`Enter your character's production (M/s). Minimum ${MIN_DEPOSIT}. 1 M/s = 1🪙`, `${Math.max(MIN_DEPOSIT, 5)}`);
      if(val==null) return;
      const tokens=Number(val);
      if(!Number.isFinite(tokens)||tokens<MIN_DEPOSIT){ alert(`Minimum deposit is ${MIN_DEPOSIT} tokens.`); return; }
      s.tokens = round3((s.tokens||0) + tokens);
      save(); refreshUI();
      messageEl && (messageEl.textContent = `Deposited ${fmtTok(tokens)}🪙`);
    });
  }

  if (cashoutBtn){
    cashoutBtn.addEventListener("click", ()=>{
      const s=stats[currentUser]; const bal=round3(Math.max(0,s.tokens||0));
      if(bal<=0){ alert("Nothing to cash out."); return; }
      if(confirm(`Cash out ${fmtTok(bal)}🪙 → ${fmtTok(bal)}M/s Brainrot?`)){
        alert(`Cashed out: ${fmtTok(bal)}M/s Brainrot!`);
        s.tokens=0; save(); refreshUI();
      }
    });
  }

  // ===== FAST MODE =====
  if (fastBtn){
    const reflect=()=>{ fastBtn.setAttribute("aria-pressed", fastMode?"true":"false"); fastBtn.classList.toggle("primary", fastMode); };
    reflect();
    fastBtn.addEventListener("click", ()=>{ fastMode=!fastMode; localStorage.setItem("br-fast", fastMode?"1":"0"); reflect(); });
  }

  // ===== BET INPUTS (optional slider / number) =====
  if (betRange){
    betRange.addEventListener("input", ()=> setBet(betRange.value));
    betRange.addEventListener("wheel", (e)=>{ e.preventDefault(); const step=Number(betRange.step)||0.01; setBet(Number(getBet()) + (e.deltaY>0?-step:step)); });
  }
  if (betInput){
    betInput.addEventListener("input", ()=> setBet(betInput.value));
    betInput.addEventListener("wheel", (e)=>{ e.preventDefault(); const step=Number(betInput.step)||0.01; setBet(Number(getBet()) + (e.deltaY>0?-step:step)); });
  }

  // ===== USER SELECT =====
  if (userSelect){
    userSelect.value = currentUser;
    userSelect.addEventListener("change", ()=>{ currentUser=userSelect.value; localStorage.setItem("br-user", currentUser); refreshUI(); });
  }

  // ===== INIT =====
  reelEls.forEach(initReelTrack);
  refreshUI();
  if (machineBetEl && !betInput && !betRange) machineBetEl.textContent = `${fmtTok(getBet())}🪙`;

  spinBtn.addEventListener("click", ()=> doSpin());
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); } });
})();
