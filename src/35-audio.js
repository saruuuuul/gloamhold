
/* ============================================================
   AUDIO — every sound is synthesised at runtime.

   There are no asset files and nothing is fetched: the build is a
   single HTML file and the Artifact CSP blocks external requests,
   so oscillators are the only thing that can make a noise in every
   place this ships.

   Browsers refuse to start an AudioContext outside a real gesture,
   so nothing exists until audioUnlock() runs from a pointer, key or
   gamepad press. Every function here is safe to call before that —
   it simply stays silent rather than throwing.
   ============================================================ */
var AC = null, MASTER = null, NOISEBUF = null, audioFailed = false;

function audioUnlock(){
  if(audioFailed) return;
  if(AC){ if(AC.state === 'suspended'){ try{ AC.resume(); }catch(e){} } return; }
  try{
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if(!Ctor){ audioFailed = true; return; }
    AC = new Ctor();
    MASTER = AC.createGain();
    MASTER.gain.value = TUNING.audio.master;
    MASTER.connect(AC.destination);
  }catch(e){ AC = null; audioFailed = true; }
}
function audioAvailable(){ return !!AC && !audioFailed; }
function audioLive(){
  if(!AC || audioFailed || cfg.mute) return false;
  try{ MASTER.gain.value = TUNING.audio.master; }catch(e){ return false; }
  return true;
}

/* one short white-noise buffer, reused for every percussive sound */
function noiseBuffer(){
  if(NOISEBUF) return NOISEBUF;
  var n = Math.floor(AC.sampleRate * 0.4), b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0), i;
  for(i=0;i<n;i++) d[i] = Math.random()*2 - 1;
  NOISEBUF = b;
  return b;
}

/* Exponential ramps cannot touch zero, hence the 0.0001 floor everywhere. */
function shaped(src, t0, attack, dur, peak){
  var g = AC.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur);
  src.connect(g); g.connect(MASTER);
  return g;
}

/* o: {f, to, dur, type, v, a, delay, detune} — v is relative to the bus gain */
function tone(o, bus){
  if(!audioLive()) return;
  try{
    var t0 = AC.currentTime + (o.delay || 0);
    var dur = o.dur == null ? TUNING.audio.clickDur : o.dur;
    var att = o.a == null ? 0.006 : o.a;
    var osc = AC.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(Math.max(o.f, 1), t0);
    if(o.to != null) osc.frequency.exponentialRampToValueAtTime(Math.max(o.to, 1), t0 + att + dur);
    if(o.detune) osc.detune.setValueAtTime(o.detune, t0);
    shaped(osc, t0, att, dur, (o.v == null ? 0.3 : o.v) * busGain(bus));
    osc.start(t0);
    osc.stop(t0 + att + dur + 0.05);
  }catch(e){}
}

/* o: {dur, v, hz, q, delay, type} — filtered noise, for swings and impacts */
function hiss(o, bus){
  if(!audioLive()) return;
  try{
    var t0 = AC.currentTime + (o.delay || 0);
    var src = AC.createBufferSource();
    src.buffer = noiseBuffer();
    var f = AC.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.hz || 1200, t0);
    f.Q.value = o.q == null ? 1.2 : o.q;
    src.connect(f);
    shaped(f, t0, 0.004, o.dur || 0.08, (o.v == null ? 0.25 : o.v) * busGain(bus));
    src.start(t0);
    src.stop(t0 + (o.dur || 0.08) + 0.06);
  }catch(e){}
}
function busGain(bus){
  var a = TUNING.audio;
  return bus === 'ui' ? a.ui : (bus === 'music' ? a.music : a.game);
}
function arp(freqs, step, o, bus){
  for(var i=0;i<freqs.length;i++){
    tone({ f:freqs[i], dur:(o && o.dur) || 0.10, type:(o && o.type) || 'triangle',
           v:(o && o.v) == null ? 0.26 : o.v, delay:i*step }, bus);
  }
}

/* ---------------- the catalogue ----------------
   Game sounds go to the 'game' bus, menu sounds to 'ui', so a parent can
   mute the interface chirps without muting the dungeon (or the reverse). */
