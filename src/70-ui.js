
/* ---------------- UI ---------------- */
function el(id){ return document.getElementById(id); }
var running = false, acc = 0, last = 0;

var MODE_HELP = {
  rebalance: 'Both eyes see the whole dungeon. The stronger eye just sees it fainter — the classic contrast-rebalancing arrangement. Safest starting point, and the one to use for a first session.',
  split: 'Enemies and their shots are drawn to the weaker eye only. Keys, hearts and door locks are drawn to the stronger eye only. Walls, floor and your own character go to both, so there is always something to fuse on. Neither eye can finish the dungeon alone — if you suppress one, half the game disappears. Strong-eye items are floored at 35% contrast so the dungeon stays winnable.'
};

function seg(id, get, set){
  var box = el(id);
  box.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    set(b.dataset.v); paintSeg(); saveCfg(); afterCfg();
  });
  box._paint = function(){
    Array.prototype.forEach.call(box.querySelectorAll('button'), function(b){
      b.setAttribute('aria-pressed', String(b.dataset.v === String(get())));
    });
  };
}
function paintSeg(){ ['segEye','segAdapt','segMode','segLens'].forEach(function(id){ var b=el(id); if(b._paint) b._paint(); }); }
seg('segEye',  function(){return cfg.weakEye;}, function(v){ cfg.weakEye=v; });
seg('segAdapt',function(){return cfg.adapt?'1':'0';}, function(v){ cfg.adapt = v==='1'; });
seg('segMode', function(){return cfg.mode;},   function(v){ cfg.mode=v; });

var LENS_PRESETS = TUNING.optics.presets;
seg('segLens', function(){return cfg.lens;}, function(v){
  cfg.lens = v;
  if(LENS_PRESETS[v]){ cfg.k1=LENS_PRESETS[v].k1; cfg.k2=LENS_PRESETS[v].k2; cfg.chroma=LENS_PRESETS[v].chroma; }
});
function toCustom(){ if(cfg.lens!=='custom'){ cfg.lens='custom'; paintSeg(); } }

function bindRange(id, lbl, get, set, fmt){
  var r = el(id); if(!r) return;
  r.addEventListener('input', function(){ set(+r.value); el(lbl).textContent = fmt(+r.value); saveCfg(); afterCfg(); });
}
bindRange('rngStrong','vStrong', null, function(v){ cfg.strong=v/100; logContrast(); }, function(v){ return v+'%'; });
bindRange('rngStrong2','vStrong2',null, function(v){ cfg.strong=v/100; logContrast(); }, function(v){ return v+'%'; });
bindRange('rngSep','vSep',   null, function(v){ cfg.sep=v; }, function(v){ return v+' px'; });
bindRange('rngSep2','vSep2', null, function(v){ cfg.sep=v; }, function(v){ return v+' px'; });
bindRange('rngZoom','vZoom', null, function(v){ cfg.zoom=v/100; }, function(v){ return v+'%'; });
bindRange('rngK1','vK1',      null, function(v){ cfg.k1=v; toCustom(); }, function(v){ return v.toFixed(2); });
bindRange('rngK2','vK2',      null, function(v){ cfg.k2=v; toCustom(); }, function(v){ return v.toFixed(2); });
bindRange('rngChroma','vChroma', null, function(v){ cfg.chroma=v; toCustom(); }, function(v){ return v.toFixed(3); });
bindRange('rngLensOff','vLensOff', null, function(v){ cfg.lensOff=v; }, function(v){ return v+' px'; });
[['barK1','bK1','k1',2],['barK2','bK2','k2',2],['barCh','bCh','chroma',3],['barOff','bOff','lensOff',0]].forEach(function(r){
  var inp = el(r[0]);
  inp.addEventListener('input', function(){
    cfg[r[2]] = +inp.value;
    if(r[2]!=='lensOff') toCustom();
    saveCfg(); syncSliders(); render();
  });
});

