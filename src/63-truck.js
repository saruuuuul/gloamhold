
/* ============================================================
   GATOR TRUCK — a side-view monster truck with a gator at the wheel,
   in the spirit of Rallygator's transforming truck (our own art, our
   own courses).

   It has three forms, changed with B at a gate:
     truck  crushes junk cars, hops boulders with A, flips on big jumps
     mini   small and quick — the only form that fits through a tunnel
     sub    dives through a lake; slow and floppy on dry land
   Controls are one job each. The stick is the gas and the brake, and only
   that — it used to lean the truck in the air as well, so a child holding
   the gas tipped the nose down on every hop, every crest and every crushed
   car, and crashed on landing (levels 3 to 5 could not be finished that
   way). Now the truck levels itself in the air and lands on its wheels; A
   hops, and HOLDING A in the air flips it, which is the trick that pays.
   The truck rests on its two wheels, so it sits on a bump the way a truck
   does, and the engine always beats a hill.

   Every gate has a SIGN showing the form it needs, and the sign is on
   the clue layer: finding it is a looking job for the weaker eye. Miss
   it and the gator says so; in child mode it changes by itself after
   the hint, so nobody is ever stuck.

   Layers (invariant 12):
     world   sky, ground, water, tunnel rock, checkpoint and finish flags
     player  the truck in all three forms, the gator, its sparkles
     foe     junk cars, boulders, pufferfish, and what they leave behind
     item    coins, stars, pearls
     clue    gate signs, ramp arrows, bonus balloons
   Signal sprites sit on the uniform sky or the uniform water, which
   are their floors. There is no camera shake: in a viewer that is
   motion he did not make, and it makes people sick.
   ============================================================ */
var TK_W = 200, TK_H = 168, TK_GY = 120;
var TK_THEMES = [
  { name:'meadow', sky:'#16202c', top:'#4f9a4a', body:'#3a2c20', deep:'#2a2018', water:'#1d3f63', rock:'#2f3444' },
  { name:'desert', sky:'#221c18', top:'#d8b26a', body:'#9a7442', deep:'#6b4f2c', water:'#1d4a63', rock:'#5a4a36' },
  { name:'snow',   sky:'#18202a', top:'#e6eaf0', body:'#6a7482', deep:'#4a525e', water:'#1d3a5a', rock:'#3a4250' },
  { name:'forest', sky:'#121a16', top:'#2f7a3a', body:'#2e2418', deep:'#201a12', water:'#1a3a52', rock:'#262b22' },
  { name:'lake',   sky:'#14202c', top:'#57b27a', body:'#3a3026', deep:'#282018', water:'#1c4270', rock:'#2c3444' },
  { name:'moon',   sky:'#0c0e16', top:'#b8bcc8', body:'#6a6e7a', deep:'#4a4e58', water:'#1d3f63', rock:'#3a3e48' }
];
var TK_PLANS = [
  ['hills', 'junk', 'hills', 'junk'],
  ['hills', 'ramp', 'junk', 'ramp', 'hills'],
  ['boulders', 'hills', 'ramp', 'boulders', 'junk'],
  ['hills', 'tunnel', 'junk', 'ramp', 'boulders'],
  ['hills', 'lake', 'ramp', 'junk', 'boulders'],
  ['ramp', 'hills', 'boulders', 'ramp', 'tunnel']
];
var TK_FORMS = {
  truck:{ h:16, half:12, base:8 }, mini:{ h:8, half:7, base:4.5 }, sub:{ h:11, half:11, base:8 }
};

/* ---------------- the course ---------------- */
function tkGround(g, x){
  var i = x/4, a = Math.floor(i), f = i - a;
  if(a < 0) return g.hm[0];
  if(a >= g.hm.length - 1) return g.hm[g.hm.length - 1];
  return g.hm[a] + (g.hm[a + 1] - g.hm[a])*f;
}
function tkSlope(g, x){ return Math.atan2(tkGround(g, x + 3) - tkGround(g, x - 3), 6); }
/* where the truck rests with both wheels on the ground: the height between
   them and the angle of the line through them */
function tkRest(g, x, form){
  var b = TK_FORMS[form].base, gr = tkGround(g, x - b), gf = tkGround(g, x + b);
  return { y:(gr + gf)/2, a:Math.atan2(gf - gr, 2*b) };
}
function tkCeil(g, x){
  for(var i=0; i<g.tunnels.length; i++){ var t = g.tunnels[i]; if(x >= t.x0 && x <= t.x1) return t.y; }
  return -1e9;
}
function tkLakeAt(g, x){
  for(var i=0; i<g.lakes.length; i++){ var l = g.lakes[i]; if(x >= l.x0 && x <= l.x1) return l; }
  return null;
}
function tkDepth(g, x){ var l = tkLakeAt(g, x); return l ? tkGround(g, x) - l.wy : 0; }

