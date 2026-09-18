
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
  return bus === 'ui' ? a.ui : a.game;
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
  fanfare: function(){ arp([523, 659, 784, 1047, 1319], 0.1, { dur:0.22, type:'triangle', v:0.26 }, 'ui'); }
};

function sfx(name){
  if(!audioLive()) return;
  var f = SFX[name];
  if(f) try{ f(); }catch(e){}
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
  done:    { mn:'Өнөөдрийн тоглоом дууслаа. Сайн тоглолоо!', en:'Today is done. Well played!' }
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
function speechStatus(){
  if(!window.speechSynthesis || !window.SpeechSynthesisUtterance) return 'unsupported';
  if(cfg.speakLang === 'off') return 'off';
  return speechVoiceFor(cfg.speakLang) ? 'ready' : 'no voice';
}
function say(key){
  if(cfg.mute || cfg.speakLang === 'off') return;
  var line = SPEECH[key];
  if(!line) return;
  try{
    if(!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    var v = speechVoiceFor(cfg.speakLang);
    if(!v) return;
    var text = line[cfg.speakLang] || line.en;
    if(!text) return;
    window.speechSynthesis.cancel();
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
