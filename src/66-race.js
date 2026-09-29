
/* ============================================================
   RACER — a top-down race up a winding road.

   Layers (invariant 12):
     world   the road, its verges, lane lines, checkpoints, the finish,
             trees and cacti on the verges                both eyes, full
     player  his car and its shadow                       both eyes, full
     foe     rival cars, oil slicks, ice                  (per-eye)
     item    coins and nitro cans                         (per-eye)
     clue    ramps and boost pads                         (per-eye)
   Rival markers on the progress bar are drawn at the foe layer's alpha
   too: the bar is HUD, but where a rival is belongs to the rival.

   He starts at the back of the grid, so the race is overtaking — each
   rival passed pays a coin. Ramps jump him clean over traffic, boost
   pads and nitro cans are bursts of speed, oil spins him, one rival
   likes to bump. Four checkpoints are the staircase's segments; the
   finish places him, and the podium is the trophy. Tracks rotate
   through city, forest, snow (with ice) and desert.
   ============================================================ */
var RC_W = 160, RC_H = 176, RC_PY = 130;
var RC_THEMES = [
  { name:'city',   road:'#2c2f38', verge:'#4a4e5a', edge:'#8a8f9e', deco:'#5e6370', deco2:'#3a3e48' },
  { name:'forest', road:'#2e2c2a', verge:'#2f5a33', edge:'#c9c4b6', deco:'#1f3d22', deco2:'#3f7a44' },
  { name:'snow',   road:'#34383f', verge:'#c8ced8', edge:'#5a6076', deco:'#e6eaf0', deco2:'#6f93b0' },
  { name:'desert', road:'#3a3228', verge:'#b8975c', edge:'#e6e2d6', deco:'#5d9257', deco2:'#8a6a3a' }
];
var RC_RIVAL_COLS = ['#e0645a', '#5aa8e8', '#e8c84a', '#a47be0', '#e87fb8', '#6fcf6f', '#e8964a'];

function rcCenter(g, d){ return RC_W/2 + g.a1*Math.sin(d*g.f1 + g.p1) + g.a2*Math.sin(d*g.f2 + g.p2); }
function rcLaneX(lane){ var R = TUNING.race, lw = R.roadW/R.lanes; return -R.roadW/2 + lw*(lane + 0.5); }
function rcScreenY(g, d){ return RC_PY - (d - g.p.d); }
function rcOverlap(ax, ay, aw, ah, bx, by, bw, bh){ return Math.abs(ax - bx) < (aw + bw)/2 && Math.abs(ay - by) < (ah + bh)/2; }

