
/* ============================================================
   THE WORLD — the Oceanhorn part: grass to cut, pots to smash,
   stones to push, torches to light, sparkles to dig, chests to
   open, cracked walls to blow, eye switches to shoot.

   Which layer each thing is drawn on is the whole design here:
     world (both eyes, full contrast) — bushes, pots, stones, torches
     clue  (alphaFor 'clue')          — plates, sparkles, cracks, eye switches, glow-bugs
     item  (alphaFor 'item')          — chests, coins, keys, anything you GET
   The things he wants to find sit on the per-eye layers, so the
   looking is driven by curiosity and not only by being chased.

   Clues are composited over whatever they sit on — plates and
   sparkles over the floor, cracks and eyes over a flat wall face —
   so alpha is still exactly their contrast against their ground.
   ============================================================ */
var FACEV = { n:[0,-1], s:[0,1], e:[1,0], w:[-1,0] };

function worldEnterRoom(st){
  G.objs = (G.spec.objs || []).map(function(o, idx){
    var ob = {}; for(var k in o) ob[k] = o[k];
    ob.idx = idx; ob.id = G.key + ':' + idx;
    if(ob.k === 'chest'){
      ob.open = !!st.opened[idx];
      ob.shown = !ob.hidden || ob.open || (ob.hidden === 'puzzle' && st.solved) || (ob.hidden === 'eye' && st.eyeHit);
    }
    if(ob.k === 'block' && st.solved && st.blocks && st.blocks[idx]){ ob.x = st.blocks[idx][0]; ob.y = st.blocks[idx][1]; }
    if(ob.k === 'block') ob.mv = null;
    if(ob.k === 'torch') ob.lit = !!st.lit[idx];
    if(ob.k === 'sparkle') ob.dug = !!st.dug[idx];
    if(ob.k === 'eye') ob.hit = !!st.eyeHit;
    if(ob.k === 'crack') ob.broken = !!st.cracked[ob.x + ',' + ob.y];
    return ob;
  });
  G.pushT = 0;
  /* glow-bugs: a few drift through every ordinary room, a coin each, once.
     They are on the clue layer, so spotting them is the weaker eye's job. */
  G.bugs = [];
  if(!G.spec.puzzle && !G.spec.boss){
    var W = TUNING.world, b, tries;
    if(st.bugs == null) st.bugs = W.bugsMin + Math.floor(Math.random()*(W.bugsMax - W.bugsMin + 1));
    for(b=0; b<st.bugs; b++){
      for(tries=0; tries<40; tries++){
        var tx = 2 + Math.floor(Math.random()*(RW - 4)), ty = 2 + Math.floor(Math.random()*(RH - 4));
        if(G.grid[ty][tx] !== T_FLOOR || objAt(tx, ty)) continue;
        G.bugs.push({ x:tx*TS + 8, y:ty*TS + 8, vx:0, vy:0, ph:(Math.random()*60)|0 });
        break;
      }
    }
  }
}
function catchBug(i){
  var b = G.bugs[i], st = rs(G.key);
  G.bugs.splice(i, 1);
  st.bugs = Math.max(0, (st.bugs || 1) - 1);
  G.fx.push({ x:b.x, y:b.y, t:16, type:'bugpop' });
  addCoins(1); sfx('bug');
  owlProgress();
}
function objAt(tx, ty, kind){
  for(var i=0; i<G.objs.length; i++){
    var o = G.objs[i];
    if(o.x === tx && o.y === ty && (!kind || o.k === kind)) return o;
  }
  return null;
}
function objSolidAt(tx, ty){
  for(var i=0; i<G.objs.length; i++){
    var o = G.objs[i];
    if(o.x !== tx || o.y !== ty) continue;
    if(o.k === 'block' || o.k === 'torch') return true;
    if(o.k === 'chest' && o.shown) return true;
  }
  return false;
}
function frontTile(){
  var p = G.p, v = FACEV[p.face];
  return [Math.floor((p.x + v[0]*TS*0.85)/TS), Math.floor((p.y + v[1]*TS*0.85)/TS)];
}
function tileCentre(tx, ty){ return [tx*TS + TS/2, ty*TS + TS/2]; }