function syncSliders(){
  el('rngStrong').value = Math.round(cfg.strong*100); el('vStrong').textContent = Math.round(cfg.strong*100)+'%';
  el('rngStrong2').value = Math.round(cfg.strong*100); el('vStrong2').textContent = Math.round(cfg.strong*100)+'%';
  el('rngSep').value = cfg.sep; el('vSep').textContent = cfg.sep+' px';
  el('rngSep2').value = cfg.sep; el('vSep2').textContent = cfg.sep+' px';
  el('rngZoom').value = Math.round(cfg.zoom*100); el('vZoom').textContent = Math.round(cfg.zoom*100)+'%';
  el('modeHelp').textContent = MODE_HELP[cfg.mode];
  el('rngK1').value = cfg.k1; el('vK1').textContent = cfg.k1.toFixed(2);
  el('rngK2').value = cfg.k2; el('vK2').textContent = cfg.k2.toFixed(2);
  el('rngChroma').value = cfg.chroma; el('vChroma').textContent = cfg.chroma.toFixed(3);
  el('rngLensOff').value = cfg.lensOff; el('vLensOff').textContent = cfg.lensOff+' px';
  el('barK1').value = cfg.k1; el('bK1').textContent = cfg.k1.toFixed(2);
  el('barK2').value = cfg.k2; el('bK2').textContent = cfg.k2.toFixed(2);
  el('barCh').value = cfg.chroma; el('bCh').textContent = cfg.chroma.toFixed(3);
  el('barOff').value = cfg.lensOff; el('bOff').textContent = String(cfg.lensOff);
}
function afterCfg(){ syncSliders(); drawPreview(); if(!running) render(); }

/* ---- live calibration preview ---- */
function drawPreview(){
  var c = el('prev'); if(!c) return;
  var w = c.clientWidth || 300, h = 104, d = Math.min(devicePixelRatio||1,2);
  c.width = Math.round(w*d); c.height = Math.round(h*d);
  var x = c.getContext('2d'); x.setTransform(d,0,0,d,0,0);
  ['left','right'].forEach(function(eye){
    var vx = eye==='left'?0:w/2, vw = w/2;
    x.save(); x.beginPath(); x.rect(vx,0,vw,h); x.clip();
    x.fillStyle = C.floor; x.fillRect(vx,0,vw,h);
    x.fillStyle = C.floor2;
    for(var i=0;i<8;i++) for(var j=0;j<4;j++) if(((i+j)&1)===0) x.fillRect(vx+i*(vw/8), j*26, vw/8, 26);
    x.fillStyle = C.stone; x.fillRect(vx,0,vw,8); x.fillStyle=C.stoneTop; x.fillRect(vx,0,vw,3);
    var cx = vx+vw/2;
    /* player: both eyes */
    x.fillStyle = C.jadeDk; x.fillRect(cx-7, 52, 14, 16); x.fillStyle=C.jade; x.fillRect(cx-6,54,12,11);
    /* enemy: foe layer */
    var af = alphaFor(eye,'foe');
    if(af>0){ x.globalAlpha=af; x.fillStyle='#5d9257'; x.fillRect(cx-40, 54, 14, 12); x.fillStyle='#101a14'; x.fillRect(cx-36,57,3,3); x.fillRect(cx-31,57,3,3); x.globalAlpha=1; }
    /* key: item layer */
    var ai = alphaFor(eye,'item');
    if(ai>0){ x.globalAlpha=ai; x.fillStyle=C.gold; x.fillRect(cx+28,52,5,11); x.fillRect(cx+24,64,12,4); x.globalAlpha=1; }
    x.fillStyle = eye===cfg.weakEye ? '#4a7a63' : '#7a6740';
    x.font='400 9px "IBM Plex Mono", monospace'; x.textAlign='left'; x.textBaseline='bottom';
    x.fillText(eye===cfg.weakEye?'weak eye':'strong eye', vx+6, h-5);
    x.restore();
  });
  x.fillStyle='#000'; x.fillRect(w/2-1,0,2,h);
}

