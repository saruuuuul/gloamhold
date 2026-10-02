
/* ============================================================
   STEREO MENUS — every screen the player sees is drawn into the
   offscreen `scene` canvas, twice, once per eye viewport, so it
   goes through present() and picks up the lens warp exactly like
   the dungeon does. The HTML panels in 10-panels.html are now a
   flat-screen fallback for a grown-up at a desk (and the home of
   the auto-generated tuning panel); they are never what you look
   at through the viewer.

   Menu chrome is HUD-layer: identical in both eyes at full
   contrast. That is deliberate — the corner brackets and the row
   cursor are the same binocular fusion lock the in-game HUD uses,
   so putting the viewer on during a menu still gives both eyes a
   shared target to lock onto.

   eye-alpha: intentional — drawKidTarget() below drives one eye's
   sprite alpha directly from cfg.weakEye instead of through
   alphaFor(). That IS the measurement: the child's setup game
   finds the contrast at which the stronger eye stops detecting a
   target, so the target must be presented to that eye alone at a
   contrast the staircase chooses. Routing it through the layer
   system would present it to both eyes and measure nothing.
   ============================================================ */

var F_SANS = '"IBM Plex Sans", system-ui, sans-serif';
var F_MONO = '"IBM Plex Mono", ui-monospace, monospace';
var F_PIX  = 'Silkscreen, "Courier New", monospace';

var SCREENS = {};
var MENU = { id:null, idx:0, stack:[], t:0, msg:'', msgT:0, scroll:0 };

function menuOpen(){ return MENU.id !== null; }
function menuItems(){
  var s = SCREENS[MENU.id];
  return (s && s.items) ? s.items() : [];
}
function menuFocusable(it){ return it && it.k !== 'note'; }
function menuFirstIdx(items){
  for(var i=0;i<items.length;i++) if(menuFocusable(items[i])) return i;
  return 0;
}
function menuSay(s){ MENU.msg = s; MENU.msgT = 150; }

function openMenu(id, keepStack){
  if(!SCREENS[id]) return;
  if(!keepStack && MENU.id && MENU.id !== id) MENU.stack.push(MENU.id);
  MENU.id = id; MENU.t = 0; MENU.scroll = 0;
  var s = SCREENS[id];
  if(s.onOpen) s.onOpen();
  MENU.idx = menuFirstIdx(menuItems());
  running = false;
  hideAll();
  render();
}
function closeMenu(){ MENU.id = null; MENU.stack.length = 0; }
function menuCancel(){
  var s = SCREENS[MENU.id];
  if(s && s.cancel){ s.cancel(); return; }
  if(MENU.stack.length){ sfx('uiBack'); openMenu(MENU.stack.pop(), true); }
  else sfx('uiEdge');
}

/* ---------------- value editing ---------------- */
function afterMenuChange(){
  saveCfg(); syncSliders(); drawPreview(); render();
}
function menuAdjust(it, dx){
  var v = +( (it.get() + dx*it.step).toFixed(4) );
  v = Math.max(it.min, Math.min(it.max, v));
  if(Math.abs(v - it.get()) > 1e-9){ it.set(v); sfx('uiTick'); afterMenuChange(); }
  else sfx('uiEdge');
}
function menuCycle(it, dx){
  var cur = it.get(), i = 0, k;
  for(k=0;k<it.opts.length;k++) if(it.opts[k][0] === cur) i = k;
  i = (i + dx + it.opts.length) % it.opts.length;
  it.set(it.opts[i][0]); sfx('uiOk'); afterMenuChange();
}
function menuNav(dx, dy){
  var s = SCREENS[MENU.id];
  if(!s) return;
  if(s.nav){ s.nav(dx, dy); return; }
  var items = menuItems();
  if(!items.length) return;
  if(dy){
    var i = MENU.idx, guard = 0;
    do { i = (i + dy + items.length) % items.length; guard++; } while(!menuFocusable(items[i]) && guard <= items.length);
    if(i !== MENU.idx){ MENU.idx = i; sfx('uiMove'); render(); }
  }
  if(dx){
    var it = items[MENU.idx];
    if(!it) return;
    if(it.k === 'num') menuAdjust(it, dx);
    else if(it.k === 'seg') menuCycle(it, dx);
    else if(it.k === 'tog'){ it.set(!it.get()); sfx('uiOk'); afterMenuChange(); }
    else sfx('uiEdge');
  }
}
function menuConfirm(){
  var s = SCREENS[MENU.id];
  if(!s) return;
  if(s.confirm){ s.confirm(); return; }
  var it = menuItems()[MENU.idx];
  if(!it) return;
  if(it.k === 'act'){ sfx('uiOk'); it.run(); }
  else if(it.k === 'tog'){ it.set(!it.get()); sfx('uiOk'); afterMenuChange(); }
  else if(it.k === 'seg') menuCycle(it, 1);
  else if(it.k === 'num') menuAdjust(it, 1);
}

