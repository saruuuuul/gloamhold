
/* ============================================================
   THE GAME PICKER — the one screen a child comes back to.

   Every game in here is a way of giving the two eyes different
   work: the islands, Gator Truck, Blocks, Space Rocks and Racer.
   Picking one is a carousel, not a list: one big moving picture of
   the selected game, its name spoken aloud (he cannot read), and
   one big button anchored to the bottom (invariant 11). Menu chrome,
   so it is identical in both eyes at full contrast (invariant 7).

   Grown-ups get in by HOLDING B, so a child's quick press on the
   back button does not drop him into the settings.
   ============================================================ */
var GAMES = {};
var GAME_ORDER = ['islands', 'truck', 'blocks', 'rocks', 'race', 'shop'];
var HUB = { sel:0, holdB:0, slide:0 };

function hubList(){ return GAME_ORDER.filter(function(id){ return !!GAMES[id]; }); }
function hubGame(){ var l = hubList(); return GAMES[l[Math.max(0, Math.min(l.length - 1, HUB.sel))]]; }
function hubSelect(id){ var i = hubList().indexOf(id); if(i >= 0) HUB.sel = i; }
function hubPlay(){
  var M = hubGame();
  if(!M) return;
  sfx('uiOk');
  PROG.lastGame = M.id; saveProg();
  if(M.play) M.play();
  else arcadeStart(M.id);
}
/* is the back button being held? keyboard Esc / Backspace, or a pad's B */
function backHeld(){
  if(keys['escape'] || keys['backspace']) return true;
  var p = padSnapshot();
  return !!(p && p.b);
}

/* ---------------- the islands and the shop, as games ---------------- */
GAMES.islands = {
  id:'islands', name:'ISLANDS', say:'g_islands', col:'#57bf92', label:'SAIL',
  play: function(){ closeMenu(); openMenu('map'); },
  progress: function(cx, y, u){
    var lit = Object.keys(PROG.lit).filter(function(k){ return PROG.lit[k]; }).length;
    drawIcon('star', cx - u*7, y, u*2, C.gold);
    mtext(lit + ' / ' + ISLAND_COUNT, cx + u*1.5, y, u*4.2, C.bone, 'center', 600, F_MONO);
  },
  icon: function(cx, cy, s, t){
    var p = s/10, i;
    ctx.fillStyle = '#0d1b2c'; ctx.fillRect(cx - s, cy - s*0.9, s*2, s*1.8);
    ctx.fillStyle = '#16304a';
    for(i=0;i<6;i++) ctx.fillRect(cx - s + ((i*37 + t*0.3) % (s*2)), cy - s*0.6 + i*p*2.6, p*3, p*0.5);
    ctx.fillStyle = '#c9b98f'; ctx.fillRect(cx - p*6, cy + p*1, p*12, p*3);
    ctx.fillStyle = '#3f7a44'; ctx.fillRect(cx - p*5, cy - p*1, p*10, p*3);
    ctx.fillStyle = '#59628a'; ctx.fillRect(cx - p*1.5, cy - p*6, p*3, p*6);
    ctx.fillStyle = '#39415a'; ctx.fillRect(cx - p*2, cy - p*7, p*4, p*1.4);
    ctx.fillStyle = C.gold; ctx.fillRect(cx - p*0.5, cy - p*9.5 + ((t >> 4) & 1)*p*0.4, p, p*2);
    var boat = cx - s*0.7 + ((t*0.4) % (s*0.5));
    ctx.fillStyle = '#6b4424'; ctx.fillRect(boat, cy + p*6, p*4, p*1.2);
    ctx.fillStyle = C.bone; ctx.fillRect(boat + p*1.6, cy + p*3, p*1.6, p*2.6);
  }
};
GAMES.shop = {
  id:'shop', name:'PAINT', say:'g_shop', col:'#e87fb8', label:'SHOP',
  play: function(){ openMenu('shop'); },
  progress: function(cx, y, u){
    drawCoinIcon(cx - u*7, y, u*1.8);
    mtext(String(PROG.wallet), cx + u*1.5, y, u*4.2, C.gold, 'center', 600, F_MONO);
  },
  icon: function(cx, cy, s, t){
    var p = s/10, i;
    ctx.fillStyle = '#8a8f9e'; ctx.fillRect(cx - p*5, cy - p*3, p*10, p*9);
    ctx.fillStyle = '#6b6f7c'; ctx.fillRect(cx - p*5, cy + p*4, p*10, p*2);
    ctx.fillStyle = '#4c505c'; ctx.fillRect(cx - p*6, cy - p*4, p*12, p*1.4);
    var col = PAINTS[(t >> 5) % PAINTS.length].c;
    ctx.fillStyle = col; ctx.fillRect(cx - p*4.4, cy - p*2.6, p*8.8, p*2.4);
    var drip = ((t >> 2) % 8);
    ctx.fillRect(cx + p*2, cy - p*0.4, p*1.2, p*(1 + drip*0.4));
    for(i=0;i<4;i++){ ctx.fillStyle = PAINTS[(i*2 + 1) % PAINTS.length].c; ctx.fillRect(cx - p*7 + i*p*4, cy + p*7.5, p*2.6, p*1.6); }
  }
};