/* ---- panels ---- */
function show(id){ ['pTitle','pCheck','pPause','pDev'].forEach(function(p){ el(p).hidden = (p!==id); }); el('nonBar').hidden = true; el('lensBar').hidden = true; cfg.grid = false; }
function hideAll(){ ['pTitle','pCheck','pPause','pDev'].forEach(function(p){ el(p).hidden = true; }); el('nonBar').hidden = true; el('lensBar').hidden = true; }

el('btnStart').onclick  = function(){ show('pCheck'); el('checkResult').hidden = true; };
el('btnBackTitle').onclick = function(){ show('pTitle'); drawPreview(); };
el('btnCheckShow').onclick = function(){ hideAll(); nonius.on = true; el('nonBar').hidden = false; render(); };
el('btnEnter').onclick  = function(){ goImmersive(); keepAwake(); hideAll(); nonius.on=false; if(!G || S.ended) newGame(); running = true; last = performance.now(); requestAnimationFrame(loop); };
el('btnResume').onclick = function(){ keepAwake(); hideAll(); running = true; last = performance.now(); requestAnimationFrame(loop); };
el('btnRecheck').onclick= function(){ running=false; show('pCheck'); el('checkResult').hidden = true; };
el('btnQuit').onclick   = function(){ running=false; S.ended=true; letSleep(); show('pTitle'); drawPreview(); };
Array.prototype.forEach.call(document.querySelectorAll('#nonBar button'), function(b){
  b.onclick = function(){ noniusAnswer(+b.dataset.a); };
});
var gridFrom = 'pTitle';
el('btnGrid').onclick = function(){
  gridFrom = running ? 'resume' : (el('pPause').hidden ? 'pTitle' : 'pPause');
  running = false; hideAll(); cfg.grid = true; el('lensBar').hidden = false; syncSliders(); render();
};
el('btnGridDone').onclick = function(){
  cfg.grid = false; el('lensBar').hidden = true; saveCfg();
  if(gridFrom==='resume'){ running = true; last = performance.now(); requestAnimationFrame(loop); }
  else { show(gridFrom); drawPreview(); render(); }
};
var devFrom = 'pTitle';
function openDev(from){ devFrom = from; running=false; buildDevPanel(); syncJsonBox(); show('pDev'); }
el('btnDevTitle').onclick = function(){ openDev('pTitle'); };
el('btnDev').onclick      = function(){ openDev('pPause'); };
el('btnDevBack').onclick  = function(){ show(devFrom); drawPreview(); render(); };
el('btnRespawn').onclick  = function(){
  if(!G) return;
  rs(G.key).cleared = false; enterRoom(G.key, null); render();
  el('jsonNote').textContent = 'Room repopulated with the current sizes and hit points.';
};
el('btnResetTune').onclick = function(){
  resetTuning(); LENS_PRESETS = TUNING.optics.presets; rebuildDev(); syncSliders(); render();
  el('jsonNote').textContent = 'Back to shipped defaults.';
};
el('btnLoadJson').onclick = function(){
  try{
    var o = JSON.parse(el('tuneJson').value);
    (function merge(dst,src){ for(var k in src){
      if(src[k] && typeof src[k]==='object' && dst[k] && typeof dst[k]==='object') merge(dst[k],src[k]);
      else if(typeof src[k] === typeof dst[k]) dst[k]=src[k];
    }})(TUNING, o.tuning || o);
    saveTuning(); LENS_PRESETS = TUNING.optics.presets; rebuildDev(); syncSliders(); render();
    el('jsonNote').textContent = 'Loaded.';
  }catch(e){ el('jsonNote').textContent = 'That is not valid JSON: ' + e.message; }
};
el('btnCopyJson').onclick = function(){
  var b = el('tuneJson'); b.focus(); b.select();
  try{
    if(navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(b.value).then(function(){ el('jsonNote').textContent='Copied.'; },
                                                  function(){ el('jsonNote').textContent='Clipboard blocked — it is selected, copy by hand.'; });
    else el('jsonNote').textContent = 'Selected — copy by hand.';
  }catch(e){ el('jsonNote').textContent = 'Selected — copy by hand.'; }
};
el('btnCopyLog').onclick = copySession;
el('btnSaveLog').onclick = downloadSession;

/* --- keep the screen awake while playing --- */
var wakeLock = null;
function keepAwake(){
  try{
    if(!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function(w){
      wakeLock = w;
      w.addEventListener('release', function(){ wakeLock = null; });
    }, function(){});
  }catch(e){}
}
function letSleep(){ try{ if(wakeLock){ wakeLock.release(); wakeLock=null; } }catch(e){} }
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible' && running) keepAwake();
});

