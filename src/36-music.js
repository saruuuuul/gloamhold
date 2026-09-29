
/* ============================================================
   MUSIC — Carol of the Bells, for the intense moments only.

   The four-note ostinato is Mykola Leontovych's "Shchedryk" (1916),
   long in the public domain. The bass under it and the bells over it
   are our own; no lyrics and no later arrangement are used. Like
   every sound in this build it is made from tone() and hiss() at
   runtime — nothing is loaded (invariant 14).

   Every activity reports how intense the moment is, 0..1 (a warden
   fight, a stack near the top, a rock about to hit). Above
   music.startAt the carol comes in; it keeps going holdSec after
   things calm down so it does not flicker on and off, and it plays
   faster and fuller the more intense it gets. Notes are scheduled a
   little ahead on the audio clock, so a slow frame never stutters it.
   ============================================================ */
var MUS = { on:false, level:0, hold:0, next:0, step:0 };
/* one bar of 3/4 in eighths: B♭ (quarter), A, B♭ (eighths), G (quarter) */
var MUS_LEAD = [466.16, 0, 440.00, 466.16, 392.00, 0];
var MUS_LEN  = [2, 0, 1, 1, 2, 0];
/* our own bass, falling G – F – E♭ – D, two bars each */
var MUS_BASS = [98.00, 98.00, 87.31, 87.31, 77.78, 77.78, 73.42, 73.42];
/* and our own long line over the second half of the cycle, at the top */
var MUS_LINE = [0, 0, 0, 0, 587.33, 523.25, 466.16, 440.00];

function musicStop(){ MUS.on = false; MUS.hold = 0; MUS.level = 0; }
function musicTick(x, force){
  var M = TUNING.music;
  if(force || !cfg.music || !audioLive() || !AC || AC.state !== 'running'){ if(force || !cfg.music || cfg.mute) musicStop(); return; }
  x = x || 0;
  if(x >= M.startAt){ MUS.hold = Math.round(M.holdSec*60); }
  else if(MUS.hold > 0) MUS.hold--;
  if(x > MUS.level) MUS.level = x; else MUS.level += (x - MUS.level)*0.01;
  if(MUS.hold <= 0){ MUS.on = false; return; }
  if(!MUS.on){ MUS.on = true; MUS.step = 0; MUS.next = AC.currentTime + 0.05; }
  /* after a stall (a backgrounded tab, a long frame) start again from now
     rather than firing a backlog of notes at once */
  if(MUS.next < AC.currentTime - 0.2) MUS.next = AC.currentTime + 0.05;
  var lv = Math.max(M.startAt, MUS.level), k = Math.max(0, Math.min(1, (lv - M.startAt)/Math.max(0.01, 1 - M.startAt)));
  var eighth = 30 / (M.bpmLow + (M.bpmHigh - M.bpmLow)*k);
  var guard = 0;
  while(MUS.next < AC.currentTime + M.lookahead && guard++ < 16){
    musicStep(MUS.step, Math.max(0, MUS.next - AC.currentTime), eighth, lv);
    MUS.next += eighth; MUS.step++;
  }
}
function musicStep(step, delay, eighth, lv){
  var M = TUNING.music, i = step % 6, bar = Math.floor(step/6) % 8;
  if(MUS_LEAD[i]){
    tone({ f:MUS_LEAD[i], dur:eighth*MUS_LEN[i]*0.8, type:'triangle', v:M.leadVol, a:0.004, delay:delay }, 'music');
    if(lv > 0.75) tone({ f:MUS_LEAD[i]*2, dur:eighth*0.9, type:'sine', v:M.bellVol, a:0.002, delay:delay }, 'music');
  }
  if(i === 0){
    tone({ f:MUS_BASS[bar], dur:eighth*5.2, type:'triangle', v:M.bassVol, a:0.02, delay:delay }, 'music');
    if(lv > 0.85 && MUS_LINE[bar]) tone({ f:MUS_LINE[bar], dur:eighth*5.4, type:'sine', v:M.lineVol, a:0.06, delay:delay }, 'music');
  }
  if(lv > 0.7 && i % 2 === 0) hiss({ hz:6500, dur:0.03, v:M.tickVol, q:0.8, delay:delay }, 'music');
}