function tkBuild(g){
  var T = TUNING.truck, rnd = islandRng((g.lv*104729 + 3) >>> 0), plan, x = 0, i;
  var all = ['hills', 'junk', 'ramp', 'boulders', 'tunnel', 'lake'];
  if(g.lv <= TK_PLANS.length) plan = TK_PLANS[g.lv - 1].slice();
  else {
    plan = []; var len = 0, target = T.stageBase + (g.lv - 1)*T.stageStep;
    while(len < target){ var k = all[Math.floor(rnd()*all.length)]; if(k === 'lake' && g.theme.name === 'moon') k = 'ramp'; plan.push(k); len += 340; }
  }
  g.hm = []; g.tunnels = []; g.lakes = []; g.gates = []; g.junk = []; g.boulders = []; g.puffers = [];
  g.coins = []; g.stars = []; g.pearls = []; g.balloons = []; g.arrows = []; g.flags = [];
  var soft = cfg.kidMode ? 0.8 : 1;
  function fill(x0, len, fn){ for(var s = Math.floor(x0/4); s <= Math.ceil((x0 + len)/4); s++) g.hm[s] = fn(s*4 - x0); }
  fill(0, 160, function(){ return TK_GY; });
  /* something to find from the first second: a trail of coins, a sign, a balloon */
  for(i=0; i<5; i++) g.coins.push({ x:96 + i*12, y:TK_GY - 8 - (i % 2)*4 });
  g.arrows.push({ x:84 });
  g.balloons.push({ x:150, y:TK_GY - 42, ph:0 });
  x = 160;
  for(i=0; i<plan.length; i++){
    var kind = plan[i], L = 340, x0 = x;
    if(kind === 'hills'){
      var A = (8 + rnd()*10)*soft, humps = 1 + Math.floor(rnd()*2);
      fill(x0, L, function(lx){ return TK_GY - A*(1 - Math.cos(6.2832*humps*lx/L))/2; });
      for(var h=0; h<humps; h++){
        var hx = x0 + (h + 0.5)*L/humps;
        for(var c=-2; c<=2; c++) g.coins.push({ x:hx + c*10, y:TK_GY - A - 12 - (2 - Math.abs(c))*3 });
      }
    } else if(kind === 'junk'){
      fill(x0, L, function(){ return TK_GY; });
      var nj = 2 + (g.lv >= 3 ? 1 : 0);
      for(var j=0; j<nj; j++) g.junk.push({ x:x0 + 70 + j*(L - 110)/Math.max(1, nj - 1), crushed:false, col:['#8a4a3a','#3a5a8a','#6a7a3a'][j % 3] });
      for(var c2=0; c2<4; c2++) g.coins.push({ x:x0 + L - 40 + c2*8, y:TK_GY - 10 });
    } else if(kind === 'ramp'){
      var rh = 30*soft;
      fill(x0, L, function(lx){ return (lx >= 60 && lx < 120) ? TK_GY - rh*(lx - 60)/60 : TK_GY; });
      g.arrows.push({ x:x0 + 30 });
      /* coins along the flight, a star at the top of it */
      for(var c3=0; c3<6; c3++){ var fx = x0 + 130 + c3*12, t3 = c3/5; g.coins.push({ x:fx, y:TK_GY - rh - 14 - Math.sin(t3*3.14)*16 + t3*18 }); }
      g.stars.push({ x:x0 + 160, y:TK_GY - rh - 34 });
      if(rnd() < 0.7) g.balloons.push({ x:x0 + 200 + rnd()*60, y:TK_GY - rh - 44 - rnd()*16, ph:rnd()*6 });
    } else if(kind === 'boulders'){
      fill(x0, L, function(){ return TK_GY; });
      var nb = 2 + (g.lv >= 5 ? 1 : 0);
      for(var b=0; b<nb; b++) g.boulders.push({ x:x0 + 80 + b*(L - 130)/Math.max(1, nb - 1), r:(5 + rnd()*2)*(cfg.kidMode ? 0.85 : 1) });
      g.stars.push({ x:x0 + 80 + (L - 130)/2, y:TK_GY - 34 });
    } else if(kind === 'tunnel'){
      fill(x0, L, function(){ return TK_GY; });
      g.tunnels.push({ x0:x0 + 70, x1:x0 + 250, y:TK_GY - 12 });
      g.gates.push({ x:x0 + 36, form:'mini' });
      g.gates.push({ x:x0 + 290, form:'truck' });
      for(var c4=0; c4<8; c4++) g.coins.push({ x:x0 + 100 + c4*16, y:TK_GY - 5 });
    } else if(kind === 'lake'){
      L = 380;
      fill(x0, L, function(lx){
        if(lx < 50) return TK_GY;
        if(lx < 72) return TK_GY + 44*(lx - 50)/22;
        if(lx < 318) return TK_GY + 44;
        if(lx < 340) return TK_GY + 44*(340 - lx)/22;
        return TK_GY;
      });
      g.lakes.push({ x0:x0 + 50, x1:x0 + 340, wy:TK_GY + 3 });
      g.gates.push({ x:x0 + 22, form:'sub' });
      g.gates.push({ x:x0 + 360, form:'truck' });
      for(var pz=0; pz<5; pz++) g.pearls.push({ x:x0 + 100 + pz*45, y:TK_GY + 16 + (pz % 2)*16 });
      for(var pf=0; pf<2 + (g.lv >= 6 ? 1 : 0); pf++) g.puffers.push({ x:x0 + 140 + pf*70, y0:TK_GY + 22, ph:rnd()*6, puff:0 });
    }
    x += L;
    g.flags.push({ x:x, seg:i + 2 });
  }
  g.flags.pop();                       /* the last section ends at the finish, not a checkpoint */
  fill(x, 200, function(){ return TK_GY; });
  g.finish = x + 60;
  g.len = x + 200;
}

/* ---------------- the truck ---------------- */
function tkTransform(g, form){
  var t = g.t;
  if(t.form === form) return;
  t.form = form; t.squash = 10;
  fxBurst(g.fxPlayer, t.x, t.y - 8, 14, C.gold, 1.4, 22, 2.6);
  sfx('transform'); arcHitstop(3);
  g.stuck = 0;
}
/* B works from a little before the sign right up to the obstacle behind it —
   the truck parks against the tunnel's rock or at the water's edge, and B
   there has to work, not honk */
function tkNearGate(g){
  var t = g.t, i;
  for(i=0; i<g.gates.length; i++){
    var gt = g.gates[i];
    if(t.x > gt.x - 48 && t.x < gt.x + 44) return gt;
  }
  return null;
}
function tkClearOfRock(g, x){ return tkCeil(g, x - 14) < -1e8 && tkCeil(g, x + 14) < -1e8; }
/* out of the water entirely: a truck or mini made while still swimming would
   sink, and used to be sent back to the start of the lake */
