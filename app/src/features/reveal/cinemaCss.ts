/** Styles for the cinematic big-screen reveal (web only). Injected once into <head>. */
export const CINEMA_CSS = `
.cin-root{position:fixed;inset:0;z-index:2147483000;background:#010205;overflow:hidden;cursor:none;color:#fff;
  font-family:'Oswald',Impact,'Arial Narrow',sans-serif;user-select:none;-webkit-font-smoothing:antialiased}
.cin-cam{position:absolute;inset:0}
.cin-cam.shake{animation:cinShake .7s cubic-bezier(.36,.07,.19,.97)}
@keyframes cinShake{10%,90%{transform:translate3d(-3px,2px,0)}20%,80%{transform:translate3d(7px,-5px,0)}
  30%,50%,70%{transform:translate3d(-12px,7px,0) scale(1.015)}40%,60%{transform:translate3d(12px,-7px,0) scale(1.015)}}

/* Backdrop: deep space blue, glow in the team colour, drifting smoke, project image ken-burns */
.cin-bg{position:absolute;inset:0;background:
  radial-gradient(ellipse 60% 45% at 50% 52%,var(--glow,#0d2a66) 0%,transparent 70%),
  radial-gradient(ellipse 120% 60% at 50% 115%,#0a1430 0%,transparent 65%),#010205;transition:background 1.4s ease}
.cin-backdrop{position:absolute;inset:-6%;background-size:cover;background-position:center;filter:blur(14px) brightness(.32) saturate(1.2);
  animation:cinKen 22s linear both;opacity:0;transition:opacity 1.5s ease}
.cin-backdrop.on{opacity:1}
@keyframes cinKen{from{transform:scale(1.05)}to{transform:scale(1.22) translate(-1.5%,-1%)}}
.cin-smoke{position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen}
.cin-smoke i{position:absolute;width:80vmax;height:80vmax;border-radius:50%;
  background:radial-gradient(circle,rgba(150,170,210,.11) 0%,rgba(150,170,210,.04) 35%,transparent 62%);filter:blur(24px)}
.cin-smoke i:nth-child(1){left:-30vmax;top:-10vmax;animation:cinDriftA 46s ease-in-out infinite}
.cin-smoke i:nth-child(2){right:-35vmax;top:5vmax;animation:cinDriftB 52s ease-in-out infinite}
.cin-smoke i:nth-child(3){left:10vmax;bottom:-45vmax;animation:cinDriftA 60s ease-in-out infinite reverse}
@keyframes cinDriftA{0%,100%{transform:translate(0,0) rotate(0)}50%{transform:translate(18vmax,-6vmax) rotate(160deg)}}
@keyframes cinDriftB{0%,100%{transform:translate(0,0) rotate(0)}50%{transform:translate(-16vmax,8vmax) rotate(-140deg)}}
.cin-rays{position:absolute;left:50%;top:50%;width:220vmax;height:220vmax;margin:-110vmax 0 0 -110vmax;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,rgba(255,236,190,.09) 0deg 2.2deg,transparent 2.2deg 11deg);
  -webkit-mask-image:radial-gradient(circle,#000 0%,rgba(0,0,0,.6) 18%,transparent 48%);mask-image:radial-gradient(circle,#000 0%,rgba(0,0,0,.6) 18%,transparent 48%);
  animation:cinSpin 90s linear infinite;opacity:0;transition:opacity 1.6s ease;mix-blend-mode:screen}
.cin-rays.on{opacity:1}
@keyframes cinSpin{to{transform:rotate(360deg)}}
.cin-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.55) 75%,rgba(0,0,0,.92) 100%)}
.cin-grain{position:absolute;inset:-50%;pointer-events:none;opacity:.07;mix-blend-mode:overlay;animation:cinGrain .5s steps(4) infinite;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
@keyframes cinGrain{0%{transform:translate(0,0)}25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-2%,-1%)}100%{transform:translate(1%,3%)}}
.cin-bar{position:absolute;left:0;right:0;height:12.5vh;background:#000;z-index:20;transition:height 1.4s cubic-bezier(.7,0,.2,1)}
.cin-bar.top{top:0}.cin-bar.bot{bottom:0}
.cin-root.wide .cin-bar{height:7vh}
.cin-canvas{position:absolute;inset:0;pointer-events:none}

/* Hit effects */
.cin-flash{position:absolute;inset:0;background:radial-gradient(circle,#fff 0%,#e8f1ff 40%,#bcd3ff 100%);pointer-events:none;z-index:30;animation:cinFlash 1s ease-out forwards}
@keyframes cinFlash{0%{opacity:.95}100%{opacity:0}}
.cin-ring{position:absolute;left:50%;top:50%;width:24vmin;height:24vmin;margin:-12vmin 0 0 -12vmin;border-radius:50%;pointer-events:none;z-index:25;
  border:2px solid var(--accent,#9cc4ff);box-shadow:0 0 30px var(--accent,#9cc4ff),inset 0 0 30px var(--accent,#9cc4ff);animation:cinRing 1.4s cubic-bezier(.1,.7,.3,1) forwards}
.cin-ring.late{animation-delay:.12s;opacity:0}
@keyframes cinRing{0%{transform:scale(.15);opacity:1}100%{transform:scale(9);opacity:0}}
.cin-flare{position:absolute;top:50%;left:-70%;width:70%;height:3px;margin-top:-1.5px;pointer-events:none;z-index:26;
  background:linear-gradient(90deg,transparent,rgba(120,180,255,.7) 30%,#fff 50%,rgba(120,180,255,.7) 70%,transparent);
  box-shadow:0 0 24px 6px rgba(110,170,255,.55),0 0 90px 20px rgba(80,140,255,.25);animation:cinFlare 1.8s cubic-bezier(.4,0,.2,1) forwards}
.cin-flare.gold{background:linear-gradient(90deg,transparent,rgba(255,200,90,.8) 30%,#fff 50%,rgba(255,200,90,.8) 70%,transparent);
  box-shadow:0 0 24px 6px rgba(255,190,70,.6),0 0 90px 20px rgba(255,170,40,.3)}
@keyframes cinFlare{0%{left:-70%;opacity:0}15%{opacity:1}100%{left:110%;opacity:0}}

/* Metal lettering */
.cin-metal,.cin-gold,.cin-bronze,.cin-silver{font-family:'Cinzel','Trajan Pro',Georgia,serif;font-weight:900;letter-spacing:.05em;line-height:1;
  -webkit-background-clip:text;background-clip:text;color:transparent;position:relative;display:inline-block;text-transform:uppercase}
.cin-metal,.cin-silver{background-image:linear-gradient(180deg,#fff 0%,#e3e9f1 28%,#97a3b5 47%,#2d3542 50%,#aab5c4 55%,#f3f6fa 74%,#8692a4 100%);
  filter:drop-shadow(0 .04em 0 #0d1118) drop-shadow(0 0 .35em rgba(120,170,255,.35))}
.cin-gold{background-image:linear-gradient(180deg,#fffbe6 0%,#ffe08a 25%,#d29a1c 46%,#5c3700 50%,#e0a92e 56%,#fff0b3 74%,#b07a0e 100%);
  filter:drop-shadow(0 .04em 0 #1d1200) drop-shadow(0 0 .4em rgba(255,180,40,.45))}
.cin-bronze{background-image:linear-gradient(180deg,#fff0e2 0%,#f0b182 25%,#b8642c 46%,#3e1a05 50%,#c9773f 56%,#ffd3ae 74%,#8f4a1d 100%);
  filter:drop-shadow(0 .04em 0 #1a0a02) drop-shadow(0 0 .4em rgba(230,120,50,.4))}
.cin-shine::after{content:attr(data-text);position:absolute;inset:0;-webkit-background-clip:text;background-clip:text;color:transparent;
  background-image:linear-gradient(105deg,transparent 42%,rgba(255,255,255,.95) 50%,transparent 58%);background-size:300% 100%;
  animation:cinShine 3.2s ease-in-out infinite;filter:none}
@keyframes cinShine{0%{background-position:120% 0}60%,100%{background-position:-60% 0}}

.cin-caps{font-family:'Oswald',Impact,sans-serif;text-transform:uppercase;letter-spacing:.42em;font-weight:500}
.cin-rule{display:flex;align-items:center;gap:2.2vw;justify-content:center}
.cin-rule:before,.cin-rule:after{content:'';height:1px;width:12vw;background:linear-gradient(90deg,transparent,currentColor,transparent)}

/* Entrances */
.cin-zoom{animation:cinZoom 1.3s cubic-bezier(.16,1,.3,1) both}
@keyframes cinZoom{0%{transform:scale(2.4);filter:blur(16px);opacity:0}100%{transform:scale(1);filter:blur(0);opacity:1}}
.cin-slam{animation:cinSlam .9s cubic-bezier(.2,1.3,.4,1) both}
@keyframes cinSlam{0%{transform:scale(3.2);filter:blur(20px);opacity:0}55%{opacity:1;filter:blur(0)}100%{transform:scale(1)}}
.cin-push{animation:cinPush 12s linear both}
@keyframes cinPush{from{transform:scale(1)}to{transform:scale(1.1)}}
.cin-rise{animation:cinRise 1.1s cubic-bezier(.16,1,.3,1) both}
@keyframes cinRise{0%{transform:translateY(5vh);filter:blur(10px);opacity:0}100%{transform:none;filter:blur(0);opacity:1}}
.cin-track{animation:cinTrack 3.5s cubic-bezier(.16,1,.3,1) both}
@keyframes cinTrack{0%{letter-spacing:1.4em;opacity:0;filter:blur(8px)}100%{opacity:1;filter:blur(0)}}
.cin-pulse{animation:cinPulse .5s ease-out}
@keyframes cinPulse{0%{transform:scale(1.06);filter:brightness(1.6)}100%{transform:scale(1);filter:brightness(1)}}
.cin-fadeout{animation:cinOut .8s ease forwards}
@keyframes cinOut{to{opacity:0}}

/* Countdown */
.cin-num{font-size:52vh;animation:cinNum 1s linear both}
@keyframes cinNum{0%{transform:scale(1.9);filter:blur(16px);opacity:0}14%{transform:scale(1);filter:blur(0);opacity:1}
  80%{transform:scale(.9);opacity:1}100%{transform:scale(.82);opacity:0;filter:blur(6px)}}
.cin-num.zero{animation:cinSlam .9s cubic-bezier(.2,1.3,.4,1) both}
.cin-emblem{position:absolute;left:50%;top:50%;pointer-events:none}
.cin-emblem svg{animation:cinSpin 40s linear infinite}
.cin-emblem.fast svg{animation-duration:8s}

/* Hero cards (teammates) */
.cin-heroes{display:flex;justify-content:center;align-items:flex-end;gap:1.8vw;perspective:1200px}
.cin-hero{position:relative;width:var(--w);height:calc(var(--w) * 1.36);border-radius:.5vw;overflow:hidden;background:#070b14;
  box-shadow:0 0 0 1px rgba(255,255,255,.22),0 0 0 .25vw rgba(0,0,0,.6),0 3vh 6vh rgba(0,0,0,.85),0 0 4vh var(--team);
  animation:cinHero 1s cubic-bezier(.16,1,.3,1) both}
.cin-hero.ghost{visibility:hidden;animation:none}
@keyframes cinHero{0%{transform:translateY(9vh) rotateX(28deg) scale(.86);filter:blur(12px) brightness(3);opacity:0}
  35%{opacity:1;filter:blur(0) brightness(1.8)}100%{transform:none;filter:none;opacity:1}}
.cin-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 22%;filter:contrast(1.08) saturate(1.05)}
.cin-hero .ini{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:calc(var(--w) * .38);
  background:radial-gradient(circle at 50% 35%,#24324f,#070b14 70%)}
.cin-hero .rim{position:absolute;inset:0;box-shadow:inset 0 0 2.2vw var(--team),inset 0 -14vh 8vh -4vh rgba(0,0,0,.95)}
.cin-hero .nm{position:absolute;left:0;right:0;bottom:1.2vh;text-align:center;font-family:'Oswald',Impact,sans-serif;font-weight:700;
  text-transform:uppercase;letter-spacing:.14em;font-size:calc(var(--w) * .095);line-height:1.15;padding:0 .6vw;text-shadow:0 2px 8px #000}
.cin-hero .rl{display:block;font-weight:400;letter-spacing:.3em;font-size:.62em;opacity:.75}
.cin-hero:after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.55) 48%,transparent 62%);
  transform:translateX(-120%);animation:cinGlint 1.4s .25s ease-out forwards}
@keyframes cinGlint{to{transform:translateX(120%)}}

.cin-op{position:absolute;left:0;right:0;bottom:1.6vh;text-align:center;font:500 12px/1 'Oswald',sans-serif;letter-spacing:.2em;
  text-transform:uppercase;color:#fff;opacity:.28;z-index:40}
.cin-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:10}
`;

export const CINEMA_FONTS = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Oswald:wght@300;400;500;700&display=swap';
