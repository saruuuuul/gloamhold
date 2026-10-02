
/* ============================================================
   THE ARCADE RUNTIME — what Gator Truck, Blocks, Space Rocks and
   Racer share with each other and with the islands.

   A game module registers itself in GAMES (58-hub.js) with:
     W, H          its field size in field units
     start(level)  -> a fresh state g
     update(g)     one 60 Hz step
     draw(g, eye)  in field units, with the field transform already set
     busy(g)       {foe, item, clue}: which per-eye layers have something
                   on them right now (exposure telemetry)
     intense(g)    0..1, which brings in the carol (36-music.js)
     hud(g, eye, vp, u)   optional extra HUD, both eyes identical

   The layer rules are exactly the dungeon's. Every drawn thing picks a
   layer through alphaFor(eye, layer); every signal sprite sits on a
   uniform floor; nothing on a per-eye layer fades by alpha, it changes
   shape instead; and anything an object spawns is drawn on that
   object's layer. Nothing here asks which eye is the weaker one.

   The staircase is the dungeon's too. A game opens SEGMENTS (a level
   part, a wave, a checkpoint section): a clean one steps the stronger
   eye's contrast down, a failure steps it up, capped per segment in
   child mode (invariant 10). In child mode no failure ends a run.
   ============================================================ */
var ARC = { id:null, g:null, t:0, hit:0, endAt:null, won:false, over:false,
            seg:null, coins:0, pops:[], banner:null, lastSay:-99999 };

function progGame(id){
  if(!PROG.games[id]) PROG.games[id] = { level:1, best:{} };
  return PROG.games[id];
}
function arcadeStart(id, level){
  var M = GAMES[id];
  if(!M || !M.start) return;
  audioUnlock(); goImmersive(); keepAwake();
  closeMenu(); hideAll(); nonius.on = false;
  if(SIT.done) SIT = newSitting();
  resetRunStats(id);
  var lv = level || progGame(id).level;
  ARC.id = id; ARC.t = 0; ARC.hit = 0; ARC.endAt = null; ARC.won = false; ARC.over = false;
  ARC.seg = null; ARC.coins = 0; ARC.pops = []; ARC.banner = null; ARC.lastSay = -99999;
  S.level = lv;
  PROG.lastGame = id; saveProg();
  toastT = 0;
  logContrast();
  ARC.g = M.start(lv);
  LIVE = true;
  running = true; last = performance.now(); acc = 0;
  sfx('go'); arcSay('go', true);
  requestAnimationFrame(loop);
}
/* leave whatever is running for the game picker, without awarding the run —
   stars are for finishing or for falling, not for quitting */
function leaveToHub(){
  if(LIVE) archiveRun('left');
  running = false; S.ended = true; LIVE = false; letSleep();
  closeMenu(); openMenu('title');
}

/* ---------------- segments: the staircase, and the session log ---------------- */
function arcSegStart(name){
  stairSegment();
  ARC.seg = { name:name, clean:true };
  S.rooms++;
  S.roomLog.push({ room:ARC.id, name:name, inAt:Math.round(S.elapsed/1000), foes:0,
                   hitsBefore:S.hits, contrast:+cfg.strong.toFixed(2) });
}
/* a hit, a crash, a top-out: the thing that pushes the stronger eye back up */
function arcSegFail(){
  S.hits++;
  if(ARC.seg) ARC.seg.clean = false;
  stepUp();
}
function arcSegEnd(){
  if(!ARC.seg) return false;
  var clean = ARC.seg.clean, e = S.roomLog[S.roomLog.length - 1];
  if(clean){ S.cleanRooms++; stepDown(); }
  if(e && e.clearedAt == null){ e.clearedAt = Math.round(S.elapsed/1000); e.clean = clean; e.hitsTaken = S.hits - e.hitsBefore; }
  ARC.seg = null;
  sittingBreakpoint();
  return clean;
}
/* the child-mode stand-in for losing: counted, never the end */
function arcKnockdown(){ S.knockdowns = (S.knockdowns || 0) + 1; }