/* ---------------- the carousel ---------------- */
SCREENS.title = {
  title: 'GAMES',
  onOpen: function(){
    hubSelect(PROG.lastGame || 'islands');
    HUB.holdB = 0; HUB.slide = 0;
    var M = hubGame(); if(M && M.say) say(M.say);
  },
  tick: function(){
    if(HUB.slide) HUB.slide *= 0.78;
    if(Math.abs(HUB.slide) < 0.01) HUB.slide = 0;
    if(backHeld()){
      HUB.holdB++;
      if(HUB.holdB >= TUNING.menu.grownupHoldFrames){ HUB.holdB = 0; sfx('uiOk'); openMenu('adult'); }
    } else HUB.holdB = 0;
  },
  nav: function(dx, dy){
    var d = dx || dy, l = hubList();
    if(!d || !l.length) return;
    HUB.sel = (HUB.sel + d + l.length) % l.length;
    HUB.slide = d;
    sfx('uiMove');
    var M = hubGame(); if(M && M.say) say(M.say);
  },
  confirm: function(){ hubPlay(); },
  start: function(){ hubPlay(); },
  /* a quick B does nothing here: grown-ups hold it (see tick) */
  cancel: function(){},
  custom: function(eye, vp, u){ drawHub(vp, u); }
};