var SFX = {
  uiMove:  function(){ tone({ f:TUNING.audio.uiMoveHz, dur:0.035, type:'square', v:0.16 }, 'ui'); },
  uiOk:    function(){ tone({ f:TUNING.audio.uiOkHz, to:TUNING.audio.uiOkHz*1.5, dur:0.09, type:'square', v:0.22 }, 'ui'); },
  uiBack:  function(){ tone({ f:TUNING.audio.uiBackHz, to:TUNING.audio.uiBackHz*0.62, dur:0.09, type:'square', v:0.2 }, 'ui'); },
  uiEdge:  function(){ tone({ f:200, dur:0.04, type:'square', v:0.1 }, 'ui'); },
  uiTick:  function(){ tone({ f:900, dur:0.02, type:'square', v:0.08 }, 'ui'); },

  swing:   function(){ hiss({ hz:1700, dur:0.07, v:0.18, q:0.8 }, 'game');
                       tone({ f:TUNING.audio.swingHz, to:TUNING.audio.swingHz*0.55, dur:0.07, type:'triangle', v:0.14 }, 'game'); },
  hitFoe:  function(){ tone({ f:TUNING.audio.hitHz, to:TUNING.audio.hitHz*0.45, dur:0.09, type:'square', v:0.26 }, 'game');
                       hiss({ hz:800, dur:0.06, v:0.2 }, 'game'); },
  foeDie:  function(){ tone({ f:320, to:70, dur:0.24, type:'sawtooth', v:0.24 }, 'game');
                       hiss({ hz:500, dur:0.18, v:0.16, type:'lowpass' }, 'game'); },
  hurt:    function(){ tone({ f:TUNING.audio.hurtHz, to:60, dur:TUNING.audio.tailDur, type:'square', v:0.34 }, 'game');
                       tone({ f:TUNING.audio.hurtHz*0.75, to:52, dur:TUNING.audio.tailDur, type:'sawtooth', v:0.18, detune:-18 }, 'game'); },
  shot:    function(){ tone({ f:520, to:300, dur:0.07, type:'square', v:0.12 }, 'game'); },

  pickup:  function(){ arp([TUNING.audio.pickupHz, TUNING.audio.pickupHz*1.33, TUNING.audio.pickupHz*2], 0.055, { dur:0.09, v:0.24 }, 'game'); },
  keyGet:  function(){ arp([880, 1175, 1568], 0.06, { dur:0.11, v:0.26 }, 'game'); },
  unlock:  function(){ tone({ f:260, to:1250, dur:0.34, type:'triangle', v:0.24 }, 'game');
                       hiss({ hz:2400, dur:0.12, v:0.12, delay:0.2 }, 'game'); },
  locked:  function(){ tone({ f:150, dur:0.12, type:'square', v:0.2 }, 'game');
                       tone({ f:140, dur:0.12, type:'square', v:0.18, delay:0.13 }, 'game'); },
  roomClear: function(){ arp([523, 659, 784], 0.075, { dur:0.14, v:0.24 }, 'game'); },

  /* the staircase speaks: down is the good direction, so it falls gently */
  stepDown: function(){ arp([700, 520], 0.09, { dur:0.16, type:'sine', v:0.22 }, 'ui'); },
  stepUp:   function(){ arp([460, 640], 0.09, { dur:0.16, type:'sine', v:0.22 }, 'ui'); },

  win:     function(){ arp([523, 659, 784, 1047], 0.11, { dur:0.2, v:0.28 }, 'game'); },
  lose:    function(){ tone({ f:400, to:90, dur:0.8, type:'sawtooth', v:0.26 }, 'game'); },
  bossWake:function(){ tone({ f:110, to:55, dur:0.7, type:'sawtooth', v:0.3 }, 'game');
                       hiss({ hz:220, dur:0.6, v:0.16, type:'lowpass' }, 'game'); },

  /* child wizard */
  target:  function(){ tone({ f:990, dur:0.09, type:'sine', v:0.16 }, 'ui'); },
  star:    function(){ arp([1200, 1600, 2100], 0.05, { dur:0.1, type:'sine', v:0.24 }, 'ui'); },
  oops:    function(){ tone({ f:300, to:220, dur:0.14, type:'triangle', v:0.16 }, 'ui'); },
  fanfare: function(){ arp([523, 659, 784, 1047, 1319], 0.1, { dur:0.22, type:'triangle', v:0.26 }, 'ui'); },

  /* the world */
  cut:     function(){ hiss({ hz:2600, dur:0.06, v:0.16, q:0.9 }, 'game'); tone({ f:700, to:420, dur:0.04, type:'triangle', v:0.08 }, 'game'); },
  pot:     function(){ hiss({ hz:1400, dur:0.1, v:0.2, q:2 }, 'game'); tone({ f:900, to:500, dur:0.06, type:'square', v:0.1 }, 'game'); },
  coin:    function(){ tone({ f:1320, dur:0.04, type:'square', v:0.12 }, 'game'); tone({ f:1760, dur:0.07, type:'square', v:0.12, delay:0.04 }, 'game'); },
  chest:   function(){ arp([392, 523, 659, 784, 1047], 0.08, { dur:0.18, type:'triangle', v:0.26 }, 'game'); },
  push:    function(){ hiss({ hz:260, dur:0.16, v:0.2, type:'lowpass' }, 'game'); },
  puzzle:  function(){ arp([659, 784, 988, 1319], 0.07, { dur:0.14, type:'sine', v:0.24 }, 'game'); },
  dig:     function(){ hiss({ hz:500, dur:0.12, v:0.2, type:'lowpass' }, 'game'); arp([880, 1175], 0.06, { dur:0.08, type:'square', v:0.12 }, 'game'); },
  light:   function(){ hiss({ hz:3000, dur:0.14, v:0.12, q:0.7 }, 'game'); tone({ f:520, to:880, dur:0.12, type:'sine', v:0.12 }, 'game'); },
  rumble:  function(){ tone({ f:90, to:45, dur:0.5, type:'sawtooth', v:0.24 }, 'game'); hiss({ hz:180, dur:0.5, v:0.2, type:'lowpass' }, 'game'); },

  /* tools */
  bombSet: function(){ tone({ f:300, dur:0.05, type:'square', v:0.14 }, 'game'); hiss({ hz:5000, dur:0.3, v:0.05, q:0.5 }, 'game'); },
  boom:    function(){ tone({ f:120, to:30, dur:0.5, type:'sawtooth', v:0.34 }, 'game'); hiss({ hz:400, dur:0.45, v:0.34, type:'lowpass' }, 'game'); },
  arrow:   function(){ hiss({ hz:3200, dur:0.08, v:0.12, q:1.5 }, 'game'); tone({ f:900, to:1400, dur:0.06, type:'triangle', v:0.08 }, 'game'); },
  block:   function(){ tone({ f:1100, to:700, dur:0.06, type:'square', v:0.14 }, 'game'); },

  /* the sea */
  sail:    function(){ hiss({ hz:700, dur:0.9, v:0.14, type:'lowpass' }, 'ui'); arp([392, 494, 587], 0.16, { dur:0.25, type:'triangle', v:0.2 }, 'ui'); },

  /* the dungeon, grown */
  charged: function(){ tone({ f:1400, dur:0.05, type:'sine', v:0.14 }, 'game'); tone({ f:2100, dur:0.06, type:'sine', v:0.1, delay:0.05 }, 'game'); },
  spin:    function(){ hiss({ hz:1500, dur:0.22, v:0.22, q:0.7 }, 'game'); tone({ f:500, to:1100, dur:0.2, type:'triangle', v:0.16 }, 'game'); },
  bug:     function(){ arp([1568, 2093], 0.04, { dur:0.06, type:'sine', v:0.16 }, 'game'); },
  frog:    function(){ tone({ f:260, to:520, dur:0.08, type:'square', v:0.1 }, 'game'); },
  split:   function(){ tone({ f:420, to:180, dur:0.12, type:'triangle', v:0.2 }, 'game'); hiss({ hz:900, dur:0.08, v:0.12 }, 'game'); },
  windup:  function(){ tone({ f:180, to:360, dur:0.5, type:'sawtooth', v:0.16 }, 'game'); },
  ring:    function(){ tone({ f:700, to:350, dur:0.18, type:'square', v:0.16 }, 'game'); },
  quake:   function(){ tone({ f:70, to:40, dur:0.45, type:'sawtooth', v:0.3 }, 'game'); hiss({ hz:160, dur:0.4, v:0.26, type:'lowpass' }, 'game'); },

  /* arcade, shared */
  go:      function(){ arp([523, 784], 0.12, { dur:0.16, type:'square', v:0.2 }, 'game'); },
  levelUp: function(){ arp([523, 659, 784, 1047, 1319, 1568], 0.075, { dur:0.18, type:'triangle', v:0.26 }, 'game'); },
  trophy:  function(){ arp([392, 523, 659, 784, 1047], 0.13, { dur:0.34, type:'triangle', v:0.28 }, 'ui'); hiss({ hz:5000, dur:0.6, v:0.05, q:0.4, delay:0.5 }, 'ui'); },
  bump:    function(){ tone({ f:160, to:110, dur:0.08, type:'square', v:0.18 }, 'game'); },
  oof:     function(){ tone({ f:300, to:120, dur:0.25, type:'sawtooth', v:0.2 }, 'game'); hiss({ hz:500, dur:0.2, v:0.14, type:'lowpass' }, 'game'); },

  /* Blocks */
  bMove:   function(){ tone({ f:600, dur:0.02, type:'square', v:0.06 }, 'game'); },
  bRotate: function(){ tone({ f:880, to:990, dur:0.03, type:'square', v:0.08 }, 'game'); },
  bLock:   function(){ tone({ f:220, to:160, dur:0.06, type:'triangle', v:0.18 }, 'game'); },
  bDrop:   function(){ hiss({ hz:600, dur:0.08, v:0.16, type:'lowpass' }, 'game'); tone({ f:180, to:90, dur:0.08, type:'square', v:0.16 }, 'game'); },
  /* each line in a row of clears climbs a step: combo is the argument */
  bLine:   function(k){ var f = 523 * Math.pow(1.122, Math.min(12, k || 0)); arp([f, f*1.26, f*1.5], 0.05, { dur:0.1, type:'square', v:0.18 }, 'game'); },
  bBig:    function(){ arp([523, 659, 784, 1047, 784, 1047, 1319], 0.06, { dur:0.14, type:'square', v:0.22 }, 'game'); },
  bGem:    function(){ arp([1319, 1760, 2637], 0.05, { dur:0.12, type:'sine', v:0.2 }, 'game'); },
  bSweep:  function(){ hiss({ hz:1200, dur:0.6, v:0.2, q:0.5 }, 'game'); tone({ f:900, to:200, dur:0.55, type:'triangle', v:0.16 }, 'game'); },

  /* Space Rocks */
  laser:   function(k){ tone({ f:1500 + (k||0)*40, to:700, dur:0.05, type:'square', v:0.07 }, 'game'); },
  rockHit: function(s){ tone({ f:[0, 520, 330, 200][s||1] || 300, to:90, dur:0.14, type:'sawtooth', v:0.2 }, 'game'); hiss({ hz:700, dur:0.12, v:0.18, type:'lowpass' }, 'game'); },
  saucer:  function(){ tone({ f:900, to:1200, dur:0.12, type:'sine', v:0.08 }, 'game'); tone({ f:1200, to:900, dur:0.12, type:'sine', v:0.08, delay:0.12 }, 'game'); },
  powerUp: function(){ arp([660, 880, 1100, 1320], 0.05, { dur:0.1, type:'square', v:0.18 }, 'game'); },
  shield:  function(){ tone({ f:300, to:900, dur:0.2, type:'sine', v:0.18 }, 'game'); },
  shipHit: function(){ tone({ f:400, to:80, dur:0.4, type:'sawtooth', v:0.26 }, 'game'); hiss({ hz:400, dur:0.35, v:0.2, type:'lowpass' }, 'game'); },

  /* Racer */
  overtake:function(){ tone({ f:988, dur:0.05, type:'square', v:0.12 }, 'game'); tone({ f:1319, dur:0.08, type:'square', v:0.12, delay:0.05 }, 'game'); },
  skid:    function(){ hiss({ hz:2200, dur:0.35, v:0.14, q:3 }, 'game'); },
  crash:   function(){ tone({ f:200, to:50, dur:0.35, type:'square', v:0.26 }, 'game'); hiss({ hz:900, dur:0.3, v:0.24 }, 'game'); },
  nitro:   function(){ hiss({ hz:900, dur:0.7, v:0.2, type:'lowpass' }, 'game'); tone({ f:200, to:600, dur:0.6, type:'sawtooth', v:0.12 }, 'game'); },
  checkpoint: function(){ arp([784, 988, 1175], 0.07, { dur:0.12, type:'triangle', v:0.2 }, 'game'); },

  /* Gator Truck */
  hop:     function(){ tone({ f:300, to:620, dur:0.1, type:'square', v:0.16 }, 'game'); },
  land:    function(){ hiss({ hz:300, dur:0.1, v:0.2, type:'lowpass' }, 'game'); tone({ f:120, to:70, dur:0.08, type:'triangle', v:0.2 }, 'game'); },
  crunch:  function(){ hiss({ hz:1600, dur:0.18, v:0.26, q:0.8 }, 'game'); tone({ f:240, to:80, dur:0.16, type:'square', v:0.22 }, 'game'); },
  honk:    function(){ tone({ f:392, dur:0.16, type:'square', v:0.14 }, 'game'); tone({ f:494, dur:0.16, type:'square', v:0.12 }, 'game'); },
  transform: function(){ arp([392, 523, 784, 1047], 0.05, { dur:0.08, type:'square', v:0.16 }, 'game'); hiss({ hz:3000, dur:0.25, v:0.1, q:0.6 }, 'game'); },
  splash:  function(){ hiss({ hz:900, dur:0.4, v:0.22, q:0.6 }, 'game'); },
  bubble:  function(){ tone({ f:700, to:1300, dur:0.06, type:'sine', v:0.1 }, 'game'); },
  balloon: function(){ hiss({ hz:3000, dur:0.06, v:0.2, q:0.8 }, 'game'); arp([1047, 1319], 0.05, { dur:0.08, type:'sine', v:0.16 }, 'game'); },
  flip:    function(){ arp([784, 1047, 1319, 1568], 0.045, { dur:0.08, type:'triangle', v:0.22 }, 'game'); }
};