/* ---------------- the one button ---------------- */
function worldInteract(){
  var ft = frontTile(), ch = objAt(ft[0], ft[1], 'chest');
  if(ch && ch.shown && !ch.open){ openChest(ch); return true; }
  var p = G.p, R = TUNING.world.digRange;
  for(var i=0; i<G.objs.length; i++){
    var o = G.objs[i];
    if(o.k !== 'sparkle' || o.dug) continue;
    var c = tileCentre(o.x, o.y);
    if(Math.hypot(c[0]-p.x, c[1]-p.y) < R){ dig(o); return true; }
  }
  return false;
}
function openChest(ch){
  ch.open = true;
  rs(G.key).opened[ch.idx] = true;
  if(ch.secret) markSecret(ch);
  grantItem(ch.item, ch.amount);
  startHold(ch.item);
  owlProgress();
}
function dig(o){
  o.dug = true;
  rs(G.key).dug[o.idx] = true;
  var c = tileCentre(o.x, o.y);
  spawnCoins(c[0], c[1], o.coins || TUNING.world.sparkleCoins);
  G.fx.push({ x:c[0], y:c[1], t:18, type:'dust' });
  if(o.secret) markSecret(o);
  sfx('dig'); owlSay('good');
  owlProgress();
}
function markSecret(o){
  var id = ISLAND.id;
  if(!PROG.secrets[id]) PROG.secrets[id] = {};
  if(!PROG.secrets[id][o.id]){ PROG.secrets[id][o.id] = true; S.secrets++; saveProg(); }
}
function spawnCoins(x, y, n){
  var B = TUNING.world.coinBurst;
  for(var i=0; i<n; i++){
    var a = Math.random()*6.283, sp = B*(0.5 + Math.random());
    G.items.push({ type:'coin', x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, r:3, bob:Math.random()*6 });
  }
}

/* ---------------- cutting and smashing ---------------- */
function worldSwordHit(sb){
  var x0 = Math.floor((sb.x - sb.w/2)/TS), x1 = Math.floor((sb.x + sb.w/2 - 0.01)/TS);
  var y0 = Math.floor((sb.y - sb.h/2)/TS), y1 = Math.floor((sb.y + sb.h/2 - 0.01)/TS), tx, ty;
  for(ty=y0; ty<=y1; ty++) for(tx=x0; tx<=x1; tx++){
    if(ty < 0 || tx < 0 || ty >= RH || tx >= RW) continue;
    var t = G.grid[ty][tx];
    if(t === T_BUSH || t === T_POT) cutTile(tx, ty);
    var o = objAt(tx, ty);
    if(o && o.k === 'torch' && !o.lit) lightTorch(o);
    if(o && o.k === 'sparkle' && !o.dug) dig(o);
  }
  for(var i = (G.bugs || []).length - 1; i >= 0; i--){
    var b = G.bugs[i];
    if(Math.abs(b.x - sb.x) < sb.w/2 + 3 && Math.abs(b.y - sb.y) < sb.h/2 + 3) catchBug(i);
  }
}
function cutTile(tx, ty){
  var t = G.grid[ty][tx], W = TUNING.world, c = tileCentre(tx, ty), p = G.p;
  G.grid[ty][tx] = T_FLOOR;
  rs(G.key).cut[tx + ',' + ty] = true;
  G.fx.push({ x:c[0], y:c[1], t:20, type: t === T_POT ? 'shard' : 'leaf', seed:Math.random()*6 });
  sfx(t === T_POT ? 'pot' : 'cut');
  var roll = Math.random();
  if(p.hp < p.maxhp && roll < W.heartChance) G.items.push({ type:'heart', x:c[0], y:c[1], r:6, bob:0, loose:true });
  else if(roll < (t === T_POT ? W.potCoinChance : W.bushCoinChance)) spawnCoins(c[0], c[1], t === T_POT ? 3 : 1);
  owlProgress();
}
function lightTorch(o){
  o.lit = true;
  rs(G.key).lit[o.idx] = true;
  sfx('light');
  owlProgress();
}