/* ---------------- rewards ---------------- */
function arcCoin(n){
  n = n || 1;
  ARC.coins += n; S.coins += n; PROG.coins += n; PROG.wallet += n;
  sfx('coin');
  ARC.pops.push({ kind:'coin', n:n, t:40 });
}
function arcStar(n){
  n = n || 1;
  S.bonusStars = (S.bonusStars || 0) + n;
  sfx('star');
  ARC.pops.push({ kind:'star', n:n, t:60 });
}
function arcBanner(text, col){ ARC.banner = { text:text, col:col || C.gold, t:TUNING.arcade.bannerFrames }; }
function arcHitstop(n){ ARC.hit = Math.max(ARC.hit, n == null ? TUNING.arcade.hitstopFrames : n); }
function arcSay(key, force){
  if(!force && ARC.t - ARC.lastSay < TUNING.arcade.speakGapSec*60) return;
  ARC.lastSay = ARC.t;
  say(key);
}
/* the level's goal is met: stars 1..3 for how it went */
function arcLevelDone(stars){
  if(ARC.won || ARC.over) return;
  if(ARC.seg) arcSegEnd();
  ARC.won = true; S.won = true;
  stars = Math.max(1, Math.min(3, stars | 0));
  S.levelStars = stars;
  var pg = progGame(ARC.id);
  pg.best[S.level] = Math.max(pg.best[S.level] || 0, stars);
  if(S.level >= pg.level) pg.level = S.level + 1;
  saveProg();
  sfx('levelUp'); arcSay('level', true);
}
/* grown-up mode only: a real game over. Child mode never calls this. */
function arcGameOver(){
  if(ARC.won || ARC.over) return;
  if(ARC.seg) arcSegEnd();
  ARC.over = true; S.won = false;
  sfx('lose');
}
function arcadeEnd(){
  running = false; S.ended = true; LIVE = false; letSleep();
  if(SIT.due && !cfg.flat){ finishSession(); return; }
  S.starsGained = awardSession();
  closeMenu(); openMenu('arcadeDone');
}

/* ---------------- the frame ---------------- */
function arcadeFrame(dt){
  var M = GAMES[ARC.id], g = ARC.g, guard = 0;
  var b = (M.busy && M.busy(g)) || {}, any = false;
  if(b.foe){ S.sig.foe += dt; any = true; }
  if(b.item){ S.sig.item += dt; any = true; }
  if(b.clue){ S.sig.clue += dt; any = true; }
  if(any) S.sig.any += dt;
  acc += dt;
  while(acc >= 16.667 && guard < 5 && running){
    gatherInput();
    if(ARC.hit > 0) ARC.hit--;
    else {
      if(!ARC.won && !ARC.over) M.update(g);
      else if(M.idle) M.idle(g);
      input.atk = false; input.toolPress = false; input.cycle = false;
    }
    arcTick();
    acc -= 16.667; guard++;
  }
  if(!running){ render(); return; }
  if(acc > 100) acc = 0;
  if(toastT > 0) toastT--;
  if(S.elapsed - (S.lastLog || 0) > 15000){ S.lastLog = S.elapsed; logContrast(); }
  checkSessionGoal();
  musicTick(M.intense ? M.intense(g) : 0);
  render();
  if((ARC.won || ARC.over) && ARC.endAt == null) ARC.endAt = ARC.t;
  if(ARC.endAt != null && ARC.t - ARC.endAt > TUNING.arcade.endDelayFrames){ arcadeEnd(); return; }
  requestAnimationFrame(loop);
}
function arcTick(){
  ARC.t++;
  for(var i = ARC.pops.length - 1; i >= 0; i--) if(--ARC.pops[i].t <= 0) ARC.pops.splice(i, 1);
  if(ARC.banner && --ARC.banner.t <= 0) ARC.banner = null;
}

