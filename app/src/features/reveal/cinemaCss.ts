/**
 * Styles for the big-screen reveal (web only), in the app's comic book look: flat primary colours, thick black
 * ink, hard offset shadows, halftone dots, speed lines and POW bursts. Injected once into <head>.
 */
export const CINEMA_CSS = `
.cin-root{position:fixed;inset:0;z-index:2147483000;background:#111;overflow:hidden;cursor:none;color:#111;--lvl:0;
  font-family:'SpaceGrotesk_700Bold','Space Grotesk',Arial,sans-serif;user-select:none;-webkit-font-smoothing:antialiased}
.cin-cam{position:absolute;inset:0}

/* Flat comic colour field (lighter in the middle), halftone dots towards the edges, speed lines */
.cin-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.34) 0%,rgba(255,255,255,0) 58%),var(--glow,#1E5BFF)}
.cin-halftone{position:absolute;inset:0;pointer-events:none;
  background-image:radial-gradient(circle,rgba(0,0,0,.3) 30%,transparent 33%);background-size:2.1vmin 2.1vmin;
  -webkit-mask-image:radial-gradient(ellipse at center,transparent 22%,#000 88%);mask-image:radial-gradient(ellipse at center,transparent 22%,#000 88%)}
.cin-rays{position:absolute;left:50%;top:50%;width:260vmax;height:260vmax;margin:-130vmax 0 0 -130vmax;pointer-events:none;
  background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.6) 0deg .8deg,transparent .8deg 4.6deg,rgba(0,0,0,.3) 4.6deg 5.3deg,transparent 5.3deg 9deg);
  -webkit-mask-image:radial-gradient(circle,transparent 7%,#000 26%);mask-image:radial-gradient(circle,transparent 7%,#000 26%);
  opacity:.28;transition:opacity .5s;animation:cinSpin 160s linear infinite}
.cin-rays.on{opacity:.85}
@keyframes cinSpin{to{transform:rotate(360deg)}}
.cin-lvl{position:absolute;inset:0;pointer-events:none;opacity:calc(var(--lvl) * .5);
  background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.75) 0%,transparent 55%)}
.cin-kick{position:absolute;inset:0;pointer-events:none;z-index:24;opacity:0;
  background:radial-gradient(circle at 50% 50%,rgba(255,255,255,.8) 0%,transparent 62%)}
/* Comic page frame: ink, paper gutter, ink */
.cin-frame{position:absolute;inset:0;pointer-events:none;z-index:35;
  box-shadow:inset 0 0 0 1.1vh #111,inset 0 0 0 2vh #FFF6DF,inset 0 0 0 2.6vh #111}
.cin-canvas{position:absolute;inset:0;pointer-events:none}

/* Hits: white flash, ink shockwave ring, POW burst */
.cin-flash{position:absolute;inset:0;background:#fff;pointer-events:none;z-index:30;animation:cinFlash .8s ease-out forwards}
@keyframes cinFlash{0%{opacity:.95}100%{opacity:0}}
.cin-ring{position:absolute;left:50%;top:50%;width:22vmin;height:22vmin;margin:-11vmin 0 0 -11vmin;border-radius:50%;pointer-events:none;z-index:25;
  border:1.1vmin solid #111;box-shadow:0 0 0 .8vmin var(--accent,#FFD400),inset 0 0 0 .8vmin var(--accent,#FFD400);
  animation:cinRing 1.1s cubic-bezier(.1,.7,.3,1) forwards}
.cin-ring.late{animation-delay:.12s;opacity:0}
.cin-ring.soft{animation-duration:.9s;border-width:.6vmin;box-shadow:0 0 0 .4vmin var(--accent,#FFD400)}
@keyframes cinRing{0%{transform:scale(.2);opacity:1}100%{transform:scale(8);opacity:0}}
.cin-sfx{position:absolute;z-index:31;pointer-events:none;width:var(--s);height:var(--s);margin:calc(var(--s) * -.5) 0 0 calc(var(--s) * -.5);
  display:flex;align-items:center;justify-content:center;animation:cinSfx 1.6s cubic-bezier(.2,1.4,.4,1) forwards}
.cin-sfx svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.cin-sfx b{position:relative;font-family:'Bangers_400Regular','Bangers',Impact,sans-serif;font-weight:400;font-size:calc(var(--s) * .24);
  letter-spacing:.04em;color:#fff;-webkit-text-stroke:.08em #111;paint-order:stroke fill;text-shadow:.07em .08em 0 #111;transform:rotate(var(--r))}
@keyframes cinSfx{0%{transform:scale(0) rotate(-40deg);opacity:1}22%{transform:scale(1.18) rotate(0)}34%{transform:scale(1)}
  78%{transform:scale(1.04);opacity:1}100%{transform:scale(1.1);opacity:0}}

/* Comic lettering: Bangers, thick ink outline, hard offset shadow */
.cin-metal,.cin-gold,.cin-bronze,.cin-silver{font-family:'Bangers_400Regular','Bangers',Impact,sans-serif;font-weight:400;letter-spacing:.045em;
  line-height:.98;text-transform:uppercase;display:inline-block;position:relative;color:#fff;
  padding-left:.045em;/* balances the trailing letter-spacing so text sits dead centre */
  -webkit-text-stroke:.075em #111;paint-order:stroke fill;text-shadow:.055em .065em 0 #111,.085em .1em 0 #111}
.cin-gold{color:#FFD400}
.cin-bronze{color:#FF7A1A}
.cin-silver,.cin-metal{color:#fff}

/* Caption boxes */
.cin-cap{display:inline-block;padding-left:calc(1.6vh + .12em) !important;background:#FFD400;color:#111;border:.42vh solid #111;box-shadow:.7vh .7vh 0 #111;padding:.5vh 1.6vh .6vh;
  font-family:'SpaceGrotesk_700Bold','Space Grotesk',Arial,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.12em;
  line-height:1.15;transform:rotate(var(--tilt,-1.5deg))}
.cin-cap.white{background:#fff}
.cin-cap.red{background:#E4002B;color:#fff}
.cin-cap.blue{background:#1E5BFF;color:#fff}
.cin-cap.orange{background:#FF7A1A}

/* Entrances (comic pops, no blur) */
.cin-zoom{animation:cinZoom .8s cubic-bezier(.2,1.5,.4,1) both}
@keyframes cinZoom{0%{transform:scale(0) rotate(-14deg);opacity:0}60%{transform:scale(1.1) rotate(2deg);opacity:1}100%{transform:none}}
.cin-slam{animation:cinSlam .75s cubic-bezier(.2,1.3,.4,1) both}
@keyframes cinSlam{0%{transform:scale(3.4) rotate(6deg);opacity:0}45%{transform:scale(.9);opacity:1}70%{transform:scale(1.06)}100%{transform:none}}
.cin-rise{animation:cinRise .7s cubic-bezier(.2,1.4,.4,1) both}
@keyframes cinRise{0%{transform:translateY(6vh) scale(.7);opacity:0}100%{transform:none;opacity:1}}
.cin-pop{animation:cinPop .6s cubic-bezier(.2,1.6,.4,1) both}
@keyframes cinPop{0%{transform:scale(0) rotate(-20deg);opacity:0}100%{transform:none;opacity:1}}
.cin-wobble{animation:cinWobble 1.6s ease-in-out infinite}
@keyframes cinWobble{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}

/* Countdown */
.cin-num{animation:cinNum 1s linear both}
@keyframes cinNum{0%{transform:scale(2.3) rotate(-10deg);opacity:0}10%{transform:scale(.94) rotate(3deg);opacity:1}18%{transform:scale(1) rotate(0)}
  84%{transform:scale(1.03);opacity:1}100%{transform:scale(.55) rotate(8deg);opacity:0}}
.cin-num.zero{animation:cinSlam .75s cubic-bezier(.2,1.3,.4,1) both}
.cin-emblem{position:absolute;left:50%;top:50%;pointer-events:none}
.cin-emblem .spin{width:100%;height:100%;will-change:transform}

/* Suspense */
.cin-charge{position:absolute;left:50%;top:50%;pointer-events:none}
.cin-charge .p{transition:stroke-dashoffset .5s linear}
.cin-numeral{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);opacity:.16;pointer-events:none;white-space:nowrap}
.cin-cipher{display:flex;gap:.8vw;justify-content:center}
.cin-cipher span{width:3.6vw;height:4.6vw;display:flex;align-items:center;justify-content:center;background:#fff;border:.4vh solid #111;
  box-shadow:.5vh .5vh 0 #111;font-family:'Bangers_400Regular','Bangers',Impact,sans-serif;font-size:3.2vw;color:#111;
  transform:rotate(var(--r,0deg));animation:cinGlyph .35s cubic-bezier(.2,1.6,.4,1) both}
.cin-cipher.gold span{background:#FFD400}
@keyframes cinGlyph{0%{transform:scale(.4) rotate(var(--r,0deg));opacity:.3}100%{transform:rotate(var(--r,0deg));opacity:1}}
.cin-dark{position:absolute;inset:0;background:#111;opacity:0;pointer-events:none;z-index:15;transition:opacity .45s ease-in}
.cin-dark.on{opacity:.82}
.cin-q{position:absolute;font-family:'Bangers_400Regular','Bangers',Impact,sans-serif;color:#fff;-webkit-text-stroke:.07em #111;paint-order:stroke fill;
  text-shadow:.06em .07em 0 #111;pointer-events:none;animation:cinQ 1s ease-in-out infinite alternate}
@keyframes cinQ{from{transform:rotate(-12deg) scale(.9)}to{transform:rotate(10deg) scale(1.08)}}

/* Top 3 badges */
.cin-shields{display:flex;gap:5vw;align-items:flex-end;justify-content:center}
.cin-shield{position:relative;width:var(--s);height:calc(var(--s) * 1.18);clip-path:polygon(50% 0,100% 16%,100% 60%,50% 100%,0 60%,0 16%);
  background:#111;animation:cinPop .6s cubic-bezier(.2,1.6,.4,1) both}
.cin-shield .in{position:absolute;inset:7%;clip-path:polygon(50% 0,100% 16%,100% 60%,50% 100%,0 60%,0 16%);background:#fff;
  display:flex;align-items:center;justify-content:center;
  background-image:radial-gradient(circle,rgba(0,0,0,.14) 30%,transparent 33%);background-size:1.2vmin 1.2vmin}
.cin-shield.gold .in{background-color:#FFD400}
.cin-shield.bronze .in{background-color:#FF7A1A}
.cin-shield.off{visibility:hidden;animation:none}

/* Teammate cards */
.cin-heroes{display:flex;justify-content:center;align-items:flex-end;gap:1.8vw}
.cin-hero{position:relative;width:var(--w);height:calc(var(--w) * 1.3);background:#fff;border:.45vh solid #111;box-shadow:.8vh .8vh 0 #111;
  overflow:hidden;transform:rotate(var(--tilt,0deg));animation:cinHero .7s cubic-bezier(.2,1.4,.4,1) both}
.cin-hero.ghost{visibility:hidden;animation:none}
@keyframes cinHero{0%{transform:translateY(9vh) rotate(-16deg) scale(.4);opacity:0}65%{transform:rotate(var(--tilt,0deg)) scale(1.08);opacity:1}
  100%{transform:rotate(var(--tilt,0deg))}}
.cin-hero img{position:absolute;left:0;top:0;width:100%;height:78%;object-fit:cover;object-position:50% 22%}
.cin-hero .ini{position:absolute;left:0;top:0;width:100%;height:78%;display:flex;align-items:center;justify-content:center;
  font-size:calc(var(--w) * .36);background-color:var(--team);
  background-image:radial-gradient(circle,rgba(0,0,0,.22) 30%,transparent 33%);background-size:1.1vmin 1.1vmin}
.cin-hero .nm{position:absolute;left:0;right:0;bottom:0;height:22%;border-top:.45vh solid #111;background:#FFD400;color:#111;
  display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden;
  font-family:'Bangers_400Regular','Bangers',Impact,sans-serif;font-size:calc(var(--w) * .1);letter-spacing:.05em;line-height:1;padding:0 .4vw}
.cin-hero .rl{display:block;font-family:'SpaceGrotesk_700Bold','Space Grotesk',sans-serif;font-size:.5em;letter-spacing:.14em;text-transform:uppercase;margin-top:.15em}
.cin-hero:after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.7) 48%,transparent 60%);
  transform:translateX(-130%);animation:cinGlint 1s .3s ease-out forwards}
@keyframes cinGlint{to{transform:translateX(130%)}}

/* Project photo as a comic panel */
.cin-proj{position:relative;flex:none;width:var(--pw);aspect-ratio:16/10;overflow:hidden;background:#fff;border:.6vh solid #111;
  box-shadow:1.2vh 1.2vh 0 #111;transform:rotate(var(--rot,-2deg));animation:cinProj .8s cubic-bezier(.2,1.4,.4,1) both}
.cin-proj img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:cinKen 20s linear both}
@keyframes cinKen{from{transform:scale(1.02)}to{transform:scale(1.14)}}
.cin-proj:after{content:'';position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.6) 48%,transparent 60%);
  transform:translateX(-130%);animation:cinGlint 1.2s .5s ease-out forwards}
@keyframes cinProj{0%{transform:translateX(-30vw) rotate(-24deg) scale(.6);opacity:0}100%{transform:rotate(var(--rot,-2deg));opacity:1}}
.cin-proj.right{animation-name:cinProjR}
@keyframes cinProjR{0%{transform:translateX(30vw) rotate(24deg) scale(.6);opacity:0}100%{transform:rotate(var(--rot,-2deg));opacity:1}}

.cin-tpanel{display:flex;flex-direction:column;align-items:center;background:var(--team);border:.6vh solid #111;box-shadow:1.2vh 1.2vh 0 #111;
  padding:2.2vh 1.2vw 2.6vh;transform:rotate(var(--tilt,0deg));
  background-image:radial-gradient(circle,rgba(0,0,0,.16) 30%,transparent 33%);background-size:1.4vmin 1.4vmin}
.cin-op{position:absolute;left:0;right:0;bottom:3.4vh;text-align:center;font:700 12px/1 'SpaceGrotesk_700Bold','Space Grotesk',sans-serif;
  letter-spacing:.2em;text-transform:uppercase;color:#fff;opacity:.55;z-index:40;text-shadow:0 1px 2px #000}
.cin-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;z-index:10}
`;

/** Fallback web fonts (the app already loads them, but the reveal must look right on its own). */
export const CINEMA_FONTS = 'https://fonts.googleapis.com/css2?family=Bangers&family=Space+Grotesk:wght@500;700&display=swap';