function drawHub(vp, u){
  var l = hubList(), n = l.length, cx = vp.x + vp.w/2, i;
  var M = hubGame();
  if(!M) return;
  /* what he has: stars and coins, as pictures and numbers */
  drawIcon('star', cx - u*20, vp.y + u*6, u*2.2, C.gold);
  mtext(String(PROG.stars), cx - u*16, vp.y + u*6, u*4.6, C.gold, 'left', 700, F_MONO);
  drawCoinIcon(cx + u*9, vp.y + u*6, u*1.9);
  mtext(String(PROG.wallet), cx + u*13, vp.y + u*6, u*4.6, C.gold, 'left', 700, F_MONO);

  /* the cards: neighbours small and dim at the edges, the chosen one big */
  var cw = Math.min(vp.w*0.52, u*58), ch = Math.min(vp.h*0.40, cw*0.78);
  var cy = vp.y + vp.h*0.14 + ch/2, off = HUB.slide * cw*0.3;
  [-1, 1].forEach(function(side){
    var j = (HUB.sel + side + n) % n, G2 = GAMES[l[j]];
    if(n < 2 || !G2) return;
    var sx = cx + side*(cw*0.5 + cw*0.34) + off, sw = cw*0.46, sh = ch*0.62;
    ctx.fillStyle = '#111726'; ctx.fillRect(sx - sw/2, cy - sh/2, sw, sh);
    G2.icon(sx, cy, sh*0.42, MENU.t);
    ctx.fillStyle = 'rgba(7,9,13,.62)'; ctx.fillRect(sx - sw/2, cy - sh/2, sw, sh);
    ctx.strokeStyle = '#2a3348'; ctx.lineWidth = Math.max(1, u*0.4);
    ctx.strokeRect(sx - sw/2, cy - sh/2, sw, sh);
  });
  ctx.fillStyle = '#111726'; ctx.fillRect(cx - cw/2 + off, cy - ch/2, cw, ch);
  ctx.save();
  ctx.beginPath(); ctx.rect(cx - cw/2 + off, cy - ch/2, cw, ch); ctx.clip();
  M.icon(cx + off, cy, ch*0.44, MENU.t);
  ctx.restore();
  var pulse = 0.55 + 0.45*Math.abs(Math.sin(MENU.t*TUNING.menu.cursorPulse));
  ctx.strokeStyle = M.col; ctx.lineWidth = Math.max(2, u*0.9);
  ctx.globalAlpha = pulse;
  ctx.strokeRect(cx - cw/2 + off + ctx.lineWidth/2, cy - ch/2 + ctx.lineWidth/2, cw - ctx.lineWidth, ch - ctx.lineWidth);
  ctx.globalAlpha = 1;
  mtext('‹', cx - cw/2 - u*3.5, cy, u*8, C.gold, 'center', 700);
  mtext('›', cx + cw/2 + u*3.5, cy, u*8, C.gold, 'center', 700);

  /* its name, in its colour, and how far he has got */
  var ny = cy + ch/2 + u*5.5;
  mtext(M.name, cx, ny, u*6.4, M.col, 'center', 700, F_PIX);
  if(M.progress) M.progress(cx, ny + u*6.5, u);
  else if(M.start){
    var pg = progGame(M.id);
    drawIcon('flag', cx - u*7, ny + u*6.5, u*2, C.jade);
    mtext(String(pg.level), cx + u*1.5, ny + u*6.5, u*4.6, C.bone, 'center', 700, F_MONO);
    var best = pg.best[pg.level - 1] || 0;
    for(i=0;i<3;i++) drawIcon('star', cx + u*8 + i*u*4.2, ny + u*6.5, u*1.5, i < best ? C.gold : '#333a4c');
  }

  /* grown-ups: hold B — the ring fills while it is held */
  var gx = vp.x + u*6, gy = vp.y + vp.h - u*6;
  drawIcon('gear', gx, gy, u*2.2, '#4a5166');
  if(HUB.holdB > 0){
    ctx.strokeStyle = C.gold; ctx.lineWidth = Math.max(1.5, u*0.6);
    ctx.beginPath(); ctx.arc(gx, gy, u*3.6, -1.5708, -1.5708 + 6.2832*HUB.holdB/TUNING.menu.grownupHoldFrames); ctx.stroke();
  }
  drawBigButton(vp, u, M.label || 'PLAY', true);
  /* sound and voice only start from a real tap — say so while they have not */
  var audioOk = !!(AC && AC.state === 'running') || cfg.mute;
  drawMenuFoot({ hint: audioOk ? '‹ › choose · A play · hold B grown-up' : 'tap the screen once for sound and voice' }, vp, u);
}

/* ---------------- one tap before the viewer goes on ----------------
   Chrome will not start sound, speech or fullscreen from a gamepad: only a
   real tap or key counts as the user asking. So the first screen of a fresh
   launch asks for one tap, and that tap unlocks all three. */