function rcBuild(g){
  var R = TUNING.race, rnd = islandRng((g.lv*7919 + 17) >>> 0), d = 160, objs = [], lv = g.lv, theme = g.theme.name;
  g.a1 = (R.curveAmp*0.6)*(0.6 + rnd()*0.4); g.a2 = (R.curveAmp*0.4)*(0.6 + rnd()*0.4);
  if(cfg.kidMode){ g.a1 *= 0.8; g.a2 *= 0.8; }
  g.f1 = 0.0035 + rnd()*0.0015; g.f2 = 0.009 + rnd()*0.004; g.p1 = rnd()*6.28; g.p2 = rnd()*6.28;
  while(d < g.len - 120){
    var lane = Math.floor(rnd()*R.lanes), roll = rnd(), i;
    if(roll < 0.34){ for(i=0; i<5; i++) objs.push({ k:'coin', d:d + i*16, lane:lane }); d += 70; }
    else if(roll < 0.48) objs.push({ k:'pad', d:d, lane:lane });
    else if(roll < 0.62 && lv >= 2) objs.push({ k:'ramp', d:d, lane:lane });
    else if(roll < 0.78 && lv >= 2) objs.push({ k:'oil', d:d, lane:lane });
    else if(roll < 0.88 && theme === 'snow') objs.push({ k:'ice', d:d, lane:lane });
    else if(roll < 0.94 && lv >= 3) objs.push({ k:'nitro', d:d, lane:lane });
    else objs.push({ k:'coin', d:d, lane:lane });
    d += 55 + rnd()*70 - Math.min(20, lv*2);
  }
  g.objs = objs;
  var sp = (R.rivalSpeed + (lv - 1)*R.rivalStep) * (cfg.kidMode ? R.kidRivalScale : 1);
  g.rivals = [];
  for(var k=0; k<R.rivals; k++){
    g.rivals.push({ d:24 + k*22, lane:k % R.lanes, x:rcLaneX(k % R.lanes), v:0, vmax:sp*(0.92 + rnd()*0.16),
                    col:RC_RIVAL_COLS[k % RC_RIVAL_COLS.length], bumper:k === R.rivals - 1, laneT:60 + Math.floor(rnd()*120),
                    ahead:true, spin:0 });
  }
}
function rcPlace(g){
  var n = 1;
  for(var i=0; i<g.rivals.length; i++) if(g.rivals[i].d > g.p.d) n++;
  return n;
}
function rcRivalsStep(g, finishing){
  var R = TUNING.race, i, j;
  for(i=0; i<g.rivals.length; i++){
    var r = g.rivals[i];
    if(r.spin > 0){ r.spin--; r.v *= 0.96; }
    else r.v += (r.vmax - r.v)*0.02;
    r.d += r.v;
    if(finishing) continue;
    /* change lane now and then, or when a slower car is in the way */
    var blocked = false;
    for(j=0; j<g.rivals.length; j++){
      var o = g.rivals[j];
      if(o !== r && o.lane === r.lane && o.d > r.d && o.d - r.d < 26 && o.v < r.v) blocked = true;
    }
    if(--r.laneT <= 0 || blocked){
      r.laneT = 90 + Math.floor(Math.random()*150);
      var nl = r.lane + (Math.random() < 0.5 ? -1 : 1);
      if(nl >= 0 && nl < R.lanes) r.lane = nl;
    }
    var target = rcLaneX(r.lane);
    /* the bumper leans toward him when he is alongside */
    if(r.bumper && Math.abs(r.d - g.p.d) < 26){
      var px = g.p.x - rcCenter(g, r.d);
      target = Math.max(-R.roadW/2 + 6, Math.min(R.roadW/2 - 6, px));
    }
    r.x += (target - r.x)*0.05;
    /* overtakes pay */
    var ahead = r.d > g.p.d;
    if(r.ahead && !ahead && Math.abs(r.d - g.p.d) < 60){ arcCoin(1); sfx('overtake'); }
    r.ahead = ahead;
  }
}