function tkDry(g, x){ return tkDepth(g, x - 14) <= 1 && tkDepth(g, x) <= 1 && tkDepth(g, x + 14) <= 1; }
function tkCanBecome(g, form, x){
  if(form === 'sub') return true;
  if(!tkDry(g, x)) return false;
  return form !== 'truck' || tkClearOfRock(g, x);
}
/* the next gate ahead that wants a different form */
function tkGateAhead(g){
  var t = g.t, i;
  for(i=0; i<g.gates.length; i++){
    var gt = g.gates[i];
    if(gt.x > t.x - 30 && gt.x < t.x + 110 && gt.form !== t.form) return gt;
  }
  return null;
}
function tkCrash(g){
  var t = g.t, T = TUNING.truck;
  if(t.crash > 0 || t.inv > 0) return;
  t.crash = T.crashFrames; t.va = (t.vx >= 0 ? 0.22 : -0.22); t.vy = -1.6; t.grounded = false;
  g.crashes++;
  sfx('oof'); arcHitstop(6);
  arcSegFail();
  if(cfg.kidMode){ arcKnockdown(); arcSay('oops_ok', true); }
}
function tkRespawn(g){
  var t = g.t, x = g.cp;
  t.x = x; t.vx = 0; t.vy = 0; t.va = 0; t.vyG = 0; t.fg = null;
  t.grounded = true; t.crash = 0; t.inv = 70; t.air = 0; t.rot = 0;
  if(tkLakeAt(g, x) && tkDepth(g, x) > 3) t.form = 'sub';
  else if(tkCeil(g, x) > -1e8) t.form = 'mini';
  else if(t.form === 'sub') t.form = 'truck';
  var rest = tkRest(g, x, t.form); t.y = rest.y; t.a = rest.a;
  /* cut straight to him: a camera sweeping back across the course is motion
     he did not make, and that is what makes people sick in a viewer */
  g.cam.x = t.x - 70; g.cam.y = Math.min(TK_GY - 104, t.y - 100);
}
function tkLand(g){
  var t = g.t, T = TUNING.truck, rest = tkRest(g, t.x, t.form), sl = rest.a;
  var diff = Math.atan2(Math.sin(t.a - sl), Math.cos(t.a - sl));
  t.y = rest.y;
  if(Math.abs(diff) > (cfg.kidMode ? T.kidLandTol : T.landTol)){ tkCrash(g); return; }
  var flips = Math.floor(Math.abs(t.rot)/6.2832 + 0.15);
  if(flips > 0){
    /* stars for flips are capped per stage, so a flip is a treat, not a farm */
    var give = Math.max(0, Math.min(flips*T.flipStars, T.flipStarsMax - g.flipStars));
    g.flipStars += give;
    if(give) arcStar(give);
    arcBanner(flips > 1 ? flips + 'x FLIP!' : 'FLIP!', C.gold); sfx('flip'); arcSay('wow', true);
  }
  else if(t.air > 44) arcSay('bigjump');
  if(t.air > 10){ sfx('land'); t.squash = 8; }
  t.grounded = true; t.a = sl; t.va = 0; t.rot = 0; t.air = 0; t.vyG = 0; t.fg = null;
  t.vx *= 0.92;
}