/* ---------------- drawing ---------------- */
function drawArcadeEye(eye){
  var M = GAMES[ARC.id];
  if(!M) return;
  var geo = fitGeom(eye, M.W, M.H), vp = geo.vp;
  ctx.save();
  ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
  ctx.fillStyle = M.surround || C.void; ctx.fillRect(vp.x, vp.y, vp.w, vp.h);
  ctx.save();
  ctx.translate(geo.ox, geo.oy); ctx.scale(geo.s, geo.s);
  /* how much of the world beyond the field the eye can see — the lens warp
     pulls it in, so games draw their surroundings that far out */
  M.draw(ARC.g, eye, { mx:(geo.ox - vp.x)/geo.s, my:(geo.oy - vp.y)/geo.s });
  ctx.restore();
  drawArcadeHUD(eye, vp);
  ctx.restore();
}
function hudInset(vp0){
  var ins = (cfg.lens === 'off' || !gl) ? 0 : Math.round(Math.min(vp0.w, vp0.h) * 0.13);
  return { x:vp0.x + ins, y:vp0.y + ins, w:vp0.w - ins*2, h:vp0.h - ins*2 };
}
/* HUD layer: identical in both eyes, full contrast. It never shows where a
   per-eye thing is — only what he has and how far he has got. */
function drawArcadeHUD(eye, vp0){
  var M = GAMES[ARC.id], vp = hudInset(vp0), u = Math.min(vp.w, vp.h)/100, i;
  ctx.strokeStyle = 'rgba(236,230,216,.30)'; ctx.lineWidth = 2;
  var m = 6, L = 22;
  [[vp.x+m, vp.y+m, 1, 1],[vp.x+vp.w-m, vp.y+m, -1, 1],[vp.x+m, vp.y+vp.h-m, 1,-1],[vp.x+vp.w-m, vp.y+vp.h-m,-1,-1]]
   .forEach(function(q){ ctx.beginPath(); ctx.moveTo(q[0]+q[2]*L, q[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0], q[1]+q[3]*L); ctx.stroke(); });
  var hs = Math.max(9, u*3.6), y = vp.y + hs*1.4;
  drawIcon('flag', vp.x + hs*1.6, y, hs*0.5, C.jade);
  mtext(String(S.level), vp.x + hs*2.5, y, hs, C.bone, 'left', 700, F_MONO);
  drawCoinIcon(vp.x + vp.w - hs*4.4, y, hs*0.42);
  mtext(String(ARC.coins), vp.x + vp.w - hs*3.6, y, hs, C.gold, 'left', 700, F_MONO);
  if(S.bonusStars){
    drawIcon('star', vp.x + vp.w - hs*4.4, y + hs*1.5, hs*0.45, C.gold);
    mtext(String(S.bonusStars), vp.x + vp.w - hs*3.6, y + hs*1.5, hs, C.gold, 'left', 700, F_MONO);
  }
  for(i=0;i<ARC.pops.length;i++){
    var pp = ARC.pops[i], k = 1 - pp.t/(pp.kind === 'star' ? 60 : 40);
    mtext('+' + pp.n, vp.x + vp.w - hs*1.4, y + hs*(pp.kind === 'star' ? 1.5 : 0) + hs*0.2 - k*hs*1.2, hs*0.9,
          pp.kind === 'star' ? C.bone : C.gold, 'right', 700, F_MONO);
  }
  if(M && M.hud) M.hud(ARC.g, eye, vp, u);
  if(ARC.banner){
    var bk = ARC.banner.t / TUNING.arcade.bannerFrames, bs = hs*2.4*(bk > 0.85 ? 1 + (bk - 0.85)*3 : 1);
    ctx.fillStyle = 'rgba(5,7,11,.72)'; ctx.fillRect(vp.x, vp.y + vp.h*0.36 - bs*0.9, vp.w, bs*1.8);
    mtext(ARC.banner.text, vp.x + vp.w/2, vp.y + vp.h*0.36, bs, ARC.banner.col, 'center', 700, F_PIX);
  }
  if(toastT > 0){
    ctx.font = '500 12px "IBM Plex Sans", sans-serif';
    var tw = ctx.measureText(toastTxt).width + 22, by = vp.y + vp.h - 30;
    ctx.fillStyle = 'rgba(6,8,12,.86)'; ctx.fillRect(vp.x + vp.w/2 - tw/2, by - 12, tw, 24);
    mtext(toastTxt, vp.x + vp.w/2, by, 12, C.bone, 'center', 500);
  }
  if(ARC.won || ARC.over){
    ctx.fillStyle = 'rgba(4,6,10,.78)'; ctx.fillRect(vp.x, vp.y + vp.h/2 - hs*3.4, vp.w, hs*6.8);
    mtext(ARC.won ? (M && M.doneTitle ? M.doneTitle() : 'LEVEL DONE!') : 'GAME OVER', vp.x + vp.w/2, vp.y + vp.h/2 - hs*1.2,
          hs*2, ARC.won ? C.gold : C.blood, 'center', 700, F_PIX);
    if(ARC.won) for(i=0;i<3;i++) drawIcon('star', vp.x + vp.w/2 + (i - 1)*hs*3, vp.y + vp.h/2 + hs*1.6, hs*1.1, i < S.levelStars ? C.gold : '#333a4c');
  }
  if(touch.active) drawTouchPads(eye, vp);
}