/* ---------------- pushing stones ---------------- */
function blockAt(tx, ty){ return objAt(tx, ty, 'block'); }
function blockCanEnter(x, y){
  /* never into the outer ring: that is where every doorway is, and a stone
     parked in a doorway is a room you cannot leave */
  if(x < 2 || y < 2 || x > RW-3 || y > RH-3) return false;
  if(G.grid[y][x] !== T_FLOOR) return false;
  for(var i=0; i<G.objs.length; i++){
    var o = G.objs[i];
    if(o.x === x && o.y === y && o.k !== 'plate') return false;
  }
  for(i=0; i<G.foes.length; i++){
    var f = G.foes[i];
    if(Math.floor(f.x/TS) === x && Math.floor(f.y/TS) === y) return false;
  }
  return true;
}
function worldPush(ix, iy){
  var p = G.p, dir = null;
  if(Math.abs(ix) > 0.5 && Math.abs(iy) < 0.35) dir = ix > 0 ? 'e' : 'w';
  else if(Math.abs(iy) > 0.5 && Math.abs(ix) < 0.35) dir = iy > 0 ? 's' : 'n';
  if(!dir){ G.pushT = 0; return; }
  var v = FACEV[dir];
  var tx = Math.floor((p.x + v[0]*(p.w/2 + 3))/TS), ty = Math.floor((p.y + v[1]*(p.h/2 + 3))/TS);
  var b = blockAt(tx, ty);
  if(!b || b.mv){ G.pushT = 0; return; }
  /* a stone that solved its puzzle stays on its plate: the room is already
     open, and a plate that looks un-pressed would say otherwise */
  if(rs(G.key).solved && objAt(b.x, b.y, 'plate')){ G.pushT = 0; return; }
  var c = tileCentre(b.x, b.y);
  if((dir === 'e' || dir === 'w') ? Math.abs(p.y - c[1]) > TS*0.5 : Math.abs(p.x - c[0]) > TS*0.5){ G.pushT = 0; return; }
  G.pushT = (G.pushDir === dir) ? G.pushT + 1 : 1;
  G.pushDir = dir;
  if(G.pushT < TUNING.world.pushFrames) return;
  G.pushT = 0;
  var nx = b.x + v[0], ny = b.y + v[1];
  if(!blockCanEnter(nx, ny)){ sfx('uiEdge'); return; }
  b.mv = { fx:b.x, fy:b.y, t:0 };
  b.x = nx; b.y = ny;
  sfx('push');
  owlProgress();
}

/* ---------------- blasts and arrows (from 44-tools.js) ---------------- */
function worldBlast(x, y, r){
  var tx, ty, st = rs(G.key);
  for(ty=0; ty<RH; ty++) for(tx=0; tx<RW; tx++){
    var c = tileCentre(tx, ty);
    if(Math.hypot(c[0]-x, c[1]-y) > r) continue;
    var t = G.grid[ty][tx];
    if(t === T_BUSH || t === T_POT) cutTile(tx, ty);
    else if(t === T_CRACK){
      G.grid[ty][tx] = T_FLOOR;
      st.cracked[tx + ',' + ty] = true;
      var ck = objAt(tx, ty, 'crack'); if(ck) ck.broken = true;
      G.fx.push({ x:c[0], y:c[1], t:24, type:'shard', seed:Math.random()*6 });
      sfx('rumble'); owlSay('secret', true);
    }
    var o = objAt(tx, ty);
    if(o && o.k === 'torch' && !o.lit) lightTorch(o);
  }
}
function worldArrowHit(tx, ty){
  var o = objAt(tx, ty);
  if(!o) return;
  if(o.k === 'torch' && !o.lit) lightTorch(o);
  if(o.k === 'eye' && !o.hit){
    o.hit = true;
    rs(G.key).eyeHit = true;
    reveal('eye');
    sfx('puzzle'); owlSay('solved', true);
    owlProgress();
  }
}

