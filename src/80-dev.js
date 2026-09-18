
/* ============================================================
   DEV PANEL — every numeric leaf in TUNING becomes a slider.
   Add a field to TUNING and a control appears here on next load;
   there is no panel code to keep in sync.
   ============================================================ */
var RANGE_RULES = [
  [/^(hp|maxHp|w|h|damage|maxSpawns|spawnBelowHp)$/,      function(v){ return {min:1, max:Math.max(10,Math.ceil(v*4)), step:1}; }],
  [/(Frames|Cycle|Move|cooldown|Life|Every|iframes|ReminderMin)$/i, function(v){ return {min:0, max:Math.max(30,Math.ceil(v*3)), step:1}; }],
  [/^(chroma)$/,                                          function(){ return {min:0, max:0.02, step:0.001}; }],
  [/^(k1|k2)$/,                                           function(){ return {min:0, max:0.6, step:0.01}; }],
  [/(friction|accel|Factor|attackSlow|Floor|quantise|minContrast|FloorBump|wobble)$/i,
                                                          function(){ return {min:0, max:1, step:0.01}; }],
  [/Hz$/,                                                 function(v){ return {min:40, max:Math.max(2000, Math.ceil(v*2)), step:10}; }],
  [/^(master|game|ui)$/,                                  function(){ return {min:0, max:1, step:0.05}; }],
  [/(Contrast|Inset|Pulse)$/i,                            function(){ return {min:0, max:1, step:0.01}; }],
  [/(Rounds|MissesToStop|maxRows|repeatDelay|repeatRate)$/i, function(v){ return {min:1, max:Math.max(12, Math.ceil(v*3)), step:1}; }],
  [/^(clickDur|tailDur)$/,                                function(){ return {min:0.01, max:1, step:0.01}; }]
];
function rangeFor(path, v){
  var leaf = path.split('.').pop(), i;
  for(i=0;i<RANGE_RULES.length;i++) if(RANGE_RULES[i][0].test(leaf)) return RANGE_RULES[i][1](v);
  return { min:0, max:Math.max(1, +(v*3).toFixed(3)), step: (v>=2 ? 0.1 : 0.01) };
}
var SECTION_NOTE = {
  player:  'Movement and the sword. Speed, friction and the attack window apply instantly.',
  grub:    'Slow pursuer that moves in bursts. hp / w / h apply to enemies spawned from now on.',
  bat:     'Fast wanderer; wobble is how much it arcs instead of homing.',
  sentry:  'Stationary turret. cooldown is frames between shots at 60fps.',
  boss:    'Charges in bursts, spawns bats below spawnBelowHp.',
  combat:  'Shared hit reactions.',
  therapy: 'The staircase. stepDownFactor is how hard a clean room pushes the stronger eye down; stepUpFactor is how hard a hit pushes it back.',
  optics:  'Lens preset values. Editing these updates what the preset buttons load.',
  feel:    'Timing of feedback, not difficulty.',
  menu:    'Stereo menu chrome. Sizes are in viewport units (1 = 1% of the short side of one eye), so they scale with the screen.',
  audio:   'Synthesised sound. master is the bus; game and ui are the two sub-mixes. Frequencies are in Hz.',
  kid:     'The child setup wizard. huntStepFactor is how much fainter each round gets; safetyBackoff pads the final contrast above the faintest catch.'
};
var devBuilt = false;
function buildDevPanel(){
  if(devBuilt) return; devBuilt = true;
  var host = el('devFields'), leaves = walkTuning(TUNING), groups = {}, order = [];
  leaves.forEach(function(L){
    var sec = L.path.split('.')[0];
    if(!groups[sec]){ groups[sec]=[]; order.push(sec); }
    groups[sec].push(L);
  });
  host.innerHTML = '';
  order.forEach(function(sec){
    var g = document.createElement('div'); g.className = 'group';
    var h = document.createElement('h2'); h.textContent = sec; g.appendChild(h);
    if(SECTION_NOTE[sec]){ var n=document.createElement('p'); n.className='hint'; n.textContent=SECTION_NOTE[sec]; g.appendChild(n); }
    groups[sec].forEach(function(L){
      var r = rangeFor(L.path, L.value);
      var row = document.createElement('div'); row.className = 'row';
      var lab = document.createElement('label'); lab.className = 'lbl';
      var id = 'tn_' + L.path.replace(/\./g,'_');
      lab.setAttribute('for', id);
      var name = document.createElement('span'); name.textContent = L.path.split('.').slice(1).join(' · ') || L.path;
      var val = document.createElement('span'); val.className = 'val'; val.textContent = fmtNum(L.value);
      lab.appendChild(name); lab.appendChild(val);
      var inp = document.createElement('input');
      inp.type='range'; inp.id=id; inp.min=r.min; inp.max=r.max; inp.step=r.step; inp.value=L.value;
      inp.addEventListener('input', function(){
        var v = +inp.value; setT(L.path, v); val.textContent = fmtNum(v);
        saveTuning(); syncJsonBox();
        if(/^optics\./.test(L.path)) { LENS_PRESETS = TUNING.optics.presets; }
        if(!running) render();
      });
      row.appendChild(lab); row.appendChild(inp);
      g.appendChild(row);
    });
    host.appendChild(g);
  });
}
function fmtNum(v){ return (Math.abs(v)>=1 || v===0) ? String(+v.toFixed(2)) : String(+v.toFixed(3)); }
function syncJsonBox(){ var b=el('tuneJson'); if(b && document.activeElement!==b) b.value = JSON.stringify(TUNING, null, 1); }
function rebuildDev(){ devBuilt=false; buildDevPanel(); syncJsonBox(); }