/* ---------------- particles: shapes that shrink, never fade ----------------
   Each game keeps one list per layer and draws it inside that layer's alpha,
   so a burst can never reach an eye its source was not drawn to. */
function fxBurst(list, x, y, n, col, speed, life, size){
  for(var i=0; i<n; i++){
    var a = Math.random()*6.2832, sp = (speed || 1.2)*(0.4 + Math.random()*0.8);
    list.push({ x:x, y:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, t:life || 24, life:life || 24, col:col, s:size || 2.4 });
  }
}
function fxStep(list, grav){
  for(var i = list.length - 1; i >= 0; i--){
    var p = list[i];
    p.x += p.vx; p.y += p.vy; p.vx *= 0.94; p.vy = p.vy*0.94 + (grav || 0);
    if(--p.t <= 0) list.splice(i, 1);
  }
}
function fxDraw(list){
  for(var i=0; i<list.length; i++){
    var p = list[i], s = p.s * (p.t / p.life);
    if(s < 0.3) continue;
    ctx.fillStyle = p.col; ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
  }
}
/* draw a layer's content only when that eye gets it, at exactly its alpha */
function withLayer(eye, layer, fn){
  var a = alphaFor(eye, layer);
  if(a <= 0) return;
  ctx.globalAlpha = a; fn(); ctx.globalAlpha = 1;
}

/* ---------------- the end of a level ---------------- */
SCREENS.arcadeDone = {
  title: 'DONE',
  onOpen: function(){
    if(ARC.won){ sfx('trophy'); say(S.place === 1 ? 'place1' : 'trophy'); }
    else say('again');
  },
  nav: function(){},
  confirm: function(){ sfx('uiOk'); if(ARC.id) arcadeStart(ARC.id); else { closeMenu(); openMenu('title'); } },
  start: function(){ SCREENS.arcadeDone.confirm(); },
  cancel: function(){ leaveToHub(); },
  custom: function(eye, vp, u){
    var M = GAMES[ARC.id] || {}, won = !!ARC.won, st = S.levelStars || 0;
    drawSimpleScreen(vp, u, {
      title: won ? (M.doneTitle ? M.doneTitle() : 'LEVEL DONE!') : 'GOOD TRY!',
      titleCol: won ? C.gold : C.jade,
      deco: function(cx, cy, uu){
        drawIcon('trophy', cx, cy - uu*3, uu*9, won ? (S.place > 1 ? (S.place === 2 ? '#c9c9d6' : '#c98a4a') : C.gold) : '#4a5166');
        for(var i=0;i<3;i++) drawIcon('star', cx + (i - 1)*uu*9, cy + uu*11, uu*3, i < st ? C.gold : '#333a4c');
      },
      big: '+' + (S.starsGained || 0) + ' stars',
      sub: (M.name ? M.name.toLowerCase() + ' · ' : '') + 'level ' + (S.level || 1) + (M.doneSub ? ' · ' + M.doneSub() : ''),
      button: won ? 'NEXT' : 'AGAIN',
      foot: won ? 'A next level · B games' : 'A again · B games'
    });
  }
};