GAMES.truck = {
  id:'truck', name:'GATOR TRUCK', say:'g_truck', col:'#6fcf6f', label:'PLAY',
  W:TK_W, H:TK_H,
  doneSub: function(){ return ARC.g ? ARC.g.theme.name : ''; },
  start: function(lv){
    var g = { lv:lv, theme:TK_THEMES[(lv - 1) % TK_THEMES.length],
              t:{ x:60, y:TK_GY, vx:0, vy:0, a:0, va:0, grounded:true, form:'truck', crash:0, inv:40, air:0, rot:0, wheel:0, squash:0, honk:0 },
              cam:{ x:0, y:TK_GY - 104 }, cp:60, seg:1, crashes:0, stuck:0, subLand:0, hopSaid:false, flipStars:0, flipSaid:false,
              fxFoe:[], fxItem:[], fxClue:[], fxPlayer:[] };
    tkBuild(g);
    g.cam.x = g.t.x - 70;
    arcSegStart('Gator Truck level ' + lv + ' part 1');
    arcBanner(g.theme.name.toUpperCase(), C.jade);
    if(lv >= 2 && lv <= 6) arcSay('newthing', true);
    return g;
  },
  update: function(g){
    var T = TUNING.truck, t = g.t, F = TK_FORMS[t.form], grav = g.theme.name === 'moon' ? T.moonGravity : T.gravity, i;
    fxStep(g.fxFoe, 0.05); fxStep(g.fxItem, 0); fxStep(g.fxClue, 0); fxStep(g.fxPlayer, 0);
    if(t.squash > 0) t.squash--;
    if(t.inv > 0) t.inv--;
    if(t.honk > 0) t.honk--;
    /* a crash tumbles, then puts him back at the last flag, upright */
    if(t.crash > 0){
      t.vy += grav; t.x += t.vx*0.6; t.y += t.vy; t.a += t.va;
      if(t.y > tkGround(g, t.x)){ t.y = tkGround(g, t.x); t.vy *= -0.3; t.vx *= 0.7; }
      if(--t.crash === 0) tkRespawn(g);
      tkCamera(g);
      return;
    }
    var lake = tkLakeAt(g, t.x), swimming = t.form === 'sub' && lake && t.y > lake.wy - 1;
    var thr = input.x;
    /* B: change at a gate, honk anywhere else */
    if(input.toolPress){
      var gate = tkNearGate(g);
      if(gate && gate.form !== t.form){
        /* never grow into the big truck under rock, nor leave the sub in water */
        if(tkCanBecome(g, gate.form, t.x)) tkTransform(g, gate.form);
        else sfx('bump');
      } else if(t.honk <= 0){ sfx('honk'); t.honk = 20; }
    }
    if(swimming){
      /* free swimming: the stick is where the sub goes */
      t.vx = (t.vx + thr*T.subSwim)*0.96; t.vy = (t.vy + input.y*T.subSwim - 0.004)*0.96;
      if(input.atk){ t.vy -= 0.8; sfx('bubble'); }
      var sp = Math.hypot(t.vx, t.vy);
      if(sp > T.subMax){ t.vx *= T.subMax/sp; t.vy *= T.subMax/sp; }
      t.x += t.vx; t.y += t.vy;
      var floorY = tkGround(g, t.x) - 3;
      if(t.y > floorY){ t.y = floorY; t.vy = Math.min(0, t.vy); }
      if(t.y < lake.wy + 2){ t.y = lake.wy + 2; t.vy = Math.max(0, t.vy); }
      t.a += (t.vx*0.12 + t.vy*0.2 - t.a)*0.1;
      t.grounded = true; t.air = 0; t.rot = 0;
      if(g.t.x % 40 < 1.2 && Math.random() < 0.3) fxBurst(g.fxPlayer, t.x - 10, t.y - 6, 1, '#8fb3cf', 0.3, 30, 1.6);
    } else if(t.grounded){
      var top = t.form === 'mini' ? T.miniSpeed : (t.form === 'sub' ? T.subLandSpeed : T.maxSpeed);
      var sl = tkRest(g, t.x, t.form).a;
      /* let go of the stick when slow and it stays put, even on a slope —
         rolling back down a hill he was not steering is what felt wrong */
      if(Math.abs(thr) <= 0.15 && Math.abs(t.vx) < 0.25) t.vx = 0;
      else {
        t.vx += thr*T.accel*((thr < 0 && t.vx > 0) ? 2 : 1);
        t.vx += grav*Math.sin(sl)*T.slopePull;
      }
      t.vx *= T.drag;
      t.vx = Math.max(-top*0.5, Math.min(top, t.vx));
      /* water stops a land form at the shore; a low ceiling stops the big truck */
      var nx = t.x + t.vx, front = nx + (t.vx >= 0 ? F.half : -F.half);
      if(t.form !== 'sub' && tkDepth(g, front) > 3){ t.vx = 0; nx = t.x; }
      if(tkCeil(g, front) > t.y - F.h - 2 && tkCeil(g, front) > -1e8 && t.form === 'truck'){ if(Math.abs(t.vx) > 0.4) sfx('bump'); t.vx = -t.vx*0.3; nx = t.x + t.vx; }
      /* The truck rests on whichever wheel has ground under it and turns
         toward the ground's angle no faster than maxTurn. A ramp's LIP is
         found at the front wheel: the ground under it suddenly falls away much
         faster than it has been, and at speed the whole truck leaves the ramp
         on the ramp's own heading and climb. (Judging this from the middle of
         the truck made it drive off the lip nose-first, or fly for one frame
         and land back on the ramp.) Rolling slowly off an edge just drops. */
      var b = F.base, prevY = t.y;
      t.x = nx;
      var rest = tkRest(g, t.x, t.form);
      var a2 = t.a + Math.max(-T.maxTurn, Math.min(T.maxTurn, rest.a - t.a)), s2 = Math.sin(a2), c2 = Math.cos(a2);
      var ySup = Math.min(tkGround(g, t.x - b*c2) + b*s2, tkGround(g, t.x + b*c2) - b*s2);
      var fg = tkGround(g, t.x + b*c2), lip = t.fg != null && fg > t.fg + (t.fd || 0) + T.liftDrop && t.vx > 0.6;
      t.fd = t.fg == null ? 0 : fg - t.fg; t.fg = fg;
      if(lip){
        /* a ramp throws the truck up, not just off: that is the big air */
        t.grounded = false; t.vy = (t.vyG || 0) - (t.form === 'sub' ? 0 : T.lipKick); t.y = prevY + (t.vyG || 0);
        t.air = 0; t.rot = 0; t.grace = T.lipGrace; t.fg = null; sfx('hop');
      } else if(ySup > prevY + Math.max(0, t.vyG || 0) + T.liftDrop){
        t.grounded = false; t.vy = Math.max(0, t.vyG || 0); t.air = 0; t.rot = 0; t.grace = 0; t.fg = null; t.a = a2;
      } else { t.a = a2; t.y = ySup; t.vyG = t.y - prevY; }
      if(input.atk && t.grounded && t.form !== 'sub'){
        t.vy = -(t.form === 'mini' ? T.miniHopV : T.hopV) + t.vx*Math.tan(sl)*0.5;
        t.grounded = false; t.air = 0; t.rot = 0; t.grace = 0; t.fg = null; sfx('hop');
      }
      if(t.form === 'sub' && lake && t.y >= lake.wy - 1){ sfx('splash'); }
    } else {
      /* in the air the truck turns itself to land on its wheels; holding A
         (not the stick) spins it backwards, and a whole turn is a flip */
      t.vy += grav; t.x += t.vx; t.y += t.vy; t.air++;
      var da, flipping = input.act && t.air > T.flipDelay && t.form !== 'sub';
      /* in child mode the truck always comes round to land on its wheels:
         a few frames before touching down it stops spinning and levels */
      if(flipping && cfg.kidMode){
        var h = tkGround(g, t.x + t.vx*6) - t.y, disc = t.vy*t.vy + 2*grav*Math.max(0, h);
        if(h < 0 || (-t.vy + Math.sqrt(disc))/grav < T.flipSafeFrames) flipping = false;
      }
      if(flipping) da = -T.flipRate;
      else {
        /* level to the ground it will land on, a little ahead — not the cliff
           it has just left, which made the nose dip in mid-air */
        var want = tkRest(g, t.x + t.vx*12, t.form).a, off = Math.atan2(Math.sin(want - t.a), Math.cos(want - t.a));
        da = Math.max(-T.levelRate, Math.min(T.levelRate, off));
      }
      t.a += da; t.rot += da; t.va = da;
      if(t.air === 30 && !g.flipSaid && g.flipStars === 0 && t.form === 'truck'){ g.flipSaid = true; arcSay('t_flip'); }
      var ceil = tkCeil(g, t.x);
      if(t.y - F.h < ceil){ t.y = ceil + F.h; t.vy = Math.max(0, t.vy); }
      if(t.form === 'sub' && lake && t.y > lake.wy){ t.grounded = true; sfx('splash'); t.vy *= 0.3; }
      else if(t.form !== 'sub' && lake && t.y > lake.wy + 2){
        /* a land form jumped into the lake: splash, back on the shore, and the hint */
        t.x = lake.x0 - F.half - 6; t.y = tkGround(g, t.x); t.vx = 0; t.vy = 0;
        t.grounded = true; t.a = 0; t.va = 0; t.rot = 0; t.air = 0;
        sfx('splash'); arcSay('t_sub', true);
      }
      else {
        /* it has landed when a wheel touches the ground — not in the first
           few frames off a lip, while the back wheels are still over the ramp */
        var bw = F.base, cw = Math.cos(t.a), sw = Math.sin(t.a);
        if(t.air > (t.grace || 0) && (t.y - bw*sw >= tkGround(g, t.x - bw*cw) || t.y + bw*sw >= tkGround(g, t.x + bw*cw))) tkLand(g);
      }
    }
    t.wheel += t.vx*0.35;
    t.x = Math.max(20, t.x);
    /* gates: the sign is there to be found; if it was missed, help */
    var ahead = tkGateAhead(g);
    var pushing = thr > 0.5 && Math.abs(t.vx) < 0.15;
    if(ahead && pushing) g.stuck++; else g.stuck = Math.max(0, g.stuck - 2);
    if(ahead && g.stuck === Math.round(T.hintSec*60)) arcSay('t_' + ahead.form, true);
    if(ahead && cfg.kidMode && g.stuck >= Math.round(T.autoSec*60) && tkCanBecome(g, ahead.form, t.x)) tkTransform(g, ahead.form);
    /* a sub left on dry land after its lake is slow — in child mode it turns back into a truck */
    if(t.form === 'sub' && tkCanBecome(g, 'truck', t.x)){
      if(++g.subLand === Math.round(T.hintSec*60)) arcSay('t_truck', true);
      if(cfg.kidMode && g.subLand >= Math.round(T.autoSec*60)) tkTransform(g, 'truck');
    } else g.subLand = 0;
    /* junk cars: the big truck crushes them, anything smaller bounces off */
    var tb = { x:t.x, y:t.y - F.h/2, w:F.half*2, h:F.h };
    for(i=0; i<g.junk.length; i++){
      var jk = g.junk[i];
      if(jk.crushed) continue;
      if(Math.abs(jk.x - t.x) < F.half + 9 && t.y > TK_GY - 12){
        if(t.form === 'truck'){
          jk.crushed = true;
          fxBurst(g.fxFoe, jk.x, TK_GY - 5, 12, jk.col, 1.4, 26, 2.6);
          sfx('crunch'); arcHitstop(5); arcCoin(T.crushCoins); S.kills++;
          t.vy = -T.bounce; t.grounded = false; t.air = 0; t.rot = 0; t.y -= 1;
        } else if(t.vx > 0){ t.vx = -1; t.x = jk.x - F.half - 10; sfx('bump'); }
      }
    }
    /* boulders: hop them */
    for(i=0; i<g.boulders.length; i++){
      var bd = g.boulders[i];
      if(!g.hopSaid && bd.x - t.x < 70 && bd.x > t.x){ g.hopSaid = true; arcSay('hop', true); }
      if(Math.abs(bd.x - t.x) < F.half + bd.r - 2 && t.y > TK_GY - bd.r*2 + 1){ t.x = bd.x - F.half - bd.r - 1; tkCrash(g); break; }
    }
    /* pufferfish bump the sub */
    for(i=0; i<g.puffers.length; i++){
      var pf = g.puffers[i];
      pf.ph += 0.03; pf.y = pf.y0 + Math.sin(pf.ph)*10; if(pf.puff > 0) pf.puff--;
      if(t.inv <= 0 && Math.hypot(pf.x - t.x, pf.y - (t.y - 5)) < 12){
        pf.puff = 40; t.vx = -1.2; t.inv = 70; sfx('oof'); arcSegFail();
        if(cfg.kidMode) arcSay('oops_ok');
      }
    }
    /* things to collect */
    var cy = t.y - F.h/2;
    for(i = g.coins.length - 1; i >= 0; i--) if(Math.abs(g.coins[i].x - t.x) < F.half + 3 && Math.abs(g.coins[i].y - cy) < F.h/2 + 5){
      fxBurst(g.fxItem, g.coins[i].x, g.coins[i].y, 4, C.gold, 0.8, 14, 2); g.coins.splice(i, 1); arcCoin(1);
    }
    for(i = g.pearls.length - 1; i >= 0; i--) if(Math.hypot(g.pearls[i].x - t.x, g.pearls[i].y - cy) < 10){
      fxBurst(g.fxItem, g.pearls[i].x, g.pearls[i].y, 5, C.bone, 0.8, 14, 2); g.pearls.splice(i, 1); arcCoin(2);
    }
    for(i = g.stars.length - 1; i >= 0; i--) if(Math.hypot(g.stars[i].x - t.x, g.stars[i].y - cy) < 12){
      fxBurst(g.fxItem, g.stars[i].x, g.stars[i].y, 10, C.gold, 1.2, 20, 2.4); g.stars.splice(i, 1); arcStar(1);
    }
    for(i = g.balloons.length - 1; i >= 0; i--){
      var bl = g.balloons[i]; bl.ph += 0.04;
      if(Math.hypot(bl.x - t.x, bl.y + Math.sin(bl.ph)*3 - cy) < 12){
        fxBurst(g.fxClue, bl.x, bl.y, 8, '#e0645a', 1.2, 18, 2.4); g.balloons.splice(i, 1); sfx('balloon'); arcCoin(3);
      }
    }
    /* checkpoints and the finish */
    for(i=0; i<g.flags.length; i++){
      var fl = g.flags[i];
      if(!fl.passed && t.x >= fl.x){
        fl.passed = true; g.cp = fl.x; sfx('checkpoint');
        arcSegEnd(); arcSegStart('Gator Truck level ' + g.lv + ' part ' + fl.seg);
      }
    }
    if(t.x >= g.finish){ arcSay('finish', true); arcLevelDone(3 - Math.min(2, g.crashes)); }
    tkCamera(g);
  },
  idle: function(g){
    var t = g.t;
    fxStep(g.fxFoe, 0.05); fxStep(g.fxItem, 0); fxStep(g.fxClue, 0); fxStep(g.fxPlayer, 0);
    if(t.grounded && !t.crash){ t.vx *= 0.97; t.x += t.vx; var rs = tkRest(g, t.x, t.form); t.y = rs.y; t.a = rs.a; t.wheel += t.vx*0.35; }
    tkCamera(g);
  },
  busy: function(g){
    var lo = g.cam.x - 20, hi = g.cam.x + TK_W + 20, b = { foe:false, item:false, clue:false }, i;
    function any(list){ for(var k=0; k<list.length; k++) if(list[k].x > lo && list[k].x < hi) return true; return false; }
    b.foe = any(g.junk.filter(function(j){ return !j.crushed; })) || any(g.boulders) || any(g.puffers);
    b.item = any(g.coins) || any(g.stars) || any(g.pearls);
    b.clue = any(g.gates) || any(g.arrows) || any(g.balloons);
    return b;
  },
  intense: function(g){
    var t = g.t, v = 0;
    if(t.air > 36) v = 0.8;
    if(t.x > g.finish - (g.finish*0.15)) v = Math.max(v, 0.9);
    return v;
  },
  draw: function(g, eye, m){
    var TH = g.theme, cx = g.cam.x, cy = g.cam.y, i, sx;
    var x0 = -m.mx, x1 = TK_W + m.mx, y0 = -m.my, y1 = TK_H + m.my;
    ctx.save(); ctx.translate(-cx, -cy);
    var wx0 = cx + x0, wx1 = cx + x1;
    /* world: sky, water, ground, tunnel rock, flags */
    ctx.fillStyle = TH.sky; ctx.fillRect(wx0, cy + y0, wx1 - wx0, y1 - y0);
    for(i=0; i<g.lakes.length; i++){
      var lk = g.lakes[i];
      if(lk.x1 < wx0 || lk.x0 > wx1) continue;
      ctx.fillStyle = TH.water; ctx.fillRect(lk.x0, lk.wy, lk.x1 - lk.x0, TK_GY + 60 - lk.wy);
      ctx.fillStyle = '#8fb3cf';
      for(var w = lk.x0 + ((ARC.t*0.3) % 16); w < lk.x1 - 4; w += 16) ctx.fillRect(w, lk.wy, 6, 1);
    }
    for(sx = Math.floor(wx0/2)*2; sx < wx1; sx += 2){
      var gy = tkGround(g, sx);
      ctx.fillStyle = TH.body; ctx.fillRect(sx, gy, 2.5, cy + y1 - gy + 2);
      ctx.fillStyle = TH.top;  ctx.fillRect(sx, gy, 2.5, 3);
      if(hash2(Math.floor(sx/2), 7) > 0.9){ ctx.fillStyle = TH.deep; ctx.fillRect(sx, gy + 8 + hash2(sx, 3)*14, 2, 2); }
    }
    for(i=0; i<g.tunnels.length; i++){
      var tn = g.tunnels[i];
      if(tn.x1 < wx0 || tn.x0 > wx1) continue;
      ctx.fillStyle = TH.rock; ctx.fillRect(tn.x0, cy + y0 - 4, tn.x1 - tn.x0, tn.y - (cy + y0 - 4));
      ctx.fillStyle = TH.deep; ctx.fillRect(tn.x0, tn.y - 3, tn.x1 - tn.x0, 3);
      ctx.fillStyle = '#12151d'; ctx.fillRect(tn.x0 - 3, cy + y0 - 4, 3, tn.y - (cy + y0 - 4) + 2); ctx.fillRect(tn.x1, cy + y0 - 4, 3, tn.y - (cy + y0 - 4) + 2);
    }
    for(i=0; i<g.flags.length; i++){
      var fg = g.flags[i];
      if(fg.x < wx0 - 10 || fg.x > wx1 + 10) continue;
      var fgy = tkGround(g, fg.x);
      ctx.fillStyle = C.bone; ctx.fillRect(fg.x - 0.6, fgy - 24, 1.2, 24);
      ctx.fillStyle = fg.passed ? C.jade : C.gold; ctx.fillRect(fg.x + 0.6, fgy - 24, 9, 6);
    }
    if(g.finish > wx0 - 20 && g.finish < wx1 + 20){
      var ffy = tkGround(g, g.finish);
      ctx.fillStyle = C.bone; ctx.fillRect(g.finish - 1, ffy - 40, 2, 40); ctx.fillRect(g.finish + 23, ffy - 40, 2, 40);
      for(var fk=0; fk<12; fk++){ ctx.fillStyle = ((fk + (fk >= 6 ? 1 : 0)) & 1) ? '#12151d' : C.bone; ctx.fillRect(g.finish + 1 + (fk % 6)*3.7, ffy - 40 + (fk >= 6 ? 3.5 : 0), 3.7, 3.5); }
    }
    /* clue: gate signs, ramp arrows, balloons */
    withLayer(eye, 'clue', function(){
      for(var k=0; k<g.gates.length; k++) if(g.gates[k].x > wx0 - 20 && g.gates[k].x < wx1 + 20) tkDrawSign(g, g.gates[k].x, g.gates[k].form);
      for(k=0; k<g.arrows.length; k++) if(g.arrows[k].x > wx0 - 20 && g.arrows[k].x < wx1 + 20) tkDrawSign(g, g.arrows[k].x, 'arrow');
      for(k=0; k<g.balloons.length; k++){
        var bl = g.balloons[k], by = bl.y + Math.sin(bl.ph)*3;
        ctx.fillStyle = C.bone; ctx.fillRect(bl.x - 0.4, by + 5, 0.8, 9);
        ctx.fillStyle = '#e0645a'; ctx.fillRect(bl.x - 4, by - 5, 8, 10); ctx.fillRect(bl.x - 5, by - 3, 10, 6);
        ctx.fillStyle = '#f2aaa2'; ctx.fillRect(bl.x - 3, by - 4, 2, 2);
      }
      fxDraw(g.fxClue);
    });
    /* item: coins, pearls, stars */
    withLayer(eye, 'item', function(){
      for(var k=0; k<g.coins.length; k++){
        var c = g.coins[k]; if(c.x < wx0 - 6 || c.x > wx1 + 6) continue;
        var cw = ((ARC.t + (c.x|0)) % 40) < 6 ? 2 : 4;
        ctx.fillStyle = '#8a6a1c'; ctx.fillRect(c.x - cw/2, c.y - 3, cw + 1, 6);
        ctx.fillStyle = C.gold; ctx.fillRect(c.x - cw/2, c.y - 3, cw, 5);
      }
      for(k=0; k<g.pearls.length; k++){
        var pr = g.pearls[k]; if(pr.x < wx0 - 6 || pr.x > wx1 + 6) continue;
        ctx.fillStyle = '#c9c4b6'; ctx.fillRect(pr.x - 3, pr.y - 3, 6, 6);
        ctx.fillStyle = C.bone; ctx.fillRect(pr.x - 2, pr.y - 2, 2, 2);
      }
      for(k=0; k<g.stars.length; k++){
        var st = g.stars[k]; if(st.x < wx0 - 8 || st.x > wx1 + 8) continue;
        var arm = 3 + ((ARC.t >> 3) & 1);
        ctx.fillStyle = C.gold; ctx.fillRect(st.x - 1.5, st.y - arm - 1, 3, arm*2 + 2); ctx.fillRect(st.x - arm - 1, st.y - 1.5, arm*2 + 2, 3);
        ctx.fillStyle = C.bone; ctx.fillRect(st.x - 1, st.y - 1, 2, 2);
      }
      fxDraw(g.fxItem);
    });
    /* foe: junk cars, boulders, pufferfish */
    withLayer(eye, 'foe', function(){
      for(var k=0; k<g.junk.length; k++){ var jk = g.junk[k]; if(jk.x > wx0 - 20 && jk.x < wx1 + 20) tkDrawJunk(jk); }
      for(k=0; k<g.boulders.length; k++){
        var bd = g.boulders[k]; if(bd.x < wx0 - 12 || bd.x > wx1 + 12) continue;
        ctx.fillStyle = '#6b6f7c'; ctx.fillRect(bd.x - bd.r, TK_GY - bd.r*2, bd.r*2, bd.r*2);
        ctx.fillRect(bd.x - bd.r - 1, TK_GY - bd.r*1.5, bd.r*2 + 2, bd.r);
        ctx.fillStyle = '#8a8f9e'; ctx.fillRect(bd.x - bd.r + 1, TK_GY - bd.r*2 + 1, bd.r, 2);
        ctx.fillStyle = '#4c505c'; ctx.fillRect(bd.x, TK_GY - bd.r, 2, 2);
      }
      for(k=0; k<g.puffers.length; k++){
        var pf = g.puffers[k]; if(pf.x < wx0 - 12 || pf.x > wx1 + 12) continue;
        var pr2 = pf.puff > 0 ? 7 : 4.5;
        ctx.fillStyle = '#e8c84a'; ctx.fillRect(pf.x - pr2, pf.y - pr2*0.8, pr2*2, pr2*1.6);
        ctx.fillStyle = '#c98a4a'; ctx.fillRect(pf.x + pr2 - 1, pf.y - 2, 3, 4);
        ctx.fillStyle = '#12151d'; ctx.fillRect(pf.x - pr2*0.5, pf.y - 2, 1.5, 1.5);
        if(pf.puff > 0){ ctx.fillStyle = C.bone; for(var sp=0; sp<6; sp++){ var sa = sp*1.047; ctx.fillRect(pf.x + Math.cos(sa)*(pr2 + 1) - 0.5, pf.y + Math.sin(sa)*(pr2 + 1) - 0.5, 1.2, 1.2); } }
      }
      fxDraw(g.fxFoe);
    });
    /* player: the truck, in whichever form */
    var t = g.t;
    if(!(t.inv > 0 && (ARC.t % 12) < 4)){
      ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(t.a);
      if(t.squash > 0) ctx.scale(1 + t.squash*0.02, 1 - t.squash*0.025);
      drawTruckSprite(t.form, paintOf('truck'), t.wheel);
      ctx.restore();
    }
    fxDraw(g.fxPlayer);
    ctx.restore();
  },
  hud: function(g, eye, vp, u){
    var hs = Math.max(9, u*3.6), y = vp.y + vp.h - hs*1.6, w = vp.w*0.5, x = vp.x + vp.w/2 - w/2, i;
    ctx.fillStyle = '#1c2233'; ctx.fillRect(x, y - 1.5, w, 3);
    for(i=0; i<g.flags.length; i++){ ctx.fillStyle = g.flags[i].passed ? C.jade : '#6a718c'; ctx.fillRect(x + w*g.flags[i].x/g.finish - 1, y - 4, 2, 8); }
    ctx.fillStyle = C.gold; ctx.fillRect(x + w - 2, y - 5, 3, 10);
    var k = Math.min(1, g.t.x/g.finish);
    ctx.fillStyle = paintOf('truck').c; ctx.fillRect(x + w*k - 4, y - 3.5, 8, 7);
  },
  icon: function(cx, cy, s, t){
    var k = s/18, i;
    ctx.fillStyle = '#16202c'; ctx.fillRect(cx - s, cy - s*0.9, s*2, s*1.8);
    ctx.fillStyle = '#3a2c20'; ctx.fillRect(cx - s, cy + k*8, s*2, s*0.9 - k*8);
    ctx.fillStyle = '#4f9a4a'; ctx.fillRect(cx - s, cy + k*8, s*2, k*2);
    ctx.fillStyle = '#8a4a3a'; ctx.fillRect(cx + k*8, cy + k*4, k*10, k*4);
    var hop = Math.max(0, Math.sin(t*0.06))*k*6;
    ctx.save(); ctx.translate(cx - k*3, cy + k*8 - hop); ctx.scale(k*1.1, k*1.1); ctx.rotate(-Math.sin(t*0.06)*0.15);
    drawTruckSprite('truck', paintOf('truck'), t*0.3);
    ctx.restore();
    for(i=0; i<3; i++){ ctx.fillStyle = C.gold; ctx.fillRect(cx - k*12 + i*k*5, cy - k*10 - Math.sin(i + t*0.05)*k, k*2, k*2.4); }
  }
};
function tkCamera(g){
  var t = g.t;
  g.cam.x += (t.x - 70 - g.cam.x)*0.2;
  var ty = Math.min(TK_GY - 104, t.y - 100);
  g.cam.y += (ty - g.cam.y)*0.08;
}
function tkDrawSign(g, x, kind){
  var y = tkGround(g, x);
  ctx.fillStyle = '#8a6a48'; ctx.fillRect(x - 1, y - 22, 2, 22);
  ctx.fillStyle = '#e6e2d6'; ctx.fillRect(x - 9, y - 34, 18, 14);
  ctx.fillStyle = '#8a6a48'; ctx.fillRect(x - 9, y - 34, 18, 1.5); ctx.fillRect(x - 9, y - 21.5, 18, 1.5);
  ctx.save(); ctx.translate(x, y - 24);
  if(kind === 'arrow'){
    ctx.fillStyle = C.blood; ctx.fillRect(-6, -4, 7, 3); ctx.fillRect(1, -6, 2, 7); ctx.fillRect(3, -5, 2, 5); ctx.fillRect(5, -3.5, 1.5, 2);
  } else {
    ctx.scale(0.45, 0.45);
    drawTruckSprite(kind, { c:'#3c4d78', d:'#232839' }, 0, true);
  }
  ctx.restore();
}
function tkDrawJunk(j){
  if(j.crushed){
    ctx.fillStyle = j.col; ctx.fillRect(j.x - 10, TK_GY - 3, 20, 3);
    ctx.fillStyle = '#12151d'; ctx.fillRect(j.x - 7, TK_GY - 1.5, 3, 1.5); ctx.fillRect(j.x + 4, TK_GY - 1.5, 3, 1.5);
    return;
  }
  ctx.fillStyle = '#12151d'; ctx.fillRect(j.x - 8, TK_GY - 4, 4, 4); ctx.fillRect(j.x + 4, TK_GY - 4, 4, 4);
  ctx.fillStyle = j.col; ctx.fillRect(j.x - 10, TK_GY - 9, 20, 6); ctx.fillRect(j.x - 6, TK_GY - 13, 11, 4);
  ctx.fillStyle = '#9fc3dc'; ctx.fillRect(j.x - 4.5, TK_GY - 12, 4, 2.5); ctx.fillRect(j.x + 0.5, TK_GY - 12, 3.5, 2.5);
  ctx.fillStyle = '#5a3a2a'; ctx.fillRect(j.x - 8, TK_GY - 7, 3, 2);
}
/* the truck at the origin: (0,0) is where its wheels meet the ground.
   `plain` draws it without the gator, for the gate signs. */