function needsTap(){
  try{ return !!(navigator.userActivation && !navigator.userActivation.hasBeenActive); }
  catch(e){ return false; }
}
function tapUnlock(){ audioUnlock(); speechPrime(); goImmersive(); }
SCREENS.tapStart = {
  title: 'HELLO',
  nav: function(){},
  confirm: function(){ tapUnlock(); closeMenu(); openMenu('title'); },
  start: function(){ tapUnlock(); closeMenu(); openMenu('title'); },
  cancel: function(){ tapUnlock(); closeMenu(); openMenu('title'); },
  custom: function(eye, vp, u){
    drawSimpleScreen(vp, u, {
      title: 'HELLO!',
      deco: function(cx, cy, uu){
        var k = (MENU.t % 60) / 60;
        drawIcon('goggles', cx, cy - uu*2, uu*9, C.jade);
        ctx.strokeStyle = C.gold; ctx.lineWidth = Math.max(1.5, uu*0.6);
        ctx.beginPath(); ctx.arc(cx, cy + uu*12, uu*(2 + k*6), 0, 6.2832); ctx.stroke();
        ctx.fillStyle = C.gold; ctx.fillRect(cx - uu*1.2, cy + uu*10.8, uu*2.4, uu*2.4);
      },
      big: 'TAP',
      sub: 'grown-up: tap once for sound + voice',
      button: 'START',
      foot: 'tap the screen'
    });
  }
};

/* ---------------- the paint shop ----------------
   Coins buy colours for the things he steers. Only PLAYER-layer sprites are
   ever recoloured — both eyes, full contrast — so nothing here can change a
   contrast the staircase is measuring. */