/* --- fullscreen + landscape, best effort, on a real gesture --- */
function goImmersive(){
  var d = document.documentElement;
  try{
    if(!document.fullscreenElement && d.requestFullscreen){
      d.requestFullscreen().then(function(){
        if(screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function(){});
      }).catch(function(){});
    } else if(screen.orientation && screen.orientation.lock){ screen.orientation.lock('landscape').catch(function(){}); }
  }catch(e){}
}

el('btnFull').onclick = function(){
  var d = document.documentElement;
  if(!document.fullscreenElement && d.requestFullscreen) d.requestFullscreen().then(function(){
    if(screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function(){});
  }).catch(function(){ el('btnFull').textContent = 'Fullscreen blocked here — open the saved file instead'; });
  else if(document.exitFullscreen) document.exitFullscreen();
};
el('btnTilt').onclick = function(){
  function go(){ tilt.on = true; tilt.base = null; cfg.tilt = true; saveCfg(); el('btnTilt').textContent = 'Head-tilt on — recentre'; addEventListener('deviceorientation', onTilt); }
  if(typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission){
    DeviceOrientationEvent.requestPermission().then(function(r){
      if(r==='granted') go(); else el('btnTilt').textContent = 'Motion access denied';
    }).catch(function(){ el('btnTilt').textContent = 'Motion access unavailable'; });
  } else if('DeviceOrientationEvent' in window){ go(); }
  else el('btnTilt').textContent = 'No motion sensor on this device';
};

/* ---- pause / results ---- */
function fmtTime(ms){ var s=Math.round(ms/1000); return Math.floor(s/60)+'m '+String(s%60).padStart(2,'0')+'s'; }
function doPause(){ running = false; fillStats('Paused','gloamhold'); show('pPause'); }
function endRun(){
  running = false; S.ended = true; S.won = !!(G && G.won);
  fillStats(S.won ? 'The warden falls' : 'You fell', S.won ? 'dungeon complete' : 'run ended');
  show('pPause');
}
function fillStats(title, sub){
  el('pauseTitle').textContent = title; el('pauseSub').textContent = sub;
  var lo = 1, hi = 0; S.trail.forEach(function(p){ lo=Math.min(lo,p.c); hi=Math.max(hi,p.c); });
  if(!S.trail.length){ lo=hi=cfg.strong; }
  var rows = [
    ['Time in the dungeon', fmtTime(S.elapsed)],
    ['Weaker eye', cfg.weakEye],
    ['Stronger-eye contrast now', Math.round(cfg.strong*100)+'%'],
    ['Best (lowest) this session', Math.round(lo*100)+'%'],
    ['Rooms entered', String(S.rooms)],
    ['Rooms cleared without a hit', String(S.cleanRooms)],
    ['Staircase steps down / up', S.stepsDown+' / '+S.stepsUp],
    ['Hits taken', String(S.hits)],
    ['Enemies felled', String(S.kills)],
    ['Alignment checks', String(S.checks.length)]
  ];
  el('statList').innerHTML = rows.map(function(r){ return '<dt>'+r[0]+'</dt><dd>'+r[1]+'</dd>'; }).join('');
  drawSpark();
  syncSliders();
}
function drawSpark(){
  var c = el('spark'), x = c.getContext('2d');
  var W = c.width, H = c.height;
  x.clearRect(0,0,W,H);
  var pts = S.trail.slice(); if(pts.length<2) pts = [{t:0,c:cfg.strong},{t:Math.max(S.elapsed,1000),c:cfg.strong}];
  var t0 = pts[0].t, t1 = Math.max(pts[pts.length-1].t, t0+1000);
  var padL=86, padR=24, padT=22, padB=46;
  var gx = function(t){ return padL + (t-t0)/(t1-t0)*(W-padL-padR); };
  var gy = function(v){ return padT + (1-v)*(H-padT-padB); };
  x.strokeStyle = '#1c2233'; x.lineWidth = 2;
  [0,0.25,0.5,0.75,1].forEach(function(v){
    x.beginPath(); x.moveTo(padL, gy(v)); x.lineTo(W-padR, gy(v)); x.stroke();
  });
  x.fillStyle = '#8e8a7e'; x.font = '400 22px "IBM Plex Mono", monospace';
  x.textAlign='right'; x.textBaseline='middle';
  [0,0.25,0.5,0.75,1].forEach(function(v){ x.fillText(Math.round(v*100)+'%', padL-12, gy(v)); });
  x.textAlign='left'; x.textBaseline='top';
  x.fillText('0m', padL, H-padB+12);
  x.textAlign='right'; x.fillText(fmtTime(t1-t0), W-padR, H-padB+12);
  x.strokeStyle = '#e8b13f'; x.lineWidth = 4; x.lineJoin='round';
  x.beginPath();
  pts.forEach(function(p,i){ var X=gx(p.t), Y=gy(p.c); if(i===0) x.moveTo(X,Y); else { x.lineTo(X, gy(pts[i-1].c)); x.lineTo(X,Y); } });
  x.stroke();
  var lastp = pts[pts.length-1];
  x.fillStyle = '#e8b13f'; x.beginPath(); x.arc(gx(lastp.t), gy(lastp.c), 7, 0, 6.2832); x.fill();
  S.checks.forEach(function(ck){
    x.fillStyle = ck.a===3 ? '#cf4a3e' : (ck.a===2 ? '#8f6bd6' : '#57bf92');
    x.fillRect(gx(Math.min(ck.t,t1))-3, padT-14, 6, 10);
  });
}