function drawTruckSprite(form, pt, wheel, plain){
  var wa = wheel || 0, i;
  function wheelAt(x, y, r){
    ctx.fillStyle = '#1c1f26'; ctx.fillRect(x - r, y - r, r*2, r*2);
    ctx.fillStyle = '#2b2f3a'; ctx.fillRect(x - r*0.7, y - r*1.1, r*1.4, r*2.2); ctx.fillRect(x - r*1.1, y - r*0.7, r*2.2, r*1.4);
    ctx.fillStyle = '#8a8f9e'; ctx.fillRect(x - r*0.35, y - r*0.35, r*0.7, r*0.7);
    ctx.fillStyle = '#5a6076'; ctx.fillRect(x + Math.cos(wa)*r*0.6 - 0.6, y + Math.sin(wa)*r*0.6 - 0.6, 1.2, 1.2);
  }
  function gator(x, y, s){
    if(plain) return;
    ctx.fillStyle = '#5d9257'; ctx.fillRect(x - 2*s, y - 3*s, 5*s, 4*s); ctx.fillRect(x + 3*s, y - 1.5*s, 3*s, 2.5*s);
    ctx.fillStyle = C.bone; ctx.fillRect(x - 0.5*s, y - 3.8*s, 1.8*s, 1.6*s); ctx.fillRect(x + 3.4*s, y + 0.6*s, 0.6*s, 0.6*s); ctx.fillRect(x + 4.6*s, y + 0.6*s, 0.6*s, 0.6*s);
    ctx.fillStyle = '#12151d'; ctx.fillRect(x + 0.3*s, y - 3.4*s, 0.8*s, 0.8*s);
  }
  if(form === 'truck'){
    wheelAt(-8, -5, 5); wheelAt(8, -5, 5);
    ctx.fillStyle = '#2b2f3a'; ctx.fillRect(-9, -8, 18, 2);
    ctx.fillStyle = pt.d; ctx.fillRect(-12, -15, 24, 7);
    ctx.fillStyle = pt.c; ctx.fillRect(-12, -15, 24, 5);
    ctx.fillStyle = pt.d; ctx.fillRect(-1, -22, 11, 7);
    ctx.fillStyle = pt.c; ctx.fillRect(0, -22, 10, 6);
    ctx.fillStyle = '#9fc3dc'; ctx.fillRect(5, -21, 4, 4);
    gator(2, -16, 0.9);
    ctx.fillStyle = C.gold; ctx.fillRect(11, -14, 1.5, 2);
    ctx.fillStyle = C.blood; ctx.fillRect(-12, -14, 1.2, 2);
  } else if(form === 'mini'){
    wheelAt(-4.5, -2.5, 2.5); wheelAt(4.5, -2.5, 2.5);
    ctx.fillStyle = pt.d; ctx.fillRect(-7, -7, 14, 4);
    ctx.fillStyle = pt.c; ctx.fillRect(-7, -7, 14, 3); ctx.fillRect(-1, -10, 6, 3);
    ctx.fillStyle = '#9fc3dc'; ctx.fillRect(2, -9.5, 2.5, 2);
    gator(0, -7.5, 0.5);
  } else {
    ctx.fillStyle = pt.d; ctx.fillRect(-11, -11, 22, 10); ctx.fillRect(-9, -12, 18, 12);
    ctx.fillStyle = pt.c; ctx.fillRect(-10, -11, 20, 7);
    ctx.fillStyle = pt.d; ctx.fillRect(-1, -16, 2, 5); ctx.fillRect(-1, -16, 5, 1.5);
    ctx.fillStyle = '#9fc3dc'; ctx.fillRect(3, -9, 4, 4);
    if(!plain){ ctx.fillStyle = '#5d9257'; ctx.fillRect(3.8, -8.2, 2.4, 2.4); ctx.fillStyle = '#12151d'; ctx.fillRect(5, -7.6, 1, 1); }
    ctx.fillStyle = '#8a8f9e';
    var pr = ((wa*2) | 0) & 1;
    ctx.fillRect(-13, -9 + (pr ? 0 : 2), 2, 4);
    for(i=0; i<3; i++){ ctx.fillStyle = C.gold; ctx.fillRect(-6 + i*4, -3, 1.5, 1.5); }
  }
}