var PAINTS = [
  { c:'#57bf92', d:'#2e7d5c', tier:0 }, { c:'#5aa8e8', d:'#2f5f8f', tier:1 },
  { c:'#e8c84a', d:'#9a7f22', tier:1 }, { c:'#e0645a', d:'#8f3530', tier:0 },
  { c:'#a47be0', d:'#5e4290', tier:2 }, { c:'#e6e2d6', d:'#8c8a82', tier:0 },
  { c:'#e8964a', d:'#94592a', tier:2 }, { c:'#e87fb8', d:'#8f4a70', tier:3 }
];
var PAINT_THINGS = ['hero', 'truck', 'ship', 'car'];
var PAINT_DEFAULT = { hero:0, truck:3, ship:5, car:1 };
var SHOP = { thing:0, col:0 };
function paintState(thing){
  if(!PROG.paint[thing]){ var o = {}; o[PAINT_DEFAULT[thing]] = true; PROG.paint[thing] = { sel:PAINT_DEFAULT[thing], own:o }; }
  return PROG.paint[thing];
}
function paintOf(thing){ return PAINTS[paintState(thing).sel] || PAINTS[0]; }
function paintPrice(i){ var S2 = TUNING.shop; return Math.round(S2.basePrice + PAINTS[i].tier*S2.priceStep); }
function drawCoinIcon(x, y, r){
  ctx.fillStyle = '#8a6a1c'; ctx.fillRect(x - r, y - r + r*0.2, r*2, r*2);
  ctx.fillStyle = C.gold;    ctx.fillRect(x - r, y - r, r*2*0.9, r*2*0.9);
  ctx.fillStyle = C.bone;    ctx.fillRect(x - r*0.5, y - r*0.6, r*0.4, r*0.8);
}
function drawPaintPreview(thing, cx, cy, s, pt){
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(s, s);
  if(thing === 'hero') drawHeroSprite(0, 4, 's', pt, 0);
  else if(thing === 'truck'){ ctx.translate(0, 11); drawTruckSprite('truck', pt, 0); }
  else if(thing === 'ship') drawShipSprite(pt, -1.5708, false);
  else drawCarSprite(pt, false);
  ctx.restore();
}
SCREENS.shop = {
  title: 'PAINT',
  onOpen: function(){ SHOP.thing = 0; SHOP.col = paintState(PAINT_THINGS[0]).sel; },
  nav: function(dx, dy){
    if(dy){
      SHOP.thing = (SHOP.thing + dy + PAINT_THINGS.length) % PAINT_THINGS.length;
      SHOP.col = paintState(PAINT_THINGS[SHOP.thing]).sel; sfx('uiMove');
    }
    if(dx){ SHOP.col = (SHOP.col + dx + PAINTS.length) % PAINTS.length; sfx('uiMove'); }
  },
  confirm: function(){
    var th = PAINT_THINGS[SHOP.thing], st = paintState(th), i = SHOP.col;
    if(st.own[i]){ st.sel = i; saveProg(); sfx('uiOk'); return; }
    var price = paintPrice(i);
    if(PROG.wallet < price){ sfx('locked'); say('more_coins'); return; }
    PROG.wallet -= price; st.own[i] = true; st.sel = i; saveProg();
    sfx('chest'); say('newcol');
  },
  custom: function(eye, vp, u){
    var cx = vp.x + vp.w/2, th = PAINT_THINGS[SHOP.thing], st = paintState(th), i;
    mtext('PAINT', cx, vp.y + u*6, u*6.5, '#e87fb8', 'center', 700, F_PIX);
    drawCoinIcon(vp.x + vp.w - u*18, vp.y + u*6, u*1.9);
    mtext(String(PROG.wallet), vp.x + vp.w - u*14, vp.y + u*6, u*4.4, C.gold, 'left', 700, F_MONO);
    /* which thing: four small pictures, up/down to choose */
    for(i=0;i<PAINT_THINGS.length;i++){
      var tx = vp.x + u*8, ty = vp.y + u*18 + i*u*11, on = i === SHOP.thing;
      ctx.fillStyle = on ? 'rgba(232,177,63,.16)' : '#111726'; ctx.fillRect(tx - u*5, ty - u*4.5, u*10, u*9);
      ctx.strokeStyle = on ? C.gold : '#242c40'; ctx.lineWidth = Math.max(1, u*(on ? 0.6 : 0.3));
      ctx.strokeRect(tx - u*5, ty - u*4.5, u*10, u*9);
      drawPaintPreview(PAINT_THINGS[i], tx, ty, u*0.34, paintOf(PAINT_THINGS[i]));
    }
    /* the big picture, in the colour being looked at */
    var pcx = cx + u*6, pcy = vp.y + vp.h*0.36;
    ctx.fillStyle = '#111726'; ctx.fillRect(pcx - u*24, pcy - u*17, u*48, u*34);
    drawPaintPreview(th, pcx, pcy, u*0.95, PAINTS[SHOP.col]);
    mtext('‹', pcx - u*28, pcy, u*8, C.gold, 'center', 700);
    mtext('›', pcx + u*28, pcy, u*8, C.gold, 'center', 700);
    /* the swatches: owned ones plain, the rest with their price */
    var sw = u*7, x0 = pcx - (PAINTS.length*sw)/2 + sw/2, sy = pcy + u*23;
    for(i=0;i<PAINTS.length;i++){
      var sx = x0 + i*sw;
      ctx.fillStyle = PAINTS[i].c; ctx.fillRect(sx - sw*0.36, sy - sw*0.36, sw*0.72, sw*0.72);
      if(i === SHOP.col){ ctx.strokeStyle = C.bone; ctx.lineWidth = Math.max(1.5, u*0.6); ctx.strokeRect(sx - sw*0.46, sy - sw*0.46, sw*0.92, sw*0.92); }
      if(i === st.sel){ ctx.fillStyle = C.bone; ctx.fillRect(sx - u*0.8, sy + sw*0.5, u*1.6, u*1.6); }
      else if(!st.own[i]) mtext(String(paintPrice(i)), sx, sy + sw*0.72, u*2.6, '#9aa0b4', 'center', 500, F_MONO);
    }
    var label = st.own[SHOP.col] ? (st.sel === SHOP.col ? 'WEARING' : 'WEAR') : ('BUY ' + paintPrice(SHOP.col));
    drawBigButton(vp, u, label, true);
    drawMenuFoot({ hint:'‹ › colour · ˄ ˅ thing · A buy · B back' }, vp, u);
  }
};