/* ---------- session telemetry ---------- */
function sessionRecord(){
  return {
    build: BUILD,
    savedAt: new Date().toISOString(),
    settings: { weakEye:cfg.weakEye, mode:cfg.mode, adapt:cfg.adapt, strongContrast:cfg.strong,
                sep:cfg.sep, zoom:cfg.zoom, lens:cfg.lens, k1:cfg.k1, k2:cfg.k2, chroma:cfg.chroma, lensOff:cfg.lensOff },
    outcome: { endedWon:!!S.won, elapsedSec:Math.round(S.elapsed/1000), roomsEntered:S.rooms,
               roomsClean:S.cleanRooms, hits:S.hits, kills:S.kills,
               stepsDown:S.stepsDown, stepsUp:S.stepsUp,
               contrastStart:(S.trail[0]||{}).c, contrastEnd:cfg.strong,
               contrastBest:S.trail.reduce(function(a,p){ return Math.min(a,p.c); }, 1) },
    contrastTrail: S.trail.map(function(p){ return { sec:Math.round(p.t/1000), c:+p.c.toFixed(2) }; }),
    noniusChecks: S.checks.map(function(c){ return { sec:Math.round(c.t/1000), answer:c.a }; }),
    rooms: S.roomLog,
    tuning: TUNING
  };
}
function copySession(){
  var txt = JSON.stringify(sessionRecord(), null, 1), note = el('logNote');
  function ok(){ note.textContent = 'Session log copied. Paste it into a chat and it can be tuned against what actually happened.'; }
  function fail(){ var b=el('tuneJson'); b.value = txt; b.focus(); b.select(); note.textContent = 'Clipboard blocked — the log is in the JSON box below, selected and ready to copy by hand.'; }
  try{
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fail);
    else fail();
  }catch(e){ fail(); }
}
function downloadSession(){
  try{
    var blob = new Blob([JSON.stringify(sessionRecord(), null, 1)], {type:'application/json'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gloamhold-' + new Date().toISOString().slice(0,19).replace(/[:T]/g,'-') + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    el('logNote').textContent = 'Saved to your downloads.';
  }catch(e){ el('logNote').textContent = 'This browser blocked the download — use Copy instead.'; }
}

/* ---------- console handle ----------
   Plug the Pixel into a laptop, open chrome://inspect, and everything the
   game runs on is reachable as GH.* — TUNING, live config, the session
   record, the render call. Useful when a slider is not the right tool. */
try{
  window.GH = {
    build: BUILD,
    get cfg(){ return cfg; },
    get TUNING(){ return TUNING; },
    get session(){ return S; },
    get game(){ return G; },
    record: sessionRecord,
    get menu(){ return MENU; },
    screens: function(){ var o=[], k; for(k in SCREENS) o.push(k); return o; },
    open: function(id){ openMenu(id); },
    pick: function(i){ MENU.idx = i; },
    confirm: menuConfirm,
    play: startRun,
    flat: goFlat,
    stereo: leaveFlat,
    sfx: sfx,
    get hunt(){ return HUNT; },
    audio: function(){ return { ctx: AC ? AC.state : null, failed: audioFailed, muted: cfg.mute,
                                master: TUNING.audio.master, effects: Object.keys(SFX).length }; },
    set: function(path, v){ setT(path, v); saveTuning(); rebuildDev(); },
    reset: resetTuning,
    redraw: function(){ render(); }
  };
}catch(e){}
