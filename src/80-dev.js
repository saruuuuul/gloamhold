
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
  [/^(clickDur|tailDur)$/,                                function(){ return {min:0.01, max:1, step:0.01}; }],
  [/Chance$/,                                             function(){ return {min:0, max:1, step:0.01}; }],
  [/(Sec|Minutes|minutes)$/,                              function(v){ return {min:0, max:Math.max(30, Math.ceil(v*3)), step:1}; }],
  [/^(extraHearts|knockdownHp|stepUpsPerRoom|catchTrials|falseAlarmLimit|roomsMin|roomsMax|foesBase|foesMax|decoMin|decoMax)$/,
                                                          function(v){ return {min:0, max:Math.max(10, Math.ceil(v*3)), step:1}; }],
  [/^(stars|unlock|coinsPerStar|sparkleCoins|secretChestCoins|bombDamage|arrowDamage|bossHpPerIsland)/,
                                                          function(v){ return {min:0, max:Math.max(20, Math.ceil(v*3)), step:1}; }],
  [/Scale$/,                                              function(){ return {min:0.1, max:2, step:0.05}; }],
  [/^(lives|rivals|lanes|wavesPerLevel|segLines|linesBase|linesStep|lockResets|ringShots|summonCount|summonMax|bugsMin|bugsMax|extraFoes|kingHp|saucerHp|crushCoins|flipStars|basePrice|priceStep|smallHp|bombEvery|flipStarsMax)$/,
                                                          function(v){ return {min:0, max:Math.max(10, Math.ceil(v*3)), step:1}; }],
  [/Vol$/,                                                function(){ return {min:0, max:1, step:0.01}; }],
  [/^(bpmLow|bpmHigh)$/,                                  function(){ return {min:60, max:240, step:2}; }],
  [/^(startAt|lookahead|landTol|iceGrip)$/,               function(){ return {min:0, max:1.5, step:0.01}; }],
  [/^(lenBase|lenStep|stageBase|stageStep)$/,             function(v){ return {min:0, max:Math.ceil(v*3), step:50}; }]
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
  kid:     'The child setup wizard. huntStepFactor is how much fainter each round gets; safetyBackoff pads the final contrast above the faintest catch.',
  session: 'The shape of a sitting: its length, child-mode difficulty, and how many stars things are worth.',
  world:   'Grass, pots, stones, chests and sparkles. pushFrames is how long he has to lean on a stone before it moves.',
  tools:   'Shield, bombs and bow. No ammo on purpose.',
  owl:     'The companion. hintAfterSec is how long he can be stuck before it speaks up.',
  islands: 'The sea. unlockBase/Step/Grow set how many stars each island costs; finishing an island also opens the next.',
  hopper:  'A frog that leaps at him; only dangerous once it has landed.',
  slime:   'Slow, and splits into two quick halves when beaten.',
  music:   'Carol of the Bells in intense moments. startAt is the intensity (0..1) that brings it in.',
  arcade:  'Shared by the four arcade games: speech gaps, the end-of-level pause, hit-stop.',
  shop:    'Paint shop prices, in coins.',
  blocks:  'Falling blocks. gravity is frames per row; segLines lines make one staircase step.',
  rocks:   'Space Rocks. Speeds are field units per frame.',
  race:    'Top-down racer. Distances are field units.',
  truck:   'Gator Truck. gravity per frame; hopV is the jump; landTol is how crooked a landing may be (radians).'
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
    /* which game this run was: 'islands', or an arcade game's id */
    activity: S.activity || 'islands',
    settings: { weakEye:cfg.weakEye, mode:cfg.mode, adapt:cfg.adapt, strongContrast:cfg.strong,
                sep:cfg.sep, zoom:cfg.zoom, lens:cfg.lens, k1:cfg.k1, k2:cfg.k2, chroma:cfg.chroma, lensOff:cfg.lensOff },
    outcome: { endedWon:!!S.won, elapsedSec:Math.round(S.elapsed/1000), roomsEntered:S.rooms,
               roomsClean:S.cleanRooms, hits:S.hits, kills:S.kills,
               stepsDown:S.stepsDown, stepsUp:S.stepsUp,
               contrastStart:(S.trail[0]||{}).c, contrastEnd:cfg.strong,
               contrastBest:S.trail.reduce(function(a,p){ return Math.min(a,p.c); }, 1),
               island:ISLAND ? ISLAND.id : null, knockdowns:S.knockdowns||0,
               coins:S.coins||0, secrets:S.secrets||0, starsGained:S.starsGained||0,
               firstLight:!!S.firstLight, sittingMin:+(SIT.ms/60000).toFixed(1),
               level:S.level || null, score:S.score || 0, place:S.place || null,
               levelStars:S.levelStars || 0, bonusStars:S.bonusStars || 0 },
    /* how long each per-eye layer had something on it, and what fraction of
       the run that was — whether the game gave the weaker eye work to do */
    exposure: (function(){
      var sg = S.sig || { foe:0, item:0, clue:0, any:0 }, T = Math.max(1, S.elapsed);
      return { foeSec:Math.round(sg.foe/1000), itemSec:Math.round(sg.item/1000), clueSec:Math.round(sg.clue/1000),
               anySec:Math.round(sg.any/1000), anyFrac:+(sg.any/T).toFixed(2) };
    })(),
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
    get prog(){ return PROG; },
    get running(){ return running; },
    get sit(){ return SIT; },
    get island(){ return ISLAND; },
    get input(){ return input; },
    alphaFor: alphaFor,
    loadIsland: function(n){ CUR_ISLAND = n; },
    islandCheck: function(from, to){
      var out = [];
      for(var n=from; n<=to; n++){
        var isl = n === 1 ? homeIsland() : genIsland(n);
        out.push({ n:n, rooms:Object.keys(isl.rooms).length, attempt:isl.attempt||0, fallback:!!isl.fallback,
                   secrets:isl.secrets.length, problems:islandProblems(isl) });
      }
      return out;
    },
    /* run the simulation without rendering — deterministic tests drive this */
    step: function(n){ for(var i=0; i<(n||1); i++) update(); },
    /* stop the live loop so step() is the only thing moving the world —
       otherwise gatherInput() overwrites whatever a test put in input */
    freeze: function(){ running = false; },
    nav: menuNav,
    tp: function(tx, ty, face){ G.p.x = tx*TS + TS/2; G.p.y = ty*TS + TS/2; G.p.vx = G.p.vy = 0; if(face) G.p.face = face; },
    room: function(key){ enterRoom(key, null); },
    grant: function(t){ PROG.tools[t] = true; G.tool = t; },
    audio: function(){ return { ctx: AC ? AC.state : null, failed: audioFailed, muted: cfg.mute,
                                master: TUNING.audio.master, effects: Object.keys(SFX).length }; },
    set: function(path, v){ setT(path, v); saveTuning(); rebuildDev(); },
    /* the arcade games and the rest of this round's additions */
    arcade: function(id, lv){ arcadeStart(id, lv); },
    /* step an arcade game without rendering, like step() does for the islands;
       edges (atk, toolPress, cycle) are consumed after each step */
    astep: function(n){
      for(var i=0; i<(n||1); i++){
        var M = GAMES[ARC.id]; if(!M) return;
        if(ARC.hit > 0) ARC.hit--;
        else {
          if(!ARC.won && !ARC.over) M.update(ARC.g); else if(M.idle) M.idle(ARC.g);
          input.atk = false; input.toolPress = false; input.cycle = false;
        }
        arcTick();
      }
    },
    get arc(){ return ARC; },
    busy: function(){ var M = GAMES[ARC.id]; return M && M.busy ? M.busy(ARC.g) : null; },
    arcadeEnd: arcadeEnd,
    raceCentre: function(d){ return rcCenter(ARC.g, d); },
    games: function(){ return hubList(); },
    get hub(){ return HUB; },
    get stair(){ return STAIR; },
    speech: speechStatus,
    say: sayLine,
    music: function(){ return { on:MUS.on, level:+MUS.level.toFixed(2), hold:MUS.hold }; },
    musicTick: musicTick,
    dungeonIntense: dungeonIntense,
    unlocked: islandUnlocked,
    get live(){ return LIVE; },
    start: menuStart,
    back: menuCancel,
    reset: resetTuning,
    redraw: function(){ render(); }
  };
}catch(e){}