GAMES.race = {
  id:'race', name:'RACER', say:'g_race', col:'#e8964a', label:'PLAY',
  W:RC_W, H:RC_H,
  doneTitle: function(){ return ['', '1ST PLACE!', '2ND PLACE!', '3RD PLACE!'][S.place] || (S.place + 'TH PLACE'); },
  doneSub: function(){ return ARC.g ? ARC.g.theme.name : ''; },
  start: function(lv){
    var R = TUNING.race, g = { lv:lv, theme:RC_THEMES[(lv - 1) % RC_THEMES.length], len:Math.round(R.lenBase + (lv - 1)*R.lenStep),
      p:{ d:0, x:0, vx:0, v:0, z:0, jumpT:0, spin:0, spinA:0, boostT:0, nitroT:0, ice:false },
      rivals:[], objs:[], cp:1, crashes:0, fxFoe:[], fxItem:[], fxPlayer:[], t:0, done:false };
    rcBuild(g);
    g.p.x = rcCenter(g, 0) + rcLaneX(Math.floor(R.lanes/2));
    arcSegStart('Racer level ' + lv + ' quarter 1');
    arcBanner(g.theme.name.toUpperCase(), C.jade);
    if(lv === 2 || lv === 3) arcSay('newthing', true);
    return g;
  },
  update: function(g){
    var R = TUNING.race, p = g.p, i;
    g.t++;
    fxStep(g.fxFoe, 0); fxStep(g.fxItem, 0); fxStep(g.fxPlayer, 0);
    var cx = rcCenter(g, p.d), half = R.roadW/2;
    var gas = input.act || input.y < -0.5 || cfg.kidMode, brake = input.tool || input.y > 0.5;
    var top = cfg.kidMode ? R.kidVmax : R.vmax;
    if(p.boostT > 0){ p.boostT--; top *= R.boostGain; }
    if(p.nitroT > 0){ p.nitroT--; top *= R.boostGain*1.1; fxBurst(g.fxPlayer, p.x, RC_PY + 9, 1, (g.t >> 2) & 1 ? C.gold : C.blood, 0.6, 12, 2.5); }
    var off = Math.abs(p.x - cx) > half - 4;
    if(off) top *= 0.55;
    if(p.spin > 0){ p.spin--; p.spinA += 0.5; gas = false; }
    else p.spinA = 0;
    if(gas) p.v += R.accel*(p.v < top ? 1 : 0);
    if(brake) p.v -= R.brake;
    p.v -= p.v*R.drag;
    if(p.v > top) p.v -= (p.v - top)*(off ? R.grassDrag*2 : 0.05);
    p.v = Math.max(0, p.v);
    /* steering; on ice the car keeps sliding the way it was going */
    var grip = p.ice ? R.iceGrip : 1;
    var want = input.x * R.steer * (0.5 + 0.5*Math.min(1, p.v/Math.max(0.1, top)));
    if(p.spin > 0) want = 0;
    p.vx += (want - p.vx)*0.25*grip;
    p.x += p.vx;
    p.x = Math.max(cx - half - 22, Math.min(cx + half + 22, p.x));
    p.d += p.v;
    if(p.jumpT > 0){ p.jumpT--; p.z = Math.sin(Math.PI*(1 - p.jumpT/R.jumpFrames))*R.jumpHeight; if(p.jumpT === 0){ sfx('land'); p.z = 0; } }
    p.ice = false;
    var air = p.z > 2.5;
    /* what is under and around him */
    for(i = g.objs.length - 1; i >= 0; i--){
      var o = g.objs[i];
      if(o.d < p.d - 40) continue;
      if(o.d > p.d + 20) continue;
      var ox = rcCenter(g, o.d) + rcLaneX(o.lane), oy = rcScreenY(g, o.d);
      var hitbox = { coin:[7, 7], nitro:[8, 8], pad:[14, 10], ramp:[16, 8], oil:[14, 10], ice:[18, 16] }[o.k];
      if(!rcOverlap(p.x, RC_PY, 9, 14, ox, oy, hitbox[0], hitbox[1])) continue;
      if(o.k === 'coin' && !air){ g.objs.splice(i, 1); fxBurst(g.fxItem, ox, oy, 5, C.gold, 0.8, 14, 2); arcCoin(1); }
      else if(o.k === 'nitro' && !air){ g.objs.splice(i, 1); fxBurst(g.fxItem, ox, oy, 8, C.gold, 1, 16, 2); p.nitroT = R.nitroFrames; sfx('nitro'); arcSay('wow'); }
      else if(o.k === 'pad' && !air){ if(p.boostT < R.boostFrames - 10){ p.boostT = R.boostFrames; sfx('go'); } }
      else if(o.k === 'ramp' && !air && p.jumpT === 0 && p.v > 0.6){ p.jumpT = R.jumpFrames; sfx('hop'); arcSay('bigjump'); }
      else if(o.k === 'oil' && !air && p.spin === 0){ p.spin = R.oilFrames; p.v *= 0.75; sfx('skid'); arcSegFail(); g.crashes++; }
      else if(o.k === 'ice') p.ice = true;
    }
    rcRivalsStep(g, false);
    /* rivals: bumping costs speed, unless he is flying over them */
    for(i=0; i<g.rivals.length; i++){
      var r = g.rivals[i], rx = rcCenter(g, r.d) + r.x, ry = rcScreenY(g, r.d);
      if(air || p.spin > 0) continue;
      if(rcOverlap(p.x, RC_PY, 9, 15, rx, ry, 9, 15)){
        p.spin = R.crashFrames; p.v *= 0.35; r.spin = 20; r.v += 0.2;
        p.vx = (p.x < rx ? -1 : 1)*0.8;
        fxBurst(g.fxFoe, rx, ry, 6, '#9aa2b8', 1, 18, 2.2);
        sfx('crash'); arcHitstop(5); arcSegFail(); g.crashes++;
        if(cfg.kidMode) arcSay('oops_ok');
      }
    }
    /* checkpoints and the finish */
    var q = g.len/4;
    if(g.cp < 4 && p.d >= q*g.cp){
      arcSegEnd(); sfx('checkpoint');
      g.cp++;
      arcSegStart('Racer level ' + g.lv + ' quarter ' + g.cp);
    }
    if(p.d >= g.len){
      var place = rcPlace(g);
      S.place = place;
      arcBanner(this.doneTitle(), place === 1 ? C.gold : C.bone);
      arcSay(place === 1 ? 'place1' : 'finish', true);
      arcLevelDone(place === 1 ? 3 : (place <= 3 ? 2 : 1));
    }
  },
  /* after the line everyone keeps rolling, slowing down */
  idle: function(g){
    var p = g.p;
    fxStep(g.fxFoe, 0); fxStep(g.fxItem, 0); fxStep(g.fxPlayer, 0);
    p.v *= 0.985; p.d += p.v; p.x += (rcCenter(g, p.d) - p.x)*0.02;
    rcRivalsStep(g, true);
  },
  busy: function(g){
    var b = { foe:false, item:false, clue:false }, i, lo = g.p.d - (RC_H - RC_PY), hi = g.p.d + RC_PY;
    for(i=0; i<g.rivals.length; i++) if(g.rivals[i].d > lo && g.rivals[i].d < hi) b.foe = true;
    for(i=0; i<g.objs.length; i++){
      var o = g.objs[i];
      if(o.d < lo || o.d > hi) continue;
      if(o.k === 'oil' || o.k === 'ice') b.foe = true;
      else if(o.k === 'coin' || o.k === 'nitro') b.item = true;
      else b.clue = true;
    }
    return b;
  },
  intense: function(g){
    var v = 0, i;
    if(g.p.d > g.len*0.75) v = 0.9;
    for(i=0; i<g.rivals.length; i++){
      var r = g.rivals[i];
      if(Math.abs(r.d - g.p.d) < 22 && Math.abs(rcCenter(g, r.d) + r.x - g.p.x) < 20) v = Math.max(v, 0.7);
    }
    if(g.p.jumpT > 0) v = Math.max(v, 0.65);
    return v;
  },
  draw: function(g, eye, m){
    var R = TUNING.race, T = g.theme, p = g.p, i, y, half = R.roadW/2;
    var y0 = -m.my, y1 = RC_H + m.my, n, sub;
    /* world: verge and road, then curbs, lane dashes and verge scenery placed
       in TRACK space, so they scroll with the road instead of shimmering */
    ctx.fillStyle = T.verge; ctx.fillRect(-m.mx, y0, RC_W + m.mx*2, y1 - y0);
    ctx.fillStyle = T.road;
    for(y = Math.floor(y0/2)*2 - 2; y < y1; y += 2){
      var d = p.d + (RC_PY - y);
      ctx.fillRect(rcCenter(g, d) - half, y, R.roadW, 2.5);
    }
    var dLo = p.d - (RC_H - RC_PY) - m.my - 30, dHi = p.d + RC_PY + m.my + 30;
    ctx.fillStyle = T.edge;
    for(n = Math.floor(dLo/12); n*12 < dHi; n++){
      if(n & 1) continue;
      for(sub=0; sub<3; sub++){
        var dc = n*12 + sub*4, cc = rcCenter(g, dc), yc = rcScreenY(g, dc + 4);
        ctx.fillRect(cc - half - 3, yc, 3, 4.5); ctx.fillRect(cc + half, yc, 3, 4.5);
      }
    }
    ctx.fillStyle = '#c9c4b6';
    for(n = Math.floor(dLo/30); n*30 < dHi; n++){
      for(sub=0; sub<2; sub++){
        var dd = n*30 + sub*5, cd = rcCenter(g, dd), yd = rcScreenY(g, dd + 5);
        for(i=1; i<R.lanes; i++) ctx.fillRect(cd - half + i*R.roadW/R.lanes - 0.6, yd, 1.2, 5.5);
      }
    }
    for(n = Math.floor(dLo/24); n*24 < dHi; n++){
      var dh = hash2(n, g.lv*31 + 7);
      if(dh < 0.5) continue;
      var dcx = rcCenter(g, n*24), side = dh > 0.75 ? 1 : -1;
      rcDrawDeco(T, dcx + side*(half + 13 + (dh*100 % 9)), rcScreenY(g, n*24));
    }
    var q = g.len/4;
    for(i=1; i<=4; i++){
      var cy = rcScreenY(g, q*i);
      if(cy < y0 - 10 || cy > y1 + 10) continue;
      var ccx = rcCenter(g, q*i);
      if(i < 4){ ctx.fillStyle = '#c9c4b6'; ctx.fillRect(ccx - half, cy - 1, R.roadW, 2); }
      else for(var k=0; k<14; k++){ ctx.fillStyle = (k & 1) ? '#12151d' : C.bone; ctx.fillRect(ccx - half + k*R.roadW/14, cy - 3, R.roadW/14 + 0.3, 3); ctx.fillStyle = (k & 1) ? C.bone : '#12151d'; ctx.fillRect(ccx - half + k*R.roadW/14, cy, R.roadW/14 + 0.3, 3); }
    }
    var lo = p.d - (RC_H - RC_PY) - 20 - m.my, hi = p.d + RC_PY + 20 + m.my;
    function each(kinds, fn){
      for(var j=0; j<g.objs.length; j++){
        var o = g.objs[j];
        if(o.d < lo || o.d > hi || kinds.indexOf(o.k) < 0) continue;
        fn(o, rcCenter(g, o.d) + rcLaneX(o.lane), rcScreenY(g, o.d));
      }
    }
    withLayer(eye, 'clue', function(){ each(['pad', 'ramp'], rcDrawClue); });
    withLayer(eye, 'item', function(){ each(['coin', 'nitro'], rcDrawItem); fxDraw(g.fxItem); });
    withLayer(eye, 'foe', function(){
      each(['oil', 'ice'], rcDrawHazard);
      for(i=0; i<g.rivals.length; i++){
        var r = g.rivals[i];
        if(r.d < lo || r.d > hi) continue;
        ctx.save(); ctx.translate(rcCenter(g, r.d) + r.x, rcScreenY(g, r.d));
        if(r.spin > 0) ctx.rotate(r.spin*0.4);
        drawCarSprite({ c:r.col, d:'#1c2233' }, false, r.bumper);
        ctx.restore();
      }
      fxDraw(g.fxFoe);
    });
    /* player: shadow, the car (bigger while it flies), the nitro flame */
    fxDraw(g.fxPlayer);
    if(p.z > 0){ ctx.fillStyle = '#0b1016'; ctx.fillRect(p.x - 5 + p.z*0.4, RC_PY - 6 + p.z*0.6, 10, 14); }
    ctx.save(); ctx.translate(p.x, RC_PY - p.z*0.5);
    var sc = 1 + p.z/22; ctx.scale(sc, sc);
    if(p.spinA) ctx.rotate(p.spinA);
    drawCarSprite(paintOf('car'), input.tool && !cfg.kidMode, false);
    ctx.restore();
  },
  hud: function(g, eye, vp, u){
    var hs = Math.max(9, u*3.6), x = vp.x + vp.w - hs*1.2, y0 = vp.y + hs*3.4, y1 = vp.y + vp.h - hs*2, i;
    ctx.fillStyle = '#1c2233'; ctx.fillRect(x - 2, y0, 4, y1 - y0);
    for(i=1; i<4; i++){ ctx.fillStyle = '#6a718c'; ctx.fillRect(x - 4, y1 - (y1 - y0)*i/4, 8, 1.5); }
    var aF = alphaFor(eye, 'foe');
    if(aF > 0){
      ctx.globalAlpha = aF;
      for(i=0; i<g.rivals.length; i++){
        var k = Math.min(1, g.rivals[i].d/g.len);
        ctx.fillStyle = g.rivals[i].col; ctx.fillRect(x - 3, y1 - (y1 - y0)*k - 1.5, 6, 3);
      }
      ctx.globalAlpha = 1;
    }
    var pk = Math.min(1, g.p.d/g.len);
    ctx.fillStyle = paintOf('car').c; ctx.fillRect(x - 5, y1 - (y1 - y0)*pk - 2.5, 10, 5);
    ctx.strokeStyle = C.bone; ctx.lineWidth = 1; ctx.strokeRect(x - 5, y1 - (y1 - y0)*pk - 2.5, 10, 5);
    var place = rcPlace(g);
    mtext(String(place), vp.x + vp.w/2 - hs*0.4, vp.y + hs*1.5, hs*1.6, place === 1 ? C.gold : C.bone, 'right', 700, F_PIX);
    mtext(['', 'st', 'nd', 'rd'][place] || 'th', vp.x + vp.w/2 - hs*0.2, vp.y + hs*1.3, hs*0.8, '#9aa0b4', 'left', 600, F_MONO);
  },
  icon: function(cx, cy, s, t){
    var k = s/20, i;
    ctx.fillStyle = '#2f5a33'; ctx.fillRect(cx - s, cy - s*0.9, s*2, s*1.8);
    ctx.fillStyle = '#2c2f38'; ctx.fillRect(cx - k*11, cy - s*0.9, k*22, s*1.8);
    ctx.fillStyle = '#c9c4b6';
    for(i=0; i<5; i++){ var yy = cy - s*0.9 + ((i*k*9 + t*0.8) % (s*1.8)); ctx.fillRect(cx - k*0.5, yy, k, k*4); }
    ctx.save(); ctx.translate(cx - k*5, cy + k*6); ctx.scale(k*1.1, k*1.1); drawCarSprite(paintOf('car'), false, false); ctx.restore();
    ctx.save(); ctx.translate(cx + k*5, cy - k*4 + Math.sin(t*0.05)*k*2); ctx.scale(k*1.1, k*1.1); drawCarSprite({ c:'#e8c84a', d:'#1c2233' }, false, false); ctx.restore();
  }
};
/* a car pointing up the screen, drawn at the origin */
function drawCarSprite(pt, braking, bumper){
  ctx.fillStyle = '#0b1016';
  ctx.fillRect(-6, -6, 2, 4); ctx.fillRect(4, -6, 2, 4); ctx.fillRect(-6, 3, 2, 4); ctx.fillRect(4, 3, 2, 4);
  ctx.fillStyle = pt.d; ctx.fillRect(-4.5, -8, 9, 16);
  ctx.fillStyle = pt.c; ctx.fillRect(-4, -7.5, 8, 15);
  ctx.fillStyle = '#9fc3dc'; ctx.fillRect(-3, -4, 6, 3);
  ctx.fillStyle = '#6f8fa6'; ctx.fillRect(-3, 3, 6, 2);
  ctx.fillStyle = C.bone; ctx.fillRect(-3.5, -8, 2, 1); ctx.fillRect(1.5, -8, 2, 1);
  ctx.fillStyle = braking ? C.blood : '#7a2a24'; ctx.fillRect(-3.5, 7, 2, 1); ctx.fillRect(1.5, 7, 2, 1);
  if(bumper){ ctx.fillStyle = '#12151d'; ctx.fillRect(-4, -1, 8, 1.5); }
}
function rcDrawDeco(T, x, y){
  if(T.name === 'desert'){ ctx.fillStyle = T.deco; ctx.fillRect(x - 1, y - 6, 2, 8); ctx.fillRect(x - 4, y - 3, 3, 1.5); ctx.fillRect(x - 4, y - 5, 1.5, 3); ctx.fillRect(x + 1, y - 4, 3, 1.5); }
  else if(T.name === 'city'){ ctx.fillStyle = T.deco2; ctx.fillRect(x - 5, y - 5, 10, 10); ctx.fillStyle = T.deco; ctx.fillRect(x - 4, y - 4, 8, 3); }
  else { ctx.fillStyle = T.deco; ctx.fillRect(x - 5, y - 5, 10, 9); ctx.fillStyle = T.deco2; ctx.fillRect(x - 3, y - 4, 6, 5); ctx.fillStyle = '#4a3422'; ctx.fillRect(x - 1, y + 4, 2, 3); }
}
function rcDrawClue(o, x, y){
  if(o.k === 'pad'){
    ctx.fillStyle = '#8fd8b4';
    for(var i=0; i<3; i++){ var yy = y + 4 - i*4; ctx.fillRect(x - 5, yy, 3, 1.5); ctx.fillRect(x - 2, yy - 1.5, 4, 1.5); ctx.fillRect(x + 2, yy, 3, 1.5); }
  } else {
    ctx.fillStyle = '#c98a4a'; ctx.fillRect(x - 8, y - 3, 16, 7);
    ctx.fillStyle = '#e8b13f'; ctx.fillRect(x - 8, y - 4, 16, 2);
    ctx.fillStyle = '#8a5a30'; ctx.fillRect(x - 6, y, 3, 2); ctx.fillRect(x - 1, y, 3, 2); ctx.fillRect(x + 4, y, 3, 2);
  }
}
function rcDrawItem(o, x, y){
  if(o.k === 'coin'){
    var w = ((ARC.t + o.d) % 40) < 6 ? 2 : 4;
    ctx.fillStyle = '#8a6a1c'; ctx.fillRect(x - w/2, y - 3, w + 1, 6);
    ctx.fillStyle = C.gold; ctx.fillRect(x - w/2, y - 3, w, 5);
  } else {
    ctx.fillStyle = C.blood; ctx.fillRect(x - 3, y - 4, 6, 8);
    ctx.fillStyle = C.gold; ctx.fillRect(x - 3, y - 1, 6, 2); ctx.fillRect(x - 1, y - 6, 2, 2);
  }
}
function rcDrawHazard(o, x, y){
  if(o.k === 'oil'){
    ctx.fillStyle = '#0c0e14'; ctx.fillRect(x - 6, y - 3, 12, 6); ctx.fillRect(x - 4, y - 5, 8, 10);
    ctx.fillStyle = '#3c4d78'; ctx.fillRect(x - 2, y - 2, 3, 1);
  } else {
    ctx.fillStyle = '#b8d4e8'; ctx.fillRect(x - 8, y - 6, 16, 12);
    ctx.fillStyle = '#e6f0f6'; ctx.fillRect(x - 6, y - 4, 5, 1); ctx.fillRect(x + 1, y + 1, 5, 1);
  }
}