/* ---------------- puzzles ---------------- */
function reveal(group){
  G.objs.forEach(function(o){
    if(o.k === 'chest' && o.hidden === group && !o.shown){
      o.shown = true;
      var c = tileCentre(o.x, o.y);
      G.fx.push({ x:c[0], y:c[1], t:30, type:'appear' });
    }
  });
  unstick();
}
function puzzleSolved(){
  var st = rs(G.key), kind = G.spec.puzzle;
  if(!kind || st.solved) return false;
  if(kind === 'push'){
    var plates = G.objs.filter(function(o){ return o.k === 'plate'; });
    return plates.length > 0 && plates.every(function(pl){ var b = blockAt(pl.x, pl.y); return b && !b.mv; });
  }
  if(kind === 'torch'){
    var torches = G.objs.filter(function(o){ return o.k === 'torch'; });
    return torches.length > 0 && torches.every(function(t){ return t.lit; });
  }
  return false;
}
function worldTick(){
  var SL = TUNING.world.pushSlideFrames, W = TUNING.world, p = G.p, i;
  for(i = (G.bugs || []).length - 1; i >= 0; i--){
    var b = G.bugs[i];
    b.ph++;
    b.vx += (Math.random() - 0.5)*0.06; b.vy += (Math.random() - 0.5)*0.06;
    var sp = Math.hypot(b.vx, b.vy);
    if(sp > W.bugSpeed){ b.vx *= W.bugSpeed/sp; b.vy *= W.bugSpeed/sp; }
    var nx = b.x + b.vx, ny = b.y + b.vy;
    if(nx < TS + 3 || nx > WW - TS - 3 || tileSolid(G.grid[Math.floor(b.y/TS)][Math.floor(nx/TS)])) b.vx = -b.vx; else b.x = nx;
    if(ny < TS + 3 || ny > WH - TS - 3 || tileSolid(G.grid[Math.floor(ny/TS)][Math.floor(b.x/TS)])) b.vy = -b.vy; else b.y = ny;
    if(Math.hypot(b.x - p.x, b.y - (p.y - 3)) < W.bugCatch) catchBug(i);
  }
  G.objs.forEach(function(o){
    if(o.k === 'block' && o.mv){ o.mv.t++; if(o.mv.t >= SL) o.mv = null; }
  });
  if(puzzleSolved()){
    var st = rs(G.key);
    st.solved = true;
    st.blocks = {};
    G.objs.forEach(function(o){ if(o.k === 'block') st.blocks[o.idx] = [o.x, o.y]; });
    reveal('puzzle');
    sfx('puzzle'); owlSay('solved', true);
    owlProgress();
  }
}
/* is anything on the clue layer still waiting to be found? (telemetry + owl) */
function clueActive(){
  var st = rs(G.key);
  if(G.bugs && G.bugs.length) return true;
  return G.objs.some(function(o){
    if(o.k === 'plate') return !st.solved;
    if(o.k === 'sparkle') return !o.dug;
    if(o.k === 'crack') return !o.broken;
    if(o.k === 'eye') return !o.hit;
    return false;
  });
}
function itemsVisible(){
  return G.items.length > 0 || G.objs.some(function(o){ return o.k === 'chest' && o.shown && !o.open; });
}

/* ---------------- drawing ----------------
   Called from drawEye() in 50-render.js, which sets the layer alpha first. */