function sfx(name, arg){
  if(!audioLive()) return;
  var f = SFX[name];
  if(f) try{ f(arg); }catch(e){}
}

/* ============================================================
   SPEECH — the player is five and cannot read the screen, so the
   wizard says its instructions out loud through the browser's own
   speech synthesiser. Still no asset files and no network: the
   voices belong to the device.

   If the device has no voice for the chosen language we stay
   SILENT rather than handing Cyrillic to an English voice, which
   produces noise a child cannot act on. speechStatus() reports
   that to the grown-up screen so the failure is visible instead of
   mysterious.
   ============================================================ */
var SPEECH = {
  goggles: { mn:'Шилээ зүүгээд том товчийг дар.',        en:'Put the goggles on, then press the big button.' },
  hunt:    { mn:'Эрвээхэйг харвал товчийг дар.',          en:'Press the button when you see the butterfly.' },
  good:    { mn:'Сайн байна!',                            en:'Nice one!' },
  sticks:  { mn:'Хэдэн саваа харагдаж байна?',            en:'How many sticks can you see?' },
  ready:   { mn:'Бэлэн боллоо. Тоглоцгооё!',              en:'All set. Let us play!' },
  again:   { mn:'Дахиад нэг тоглоцгооё.',                 en:'Let us try that again.' },
  soon:    { mn:'Бага зэрэг үлдлээ.',                     en:'Nearly finished.' },
  done:    { mn:'Өнөөдрийн тоглоом дууслаа. Сайн тоглолоо!', en:'Today is done. Well played!' },

  /* the owl, in the dungeon */
  push:    { mn:'Чулууг дугуй дээр түлх.',                  en:'Push the stone onto the circle.' },
  torch:   { mn:'Бүх бамбарыг сэлмээрээ асаа.',             en:'Light every torch with your sword.' },
  sealed:  { mn:'Хаалга хаагдлаа! Бүх мангасыг ял.',        en:'The doors closed! Beat all the monsters.' },
  sparkle: { mn:'Гялалзсан газрыг ухаарай!',                en:'Dig where it sparkles!' },
  careful: { mn:'Болгоомжтой!',                             en:'Careful!' },
  chest:   { mn:'Эрдэнэс оллоо!',                           en:'You found treasure!' },
  key:     { mn:'Түлхүүр оллоо!',                           en:'You found a key!' },
  heart:   { mn:'Зүрх оллоо!',                              en:'You found a heart!' },
  shield:  { mn:'Бамбай оллоо! Хоёр дахь товчоор бамбайгаа өргө.', en:'You found the shield! Hold the second button to raise it.' },
  bombs:   { mn:'Тэсрэх бөмбөг оллоо! Хагарсан ханыг дэлбэл.', en:'You found the bombs! Blow up cracked walls.' },
  bow:     { mn:'Нум сум оллоо! Хананы нүдийг харваарай.',   en:'You found the bow! Shoot the eyes in the walls.' },
  orb:     { mn:'Гэрэл оллоо! Арал дахин гэрэлтлээ.',        en:'You found the light! The island shines again.' },
  secret:  { mn:'Нууц зам нээгдлээ!',                       en:'A secret way opened!' },
  solved:  { mn:'Сайн байна! Нэг юм нээгдлээ.',             en:'Well done! Something opened.' },
  look:    { mn:'Эргэн тойрноо сайн хараарай.',             en:'Look around carefully.' },
  reset:   { mn:'Гараад буцаж орвол чулуунууд байрандаа очно.', en:'Go out and back in to put the stones back.' },
  crack:   { mn:'Энэ хана хагарсан байна. Бөмбөг тавиад үз.', en:'That wall is cracked. Try a bomb.' },
  eye:     { mn:'Хананд нүд байна. Сумаар харваарай.',      en:'There is an eye in the wall. Shoot it.' },
  rest:    { mn:'Энэ өрөөний дараа амарцгаая.',             en:'Let us rest after this room.' },

  /* the sea */
  sail:    { mn:'Далайд гарцгаая!',                         en:'Let us set sail!' },
  more_stars: { mn:'Илүү од цуглуулаарай.',                 en:'Collect more stars first.' },
  next_island: { mn:'Дараагийн арал руу!',                  en:'On to the next island!' },

  /* the game picker: each game says its own name */
  g_islands: { mn:'Арлын адал явдал',                       en:'Island adventure' },
  g_truck:   { mn:'Матар машин',                            en:'Gator truck' },
  g_blocks:  { mn:'Блок',                                   en:'Blocks' },
  g_rocks:   { mn:'Сансрын чулуу',                          en:'Space rocks' },
  g_race:    { mn:'Уралдаан',                               en:'Racing' },
  g_shop:    { mn:'Будгийн дэлгүүр',                        en:'Paint shop' },

  /* cheers and prompts shared by the arcade games */
  go:        { mn:'Явцгаая!',                               en:'Let us go!' },
  wow:       { mn:'Гайхалтай!',                             en:'Wow!' },
  level:     { mn:'Дараагийн шат!',                         en:'Next level!' },
  trophy:    { mn:'Цом авлаа!',                             en:'You won a trophy!' },
  newthing:  { mn:'Шинэ зүйл гарч ирлээ!',                  en:'Something new!' },
  oops_ok:   { mn:'Зүгээр дээ, үргэлжлүүлье!',              en:'That is okay, keep going!' },
  bigjump:   { mn:'Том үсрэлт!',                            en:'Big jump!' },
  hop:       { mn:'А товчоор үсэр!',                        en:'Press A to jump!' },
  t_sub:     { mn:'B товчоор шумбагч болоорой!',            en:'Press B to become a submarine!' },
  t_mini:    { mn:'B товчоор жижиг машин болоорой!',        en:'Press B to become a mini truck!' },
  t_truck:   { mn:'B товчоор том машин болоорой!',          en:'Press B to become a big truck!' },
  wave:      { mn:'Шинэ давалгаа ирлээ!',                   en:'Here comes a wave!' },
  boss_rock: { mn:'Чулуун хаан ирлээ!',                     en:'The rock king is here!' },
  finish:    { mn:'Барианд орлоо!',                         en:'Finish!' },
  place1:    { mn:'Нэгдүгээр байр!',                        en:'First place!' },
  newcol:    { mn:'Шинэ өнгө!',                             en:'A new colour!' },
  more_coins:{ mn:'Илүү зоос цуглуулаарай.',                en:'Collect more coins first.' },
  voice_test:{ mn:'Сайн байна уу! Би ярьж чадна.',          en:'Hello! I can talk.' }
};