/* ---------------- loop ---------------- */
function loop(now){
  if(!running) return;
  var dt = Math.min(now-last, 120); last = now;
  S.elapsed += dt;
  acc += dt;
  var guard = 0;
  while(acc >= 16.667 && guard < 5){ gatherInput(); update(); acc -= 16.667; guard++; }
  if(acc > 100) acc = 0;
  if(toastT>0) toastT--;
  if(S.elapsed - (S.lastLog||0) > 15000){ S.lastLog = S.elapsed; logContrast(); }
  render();
  if((G.dead || G.won) && !G.endT){ G.endT = now; }
  requestAnimationFrame(loop);
}

/* ---------------- boot ---------------- */
function start(state){
  loadTuning();
  LENS_PRESETS = TUNING.optics.presets;
  el('buildStamp').textContent = 'Build ' + BUILD;
  el('buildStampPause').textContent = 'Build ' + BUILD;
  if(state && state.cfg){ for(var k in cfg) if(k in state.cfg) cfg[k]=state.cfg[k]; }
  var okGL = initGL();
  resize(); syncSliders(); paintSeg(); drawPreview();
  if(!okGL){
    cfg.lens = 'off'; paintSeg();
    Array.prototype.forEach.call(document.querySelectorAll('#segLens button, #rngK1, #rngK2, #rngChroma, #rngLensOff, #btnGrid'), function(n){ n.disabled = true; });
    el('lensNote').textContent = 'This browser has no WebGL, so lens correction is unavailable here. Everything else works \u2014 lines will just bow outward through the viewer.';
  }
  if(cfg.tilt && 'DeviceOrientationEvent' in window && !DeviceOrientationEvent.requestPermission){
    tilt.on = true; addEventListener('deviceorientation', onTilt);
  }
  newGame(); running = false; render();
  show('pTitle');
}
try{
  if(window.claude && window.claude.hot){
    window.claude.hot.snapshot(function(){ return { cfg:cfg }; });
    if(window.claude.hot.ready) window.claude.hot.ready(start); else start(window.claude.hot.data||{});
  } else start({});
}catch(e){ start({}); }
window.addEventListener('resize', function(){ drawPreview(); if(!running) render(); });
