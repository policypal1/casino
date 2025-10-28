/* Brainrot Slots — v23
   - Scrollable bet (range + wheel) limited by balance
   - Fast Spin toggle
   - No modals/bubbles; small +/− delta flashes next to Balance
   - “character” wording
*/

function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
const wait = (ms)=> new Promise(r=>setTimeout(r, ms));
const round3 = (n)=> Math.round((n + Number.EPSILON) * 1000) / 1000;
const fmtTok = (n)=> { const s = (round3(n)).toFixed(3); return s.replace(/\.?0+$/,''); };

(() => {
  // ===== ECONOMY/EDGE (same tight defaults you approved) =====
  const DEFAULT_RTP_TARGET = 35, DEFAULT_RTP_GAIN = 120;
  const FORCED_TOP_PCT = 0.002;     // 0.2% forced top triple
  const PITY_START = 4, PITY_STEP = 8;
  const DEFAULT_ODDS = 70, DEFAULT_LUCK = 4;
  const MIN_DEPOSIT = 5;

  // Symbols (best → least) using your webp files
  const ITEMS = [
    { k:"strawberryelephant", file:"Strawberryelephant.webp",         label:"Strawberry Elephant", weight:5,  rank:8 },
    { k:"dragoncanneloni",    file:"Dragoncanneloni.webp",            label:"Dragon Canneloni",    weight:5,  rank:7 },
    { k:"garamadundung",      file:"Garamadundung.webp",              label:"Garamadundung",       weight:10, rank:6 },
    { k:"carti",              file:"Carti.webp",                      label:"Carti",               weight:12, rank:5 },
    { k:"saturnita",          file:"La_Vaccca_Saturno_Saturnita.webp",label:"Saturnita",           weight:14, rank:4 },
    { k:"tralalero",          file:"TralaleroTralala.webp",           label:"Tralalero Tralala",   weight:16, rank:3 },
    { k:"sgedrftdikou",       file:"Sgedrftdikou.webp",               label:"Sgedrftdikou",        weight:18, rank:2 },
    { k:"noobini",            file:"Noobini_Pizzanini_NEW.webp",      label:"Noobini Pizzanini",   weight:20, rank:1 },
  ];
  const TOTAL_WEIGHT = ITEMS.reduce((s,x)=>s+x.weight,0);
  const TOP = ITEMS[0];

  // Payout multipliers per 1🪙 bet (tight + decimals)
  const PAYX_3 = {
    strawberryelephant: 5.0,
    dragoncanneloni:    2.5,
    garamadundung:      1.5,
    carti:              1.0,
    saturnita:          0.7,
    tralalero:          0.5,
    sgedrftdikou:       0.3,
    noobini:            0.2,
  };
  const PAYX_PAIR = 0.05;

  const USERS = ["Will","Isaac","Faisal","Muhammed"];
  const storeKey = "brainrot-slots-v23";

  // ===== State =====
  function baseUser(){ return {tokens:0, earned:0, spent:0, luck:DEFAULT_LUCK, odds:DEFAULT_ODDS, rtpTarget:DEFAULT_RTP_TARGET, rtpGain:DEFAULT_RTP_GAIN, dry:0, diamond3:FORCED_TOP_PCT}; }
  function loadStats(){ try{ const raw=JSON.parse(localStorage.getItem(storeKey)||"{}"); for(const u of USERS) if(!raw[u]) raw[u]=baseUser(); return raw; }catch{ return Object.fromEntries(USERS.map(u=>[u, baseUser()])); } }
  function saveStats(){ localStorage.setItem(storeKey, JSON.stringify(stats)); }

  let stats = loadStats();
  let currentUser = USERS.includes(localStorage.getItem("br-user")) ? localStorage.getItem("br-user") : "Will";
  let fastMode = localStorage.getItem("br-fast") === "1";

  // ===== DOM =====
  const machine = document.getElementById("machine");
  const reelEls = [1,2,3].map(i => document.getElementById(`reel-${i}`));
  const spinBtn = document.getElementById("spinBtn");
  const fastBtn = document.getElementById("fastBtn");
  const depositBtn = document.getElementById("depositBtn");
  const cashoutBtn = document.getElementById("cashoutBtn");
  const messageEl = document.getElementById("message");
  const tokenBalanceEl = document.getElementById("tokenBalance");
  const deltaEl = document.getElementById("balanceDelta");

  const userSelect = document.getElementById("userSelect");
  const machineBetEl = document.getElementById("machineBet");
  const betRange = document.getElementById("betRange");
  const betInput = document.getElementById("betInput");

  const adminToggle  = document.getElementById("adminToggle");
  const adminPanel   = document.getElementById("adminPanel");
  const closeAdmin   = document.getElementById("closeAdmin");
  const adminUserLabel = document.getElementById("adminUserLabel");
  const adminAddTokens = document.getElementById("adminAddTokens");
  const adminAddBtn    = document.getElementById("adminAddBtn");
  const adminBalance   = document.getElementById("adminBalance");
  const resetStatsBtn  = document.getElementById("resetStats");

  // ===== Reels helpers =====
  const CELL_H = 156;
  const imgHTML = (file, alt)=> `<img src="./${file}" alt="${alt}">`;
  function makeCell(inner, isMid=false){ const d=document.createElement("div"); d.className="cell"+(isMid?" mid":""); d.innerHTML=inner; return d; }
  function randItem(){ return ITEMS[(Math.random()*ITEMS.length)|0]; }
  function initReelTrack(reel){ const t=reel.querySelector(".track"); t.innerHTML=""; for(let i=0;i<6;i++) t.appendChild(makeCell(imgHTML(randItem().file,"sym"), i===1)); }

  function pickBase(){ let r=Math.random()*TOTAL_WEIGHT; for(const s of ITEMS){ if((r-=s.weight)<=0) return s; } return ITEMS[ITEMS.length-1]; }
  function effectiveLuck(){ const s=stats[currentUser]; const extra=(s.odds-100)*0.9; return clamp((s.luck||0)+extra,0,100); }
  function pityBonusLuck(){ const d=stats[currentUser].dry||0; if(d<=PITY_START) return 0; return clamp((d-PITY_START)*PITY_STEP,0,40); }
  function pickBiased(L){ const c=1+Math.floor(clamp(L,0,100)/26); let best=pickBase(); for(let i=1;i<c;i++){ const p=pickBase(); if(p.rank>best.rank) best=p; } return best; }
  function calcWinRow(row){ const [a,b,c]=row.map(x=>x.k); if(a===b&&b===c) return PAYX_3[a]; if(a===b||a===c||b===c) return PAYX_PAIR; return 0; }
  function governorBoost(){ const s=stats[currentUser]; const spent=s.spent||0, earned=s.earned||0; if(spent<=0) return 1+(s.rtpGain/900); const rtp=100*earned/spent; const diff=(s.rtpTarget)-rtp; return clamp(1+clamp(diff/100,-0.35,0.35)*(s.rtpGain/100),0.65,1.30); }
  function upgradeRow(row, L){
    const g=governorBoost();
    let u=0.12*g+(L/180)*0.55, u2=0.06*g+(L/360)*0.45*0.85;
    u=clamp(u,0,0.40); u2=clamp(u2,0,0.28);
    const k=row.map(r=>r.k), counts={}; k.forEach(x=>counts[x]=(counts[x]||0)+1);
    const hasThree=Object.values(counts).some(c=>c===3), hasPair=Object.values(counts).some(c=>c===2);
    if(!hasPair && !hasThree && Math.random()<u){
      const pool=row.slice().sort((a,b)=>a.rank-b.rank); let pick=pool[0]; if(pick.k===TOP.k) pick=pool[1]||pick; row[2]=pick;
    } else if(hasPair && !hasThree && Math.random()<u2){
      let sym=Object.entries(counts).find(([_,c])=>c===2)[0]; if(sym===TOP.k && Math.random()<0.75) return row; for(let i=0;i<3;i++) if(row[i].k!==sym) row[i]=row.find(r=>r.k===sym);
    }
    return row;
  }

  // ===== UI =====
  function renderStats(){
    const s=stats[currentUser];
    tokenBalanceEl.textContent=`${fmtTok(s.tokens||0)}🪙`;
    adminUserLabel && (adminUserLabel.textContent=currentUser);
    adminBalance && (adminBalance.textContent=`${fmtTok(s.tokens||0)}🪙`);
    syncBetMax();
    updateSpinEnabled();
  }
  function renderPaytable(){
    const rows=[
      [`<span class="triple">${imgHTML(TOP.file,TOP.label).repeat(3)}</span>`, `${fmtTok(PAYX_3[TOP.k])}🪙`],
      [`<span class="triple">${imgHTML("Dragoncanneloni.webp","Dragon").repeat(3)}</span>`, `${fmtTok(PAYX_3.dragoncanneloni)}🪙`],
      [`<span class="triple">${imgHTML("Garamadundung.webp","Garamadundung").repeat(3)}</span>`, `${fmtTok(PAYX_3.garamadundung)}🪙`],
      [`<span class="triple">${imgHTML("Carti.webp","Carti").repeat(3)}</span>`, `${fmtTok(PAYX_3.carti)}🪙`],
      [`<span class="triple">${imgHTML("La_Vaccca_Saturno_Saturnita.webp","Saturnita").repeat(3)}</span>`, `${fmtTok(PAYX_3.saturnita)}🪙`],
      [`<span class="triple">${imgHTML("TralaleroTralala.webp","Tralalero").repeat(3)}</span>`, `${fmtTok(PAYX_3.tralalero)}🪙`],
      [`<span class="triple">${imgHTML("Sgedrftdikou.webp","Sgedrftdikou").repeat(3)}</span>`, `${fmtTok(PAYX_3.sgedrftdikou)}🪙`],
      [`<span class="triple">${imgHTML("Noobini_Pizzanini_NEW.webp","Noobini").repeat(3)}</span>`, `${fmtTok(PAYX_3.noobini)}🪙`],
      [`Any 2-of-a-kind`, `${fmtTok(PAYX_PAIR)}🪙`],
    ];
    document.getElementById("payRows").innerHTML = rows.map(([l,v],i)=>`
      <div class="pt-row"><div class="pt-sym">${l}</div><div class="muted">${i<8?'3× match':''}</div><b>${v}</b></div>
    `).join("");
  }

  function setBet(v){
    const s=stats[currentUser];
    const max = Math.max(0.01, (s.tokens||0));
    const val = clamp(Number(v)||0.01, 0.01, max);
    betRange.max = String(max);
    betRange.value = String(val);
    betInput.max = String(max);
    betInput.value = String(round3(val));
    machineBetEl.textContent = `${fmtTok(val)}🪙`;
    updateSpinEnabled();
  }
  function syncBetMax(){ const s=stats[currentUser]; const max=Math.max(0.01,(s.tokens||0)); betRange.max=String(max); betInput.max=String(max); if(Number(betRange.value)>max) setBet(max); }
  function getBet(){ return clamp(Number(betInput.value)||0.01, 0.01, Number(betInput.max)||5); }
  function updateSpinEnabled(){ spinBtn.disabled = (stats[currentUser].tokens||0) + 1e-9 < getBet(); }

  // Wheel-over inputs to adjust bet
  function wheelAdjust(e, target){
    e.preventDefault();
    const step=Number(target.step)||0.005;
    const dir = e.deltaY>0 ? -1 : 1;
    setBet((getBet()+dir*step));
  }

  betRange.addEventListener("input", () => setBet(betRange.value));
  betInput.addEventListener("input", () => setBet(betInput.value));
  betRange.addEventListener("wheel", (e)=>wheelAdjust(e, betRange));
  betInput.addEventListener("wheel", (e)=>wheelAdjust(e, betInput));

  // Fast mode
  function reflectFast(){ fastBtn.setAttribute("aria-pressed", fastMode ? "true" : "false"); fastBtn.classList.toggle("primary", fastMode); }
  fastBtn.addEventListener("click", ()=>{ fastMode=!fastMode; localStorage.setItem("br-fast", fastMode?"1":"0"); reflectFast(); });

  // Spinning visuals (fastMode shortens times)
  async function scrollReelTo(reel, finalCol, totalRows, fakeHops, durationMs){
    const speed = fastMode ? 0.32 : 1;         // ~68% faster
    const hops  = fastMode ? Math.max(0,fakeHops-1) : fakeHops;
    const rows  = fastMode ? Math.floor(totalRows*0.6) : totalRows;
    const dur   = Math.max(400, Math.floor(durationMs*speed));

    const track=reel.querySelector(".track");
    reel.classList.remove("stopped");
    track.innerHTML="";
    const filler=Math.max(3, rows-3);
    for(let i=0;i<filler;i++) track.appendChild(makeCell(imgHTML(randItem().file,"sym"), false));
    track.appendChild(makeCell(imgHTML(finalCol.top.file, finalCol.top.label), false));
    track.appendChild(makeCell(imgHTML(finalCol.mid.file, finalCol.mid.label), true));
    track.appendChild(makeCell(imgHTML(finalCol.bot.file, finalCol.bot.label), false));
    track.style.transform="translateY(0px)"; track.style.transition="none";
    void track.offsetHeight;
    const distance = -(CELL_H*(rows-3));
    track.style.transition=`transform ${dur}ms cubic-bezier(.12,.86,.16,1)`;
    track.style.transform=`translateY(${distance}px)`;
    await wait(dur);
    for(let i=0;i<hops;i++){
      track.style.transition="transform 140ms ease-out"; track.style.transform=`translateY(${distance+18}px)`; await wait(140);
      track.style.transition="transform 160ms ease-in";  track.style.transform=`translateY(${distance}px)`;     await wait(160);
    }
    reel.classList.add("stopped");
  }

  // Spin flow (+ delta beside balance)
  let spinning=false;
  async function doSpin(){
    if (spinning) return;
    const s=stats[currentUser];
    const bet = getBet();
    if ((s.tokens||0) + 1e-9 < bet){ messageEl.textContent="Insufficient tokens. Deposit a character (≥ 5🪙)."; return; }

    spinning=true; machine.classList.add("spinning");
    reelEls.forEach(r=>r.classList.remove("stopped"));

    // take bet
    s.tokens = round3((s.tokens||0) - bet);
    s.spent  = round3((s.spent ||0) + bet);
    saveStats(); renderStats();
    flashDelta(-bet);

    const luck = effectiveLuck() + pityBonusLuck();
    let midRow;
    if (Math.random() < (s.diamond3 ?? FORCED_TOP_PCT)){
      midRow = [TOP,TOP,TOP];
    } else {
      midRow = [pickBiased(luck), pickBiased(luck), pickBiased(luck)];
      midRow = upgradeRow(midRow, luck);
    }

    const finals=[
      {top:randItem(), mid:midRow[0], bot:randItem()},
      {top:randItem(), mid:midRow[1], bot:randItem()},
      {top:randItem(), mid:midRow[2], bot:randItem()},
    ];

    await scrollReelTo(reelEls[0], finals[0], 64, 1, 4200);
    await wait(fastMode?120:280);
    await scrollReelTo(reelEls[1], finals[1], 84, 1, 5800);
    await wait(fastMode?140:360);
    await scrollReelTo(reelEls[2], finals[2], 112, 2, 8200);

    const mult = calcWinRow(midRow);
    const win  = round3(mult * bet);
    if (win>0){
      s.tokens = round3((s.tokens||0) + win);
      s.earned = round3((s.earned||0) + win);
      s.dry = 0;
      flashDelta(+win);
    } else {
      s.dry = (s.dry||0) + 1;
    }
    saveStats(); renderStats();
    machine.classList.remove("spinning");
    spinning=false;
  }

  function flashDelta(amount){
    deltaEl.textContent = `${amount>=0?'+':''}${fmtTok(amount)}🪙`;
    deltaEl.classList.remove('show');
    void deltaEl.offsetWidth;
    deltaEl.classList.add('show');
  }

  // Economy buttons
  depositBtn.addEventListener("click", ()=>{
    const s=stats[currentUser];
    const val=prompt(`Enter your character's production (M/s). Minimum ${MIN_DEPOSIT}. 1 M/s = 1🪙`, `${Math.max(MIN_DEPOSIT, 5)}`);
    if(val==null) return;
    const tokens=Number(val);
    if(!Number.isFinite(tokens)||tokens<MIN_DEPOSIT){ alert(`Minimum deposit is ${MIN_DEPOSIT} tokens (i.e., ${MIN_DEPOSIT}M/s character).`); return; }
    s.tokens = round3((s.tokens||0) + tokens);
    messageEl.textContent = `Deposited ${fmtTok(tokens)}🪙 (from ${fmtTok(tokens)}M/s character).`;
    saveStats(); renderStats();
  });

  cashoutBtn.addEventListener("click", ()=>{
    const s=stats[currentUser]; const bal=round3(Math.max(0,s.tokens||0));
    if(bal<=0){ alert("Nothing to cash out."); return; }
    if(confirm(`Cash out ${fmtTok(bal)}🪙 → ${fmtTok(bal)}M/s Brainrot?`)){
      alert(`Cashed out: ${fmtTok(bal)}M/s Brainrot awarded!`); s.tokens=0; saveStats(); renderStats();
    }
  });

  // Simple admin
  let adminUnlocked = localStorage.getItem("br23-admin")==="1";
  adminToggle?.addEventListener("click", ()=>{
    if(!adminUnlocked){
      const code=prompt("Enter admin passcode:"); if(code==="1111"){ adminUnlocked=true; localStorage.setItem("br23-admin","1"); showAdmin(); }
      else alert("Incorrect passcode.");
    } else { adminPanel.classList.contains("hidden") ? showAdmin() : hideAdmin(); }
  });
  function showAdmin(){ adminPanel.classList.remove("hidden"); adminPanel.setAttribute("aria-hidden","false"); adminBalance.textContent = `${fmtTok(stats[currentUser].tokens||0)}🪙`; }
  function hideAdmin(){ adminPanel.classList.add("hidden"); adminPanel.setAttribute("aria-hidden","true"); }
  closeAdmin?.addEventListener("click", hideAdmin);

  adminAddBtn?.addEventListener("click", ()=>{
    const amt=Math.max(0.001, Number(adminAddTokens.value)||0);
    stats[currentUser].tokens=round3((stats[currentUser].tokens||0)+amt);
    saveStats(); renderStats();
  });
  resetStatsBtn?.addEventListener("click", ()=>{
    if(confirm(`Reset stats for ${currentUser}?`)){ stats[currentUser]=baseUser(); saveStats(); renderStats(); }
  });
  userSelect.addEventListener("change", ()=>{ currentUser=userSelect.value; localStorage.setItem("br-user",currentUser); renderStats(); hideAdmin(); });

  // Init
  userSelect.value=currentUser;
  [1,2,3].forEach(i=>initReelTrack(document.getElementById(`reel-${i}`)));
  renderStats(); renderPaytable();
  reflectFast();
  setBet(0.50);

  // Controls
  spinBtn.addEventListener("click", ()=> doSpin());
  window.addEventListener("keydown", (e)=>{ if(e.code==="Space"){ e.preventDefault(); doSpin(); } });
})();