function blockPixel(o){
  var x = o.x*TS, y = o.y*TS;
  if(o.mv){
    var k = o.mv.t / TUNING.world.pushSlideFrames;
    x = (o.mv.fx + (o.x - o.mv.fx)*k)*TS; y = (o.mv.fy + (o.y - o.mv.fy)*k)*TS;
  }
  return [x, y];
}
/* world layer: stones and torches */
function drawWorldObjs(){
  G.objs.forEach(function(o){
    if(o.k === 'block'){
      var b = blockPixel(o), x = b[0], y = b[1];
      ctx.fillStyle = '#0b1016'; ctx.fillRect(x+1, y+TS-3, TS-2, 3);
      ctx.fillStyle = '#6b6f7c'; ctx.fillRect(x+1, y+1, TS-2, TS-3);
      ctx.fillStyle = '#8a8f9e'; ctx.fillRect(x+1, y+1, TS-2, 4);
      ctx.fillStyle = '#4c505c'; ctx.fillRect(x+4, y+8, 8, 1); ctx.fillRect(x+7, y+5, 1, 3);
    } else if(o.k === 'torch'){
      var tx = o.x*TS, ty = o.y*TS;
      ctx.fillStyle = '#0b1016'; ctx.fillRect(tx+4, ty+TS-3, 8, 2);
      ctx.fillStyle = '#4a3c22'; ctx.fillRect(tx+6, ty+7, 4, 7);
      ctx.fillStyle = '#6b5530'; ctx.fillRect(tx+4, ty+5, 8, 3);
      if(o.lit){
        var fl = ((G.t >> 2) + o.idx) & 1;
        ctx.fillStyle = C.gold;  ctx.fillRect(tx+5, ty+fl, 6, 5);
        ctx.fillStyle = C.blood; ctx.fillRect(tx+6, ty+1+fl, 4, 3);
        ctx.fillStyle = C.bone;  ctx.fillRect(tx+7, ty+3, 2, 2);
      } else {
        ctx.fillStyle = '#2a2418'; ctx.fillRect(tx+5, ty+3, 6, 2);
      }
    }
  });
}
/* clue layer: the things worth finding */
function drawClueObjs(){
  var st = rs(G.key);
  G.objs.forEach(function(o){
    var x = o.x*TS, y = o.y*TS;
    if(o.k === 'plate'){
      var pressed = st.solved || !!blockAt(o.x, o.y);
      ctx.fillStyle = pressed ? C.jade : '#b9b3a3';
      ctx.fillRect(x+2, y+2, TS-4, 2); ctx.fillRect(x+2, y+TS-4, TS-4, 2);
      ctx.fillRect(x+2, y+2, 2, TS-4); ctx.fillRect(x+TS-4, y+2, 2, TS-4);
      if(pressed){ ctx.fillRect(x+6, y+6, 4, 4); }
    } else if(o.k === 'sparkle' && !o.dug){
      /* the twinkle changes SHAPE, never alpha — alpha is the contrast */
      var ph = (G.t + o.idx*23) % 60, arm = ph < 30 ? 2 + (ph >> 3) : 2 + ((60-ph) >> 3);
      var cx = x + TS/2, cy = y + TS/2;
      ctx.fillStyle = C.bone;
      ctx.fillRect(cx-1, cy-arm, 2, arm*2); ctx.fillRect(cx-arm, cy-1, arm*2, 2);
      ctx.fillStyle = C.gold; ctx.fillRect(cx-1, cy-1, 2, 2);
    } else if(o.k === 'crack' && !o.broken){
      ctx.fillStyle = '#12151d';
      ctx.fillRect(x+7, y+4, 2, 3); ctx.fillRect(x+5, y+7, 3, 2); ctx.fillRect(x+8, y+8, 2, 3);
      ctx.fillRect(x+4, y+10, 2, 2); ctx.fillRect(x+10, y+11, 2, 2);
    } else if(o.k === 'eye'){
      ctx.fillStyle = o.hit ? C.jade : C.bone; ctx.fillRect(x+3, y+6, 10, 5);
      ctx.fillStyle = o.hit ? '#1c3a2c' : C.blood; ctx.fillRect(x+6, y+7, 4, 3);
    }
  });
  /* glow-bugs twinkle by growing their wings — shape, never alpha */
  (G.bugs || []).forEach(function(b){
    var ph = b.ph % 40, arm = ph < 20 ? 1 + (ph >> 3) : 1 + ((40 - ph) >> 3);
    ctx.fillStyle = '#e8f08a'; ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
    ctx.fillStyle = C.bone; ctx.fillRect(b.x - arm - 1, b.y - 0.5, arm, 1); ctx.fillRect(b.x + 1, b.y - 0.5, arm, 1);
  });
  /* a caught bug's burst is spawned by the bug, so it stays on its layer */
  G.fx.forEach(function(e){
    if(e.type !== 'bugpop') return;
    var k = 1 - e.t/16, r = 2 + k*7;
    ctx.fillStyle = '#e8f08a';
    for(var i=0; i<4; i++){ var a = i*1.5708 + 0.785; ctx.fillRect(e.x + Math.cos(a)*r - 1, e.y + Math.sin(a)*r - 1, 2, 2); }
  });
}
/* item layer: chests */
function drawChests(){
  G.objs.forEach(function(o){
    if(o.k !== 'chest' || !o.shown) return;
    var x = o.x*TS, y = o.y*TS;
    ctx.fillStyle = '#0b1016'; ctx.fillRect(x+1, y+TS-3, TS-2, 3);
    ctx.fillStyle = '#6b4424'; ctx.fillRect(x+1, y+5, TS-2, TS-8);
    ctx.fillStyle = o.open ? '#3a2412' : '#8a5a30'; ctx.fillRect(x+1, y+2, TS-2, 5);
    ctx.fillStyle = C.gold; ctx.fillRect(x+1, y+6, TS-2, 1); ctx.fillRect(x+7, y+5, 2, 4);
    if(o.open){ ctx.fillStyle = '#1a1008'; ctx.fillRect(x+3, y+3, TS-6, 2); }
  });
}
/* world-layer debris and blasts: both eyes, full contrast */
function drawWorldFx(){
  G.fx.forEach(function(e){
    var k, i;
    if(e.type === 'leaf' || e.type === 'shard'){
      k = 1 - e.t/20;
      ctx.fillStyle = e.type === 'leaf' ? '#5d9257' : '#a08a64';
      for(i=0;i<5;i++){
        var a = e.seed + i*1.26, r = k*10;
        ctx.fillRect(e.x + Math.cos(a)*r - 1, e.y + Math.sin(a)*r - 1 + k*k*6, 3, 2);
      }
    } else if(e.type === 'dust'){
      k = 1 - e.t/18;
      ctx.fillStyle = '#7a6c58';
      for(i=0;i<4;i++) ctx.fillRect(e.x - 1 + (i-1.5)*k*8, e.y - k*5, 3, 3);
    } else if(e.type === 'boom'){
      k = 1 - e.t/22;
      var R = TUNING.tools.bombRadius * (0.35 + k*0.65);
      ctx.fillStyle = k < 0.4 ? C.bone : (k < 0.7 ? C.gold : '#6b5a44');
      for(i=0;i<12;i++){
        var ang = i*0.5236;
        ctx.fillRect(e.x + Math.cos(ang)*R - 2, e.y + Math.sin(ang)*R - 2, 4, 4);
      }
      if(k < 0.3){ ctx.fillStyle = C.bone; ctx.fillRect(e.x-5, e.y-5, 10, 10); }
    }
  });
}
/* Item-layer effects. The "a chest just appeared" burst belongs to the item
   layer: drawn at full contrast to both eyes it would show the eye that is
   not supposed to see items exactly where one just turned up — the same leak
   the death poofs had on the foe layer. */
function drawItemFx(){
  G.fx.forEach(function(e){
    if(e.type !== 'appear') return;
    var k = 1 - e.t/30, i;
    ctx.fillStyle = C.gold;
    for(i=0;i<6;i++){
      var a2 = i*1.047 + k*2;
      ctx.fillRect(e.x + Math.cos(a2)*(4 + k*12) - 1, e.y + Math.sin(a2)*(4 + k*12) - 1, 2, 2);
    }
  });
}