/* ---------------- drawing helpers ---------------- */
function menuSafe(vp0){
  var f = (cfg.lens === 'off' || !gl) ? TUNING.menu.safeInsetFlat : TUNING.menu.safeInsetLens;
  var ins = Math.round(Math.min(vp0.w, vp0.h) * f);
  return { x:vp0.x+ins, y:vp0.y+ins, w:vp0.w-ins*2, h:vp0.h-ins*2 };
}
function mtext(s, x, y, size, col, align, weight, fam){
  ctx.font = (weight||400) + ' ' + Math.max(7, Math.round(size)) + 'px ' + (fam || F_SANS);
  ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
function mwrap(s, maxW, size, fam, weight){
  ctx.font = (weight||400) + ' ' + Math.max(7, Math.round(size)) + 'px ' + (fam || F_SANS);
  var words = String(s).split(' '), lines = [], cur = '', i, t;
  for(i=0;i<words.length;i++){
    t = cur ? cur + ' ' + words[i] : words[i];
    if(ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = words[i]; }
    else cur = t;
  }
  if(cur) lines.push(cur);
  return lines;
}
function mparagraph(s, x, y, maxW, size, col, lead, align){
  var lines = mwrap(s, maxW, size), i;
  for(i=0;i<lines.length;i++) mtext(lines[i], x, y + i*size*(lead||1.45), size, col, align || 'left');
  return y + lines.length*size*(lead||1.45);
}
/* the fusion lock: identical corner brackets in both eyes, full contrast */
function drawMenuFrame(vp, u){
  ctx.strokeStyle = 'rgba(236,230,216,.30)'; ctx.lineWidth = Math.max(1.5, u*0.5);
  var m = u*1.2, L = u*8;
  [[vp.x+m, vp.y+m, 1, 1], [vp.x+vp.w-m, vp.y+m, -1, 1],
   [vp.x+m, vp.y+vp.h-m, 1, -1], [vp.x+vp.w-m, vp.y+vp.h-m, -1, -1]]
  .forEach(function(q){
    ctx.beginPath(); ctx.moveTo(q[0]+q[2]*L, q[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0], q[1]+q[3]*L); ctx.stroke();
  });
}

/* ---------------- icons (rect art, same language as the sprites) ---------------- */
function drawIcon(name, cx, cy, s, col){
  var p = s/6, i;
  function px(gx, gy, gw, gh, c){ ctx.fillStyle = c || col; ctx.fillRect(cx - s + gx*p, cy - s + gy*p, gw*p, gh*p); }
  ctx.fillStyle = col;
  if(name === 'play'){ for(i=0;i<5;i++) px(3, 2+i, 2 + (i<3?i:4-i)*1.4, 1); }
  else if(name === 'gear'){ px(2,2,8,8); px(0,4,12,4); px(4,0,4,12); ctx.fillStyle = C.void; ctx.fillRect(cx-p*1.6, cy-p*1.6, p*3.2, p*3.2); }
  else if(name === 'star'){ px(5,0,2,12); px(0,5,12,2); px(2,2,2,2); px(8,2,2,2); px(2,8,2,2); px(8,8,2,2); }
  else if(name === 'eye'){ px(1,4,10,4); px(3,2,6,2); px(3,8,6,2); ctx.fillStyle = C.void; ctx.fillRect(cx-p*1.5, cy-p*1.5, p*3, p*3); }
  else if(name === 'goggles'){ px(0,3,12,6); ctx.fillStyle = C.void; ctx.fillRect(cx-s+p*1.5, cy-s+p*4.5, p*3, p*3); ctx.fillRect(cx-s+p*7.5, cy-s+p*4.5, p*3, p*3); ctx.fillStyle = col; px(5,5,2,2); }
  else if(name === 'cross'){ px(5,1,2,10); px(1,5,10,2); }
  else if(name === 'grid'){ for(i=0;i<4;i++){ px(i*3+1, 1, 1, 10); px(1, i*3+1, 10, 1); } }
  else if(name === 'sound'){ px(1,4,3,4); px(4,2,2,8); px(8,4,1,4); px(10,2,1,8); }
  else if(name === 'mute'){ px(1,4,3,4); px(4,2,2,8); px(8,5,4,2); }
  else if(name === 'flat'){ px(1,2,10,8); ctx.fillStyle = C.void; ctx.fillRect(cx-s+p*2, cy-s+p*3, p*8, p*6); ctx.fillStyle = col; px(2,3,8,1); }
  else if(name === 'info'){ px(5,1,2,2); px(5,4,2,7); }
  else if(name === 'back'){ px(1,5,10,2); px(3,3,2,2); px(3,7,2,2); }
  else if(name === 'kid'){ px(4,0,4,4); px(3,5,6,4); px(1,5,2,2); px(9,5,2,2); px(3,10,2,2); px(7,10,2,2); }
  else if(name === 'sword'){ px(5,0,2,8); px(3,8,6,1); px(5,9,2,3); }
  else if(name === 'key'){ px(4,1,4,4); px(5,5,2,6); px(7,7,2,1); px(7,9,2,1); ctx.fillStyle = C.void; ctx.fillRect(cx-s+p*5, cy-s+p*2, p*2, p*2); }
  else if(name === 'flag'){ px(2,0,2,12); px(4,1,7,5); }
  else if(name === 'trophy'){ px(2,0,8,5); px(0,1,2,3); px(10,1,2,3); px(3,5,6,1); px(5,6,2,3); px(3,9,6,1); px(2,10,8,2); }
  else if(name === 'bar_v'){ px(5,0,2,12); }
  else if(name === 'bar_h'){ px(0,5,12,2); }
  else px(2,2,8,8);
}

/* ---------------- list screens ---------------- */
function menuValueText(it){
  if(it.k === 'seg'){
    var cur = it.get(), i;
    for(i=0;i<it.opts.length;i++) if(it.opts[i][0] === cur) return it.opts[i][1];
    return String(cur);
  }
  if(it.k === 'num') return it.fmt ? it.fmt(it.get()) : String(it.get());
  if(it.k === 'tog') return it.get() ? 'ON' : 'OFF';
  return '';
}
function drawMenuRow(it, x, y, w, h, u, focused){
  var M = TUNING.menu, pad = u*M.padX*0.5;
  if(focused){
    var pulse = 0.55 + 0.45*Math.abs(Math.sin(MENU.t*M.cursorPulse));
    ctx.fillStyle = 'rgba(232,177,63,0.12)';
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = C.gold; ctx.lineWidth = Math.max(1.5, u*M.cursorWidth);
    ctx.strokeRect(x + ctx.lineWidth/2, y + ctx.lineWidth/2, w - ctx.lineWidth, h - ctx.lineWidth);
    ctx.globalAlpha = 1;
  }
  var tx = x + pad;
  if(it.icon){
    drawIcon(it.icon, tx + u*M.iconSize/2, y + h/2, u*M.iconSize/2, focused ? C.gold : '#7d849c');
    tx += u*M.iconSize + pad*0.6;
  }
  var val = menuValueText(it);
  var labCol = it.k === 'note' ? '#8e8a7e' : (focused ? C.bone : '#c2bdaf');
  mtext(it.label, tx, y + h/2, u*TUNING.menu.labelSize, labCol, 'left', focused ? 600 : 400);
  if(val){
    var vx = x + w - pad;
    if(focused && (it.k === 'num' || it.k === 'seg')){
      mtext('›', vx, y + h/2, u*M.labelSize, C.gold, 'right', 600);
      vx -= u*M.labelSize*0.8;
    }
    mtext(val, vx, y + h/2, u*M.labelSize*0.92, focused ? C.gold : '#9aa0b4', 'right', 500, F_MONO);
    if(focused && (it.k === 'num' || it.k === 'seg')){
      ctx.font = (600) + ' ' + Math.round(u*M.labelSize) + 'px ' + F_SANS;
      mtext('‹', vx - ctx.measureText(val).width - u*0.8, y + h/2, u*M.labelSize, C.gold, 'right', 600);
    }
  }
}
function drawMenuList(s, vp, u){
  var items = menuItems(), M = TUNING.menu;
  var y = vp.y + u*6;
  mtext(s.title, vp.x + vp.w/2, y, u*M.titleSize, C.gold, 'center', 700, F_PIX);
  y += u*M.titleSize*0.75;
  if(s.sub){ mtext(s.sub, vp.x + vp.w/2, y, u*M.hintSize, '#8e8a7e', 'center', 400, F_MONO); y += u*4; }

  var footH = u*9;
  var listTop = y + u*2.5;
  var listBot = vp.y + vp.h - footH;
  var rowH = u*M.rowHeight, gap = u*M.rowGap;
  var fit = Math.max(2, Math.floor((listBot - listTop + gap) / (rowH + gap)));
  var maxShow = Math.min(fit, M.maxRows, items.length);

  if(MENU.idx < MENU.scroll) MENU.scroll = MENU.idx;
  if(MENU.idx >= MENU.scroll + maxShow) MENU.scroll = MENU.idx - maxShow + 1;
  MENU.scroll = Math.max(0, Math.min(MENU.scroll, Math.max(0, items.length - maxShow)));

  var i, ry = listTop;
  for(i = MENU.scroll; i < Math.min(items.length, MENU.scroll + maxShow); i++){
    drawMenuRow(items[i], vp.x + u*2, ry, vp.w - u*4, rowH, u, i === MENU.idx);
    ry += rowH + gap;
  }
  if(items.length > maxShow){
    var frac = MENU.scroll / Math.max(1, items.length - maxShow);
    var trackH = ry - listTop - gap;
    ctx.fillStyle = '#1c2233';
    ctx.fillRect(vp.x + vp.w - u*1.4, listTop, u*0.6, trackH);
    ctx.fillStyle = C.gold;
    ctx.fillRect(vp.x + vp.w - u*1.4, listTop + frac*(trackH - trackH*maxShow/items.length), u*0.6, trackH*maxShow/items.length);
  }
  drawMenuFoot(s, vp, u);
}
function drawMenuFoot(s, vp, u){
  var fy = vp.y + vp.h - u*4.5;
  if(MENU.msgT > 0){
    mtext(MENU.msg, vp.x + vp.w/2, fy - u*4.5, u*TUNING.menu.hintSize, C.jade, 'center', 500);
  }
  var hint = s.hint || 'A pick  ·  B back  ·  Start play';
  mtext(hint, vp.x + vp.w/2, fy, u*TUNING.menu.hintSize, '#6a718c', 'center', 400, F_MONO);
}

/* Shown in place of everything while the device is upright. Not stereo on
   purpose: there is nothing useful to fuse until the phone is turned. */
function drawRotatePrompt(){
  var u = Math.min(VW, VH)/100, cx = VW/2, cy = VH/2;
  ctx.save();
  ctx.fillStyle = C.void; ctx.fillRect(0, 0, VW, VH);
  ctx.strokeStyle = C.gold; ctx.lineWidth = Math.max(2, u*1.2);
  ctx.strokeRect(cx - u*22, cy - u*13, u*44, u*26);
  ctx.strokeStyle = '#3c4d78';
  ctx.strokeRect(cx - u*13, cy - u*22, u*26, u*44);
  drawIcon('back', cx, cy, u*7, C.gold);
  mtext('TURN THE PHONE', cx, cy + u*32, u*6, C.gold, 'center', 700, F_PIX);
  mtext('sideways, then into the viewer', cx, cy + u*39, u*3.4, '#8e8a7e', 'center', 400, F_MONO);
  ctx.restore();
}

/* ---------------- one-big-button screens ----------------
   Everything the child ever has to act on uses this. The button is anchored
   to the BOTTOM of the safe area and drawn last, so no amount of content
   above it can push it off screen — which is exactly what the old stats-table
   summary did once the lens inset took 13% off each edge, leaving a screen
   with nothing on it to aim a cursor at. */
function drawBigButton(vp, u, label, focused){
  var w = Math.min(vp.w*0.78, u*62), h = u*13;
  var x = vp.x + (vp.w - w)/2, y = vp.y + vp.h - h - u*8;
  var pulse = 0.55 + 0.45*Math.abs(Math.sin(MENU.t*TUNING.menu.cursorPulse));
  ctx.fillStyle = 'rgba(232,177,63,0.16)';
  ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = focused ? pulse : 0.45;
  ctx.strokeStyle = C.gold; ctx.lineWidth = Math.max(2, u*1.1);
  ctx.strokeRect(x + ctx.lineWidth/2, y + ctx.lineWidth/2, w - ctx.lineWidth, h - ctx.lineWidth);
  ctx.globalAlpha = 1;
  drawIcon('play', x + u*7, y + h/2, u*3.4, C.gold);
  mtext(label, x + w/2 + u*3, y + h/2, u*5.8, C.bone, 'center', 700);
}
function drawSimpleScreen(vp, u, o){
  var cx = vp.x + vp.w/2;
  mtext(o.title, cx, vp.y + u*9, u*8, o.titleCol || C.gold, 'center', 700, F_PIX);
  if(o.deco) o.deco(cx, vp.y + vp.h*0.38, u);
  else if(o.icon) drawIcon(o.icon, cx, vp.y + vp.h*0.38, u*11, o.iconCol || C.jade);
  if(o.big) mtext(o.big, cx, vp.y + vp.h*0.60, u*7, C.jade, 'center', 700, F_PIX);
  if(o.sub) mtext(o.sub, cx, vp.y + vp.h*0.69, u*3.2, '#8e8a7e', 'center', 400, F_MONO);
  drawBigButton(vp, u, o.button, true);
  drawMenuFoot({ hint: o.foot }, vp, u);
}

/* ---------------- the per-eye entry point ---------------- */
function drawMenuEye(eye){
  var vp0 = viewportFor(eye), vp = menuSafe(vp0), u = Math.min(vp.w, vp.h)/100;
  var s = SCREENS[MENU.id];
  ctx.save();
  ctx.beginPath(); ctx.rect(vp0.x, vp0.y, vp0.w, vp0.h); ctx.clip();
  ctx.fillStyle = C.void; ctx.fillRect(vp0.x, vp0.y, vp0.w, vp0.h);
  if(s){
    drawMenuFrame(vp, u);
    if(s.custom) s.custom(eye, vp, u);
    else drawMenuList(s, vp, u);
  }
  ctx.restore();
}
function menuTick(){
  MENU.t++;
  if(MENU.msgT > 0) MENU.msgT--;
  var s = SCREENS[MENU.id];
  if(s && s.tick) s.tick();
}

/* ============================================================
   SCREENS
   ============================================================ */
function pct(v){ return Math.round(v*100) + '%'; }

/* SCREENS.title — the game picker — lives in 58-hub.js. Everything that was
   on the old title list is on the grown-up screen below. */

/* Under a locked study protocol the settings the protocol fixes are shown,
   not offered: a parent adjusting contrast mid-study makes the data
   meaningless. Comfort settings (lens, separation, sound) stay adjustable. */
function lockRow(it){
  if(!cfg.locked || !it.study) return it;
  return { k:'note', icon:it.icon, label:it.label + ': ' + (menuValueText(it) || '') + ' (locked)' };
}
SCREENS.adult = {
  title: 'GROWN-UP',
  get sub(){ return cfg.locked ? 'study protocol ' + cfg.protocol + ' · locked' : 'the real controls'; },
  items: function(){
    return [
      { k:'seg', icon:'eye', label:'Weaker (amblyopic) eye', opts:[['left','Left'],['right','Right']], study:true,
        get:function(){ return cfg.weakEye; }, set:function(v){ cfg.weakEye = v; } },
      { k:'num', icon:'bar_h', label:'Stronger-eye contrast', min:0.05, max:1, step:0.05, study:true,
        get:function(){ return cfg.strong; }, set:function(v){ cfg.strong = v; logContrast(); }, fmt:pct },
      { k:'seg', icon:'bar_h', label:'Contrast means', opts:[['alpha','Blend alpha'],['luminance','Luminance (est.)']], study:true,
        get:function(){ return cfg.contrastScale; }, set:function(v){ cfg.contrastScale = v; logContrast(); } },
      { k:'seg', icon:'cross', label:'Mode', opts:[['rebalance','Rebalance'],['split','Forced fusion']], study:true,
        get:function(){ return cfg.mode; }, set:function(v){ cfg.mode = v; } },
      { k:'tog', icon:'star', label:'Adaptive staircase', study:true, get:function(){ return cfg.adapt; }, set:function(v){ cfg.adapt = v; } },
      { k:'num', icon:'goggles', label:'Eye separation', min:-60, max:60, step:2,
        get:function(){ return cfg.sep; }, set:function(v){ cfg.sep = v; }, fmt:function(v){ return v + ' px'; } },
      { k:'num', icon:'grid', label:'Image scale', min:0.6, max:1.4, step:0.05,
        get:function(){ return cfg.zoom; }, set:function(v){ cfg.zoom = v; }, fmt:pct },
      { k:'seg', icon:'grid', label:'Lens preset', opts:[['off','Off'],['cardboard','Cardboard'],['strong','Strong'],['custom','Custom']],
        get:function(){ return cfg.lens; }, set:function(v){ cfg.lens = v; if(LENS_PRESETS[v]){ cfg.k1=LENS_PRESETS[v].k1; cfg.k2=LENS_PRESETS[v].k2; cfg.chroma=LENS_PRESETS[v].chroma; } paintSeg(); } },
      { k:'act', icon:'grid', label:'Calibrate against a grid', run:function(){ openMenu('lensgrid'); } },
      { k:'act', icon:'cross', label:'Alignment check', run:function(){ startNonius(); } },
      { k:'tog', icon:'kid', label:'Child mode', study:true, get:function(){ return cfg.kidMode; }, set:function(v){ cfg.kidMode = v; } },
      { k:'tog', icon:'flag', label:'All islands open', get:function(){ return cfg.allIslands; }, set:function(v){ cfg.allIslands = v; } },
      { k:'num', icon:'flag', label:'Session length', min:0, max:45, step:1, study:true,
        get:function(){ return TUNING.session.minutes; },
        set:function(v){ TUNING.session.minutes = v; saveTuning(); },
        fmt:function(v){ return v ? v + ' min' : 'no limit'; } },
      { k:'act', icon:'star', label:'Easy setup (butterfly)', study:true, run:function(){ openMenu('kidIntro'); } },
      { k:'tog', icon: cfg.mute ? 'mute' : 'sound', label:'Sound', get:function(){ return !cfg.mute; }, set:function(v){ cfg.mute = !v; if(v){ audioUnlock(); sfx('uiOk'); } else musicStop(); } },
      { k:'tog', icon:'sound', label:'Music in intense moments', get:function(){ return cfg.music; }, set:function(v){ cfg.music = v; if(!v) musicStop(); } },
      { k:'seg', icon:'sound', label:'Spoken prompts', opts:[['mn','Mongolian (else English)'],['en','English'],['off','Off']],
        get:function(){ return cfg.speakLang; }, set:function(v){ cfg.speakLang = v; if(v!=='off') say('voice_test'); } },
      { k:'act', icon:'info', label:'Test the voice', run:function(){ speechPrime(); say('voice_test'); menuSay('speech: ' + speechStatus()); } },
      { k:'act', icon:'star', label:'My stars', run:function(){ openMenu('stars'); } },
      { k:'act', icon:'flag', label:'This run in numbers', run:function(){ openMenu('report'); } },
      { k:'act', icon:'info', label:'What the easy setup measured', run:function(){ openMenu('measured'); } },
      { k:'act', icon:'flat', label:'Advanced tuning (flat panel)', study:true, run:function(){ openDevStereo('adult'); } },
      { k:'note', icon:'info', label:'Study: ' + (cfg.participant || '—') + ' · ' + studyRunCount() + ' runs saved on this phone' },
      { k:'act', icon:'flat', label:'Flat menus (no viewer)', run:function(){ goFlat(); } },
      { k:'act', icon:'info', label:'Not a medical device', run:function(){ openMenu('safety'); } },
      { k:'act', icon:'back', label:'Back', run:function(){ menuCancel(); } }
    ].map(lockRow).filter(function(it){ return !(cfg.locked && it.k === 'note' && /^(Easy setup|Advanced tuning)/.test(it.label)); });
  }
};

SCREENS.safety = {
  title: 'READ THIS',
  custom: function(eye, vp, u){
    var y = vp.y + u*7;
    mtext('NOT A MEDICAL DEVICE', vp.x + vp.w/2, y, u*6, C.blood, 'center', 700, F_PIX);
    y += u*8;
    y = mparagraph('This is a hobby build, not a treatment. Dichoptic training for amblyopia is an active research area with mixed results, and it belongs under an optometrist or ophthalmologist who has measured acuity, stereoacuity and suppression.',
      vp.x + u*4, y, vp.w - u*8, u*3.7, '#c9c4b6', 1.5);
    y += u*3;
    y = mparagraph('Stop if you get headache, nausea, eye strain or double vision that persists after the viewer comes off. Children in particular should only do this on a clinician’s instruction, since the alternatives they might be skipping have real evidence behind them.',
      vp.x + u*4, y, vp.w - u*8, u*3.7, '#c9c4b6', 1.5);
    y += u*3;
    mparagraph('Cardboard-style viewers are built for an adult eye spacing. On a small child the lens centres may not sit over the pupils, which adds strain and works against fusion. Measure before you rely on this.',
      vp.x + u*4, y, vp.w - u*8, u*3.7, '#8e8a7e', 1.5);
    mtext('Free software (GNU AGPL v3+) · source: github.com/saruuuuul/gloamhold', vp.x + vp.w/2, vp.y + vp.h - u*12.5, u*2.8, '#5a6076', 'center', 400, F_MONO);
    mtext('Built with generative AI (Claude). ' + BUILD, vp.x + vp.w/2, vp.y + vp.h - u*9, u*2.8, '#5a6076', 'center', 400, F_MONO);
    drawMenuFoot({ hint:'B back' }, vp, u);
  },
  nav: function(){},
  confirm: function(){ menuCancel(); }
};

SCREENS.measured = {
  title: 'EASY SETUP',
  sub: 'what the number came from',
  custom: function(eye, vp, u){
    var y = vp.y + u*11;
    y = mparagraph('The easy setup shows a target to the stronger eye only, dimmer each round, and records the faintest one the player still catches. The starting contrast is that value backed off one step.',
      vp.x + u*4, y, vp.w - u*8, u*3.7, '#c9c4b6', 1.5);
    y += u*3;
    y = mparagraph('That is a detection threshold from a game, not a clinical measurement, and a tired or distracted player will read lower than they really are. Treat it as a starting point and watch the alignment check.',
      vp.x + u*4, y, vp.w - u*8, u*3.7, '#8e8a7e', 1.5);
    y += u*4;
    mtext('last easy-setup result', vp.x + vp.w/2, y, u*3, '#6a718c', 'center', 400, F_MONO);
    y += u*6;
    mtext(cfg.kidSet ? pct(cfg.strong) : 'not run yet', vp.x + vp.w/2, y, u*9, C.gold, 'center', 700, F_PIX);
    drawMenuFoot({ hint:'B back' }, vp, u);
  },
  nav: function(){},
  confirm: function(){ menuCancel(); }
};

/* ---------------- pause / summary ---------------- */
function statRows(){
  var lo = 1;
  S.trail.forEach(function(p){ lo = Math.min(lo, p.c); });
  if(!S.trail.length) lo = cfg.strong;
  return [
    ['island', ISLAND ? ISLAND.name : '\u2014'],
    ['coins / secrets', S.coins + ' / ' + S.secrets],
    ['knockdowns', String(S.knockdowns || 0)],
    ['time', fmtTime(S.elapsed)],
    ['rooms entered', String(S.rooms)],
    ['clean rooms', String(S.cleanRooms)],
    ['hits taken', String(S.hits)],
    ['strong eye now', pct(cfg.strong)],
    ['best this run', pct(lo)],
    ['steps down / up', S.stepsDown + ' / ' + S.stepsUp]
  ];
}
function drawStatBlock(vp, u, y){
  var rows = statRows(), i, ry = y;
  for(i=0;i<rows.length;i++){
    mtext(rows[i][0], vp.x + u*5, ry, u*3.4, '#8e8a7e', 'left', 400, F_MONO);
    mtext(rows[i][1], vp.x + vp.w - u*5, ry, u*3.4, '#ded9cb', 'right', 500, F_MONO);
    ry += u*4.6;
  }
  return ry;
}

SCREENS.pause = {
  title: 'PAUSED',
  get sub(){
    if(ARC.id && GAMES[ARC.id]) return GAMES[ARC.id].name.toLowerCase() + ' · level ' + S.level;
    return ISLAND ? ISLAND.name.toLowerCase() : 'gloamhold';
  },
  hint: 'A pick · B resume · Start resume',
  items: function(){
    var out = [
      { k:'act', icon:'play',  label:'Keep playing',      run:function(){ resumeRun(); } },
      { k:'act', icon:'star',  label:'Back to the games', run:function(){ leaveToHub(); } }
    ];
    if(!ARC.id) out.push({ k:'act', icon:'back', label:'Back to the sea', run:function(){ archiveRun('left'); running = false; S.ended = true; LIVE = false; closeMenu(); openMenu('map'); } });
    out.push({ k:'act', icon:'cross', label:'Alignment check', run:function(){ startNonius(); } });
    out.push({ k:'act', icon:'gear',  label:'Grown-up setup',  run:function(){ openMenu('adult'); } });
    return out;
  },
  cancel: function(){ resumeRun(); }
};

/* One result, one button. The numbers a grown-up wants live on SCREENS.report;
   putting them here meant a child met a seven-row table on the worst screen in
   the game, and behind the lens inset the buttons fell off the bottom edge. */
function nextIsland(){
  var n = (ISLAND ? ISLAND.id : 1) + 1;
  return n <= ISLAND_COUNT ? n : 0;
}
SCREENS.summary = {
  title: 'RUN OVER',
  onOpen: function(){ awardSession(); say(S.won ? (nextIsland() ? 'next_island' : 'ready') : 'again'); },
  nav: function(){},
  /* A light found is not the end: the boat sails straight on to the next
     island, which finding this light has just opened. It used to drop him on
     the map with nothing moving, which read as "the game is over". */
  confirm: function(){
    sfx('uiOk'); S.ended = true; LIVE = false;
    if(S.won){ MAP.autoTo = nextIsland(); closeMenu(); openMenu('map'); } else startRun();
  },
  start: function(){ SCREENS.summary.confirm(); },
  cancel: function(){ closeMenu(); openMenu('title'); },
  custom: function(eye, vp, u){
    drawSimpleScreen(vp, u, {
      title: S.won ? 'LIGHT FOUND!' : 'GOOD TRY!',
      titleCol: S.won ? C.gold : C.jade,
      deco: function(cx, cy, uu){
        var i;
        for(i=0;i<5;i++){
          var a = MENU.t*0.028 + i*1.257, rr = uu*19 + Math.sin(MENU.t*0.05 + i)*uu*2;
          ctx.globalAlpha = 0.45 + 0.55*Math.abs(Math.sin(MENU.t*0.04 + i));
          drawIcon('star', cx + Math.cos(a)*rr, cy + Math.sin(a)*rr*0.62, uu*2.4, C.gold);
          ctx.globalAlpha = 1;
        }
        if(S.won) drawItem({ type:'orb', x:cx, y:cy, bob:0 });
        else drawIcon('sword', cx, cy, uu*10, C.jade);
      },
      big: '+' + S.starsGained + ' stars',
      sub: PROG.stars + ' stars  ·  ' + PROG.streak + ' day streak',
      button: S.won ? (nextIsland() ? 'NEXT ISLAND' : 'THE SEA') : 'TRY AGAIN',
      foot: S.won ? 'A sail on · B games' : 'A try again · B games'
    });
  }
};

/* Where the seven rows went: a grown-up screen, not the end of a child's run. */
SCREENS.report = {
  title: 'THIS RUN',
  nav: function(){},
  confirm: function(){ menuCancel(); },
  custom: function(eye, vp, u){
    mtext('THIS RUN', vp.x + vp.w/2, vp.y + u*8, u*7, C.gold, 'center', 700, F_PIX);
    drawStatBlock(vp, u, vp.y + u*16);
    mtext(PROG.stars + ' stars · ' + PROG.sessions + ' sessions · ' + PROG.streak + ' day streak',
          vp.x + vp.w/2, vp.y + vp.h - u*12, u*3, '#6a718c', 'center', 400, F_MONO);
    drawMenuFoot({ hint:'B back' }, vp, u);
  }
};

/* ---------------- lens grid, in stereo ---------------- */
SCREENS.lensgrid = {
  title: 'LENS',
  onOpen: function(){ if(cfg.lens === 'off' && gl){ cfg.lens = 'cardboard'; cfg.k1 = LENS_PRESETS.cardboard.k1; cfg.k2 = LENS_PRESETS.cardboard.k2; cfg.chroma = LENS_PRESETS.cardboard.chroma; paintSeg(); saveCfg(); } },
  items: function(){
    return [
      { k:'num', label:'barrel k1', min:0, max:0.6, step:0.01, get:function(){ return cfg.k1; }, set:function(v){ cfg.k1 = v; toCustom(); }, fmt:function(v){ return v.toFixed(2); } },
      { k:'num', label:'barrel k2', min:0, max:0.6, step:0.01, get:function(){ return cfg.k2; }, set:function(v){ cfg.k2 = v; toCustom(); }, fmt:function(v){ return v.toFixed(2); } },
      { k:'num', label:'colour fringe', min:0, max:0.012, step:0.001, get:function(){ return cfg.chroma; }, set:function(v){ cfg.chroma = v; toCustom(); }, fmt:function(v){ return v.toFixed(3); } },
      { k:'num', label:'lens centre', min:-60, max:60, step:2, get:function(){ return cfg.lensOff; }, set:function(v){ cfg.lensOff = v; }, fmt:function(v){ return v + ' px'; } },
      { k:'act', icon:'back', label:'Done', run:function(){ menuCancel(); } }
    ];
  },
  custom: function(eye, vp, u){
    drawGrid(eye);
    var items = menuItems(), i, rowH = u*7.5;
    var y = vp.y + vp.h - (items.length*(rowH + u*1) ) - u*6;
    ctx.fillStyle = 'rgba(7,9,13,.86)';
    ctx.fillRect(vp.x, y - u*5, vp.w, items.length*(rowH + u*1) + u*10);
    mtext('raise k1 until the lines look straight', vp.x + vp.w/2, y - u*2, u*3, '#8e8a7e', 'center', 400, F_MONO);
    for(i=0;i<items.length;i++){
      drawMenuRow(items[i], vp.x + u*2, y, vp.w - u*4, rowH, u, i === MENU.idx);
      y += rowH + u*1;
    }
  }
};

/* ============================================================
   THE CHILD SETUP WIZARD
   Three steps, no reading required: put the goggles on, catch the
   thing, say how many sticks. Everything is a big picture and one
   button. The one decision that is genuinely clinical — which eye
   is the weaker one — is NOT asked here; it comes from the
   grown-up screen, because a five-year-old cannot answer it and
   guessing it wrong trains the wrong eye.
   ============================================================ */
var HUNT = null;

SCREENS.kidIntro = {
  title: 'READY?',
  onOpen: function(){ say('goggles'); },
  start: function(){ sfx('uiOk'); openMenu('kidHunt'); },
  custom: function(eye, vp, u){
    drawSimpleScreen(vp, u, {
      title: 'READY?',
      icon: 'goggles',
      big: 'GOGGLES ON',
      button: 'GO',
      foot: 'A go · B back'
    });
  },
  nav: function(){},
  confirm: function(){ sfx('uiOk'); openMenu('kidHunt'); }
};

function huntStart(){
  var K = TUNING.kid;
  HUNT = { round:0, c:K.huntStartContrast, best:0, shown:false, blank:false, hold:0, wait:0,
           misses:0, hits:0, fa:0, blanks:0, fb:0, fbGood:false,
           pos:{x:0.5,y:0.45}, done:false, unreliable:false, realDone:false };
  huntArm();
  say('hunt');
}
/* The real rounds are over (enough catches, the floor reached, or two
   misses) — but the run only ends once every catch trial has been shown.
   It used to end on the last real catch, and when the dice had put the
   blanks late, a masher met only one of them and was waved through. */
function huntRealOver(){
  var K = TUNING.kid;
  HUNT.realDone = true;
  if(HUNT.blanks >= K.catchTrials) huntFinish();
  else huntArm();
}
function huntNext(){
  if(HUNT.realDone && HUNT.blanks >= TUNING.kid.catchTrials) huntFinish();
  else huntArm();
}
function huntArm(){
  var K = TUNING.kid;
  HUNT.shown = false;
  /* A catch trial opens the same window but presents nothing. Without these
     the staircase cannot tell a threshold from a child mashing the button:
     a masher "catches" every round and always lands on whatever the last
     scheduled contrast happened to be.
     Exactly K.catchTrials of them are interleaved, spread by weighting
     against the real rounds still to come; any not yet shown when the real
     rounds end are shown before the run finishes (huntRealOver). */
  var realLeft  = HUNT.realDone ? 0 : Math.max(0, K.huntRounds - HUNT.round);
  var blankLeft = Math.max(0, K.catchTrials - HUNT.blanks);
  HUNT.blank = blankLeft > 0 && (realLeft === 0 || Math.random() < blankLeft / (blankLeft + realLeft));
  if(HUNT.blank) HUNT.blanks++;
  HUNT.wait = K.waitMinFrames + ((Math.random()*K.waitVarFrames)|0);
  HUNT.pos = { x: 0.25 + Math.random()*0.5, y: 0.3 + Math.random()*0.35 };
}
function huntTick(){
  var K = TUNING.kid;
  if(!HUNT || HUNT.done) return;
  if(HUNT.fb > 0) HUNT.fb--;
  if(!HUNT.shown){
    if(--HUNT.wait <= 0){
      HUNT.shown = true; HUNT.hold = K.targetHoldFrames;
      if(!HUNT.blank) sfx('target');
    }
    return;
  }
  if(--HUNT.hold <= 0){
    if(HUNT.blank){ huntNext(); return; }   /* letting a blank pass is the right answer */
    huntMiss();
  }
}
function huntFalseAlarm(){
  var K = TUNING.kid;
  HUNT.fa++; HUNT.fb = K.feedbackFrames; HUNT.fbGood = false; sfx('oops');
}
function huntPress(){
  var K = TUNING.kid;
  if(!HUNT || HUNT.done) return;
  if(!HUNT.shown){ huntFalseAlarm(); return; }          /* pressed before anything opened */
  if(HUNT.blank){ huntFalseAlarm(); huntNext(); return; } /* pressed at nothing */
  HUNT.hits++; HUNT.best = HUNT.c;
  HUNT.fb = K.feedbackFrames; HUNT.fbGood = true; sfx('star'); say('good');
  HUNT.round++;
  if(HUNT.round >= K.huntRounds || HUNT.c <= K.huntFloor + 1e-6){ huntRealOver(); return; }
  HUNT.c = Math.max(K.huntFloor, HUNT.c * K.huntStepFactor);
  huntArm();
}
function huntMiss(){
  var K = TUNING.kid;
  HUNT.misses++; HUNT.fb = K.feedbackFrames; HUNT.fbGood = false; sfx('oops');
  if(HUNT.misses >= K.huntMissesToStop){ huntRealOver(); return; }
  HUNT.c = Math.min(1, HUNT.c / K.huntStepFactor);
  huntArm();
}
function huntFinish(){
  var K = TUNING.kid, th = TUNING.therapy, q = th.quantise;
  HUNT.done = true;
  /* Too many presses at nothing, or nothing caught at all, and there is no
     threshold in here — only a number that would look like one. Report that
     rather than writing it into cfg.strong. */
  if(HUNT.fa >= K.falseAlarmLimit || HUNT.best <= 0){
    HUNT.unreliable = true;
    sfx('oops');
    openMenu('kidRetry', true);
    return;
  }
  /* back off one step from the faintest catch — a threshold you only just
     reached in a game is not one to start a session at */
  if(cfg.locked){ sfx('fanfare'); openMenu('kidSticks', true); return; }
  var base = HUNT.best / (K.huntStepFactor * K.safetyBackoff);
  var v = Math.max(th.minContrast, Math.min(1, Math.round(base/q)*q));
  cfg.strong = v; cfg.kidSet = true;
  saveCfg(); syncSliders(); logContrast();
  sfx('fanfare');
  openMenu('kidSticks', true);
}

SCREENS.kidHunt = {
  title: 'CATCH IT',
  onOpen: huntStart,
  tick: huntTick,
  nav: function(){},
  confirm: function(){ huntPress(); },
  custom: function(eye, vp, u){
    var K = TUNING.kid, cx = vp.x + vp.w/2;
    /* floor fill first: every target is composited on top of it, so alpha is
       contrast against a known background, exactly as in the dungeon */
    ctx.fillStyle = C.floor;
    ctx.fillRect(vp.x, vp.y + u*16, vp.w, vp.h - u*30);
    mtext('CATCH IT!', cx, vp.y + u*7, u*7.5, C.gold, 'center', 700, F_PIX);
    mtext('press when you see the butterfly', cx, vp.y + u*13, u*3.3, '#8e8a7e', 'center', 400, F_MONO);
    if(HUNT) drawKidTarget(eye, vp, u);
    /* progress pips, both eyes, full contrast */
    var i, n = K.huntRounds, px0 = cx - (n*u*3)/2;
    for(i=0;i<n;i++){
      ctx.fillStyle = (HUNT && i < HUNT.round) ? C.gold : '#2a3348';
      ctx.fillRect(px0 + i*u*3, vp.y + vp.h - u*11, u*2, u*2);
    }
    drawMenuFoot({ hint:'A catch · B stop' }, vp, u);
  }
};

/* eye-alpha: intentional — see the file header. The target is presented to
   the stronger eye alone at the staircase's current contrast; that IS the
   measurement, and alphaFor() would show it to both eyes. */
function drawKidTarget(eye, vp, u){
  var strongEye = (cfg.weakEye === 'left') ? 'right' : 'left';
  var fx = vp.x + vp.w*HUNT.pos.x, fy = vp.y + u*16 + (vp.h - u*30)*HUNT.pos.y;
  if(HUNT.fb > 0){
    var k = HUNT.fb / TUNING.kid.feedbackFrames;
    if(HUNT.fbGood){
      ctx.globalAlpha = k;
      drawIcon('star', vp.x + vp.w/2, vp.y + vp.h*0.5, u*10*(1.4 - k*0.4), C.jade);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = k*0.8;
      mtext('—', vp.x + vp.w/2, vp.y + vp.h*0.5, u*10, '#5a6076', 'center', 700);
      ctx.globalAlpha = 1;
    }
  }
  if(!HUNT.shown || HUNT.blank || eye !== strongEye) return;
  ctx.globalAlpha = stimAlpha(HUNT.c);
  drawButterfly(fx, fy, u*3.2);
  ctx.globalAlpha = 1;
}
function drawButterfly(x, y, s){
  var p = s/3;
  ctx.fillStyle = C.violet;
  ctx.fillRect(x - p*3, y - p*2, p*2.4, p*3);
  ctx.fillRect(x + p*0.6, y - p*2, p*2.4, p*3);
  ctx.fillStyle = '#a78ce0';
  ctx.fillRect(x - p*2.6, y - p*1.6, p*1.6, p*2.2);
  ctx.fillRect(x + p*1, y - p*1.6, p*1.6, p*2.2);
  ctx.fillStyle = C.bone;
  ctx.fillRect(x - p*0.3, y - p*2.2, p*0.6, p*3.6);
}

SCREENS.kidSticks = {
  title: 'STICKS',
  onOpen: function(){ nonius.on = false; MENU.idx = 0; say('sticks'); },
  tick: function(){},
  nav: function(dx){
    if(!dx) return;
    var n = 3;
    MENU.idx = (MENU.idx + dx + n) % n;
    sfx('uiMove'); render();
  },
  confirm: function(){
    var a = MENU.idx + 1;
    sfx('uiOk');
    noniusAnswer(a);
    openMenu('kidDone', true);
  },
  custom: function(eye, vp, u){
    var cx = vp.x + vp.w/2, cy = vp.y + vp.h*0.40;
    ctx.fillStyle = C.floor;
    ctx.fillRect(vp.x, vp.y + u*14, vp.w, vp.h - u*38);
    mtext('HOW MANY STICKS?', cx, vp.y + u*7, u*6, C.gold, 'center', 700, F_PIX);
    drawKidNonius(eye, cx, cy, u);
    /* three big picture answers, identical in both eyes */
    var bw = vp.w*0.26, bh = u*20, gap = vp.w*0.04;
    var x0 = cx - (bw*3 + gap*2)/2, i;
    var icons = ['cross', 'bar_v', 'bar_h'];
    for(i=0;i<3;i++){
      var bx = x0 + i*(bw + gap), by = vp.y + vp.h - bh - u*8;
      var on = (i === MENU.idx);
      ctx.fillStyle = on ? 'rgba(232,177,63,.14)' : 'rgba(20,25,38,.9)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = on ? C.gold : '#242c40';
      ctx.lineWidth = Math.max(1.5, u*(on ? 0.8 : 0.4));
      ctx.strokeRect(bx, by, bw, bh);
      drawIcon(icons[i], bx + bw/2, by + bh*0.42, u*5, on ? C.gold : '#7d849c');
      mtext(['both', 'up-down', 'across'][i], bx + bw/2, by + bh*0.8, u*3.2, on ? C.bone : '#7d849c', 'center', 500, F_MONO);
    }
    drawMenuFoot({ hint:'‹ › choose · A say it' }, vp, u);
  }
};
/* eye-alpha: intentional — the nonius bars are per-eye by definition; see
   the identical note in 60-hud.js drawEyeNonius(). */
function drawKidNonius(eye, cx, cy, u){
  var isWeak = (eye === cfg.weakEye), r = u*13;
  ctx.strokeStyle = C.bone; ctx.lineWidth = Math.max(2, u*0.8);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
  ctx.lineWidth = Math.max(3, u*1.4); ctx.lineCap = 'butt';
  if(isWeak){
    ctx.globalAlpha = 1; ctx.strokeStyle = '#8fd8b4';
    ctx.beginPath(); ctx.moveTo(cx, cy - r*0.95); ctx.lineTo(cx, cy + r*0.95); ctx.stroke();
  } else {
    ctx.globalAlpha = stimAlpha(Math.max(cfg.strong, 0.08)); ctx.strokeStyle = '#f0c76a';
    ctx.beginPath(); ctx.moveTo(cx - r*0.95, cy); ctx.lineTo(cx + r*0.95, cy); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

SCREENS.kidDone = {
  title: 'ALL SET',
  onOpen: function(){ sfx('fanfare'); say('ready'); },
  nav: function(){},
  confirm: function(){ sfx('uiOk'); playOn(); },
  custom: function(eye, vp, u){
    drawSimpleScreen(vp, u, {
      title: 'ALL SET!',
      deco: function(cx, cy, uu){
        var i;
        for(i=0;i<5;i++){
          var a = MENU.t*0.03 + i*1.257, rr = uu*18 + Math.sin(MENU.t*0.05 + i)*uu*2;
          ctx.globalAlpha = 0.5 + 0.5*Math.abs(Math.sin(MENU.t*0.04 + i));
          drawIcon('star', cx + Math.cos(a)*rr, cy + Math.sin(a)*rr*0.7, uu*2.6, C.gold);
          ctx.globalAlpha = 1;
        }
        drawIcon('sword', cx, cy, uu*10, C.jade);
      },
      sub: 'grown-up: strong eye starts at ' + pct(cfg.strong),
      button: 'PLAY',
      foot: 'A play'
    });
  }
};

/* ---------------- alignment check, in stereo ----------------
   Same measurement as the flat panel, but drawn per eye and answered
   with the controller, so it can be run without taking the viewer off —
   which is the only time the answer is worth anything. */
SCREENS.nonius = {
  title: 'ALIGNMENT',
  onOpen: function(){ nonius.on = false; MENU.idx = 0; },
  nav: function(dx){
    if(!dx) return;
    MENU.idx = (MENU.idx + dx + 3) % 3;
    sfx('uiMove'); render();
  },
  confirm: function(){ sfx('uiOk'); noniusAnswer(MENU.idx + 1); openMenu('noniusResult', true); },
  custom: function(eye, vp, u){
    var cx = vp.x + vp.w/2, cy = vp.y + vp.h*0.40, i;
    ctx.fillStyle = C.floor;
    ctx.fillRect(vp.x, vp.y + u*14, vp.w, vp.h - u*38);
    mtext('WHAT DO YOU SEE?', cx, vp.y + u*7, u*5.5, C.gold, 'center', 700, F_PIX);
    drawKidNonius(eye, cx, cy, u);
    var bw = vp.w*0.26, bh = u*20, gap = vp.w*0.04, x0 = cx - (bw*3 + gap*2)/2;
    var icons = ['cross', 'bar_v', 'bar_h'];
    var labs = ['full cross', 'no across bar', 'no up-down bar'];
    for(i=0;i<3;i++){
      var bx = x0 + i*(bw + gap), by = vp.y + vp.h - bh - u*8, on = (i === MENU.idx);
      ctx.fillStyle = on ? 'rgba(232,177,63,.14)' : 'rgba(20,25,38,.9)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = on ? C.gold : '#242c40';
      ctx.lineWidth = Math.max(1.5, u*(on ? 0.8 : 0.4));
      ctx.strokeRect(bx, by, bw, bh);
      drawIcon(icons[i], bx + bw/2, by + bh*0.40, u*4.5, on ? C.gold : '#7d849c');
      mtext(labs[i], bx + bw/2, by + bh*0.78, u*2.8, on ? C.bone : '#7d849c', 'center', 500, F_MONO);
    }
    drawMenuFoot({ hint:'\u2039 \u203a choose \u00b7 A answer' }, vp, u);
  }
};

SCREENS.noniusResult = {
  title: 'RESULT',
  custom: function(eye, vp, u){
    var cx = vp.x + vp.w/2;
    mtext('RESULT', cx, vp.y + u*8, u*7, C.gold, 'center', 700, F_PIX);
    mparagraph(noniusMsg || '', vp.x + u*5, vp.y + u*20, vp.w - u*10, u*3.8, '#c9c4b6', 1.5);
    mtext('strong eye now ' + pct(cfg.strong), cx, vp.y + vp.h - u*14, u*4, C.gold, 'center', 600, F_MONO);
    drawMenuFoot({ hint:'A play \u00b7 B back' }, vp, u);
  },
  nav: function(){},
  confirm: function(){ sfx('uiOk'); playOn(); },
  cancel: function(){ closeMenu(); openMenu('title'); }
};

/* ============================================================
   THE REWARD LOOP
   The commercial dichoptic games this replaces failed on boredom,
   not on mechanism, so what keeps a child coming back tomorrow is
   load-bearing. Stars and a day streak persist across sessions;
   PROG is the only thing in this app that outlives a run.
   ============================================================ */
var PROG = { stars:0, sessions:0, streak:0, lastDay:'', best:1,
             coins:0, lastIsland:1, tools:{ shield:false, bombs:false, bow:false },
             lit:{}, secrets:{},
             /* the arcade games: level reached and best stars per level; coins to
                spend in the paint shop (coins stays the lifetime count); colours */
             games:{}, wallet:0, paint:{}, lastGame:'islands' };

function loadProg(){
  try{
    var raw = localStorage.getItem('gloamhold.progress');
    if(!raw) return;
    var o = JSON.parse(raw);
    for(var k in PROG) if(k in o && typeof o[k] === typeof PROG[k]) PROG[k] = o[k];
    /* coins collected before the shop existed become spendable */
    if(!('wallet' in o)) PROG.wallet = PROG.coins;
  }catch(e){}
}
function saveProg(){ try{ localStorage.setItem('gloamhold.progress', JSON.stringify(PROG)); }catch(e){} }
function dayKey(d){
  d = d || new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}
/* Idempotent per run: a run can end by reaching the session goal OR by the
   player falling, and both routes award. Dying must still be worth stars —
   a five-year-old who gets nothing for a bad run stops having bad runs by
   not playing. */
function awardSession(){
  if(S.awarded) return S.starsGained;
  /* filed in the study history once the stars are known (below) */
  S.awarded = true;
  var SS = TUNING.session, I = TUNING.islands, lo = 1;
  var gained = SS.starsFinish + S.cleanRooms * SS.starsCleanRoom
             + (S.firstLight ? I.starsIsland : 0)
             + (S.secrets || 0) * I.starsSecret
             + Math.floor((S.coins || 0) / I.coinsPerStar)
             + (S.levelStars || 0) + (S.bonusStars || 0);
  S.trail.forEach(function(p){ lo = Math.min(lo, p.c); });
  if(S.trail.length && lo < PROG.best - 0.001){ gained += SS.starsImproved; PROG.best = lo; }
  PROG.stars += gained;
  PROG.sessions++;
  S.starsGained = gained;
  var d = dayKey();
  if(PROG.lastDay !== d){
    var y = dayKey(new Date(Date.now() - 86400000));
    PROG.streak = (PROG.lastDay === y) ? PROG.streak + 1 : 1;
    PROG.lastDay = d;
  }
  saveProg();
  archiveRun(S.sessionDone ? 'session-end' : (S.won ? 'won' : 'ended'));
  return gained;
}

function drawStarRow(cx, y, n, u, max){
  var show = Math.min(n, max || 8), i, w = u*5;
  var x0 = cx - (show*w)/2 + w/2;
  for(i=0;i<show;i++) drawIcon('star', x0 + i*w, y, u*2.2, C.gold);
  if(n > show) mtext('+' + (n - show), cx + (show*w)/2 + u*3, y, u*4, C.gold, 'left', 600, F_MONO);
}

SCREENS.sessionDone = {
  title: 'DONE',
  onOpen: function(){ say('done'); },
  nav: function(){},
  confirm: function(){ sfx('uiOk'); closeMenu(); openMenu('title'); },
  cancel: function(){ closeMenu(); openMenu('title'); },
  custom: function(eye, vp, u){
    drawSimpleScreen(vp, u, {
      title: 'WELL PLAYED',
      deco: function(cx, cy, uu){
        var i;
        for(i=0;i<6;i++){
          var a = MENU.t*0.025 + i*1.047, rr = uu*19 + Math.sin(MENU.t*0.05 + i)*uu*2;
          ctx.globalAlpha = 0.45 + 0.55*Math.abs(Math.sin(MENU.t*0.035 + i));
          drawIcon('star', cx + Math.cos(a)*rr, cy + Math.sin(a)*rr*0.62, uu*2.4, C.gold);
          ctx.globalAlpha = 1;
        }
        drawIcon('key', cx, cy, uu*10, C.gold);
      },
      big: '+' + S.starsGained + ' stars',
      sub: PROG.stars + ' stars  \u00b7  ' + PROG.streak + ' day streak',
      button: 'DONE',
      foot: 'A finish'
    });
  }
};

SCREENS.stars = {
  title: 'STARS',
  nav: function(){},
  confirm: function(){ menuCancel(); },
  custom: function(eye, vp, u){
    var cx = vp.x + vp.w/2;
    mtext('STARS', cx, vp.y + u*8, u*9, C.gold, 'center', 700, F_PIX);
    mtext(String(PROG.stars), cx, vp.y + vp.h*0.33, u*16, C.gold, 'center', 700, F_PIX);
    drawStarRow(cx, vp.y + vp.h*0.50, Math.min(PROG.stars, 8), u, 8);
    var lights = Object.keys(PROG.lit).filter(function(k){ return PROG.lit[k]; }).length;
    var rows = [
      ['lights found', lights + ' / ' + ISLAND_COUNT],
      ['coins', String(PROG.coins)],
      ['day streak', String(PROG.streak)],
      ['sessions', String(PROG.sessions)],
      ['best contrast', PROG.best < 1 ? pct(PROG.best) : '\u2014']
    ], i, ry = vp.y + vp.h*0.57;
    for(i=0;i<rows.length;i++){
      mtext(rows[i][0], vp.x + u*10, ry, u*3.6, '#8e8a7e', 'left', 400, F_MONO);
      mtext(rows[i][1], vp.x + vp.w - u*10, ry, u*3.6, '#ded9cb', 'right', 500, F_MONO);
      ry += u*5.5;
    }
    drawMenuFoot({ hint:'B back' }, vp, u);
  }
};

/* A wizard run that cannot be trusted ends here instead of writing a number
   into cfg.strong. For the child it is just "let us go again"; the grown-up
   line underneath says what actually happened. */
SCREENS.kidRetry = {
  title: 'AGAIN',
  onOpen: function(){ say('again'); },
  nav: function(){},
  confirm: function(){ sfx('uiOk'); openMenu('kidHunt', true); },
  cancel: function(){ closeMenu(); openMenu('title'); },
  custom: function(eye, vp, u){
    drawSimpleScreen(vp, u, {
      title: 'ONE MORE GO',
      icon: 'star',
      iconCol: '#4a5166',
      sub: (HUNT && HUNT.fa >= TUNING.kid.falseAlarmLimit)
        ? 'grown-up: ' + HUNT.fa + ' presses on empty rounds, contrast left alone'
        : 'grown-up: nothing caught, contrast left alone',
      button: 'AGAIN',
      foot: 'A again \u00b7 B stop'
    });
  }
};
