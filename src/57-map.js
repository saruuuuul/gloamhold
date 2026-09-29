
/* ============================================================
   THE SEA — the hub between islands, and the part of Oceanhorn a
   five-year-old remembers: a little boat sailing to the next one.

   It is menu chrome, so it follows the menu rule: identical in both
   eyes at full contrast. Islands are told apart by COLOUR, not by
   name, because the player cannot read — and every island that has
   given up its light shows a beacon, so progress is visible at a
   glance rather than written down.
   ============================================================ */
var MAP = { sel:1, sail:null, autoTo:0 };

/* a zig-zag across the water, left to right */
function mapPos(n){
  var i = n - 1, x = 0.1 + i*(0.8/(ISLAND_COUNT - 1)), y = (i % 2 === 0) ? 0.72 : 0.3;
  return [x, y];
}
function mapXY(n, R){ var q = mapPos(n); return [R.x + q[0]*R.w, R.y + q[1]*R.h]; }
function secretsLeft(n){
  var isl = getIsland(n), found = PROG.secrets[n] || {};
  return isl.secrets.filter(function(id){ return !found[id]; }).length;
}

SCREENS.map = {
  title: 'THE SEA',
  onOpen: function(){
    MAP.sel = Math.max(1, Math.min(ISLAND_COUNT, PROG.lastIsland || 1));
    MAP.sail = null;
    /* straight on from a light just found: the boat is already moving */
    var to = MAP.autoTo; MAP.autoTo = 0;
    if(to && islandUnlocked(to)){
      MAP.sel = to;
      MAP.sail = { from:PROG.lastIsland || 1, to:to, t:0 };
      sfx('sail');
      return;
    }
    owlSay('sail', true);
  },
  nav: function(dx, dy){
    if(MAP.sail) return;
    var d = dx || dy;
    if(!d) return;
    MAP.sel = ((MAP.sel - 1 + d + ISLAND_COUNT) % ISLAND_COUNT) + 1;
    sfx('uiMove');
  },
  confirm: function(){
    if(MAP.sail) return;
    if(!islandUnlocked(MAP.sel)){ sfx('locked'); say('more_stars'); return; }
    MAP.sail = { from:PROG.lastIsland || 1, to:MAP.sel, t:0 };
    sfx('sail');
    var d = ISLAND_DEFS[MAP.sel];
    sayLine({ mn: d.mn + ' руу явцгаая!', en: 'Let us sail to ' + d.name + '!' });
  },
  start: function(){ SCREENS.map.confirm(); },
  cancel: function(){ if(MAP.sail) return; closeMenu(); openMenu('title'); },
  tick: function(){
    if(!MAP.sail) return;
    if(++MAP.sail.t < TUNING.islands.sailFrames) return;
    var n = MAP.sail.to;
    MAP.sail = null;
    PROG.lastIsland = n; saveProg();
    CUR_ISLAND = n;
    S.ended = true;
    startRun();
  },
  custom: function(eye, vp, u){ drawSeaMap(vp, u); }
};

