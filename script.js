*{box-sizing:border-box}
:root{
  --bg:#0c1016; --ink:#e9f1ff; --muted:#9fb3c8;
  --accent:#35d2a8; --accent-2:#ffd166; --danger:#ff5a5f;
  --frame:#0f1729; --card:#111827;
  --card-border:rgba(255,255,255,.06);
  --shadow:0 10px 25px rgba(0,0,0,.35);
  --radius:18px;
}
html,body{height:100%}
body{
  margin:0; font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
  background: radial-gradient(1200px 600px at 10% -10%, #142034 0%, var(--bg) 45%) no-repeat, var(--bg);
  color:var(--ink);
}
.app{max-width:960px;margin:0 auto;padding:22px}

/* Top bar — compact, seamless */
.topbar{
  display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px
}
.brand{margin:0;font-size:clamp(18px,2.6vw,26px);font-weight:800;letter-spacing:.2px}
.logo{filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}
.hud{
  display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:999px;
  background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.02));
  border:1px solid var(--card-border);
}
.userpick{display:flex;align-items:center;gap:6px;color:var(--muted)}
.userpick select{
  padding:6px 10px;border-radius:10px;border:1px solid var(--card-border);
  background:#0f1730;color:var(--ink)
}
.divider{width:1px;height:20px;background:var(--card-border)}
.stat{display:flex;gap:6px;align-items:center;color:var(--muted);font-weight:800}
.stat .k{opacity:.9}
.stat .v{color:var(--ink)}
.btn{
  background:#1a2438;color:var(--ink);border:1px solid rgba(255,255,255,.12);
  padding:10px 14px;border-radius:12px;cursor:pointer;font-weight:800;letter-spacing:.3px;
  transition:.18s;box-shadow:var(--shadow)
}
.btn.ghost{background:transparent}
.btn.primary{background:linear-gradient(90deg, #1de9b6, #00bfa6);color:#001b18;border:none}
.btn.big{font-size:18px;padding:12px 18px;border-radius:14px}
.btn:hover{transform:translateY(-1px)}
.btn:disabled{opacity:.6;cursor:not-allowed}

/* Cards */
.card{
  background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));
  border:1px solid var(--card-border);
  border-radius:var(--radius);
  box-shadow:var(--shadow);
  padding:18px;
}

/* Machine */
.machine{padding:22px;margin-bottom:16px;position:relative;overflow:hidden}
.win-banner{
  position:absolute;left:12px;right:12px;bottom:12px;
  background:linear-gradient(90deg,#ffe082,#ffd166,#ffc400);
  color:#3a2a00;border-radius:12px;padding:10px 14px;font-weight:900;letter-spacing:.5px;
  text-align:center;box-shadow:var(--shadow);transform:translateY(150%);opacity:0;
  transition:transform .45s cubic-bezier(.2,.8,.2,1), opacity .45s;
}
.win-banner.show{transform:translateY(0);opacity:1}

/* Reels + rainbow lights frame */
.reels{
  display:grid;grid-template-columns:repeat(3,1fr);gap:16px;
  background:var(--frame);border-radius:14px;padding:18px;border:1px solid var(--card-border);
  position:relative;overflow:hidden;
}

/* Rotating rainbow border */
.lightframe::before{
  content:""; position:absolute; inset:-2px; border-radius:16px; z-index:0;
  background:conic-gradient(#ff4d4f, #ffcd3c, #2ee59d, #40c4ff, #a78bfa, #ff4d4f);
  filter:saturate(1.4); mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude; padding:2px; opacity:.0;
  transition:opacity .2s ease;
}
.machine.spinning .lightframe::before{opacity:.9; animation:spinRainbow 2.2s linear infinite}
@keyframes spinRainbow { to { transform: rotate(1turn); } }

/* LED strip at bottom */
.reels::after{
  content:""; position:absolute; left:0; right:0; bottom:0; height:8px; z-index:1;
  background:
    radial-gradient(6px 6px at 6px 50%, #ffd166 50%, transparent 52%),
    radial-gradient(6px 6px at 30px 50%, #76e4f7 50%, transparent 52%),
    radial-gradient(6px 6px at 54px 50%, #a78bfa 50%, transparent 52%),
    radial-gradient(6px 6px at 78px 50%, #ff8a80 50%, transparent 52%);
  background-size:96px 100%;
  filter:saturate(1.3) drop-shadow(0 2px 6px rgba(0,0,0,.4));
  opacity:.0; transition:opacity .2s ease;
  animation:chase 1.2s linear infinite paused;
}
.machine.spinning .reels::after{opacity:.9; animation-play-state:running}
@keyframes chase { to { background-position:96px 0 } }

.reel{
  height:120px;background:linear-gradient(180deg,#0b1222,#0f192d);
  border-radius:12px;border:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;justify-content:center;
  font-size:64px;box-shadow: inset 0 10px 20px rgba(0,0,0,.25);
  position:relative;overflow:hidden; z-index:2;
}
.symbol{transform:translateY(0);}

/* Crisp motion (no blur) + slight punch on stop */
.reel.spinning .symbol{transform:translateY(0) scale(1)}
.reel.stop .symbol{animation:pop .18s ease}
@keyframes pop{0%{transform:scale(0.96)}100%{transform:scale(1)}}

/* Win glow */
.reel.win{
  animation:glow 1200ms ease-in-out 1;
  box-shadow:0 0 0 rgba(0,0,0,0), inset 0 10px 20px rgba(0,0,0,.25);
}
@keyframes glow{
  0%{box-shadow:0 0 0 rgba(255,255,255,0)}
  30%{box-shadow:0 0 24px rgba(255,214,102,.9), 0 0 60px rgba(255,214,102,.5)}
  100%{box-shadow:0 0 0 rgba(255,255,255,0)}
}

.controls{display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;justify-content:center}
.message{margin-top:10px;min-height:24px;color:var(--accent-2);font-weight:800;letter-spacing:.3px}
.message.win{animation:pulse 1.2s ease 1}
@keyframes pulse{
  0%{transform:scale(1);text-shadow:none}
  40%{transform:scale(1.06);text-shadow:0 0 18px rgba(255,209,102,.9)}
  100%{transform:scale(1);text-shadow:none}
}

/* Paytable — simpler rows */
.paytable h2{margin:0 0 10px}
.pt-grid{display:grid;gap:8px}
.pt-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 12px;border:1px solid var(--card-border);border-radius:10px;
  background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));
}
.pt-row b{font-size:1.02rem}
.pt-row.sub{opacity:.9}
.rg{color:var(--muted);margin-top:10px}

/* Admin */
.admin h2{margin:0 0 10px}
.admin.hidden{display:none}
.admin-row{margin:.25rem 0 .75rem}
.admin-grid{display:grid;grid-template-columns:repeat(2,minmax(140px,1fr));gap:12px}
.admin input{
  width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--card-border);
  background:#0e1524;color:var(--ink)
}
.admin-actions{display:flex;gap:10px;margin-top:10px}
.muted{color:var(--muted);font-size:.9rem}

/* Confetti canvas */
.confetti{position:fixed;inset:0;pointer-events:none;z-index:9999}
.hidden{display:none}

.foot{margin-top:18px;color:var(--muted);text-align:center}