function speechVoices(){
  try{ return (window.speechSynthesis && window.speechSynthesis.getVoices()) || []; }
  catch(e){ return []; }
}
function speechVoiceFor(lang){
  var vs = speechVoices(), i, want = String(lang || '').toLowerCase();
  if(!want || want === 'off') return null;
  for(i=0;i<vs.length;i++){
    if(vs[i].lang && vs[i].lang.toLowerCase().indexOf(want) === 0) return vs[i];
  }
  return null;
}
/* Which voice speaks, and in which language. Mongolian voices are rare on
   phones, so without one the ENGLISH line is spoken by an English voice —
   never the Cyrillic text by an English voice, which is noise to a child. */
function speechPick(){
  if(cfg.speakLang === 'off') return null;
  var v = speechVoiceFor(cfg.speakLang);
  if(v) return { voice:v, lang:cfg.speakLang };
  if(cfg.speakLang !== 'en'){
    var e = speechVoiceFor('en');
    if(e) return { voice:e, lang:'en' };
  }
  return null;
}
function speechStatus(){
  if(!window.speechSynthesis || !window.SpeechSynthesisUtterance) return 'unsupported';
  if(cfg.speakLang === 'off') return 'off';
  var pk = speechPick();
  if(!pk) return 'no voice';
  if(pk.lang === cfg.speakLang) return cfg.speakLang === 'mn' ? 'mongolian' : 'english';
  return 'english (no mongolian voice)';
}
/* Chrome only lets a page speak after a real tap or key. Speaking one silent
   utterance inside that gesture opens the door for every line after it. */
var speechPrimed = false;
function speechPrime(){
  if(speechPrimed) return;
  try{
    if(!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    var u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    speechPrimed = true;
  }catch(e){}
}
function say(key){ sayLine(SPEECH[key]); }
/* for lines built at runtime, like "let's sail to Blue Isle" */
function sayLine(line){
  if(cfg.mute || cfg.speakLang === 'off') return;
  if(!line) return;
  try{
    if(!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    var pk = speechPick();
    if(!pk) return;
    var v = pk.voice;
    var text = line[pk.lang] || line.en;
    if(!text) return;
    /* only cancel something that is actually playing: on Chrome for Android a
       speak() issued straight after cancel() is sometimes dropped */
    if(window.speechSynthesis.speaking || window.speechSynthesis.pending) window.speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(text);
    u.voice = v; u.lang = v.lang;
    u.rate = TUNING.audio.speechRate;
    u.pitch = TUNING.audio.speechPitch;
    window.speechSynthesis.speak(u);
  }catch(e){}
}
/* voices arrive asynchronously on most engines */
try{
  if(window.speechSynthesis && 'onvoiceschanged' in window.speechSynthesis){
    window.speechSynthesis.onvoiceschanged = function(){};
  }
}catch(e){}