function drawSeaMap(vp, u){
  var cx = vp.x + vp.w/2, i, n;
  mtext('THE SEA', cx, vp.y + u*6, u*6.5, C.gold, 'center', 700, F_PIX);
  var R = { x:vp.x + u*3, y:vp.y + u*12, w:vp.w - u*6, h:vp.h - u*41 };

  /* water */
  ctx.fillStyle = '#0d1b2c'; ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.fillStyle = '#16304a';
  for(i=0; i<24; i++){
    var wx = R.x + ((hash2(i, 3)*R.w + MENU.t*0.15*(1 + (i % 3))) % R.w);
    var wy = R.y + hash2(i, 7)*R.h;
    ctx.fillRect(wx, wy, u*2.2, Math.max(1, u*0.35));
  }
  /* the route */
  ctx.fillStyle = '#2a4a6a';
  for(n=1; n<ISLAND_COUNT; n++){
    var a = mapXY(n, R), b = mapXY(n+1, R);
    for(i=1; i<8; i++){
      var k = i/8;
      ctx.fillRect(a[0] + (b[0]-a[0])*k - u*0.3, a[1] + (b[1]-a[1])*k - u*0.3, u*0.6, u*0.6);
    }
  }
  /* islands */
  var s = u*4.2;
  for(n=1; n<=ISLAND_COUNT; n++){
    var p = mapXY(n, R), d = ISLAND_DEFS[n], open = islandUnlocked(n), lit = !!PROG.lit[n];
    ctx.fillStyle = '#c9b98f';                                   /* sand */
    ctx.fillRect(p[0] - s, p[1] - s*0.55, s*2, s*1.1);
    ctx.fillRect(p[0] - s*0.7, p[1] - s*0.8, s*1.4, s*1.6);
    ctx.fillStyle = open ? d.col : '#2a3140';                    /* the island itself */
    ctx.fillRect(p[0] - s*0.75, p[1] - s*0.45, s*1.5, s*0.9);
    ctx.fillRect(p[0] - s*0.45, p[1] - s*0.65, s*0.9, s*1.3);
    if(lit){                                                     /* its light, found */
      ctx.fillStyle = C.bone; ctx.fillRect(p[0] - u*0.5, p[1] - s*1.5, u, s*0.8);
      ctx.fillStyle = C.gold;
      ctx.fillRect(p[0] - u*1.6, p[1] - s*1.5 - u*0.5, u*3.2, u);
      ctx.fillRect(p[0] - u*0.5, p[1] - s*1.5 - u*1.6, u, u*3.2);
    }
    if(!open){
      drawIcon('key', p[0], p[1], u*1.8, '#6a718c');
    } else if(secretsLeft(n) > 0 && PROG.lit[n]){
      drawIcon('star', p[0] + s*0.95, p[1] - s*0.8, u*1.2, C.gold);   /* something still hidden here */
    }
    if(n === MAP.sel){
      var pulse = 0.5 + 0.5*Math.abs(Math.sin(MENU.t*TUNING.menu.cursorPulse));
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = C.gold; ctx.lineWidth = Math.max(2, u*0.7);
      ctx.strokeRect(p[0] - s*1.35, p[1] - s*1.35, s*2.7, s*2.7);
      ctx.globalAlpha = 1;
    }
  }
  /* the boat */
  var bp;
  if(MAP.sail){
    var k2 = MAP.sail.t / TUNING.islands.sailFrames, e = k2 < 0.5 ? 2*k2*k2 : 1 - Math.pow(-2*k2 + 2, 2)/2;
    var f = mapXY(MAP.sail.from, R), t = mapXY(MAP.sail.to, R);
    bp = [f[0] + (t[0]-f[0])*e, f[1] + (t[1]-f[1])*e];
  } else {
    var h = mapXY(PROG.lastIsland || 1, R); bp = [h[0], h[1] + s*1.35];
  }
  var bob = Math.sin(MENU.t*0.1)*u*0.4, bx = bp[0], by = bp[1] + bob, hero = paintOf('hero');
  ctx.fillStyle = '#6b4424'; ctx.fillRect(bx - u*2.4, by, u*4.8, u*1.3);
  ctx.fillRect(bx - u*1.8, by + u*1.3, u*3.6, u*0.7);
  ctx.fillStyle = '#4a3c22'; ctx.fillRect(bx - u*0.2, by - u*3.4, u*0.4, u*3.4);
  ctx.fillStyle = C.bone; ctx.fillRect(bx + u*0.2, by - u*3.2, u*1.8, u*2.4);
  ctx.fillStyle = hero.c; ctx.fillRect(bx - u*0.9, by - u*1.1, u*0.8, u*1.1);   /* him */

  /* what is selected, and the one button */
  var dsel = ISLAND_DEFS[MAP.sel], openSel = islandUnlocked(MAP.sel);
  mtext(dsel.name, cx, R.y + R.h + u*3.2, u*4, openSel ? dsel.col : '#6a718c', 'center', 600);
  drawBigButton(vp, u, openSel ? 'SAIL' : ('★ ' + islandCost(MAP.sel)), true);
  drawMenuFoot({ hint:'‹ › island · A sail · B games' }, vp, u);
}
