
/* ============================================================
   SPACE ROCKS — a little ship in a field of rocks that wraps round.

   Layers (invariant 12):
     world   the field's floor and frame                  both eyes, full
     player  the ship, its shots, its shield              both eyes, full
     foe     rocks, comets, the rock king, the saucer and its shots,
             and every bit of debris they leave
     item    power-ups drifting through (triple, rapid, shield, star)
   Coins and stars from a rock go straight to the counter, never onto
   the field: a coin appearing where a rock just broke would show the
   stronger eye, in forced fusion, exactly where a rock it is not
   allowed to see had been — the same leak the dungeon's death poofs
   once had. Power-ups therefore drift in on their own, not out of rocks.

   Five-year-old controls: the stick flies the ship where it points (no
   rotate-and-thrust), A held fires, a right stick aims and fires if the
   pad has one, B raises a shield bubble. New things arrive by level: a
   saucer at 2, comets at 3, the ROCK KING every fourth level.
   ============================================================ */
var RK_W = 200, RK_H = 176;
var RK_POWERS = ['triple', 'rapid', 'shield', 'star'];

function rkWrap(o){
  if(o.x < 0) o.x += RK_W; else if(o.x >= RK_W) o.x -= RK_W;
  if(o.y < 0) o.y += RK_H; else if(o.y >= RK_H) o.y -= RK_H;
}
function rkDelta(a, b){
  var dx = b.x - a.x, dy = b.y - a.y;
  if(dx > RK_W/2) dx -= RK_W; else if(dx < -RK_W/2) dx += RK_W;
  if(dy > RK_H/2) dy -= RK_H; else if(dy < -RK_H/2) dy += RK_H;
  return [dx, dy];
}
function rkDist(a, b){ var d = rkDelta(a, b); return Math.hypot(d[0], d[1]); }
function rkSpeed(g){
  var R = TUNING.rocks;
  return (R.rockSpeed + (g.lv - 1)*R.rockSpeedStep) * (cfg.kidMode ? R.kidRockScale : 1);
}
function rkRadius(size){ var R = TUNING.rocks; return [0, R.smallR, R.midR, R.bigR, 24][size]; }
function rkMakeRock(g, x, y, size, ang, spd, kind){
  var r = rkRadius(size), shape = [], i;
  for(i=0; i<9; i++) shape.push(0.74 + Math.random()*0.34);
  var rock = { x:x, y:y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, size:size, r:r, a:Math.random()*6.28,
               va:(Math.random() - 0.5)*0.04, shape:shape, hp:1, kind:kind || 'rock', t:0, hurt:0 };
  if(kind === 'king'){ rock.hp = Math.max(3, Math.round(TUNING.rocks.kingHp * (cfg.kidMode ? 0.7 : 1))); rock.maxhp = rock.hp; rock.va = 0.006; }
  g.rocks.push(rock);
  return rock;
}
/* rocks come in from the edges, never on top of him */
function rkEdgeSpot(g){
  for(var t=0; t<30; t++){
    var side = Math.floor(Math.random()*4), x = Math.random()*RK_W, y = Math.random()*RK_H;
    if(side === 0) x = 0; else if(side === 1) x = RK_W - 1; else if(side === 2) y = 0; else y = RK_H - 1;
    if(rkDist({ x:x, y:y }, g.ship) > 60) return [x, y];
  }
  return [0, 0];
}
function rkStartWave(g){
  var lv = g.lv, n = 2 + Math.floor(lv/2) + (g.wave - 1), i, sp = rkSpeed(g), p;
  var king = (lv % 4 === 0) && g.wave === TUNING.rocks.wavesPerLevel;
  if(king){
    p = rkEdgeSpot(g);
    rkMakeRock(g, p[0], p[1], 4, Math.random()*6.28, sp*0.45, 'king');
    n = 2;
    arcBanner('ROCK KING!', C.blood); arcSay('boss_rock', true);
  } else arcBanner('WAVE ' + g.wave, C.jade);
  for(i=0; i<n; i++){ p = rkEdgeSpot(g); rkMakeRock(g, p[0], p[1], 3, Math.random()*6.28, sp*(0.7 + Math.random()*0.6)); }
  if(lv >= 3){
    var comets = 1 + Math.floor((lv - 3)/2);
    for(i=0; i<comets; i++){ p = rkEdgeSpot(g); rkMakeRock(g, p[0], p[1], 1, Math.random()*6.28, TUNING.rocks.cometSpeed*(cfg.kidMode ? 0.8 : 1), 'comet'); }
  }
  arcSegStart('Space Rocks level ' + lv + ' wave ' + g.wave);
  if(g.wave > 1 && !king) arcSay('wave');
}
function rkBreak(g, rock, bi){
  var R = TUNING.rocks, i;
  fxBurst(g.fxFoe, rock.x, rock.y, 6 + rock.size*3, rock.kind === 'comet' ? '#b8d4e8' : '#a89880', 1 + rock.size*0.3, 26, 2.4);
  sfx('rockHit', Math.min(3, rock.size));
  var idx = g.rocks.indexOf(rock);
  if(idx >= 0) g.rocks.splice(idx, 1);
  S.kills++;
  S.score += [0, 100, 50, 20, 500][rock.size];
  /* chains of quick kills pay extra */
  g.chain = (ARC.t - g.lastKill < R.chainFrames) ? g.chain + 1 : 1;
  g.lastKill = ARC.t;
  /* a chain of five quick kills pays a bonus once — every kill paying made the
     shop trivial */
  var coins = (rock.size === 1 ? 1 : 0) + (rock.kind === 'comet' ? 1 : 0) + (g.chain === 5 ? 2 : 0);
  if(coins) arcCoin(coins);
  if(rock.kind === 'king'){
    for(i=0; i<6; i++) rkMakeRock(g, rock.x, rock.y, 1, i*1.047 + 0.3, rkSpeed(g)*1.4);
    arcStar(1); arcHitstop(8); arcSay('wow', true);
    return;
  }
  if(rock.size > 1){
    var base = Math.atan2(rock.vy, rock.vx), sp = Math.hypot(rock.vx, rock.vy)*1.25 + 0.1;
    rkMakeRock(g, rock.x, rock.y, rock.size - 1, base + 0.9, sp);
    rkMakeRock(g, rock.x, rock.y, rock.size - 1, base - 0.9, sp);
  }
  arcHitstop(rock.size >= 3 ? 3 : 1);
}
function rkShoot(g){
  var R = TUNING.rocks, s = g.ship, spread = g.triple > 0 ? [-0.22, 0, 0.22] : [0], i;
  for(i=0; i<spread.length; i++){
    var a = s.a + spread[i];
    g.shots.push({ x:s.x + Math.cos(a)*7, y:s.y + Math.sin(a)*7, vx:Math.cos(a)*R.bulletSpeed + s.vx*0.4,
                   vy:Math.sin(a)*R.bulletSpeed + s.vy*0.4, t:R.bulletLife });
  }
  sfx('laser', g.shotN++ % 3);
  g.cd = g.rapid > 0 ? R.rapidEvery : R.fireEvery;
}
function rkShipHit(g, fromX, fromY){
  var R = TUNING.rocks, s = g.ship;
  if(s.inv > 0 || g.shield > 0) return false;
  sfx('shipHit'); arcHitstop(6);
  arcSegFail();
  g.hits++;
  var a = Math.atan2(s.y - fromY, s.x - fromX);
  s.vx = Math.cos(a)*2; s.vy = Math.sin(a)*2;
  s.inv = R.invFrames;
  if(cfg.kidMode){ arcKnockdown(); arcSay('oops_ok'); }
  else { g.lives--; if(g.lives <= 0) arcGameOver(); }
  return true;
}

GAMES.rocks = {
  id:'rocks', name:'SPACE ROCKS', say:'g_rocks', col:'#8fd8b4', label:'PLAY',
  W:RK_W, H:RK_H, surround:'#090c14', floor:'#0e1320',
  doneSub: function(){ return ARC.g ? (ARC.g.hits ? ARC.g.hits + ' bumps' : 'no bumps!') : ''; },
  start: function(lv){
    var g = { lv:lv, ship:{ x:RK_W/2, y:RK_H/2, vx:0, vy:0, a:-1.5708, inv:60 }, rocks:[], shots:[], eshots:[],
              powers:[], saucer:null, wave:1, pause:0, cd:0, triple:0, rapid:0, shield:0, shieldCd:0,
              saucerT:TUNING.rocks.saucerEvery*0.6, powerT:TUNING.rocks.powerEvery*0.5, chain:0, lastKill:-999,
              hits:0, lives:TUNING.rocks.lives, shotN:0, fxFoe:[], fxItem:[] };
    rkStartWave(g);
    if(lv === 2 || lv === 3) arcSay('newthing', true);
    return g;
  },
  update: function(g){
    var R = TUNING.rocks, s = g.ship, i, j;
    fxStep(g.fxFoe, 0); fxStep(g.fxItem, 0);
    /* the ship: the stick is where it goes */
    var ix = input.x, iy = input.y, m = Math.hypot(ix, iy);
    if(m > 1){ ix /= m; iy /= m; }
    s.vx = s.vx*R.shipFriction + ix*R.shipAccel; s.vy = s.vy*R.shipFriction + iy*R.shipAccel;
    var sp = Math.hypot(s.vx, s.vy);
    if(sp > R.shipMax){ s.vx *= R.shipMax/sp; s.vy *= R.shipMax/sp; }
    s.x += s.vx; s.y += s.vy; rkWrap(s);
    var aiming = Math.hypot(input.ax, input.ay) > 0.3;
    var want = aiming ? Math.atan2(input.ay, input.ax) : (m > 0.2 ? Math.atan2(iy, ix) : s.a);
    var da = Math.atan2(Math.sin(want - s.a), Math.cos(want - s.a));
    s.a += da*0.25;
    s.thrust = m > 0.2;
    if(s.inv > 0) s.inv--;
    if(g.cd > 0) g.cd--;
    if((input.act || input.atk || aiming) && g.cd <= 0) rkShoot(g);
    if(g.triple > 0) g.triple--;
    if(g.rapid > 0) g.rapid--;
    if(g.shield > 0) g.shield--;
    if(g.shieldCd > 0) g.shieldCd--;
    if(input.toolPress && g.shieldCd <= 0){ g.shield = R.shieldFrames; g.shieldCd = R.shieldCooldown; sfx('shield'); }

    /* shots */
    for(i = g.shots.length - 1; i >= 0; i--){
      var b = g.shots[i]; b.x += b.vx; b.y += b.vy; rkWrap(b);
      if(--b.t <= 0){ g.shots.splice(i, 1); continue; }
      var hit = false;
      for(j = g.rocks.length - 1; j >= 0 && !hit; j--){
        var rk = g.rocks[j];
        if(rkDist(b, rk) < rk.r + 1.5){
          hit = true; rk.hurt = 6;
          if(--rk.hp <= 0) rkBreak(g, rk);
          else { sfx('bump'); fxBurst(g.fxFoe, b.x, b.y, 3, '#a89880', 0.8, 14, 2); }
        }
      }
      if(!hit && g.saucer && rkDist(b, g.saucer) < 8){
        hit = true; g.saucer.hurt = 6;
        if(--g.saucer.hp <= 0){
          fxBurst(g.fxFoe, g.saucer.x, g.saucer.y, 16, '#8fd8b4', 1.6, 28, 3);
          sfx('boom'); arcStar(1); arcHitstop(6); S.score += 300;
          g.saucer = null;
        } else sfx('bump');
      }
      if(hit) g.shots.splice(i, 1);
    }
    /* rocks */
    for(i = g.rocks.length - 1; i >= 0; i--){
      var r = g.rocks[i];
      r.x += r.vx; r.y += r.vy; r.a += r.va; r.t++; if(r.hurt > 0) r.hurt--;
      rkWrap(r);
      if(r.kind === 'king' && r.t % Math.round(R.kingSpawnEvery) === 0){
        var d = rkDelta(r, s);
        rkMakeRock(g, r.x, r.y, 1, Math.atan2(d[1], d[0]), rkSpeed(g)*1.6);
        sfx('ring');
      }
      if(rkDist(r, s) < r.r + 4){
        if(g.shield > 0){
          var dd = rkDelta(s, r), n = Math.hypot(dd[0], dd[1]) || 1, v = Math.hypot(r.vx, r.vy);
          r.vx = dd[0]/n*v; r.vy = dd[1]/n*v; r.x = s.x + dd[0]/n*(r.r + 6); r.y = s.y + dd[1]/n*(r.r + 6); rkWrap(r);
          sfx('block');
        } else rkShipHit(g, r.x, r.y);
      }
    }
    /* the saucer: crosses once, shooting slowly, worth a star */
    if(g.lv >= 2){
      if(!g.saucer && --g.saucerT <= 0){
        var fromLeft = Math.random() < 0.5;
        g.saucer = { x:fromLeft ? 0 : RK_W - 1, y:20 + Math.random()*(RK_H - 40), dir:fromLeft ? 1 : -1, t:0, hp:R.saucerHp, hurt:0 };
        g.saucerT = R.saucerEvery;
        sfx('saucer');
      }
      if(g.saucer){
        var sc = g.saucer;
        sc.t++; sc.x += sc.dir*0.7; sc.y += Math.sin(sc.t*0.05)*0.5; if(sc.hurt > 0) sc.hurt--;
        if(sc.t % 40 === 0) sfx('saucer');
        if(sc.t % Math.round(R.saucerShotEvery) === 0){
          var sd = rkDelta(sc, s), sn = Math.hypot(sd[0], sd[1]) || 1;
          g.eshots.push({ x:sc.x, y:sc.y, vx:sd[0]/sn*1.1, vy:sd[1]/sn*1.1, t:150 });
        }
        if(sc.x < -8 || sc.x > RK_W + 8) g.saucer = null;
        else if(rkDist(sc, s) < 9) rkShipHit(g, sc.x, sc.y);
      }
    }
    for(i = g.eshots.length - 1; i >= 0; i--){
      var e = g.eshots[i]; e.x += e.vx; e.y += e.vy; rkWrap(e);
      if(--e.t <= 0){ g.eshots.splice(i, 1); continue; }
      if(rkDist(e, s) < 5){ if(g.shield <= 0) rkShipHit(g, e.x, e.y); else sfx('block'); g.eshots.splice(i, 1); }
    }
    /* power-ups drift through on their own schedule */
    if(--g.powerT <= 0){
      g.powerT = R.powerEvery;
      var pp = rkEdgeSpot(g), pa = Math.atan2(RK_H/2 - pp[1], RK_W/2 - pp[0]) + (Math.random() - 0.5);
      g.powers.push({ x:pp[0], y:pp[1], vx:Math.cos(pa)*0.35, vy:Math.sin(pa)*0.35, t:R.powerLife,
                      kind:RK_POWERS[Math.floor(Math.random()*RK_POWERS.length)] });
    }
    for(i = g.powers.length - 1; i >= 0; i--){
      var pw = g.powers[i]; pw.x += pw.vx; pw.y += pw.vy; rkWrap(pw);
      if(--pw.t <= 0){ g.powers.splice(i, 1); continue; }
      if(rkDist(pw, s) < 9){
        g.powers.splice(i, 1);
        fxBurst(g.fxItem, pw.x, pw.y, 10, C.gold, 1.2, 20, 2);
        sfx('powerUp');
        if(pw.kind === 'triple') g.triple = R.powerFrames;
        else if(pw.kind === 'rapid') g.rapid = R.powerFrames;
        else if(pw.kind === 'shield') g.shield = R.shieldFrames*2;
        else arcStar(1);
      }
    }
    /* the wave is over when the rocks are */
    if(!g.rocks.length){
      if(g.pause === 0){
        arcSegEnd();
        if(g.wave >= R.wavesPerLevel){ arcLevelDone(3 - Math.min(2, g.hits)); return; }
        g.pause = 70;
      } else if(--g.pause === 0){ g.wave++; rkStartWave(g); }
    }
  },
  idle: function(g){ fxStep(g.fxFoe, 0); fxStep(g.fxItem, 0); },
  busy: function(g){ return { foe:!!(g.rocks.length || g.saucer || g.eshots.length), item:g.powers.length > 0, clue:false }; },
  intense: function(g){
    var v = 0, i;
    for(i=0; i<g.rocks.length; i++){
      if(g.rocks[i].kind === 'king') return 1;
      if(rkDist(g.rocks[i], g.ship) < g.rocks[i].r + 26) v = 0.8;
    }
    if(g.rocks.length >= 9) v = Math.max(v, 0.62);
    return v;
  },
  draw: function(g, eye, m){
    var i;
    /* world: the field and its frame */
    ctx.fillStyle = this.surround; ctx.fillRect(-m.mx, -m.my, RK_W + m.mx*2, RK_H + m.my*2);
    ctx.fillStyle = '#2a3348'; ctx.fillRect(-2, -2, RK_W + 4, RK_H + 4);
    ctx.fillStyle = this.floor; ctx.fillRect(0, 0, RK_W, RK_H);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, RK_W, RK_H); ctx.clip();
    withLayer(eye, 'item', function(){
      for(i=0; i<g.powers.length; i++) rkWrapDraw(g.powers[i], 8, rkDrawPower);
      fxDraw(g.fxItem);
    });
    withLayer(eye, 'foe', function(){
      for(i=0; i<g.rocks.length; i++) rkWrapDraw(g.rocks[i], g.rocks[i].r + 6, rkDrawRock);
      if(g.saucer) rkWrapDraw(g.saucer, 10, rkDrawSaucer);
      ctx.fillStyle = C.blood;
      for(i=0; i<g.eshots.length; i++) ctx.fillRect(g.eshots[i].x - 2, g.eshots[i].y - 2, 4, 4);
      fxDraw(g.fxFoe);
    });
    /* player: shots, shield and ship — both eyes, full contrast */
    ctx.fillStyle = C.bone;
    for(i=0; i<g.shots.length; i++) ctx.fillRect(g.shots[i].x - 1.2, g.shots[i].y - 1.2, 2.4, 2.4);
    var s = g.ship;
    if(!(s.inv > 0 && (ARC.t % 12) < 5)){
      rkWrapDraw(s, 10, function(o){
        ctx.save(); ctx.translate(o.x, o.y);
        drawShipSprite(paintOf('ship'), s.a, s.thrust);
        ctx.restore();
      });
    }
    if(g.shield > 0){
      ctx.strokeStyle = '#8fd8b4'; ctx.lineWidth = 1.2;
      var rr = 10 + ((ARC.t >> 3) & 1);
      ctx.beginPath(); ctx.arc(s.x, s.y, rr, 0, 6.2832); ctx.stroke();
    }
    ctx.restore();
  },
  hud: function(g, eye, vp, u){
    var hs = Math.max(9, u*3.6), i, R = TUNING.rocks, y = vp.y + vp.h - hs*1.6;
    for(i=0; i<R.wavesPerLevel; i++){
      ctx.fillStyle = i < g.wave - (g.rocks.length ? 1 : 0) ? C.jade : '#2a3348';
      ctx.fillRect(vp.x + vp.w/2 + (i - (R.wavesPerLevel - 1)/2)*hs*1.4 - hs*0.4, y - hs*0.4, hs*0.8, hs*0.8);
    }
    if(!cfg.kidMode) for(i=0; i<g.lives; i++){
      ctx.save(); ctx.translate(vp.x + hs*1.6 + i*hs*1.6, vp.y + hs*3.2); ctx.scale(hs/14, hs/14);
      drawShipSprite(paintOf('ship'), -1.5708, false); ctx.restore();
    }
    var px = vp.x + vp.w - hs*1.8;
    if(g.triple > 0){ drawIcon('star', px, y, hs*0.4, C.gold); px -= hs*1.4; }
    if(g.rapid > 0){ drawIcon('play', px, y, hs*0.4, C.gold); px -= hs*1.4; }
    if(g.chain >= 3 && ARC.t - g.lastKill < 60) mtext('x' + g.chain, vp.x + vp.w/2, vp.y + hs*1.4, hs, C.gold, 'center', 700, F_MONO);
  },
  icon: function(cx, cy, s, t){
    var k = s/20;
    ctx.fillStyle = '#0e1320'; ctx.fillRect(cx - s, cy - s*0.9, s*2, s*1.8);
    var rocks = [[-11, -6, 5], [10, -8, 4], [8, 8, 6], [-9, 9, 3]], i;
    for(i=0; i<rocks.length; i++){
      var a = t*0.02 + i;
      rkDrawRock({ x:cx + rocks[i][0]*k + Math.cos(a)*k, y:cy + rocks[i][1]*k + Math.sin(a)*k, r:rocks[i][2]*k,
                   a:a, shape:[1,0.85,1,0.9,1,0.8,0.95,1,0.88], kind:'rock', hurt:0 });
    }
    ctx.save(); ctx.translate(cx, cy); ctx.scale(k*1.4, k*1.4);
    drawShipSprite(paintOf('ship'), -1.5708 + Math.sin(t*0.03)*0.6, true);
    ctx.restore();
    ctx.fillStyle = C.bone;
    var by = cy - ((t*1.5) % (s*0.9));
    ctx.fillRect(cx - k*0.6, by - k*4, k*1.2, k*1.2);
  }
};
/* draw an object at its place and, near an edge, at its wrapped places too */
function rkWrapDraw(o, r, fn){
  var xs = [o.x], ys = [o.y], i, j;
  if(o.x < r) xs.push(o.x + RK_W); else if(o.x > RK_W - r) xs.push(o.x - RK_W);
  if(o.y < r) ys.push(o.y + RK_H); else if(o.y > RK_H - r) ys.push(o.y - RK_H);
  for(i=0; i<xs.length; i++) for(j=0; j<ys.length; j++){
    if(i === 0 && j === 0){ fn(o); continue; }
    var c = {}, k; for(k in o) c[k] = o[k];
    c.x = xs[i]; c.y = ys[j]; fn(c);
  }
}
function rkDrawRock(r){
  var n = r.shape.length, i, flash = r.hurt > 0 && (r.hurt >> 1) % 2 === 0;
  var body = r.kind === 'comet' ? '#b8d4e8' : (r.kind === 'king' ? '#9a6f5a' : '#8a7f6a');
  if(r.kind === 'comet'){
    var sp = Math.hypot(r.vx || 0, r.vy || 0) || 1, tx = -(r.vx || 0)/sp, ty = -(r.vy || 0)/sp;
    ctx.fillStyle = '#6f93b0';
    for(i=1; i<=3; i++){ var ts = r.r*(1.3 - i*0.3); ctx.fillRect(r.x + tx*i*4 - ts/2, r.y + ty*i*4 - ts/2, ts, ts); }
  }
  ctx.fillStyle = flash ? C.bone : body;
  ctx.beginPath();
  for(i=0; i<n; i++){
    var a = r.a + i/n*6.2832, rr = r.r*r.shape[i];
    if(i === 0) ctx.moveTo(r.x + Math.cos(a)*rr, r.y + Math.sin(a)*rr); else ctx.lineTo(r.x + Math.cos(a)*rr, r.y + Math.sin(a)*rr);
  }
  ctx.closePath(); ctx.fill();
  if(flash) return;
  ctx.fillStyle = r.kind === 'comet' ? '#8fb3cf' : '#5f5747';
  ctx.fillRect(r.x + Math.cos(r.a)*r.r*0.35 - r.r*0.15, r.y + Math.sin(r.a)*r.r*0.35 - r.r*0.15, r.r*0.3, r.r*0.3);
  ctx.fillRect(r.x - Math.cos(r.a + 1)*r.r*0.4 - r.r*0.1, r.y - Math.sin(r.a + 1)*r.r*0.4 - r.r*0.1, r.r*0.22, r.r*0.22);
  if(r.kind === 'king'){
    var e = r.r*0.22;
    ctx.fillStyle = C.bone; ctx.fillRect(r.x - e*2.2, r.y - e*1.4, e*1.6, e*1.4); ctx.fillRect(r.x + e*0.6, r.y - e*1.4, e*1.6, e*1.4);
    ctx.fillStyle = '#12151d'; ctx.fillRect(r.x - e*1.6, r.y - e, e*0.7, e*0.8); ctx.fillRect(r.x + e*1.2, r.y - e, e*0.7, e*0.8);
    ctx.fillStyle = C.gold;
    ctx.fillRect(r.x - e*2.5, r.y - r.r*0.95, e*5, e*0.8);
    ctx.fillRect(r.x - e*2.5, r.y - r.r*0.95 - e, e*0.8, e); ctx.fillRect(r.x - e*0.4, r.y - r.r*0.95 - e*1.3, e*0.8, e*1.3); ctx.fillRect(r.x + e*1.7, r.y - r.r*0.95 - e, e*0.8, e);
    /* its health, drawn on the foe layer with it */
    var hw = r.r*1.6, k = (r.hp || 0)/(r.maxhp || 1);
    ctx.fillStyle = '#3a2020'; ctx.fillRect(r.x - hw/2, r.y + r.r + 4, hw, 2.5);
    ctx.fillStyle = C.blood; ctx.fillRect(r.x - hw/2, r.y + r.r + 4, hw*k, 2.5);
  }
}
function rkDrawSaucer(s){
  var flash = s.hurt > 0 && (s.hurt >> 1) % 2 === 0;
  ctx.fillStyle = flash ? C.bone : '#8a90a8'; ctx.fillRect(s.x - 8, s.y - 1, 16, 4);
  ctx.fillStyle = flash ? C.bone : '#5e6378'; ctx.fillRect(s.x - 6, s.y + 3, 12, 2);
  ctx.fillStyle = flash ? C.bone : '#8fd8b4'; ctx.fillRect(s.x - 4, s.y - 5, 8, 4);
  ctx.fillStyle = C.gold; ctx.fillRect(s.x - 6 + ((s.t >> 3) % 3)*5, s.y, 2, 2);
}
function rkDrawPower(p){
  var s = p.t < 40 ? p.t/40 : 1, r = 5*s;
  if(r < 0.5) return;
  ctx.fillStyle = C.gold; ctx.fillRect(p.x - r, p.y - r, r*2, r*2);
  ctx.fillStyle = '#1a1405'; ctx.fillRect(p.x - r*0.7, p.y - r*0.7, r*1.4, r*1.4);
  ctx.fillStyle = C.gold;
  if(p.kind === 'triple'){ ctx.fillRect(p.x - r*0.5, p.y - r*0.5, r*0.25, r); ctx.fillRect(p.x - r*0.12, p.y - r*0.5, r*0.25, r); ctx.fillRect(p.x + r*0.26, p.y - r*0.5, r*0.25, r); }
  else if(p.kind === 'rapid'){ ctx.fillRect(p.x - r*0.1, p.y - r*0.55, r*0.3, r*0.6); ctx.fillRect(p.x - r*0.3, p.y, r*0.3, r*0.55); }
  else if(p.kind === 'shield'){ ctx.fillRect(p.x - r*0.45, p.y - r*0.45, r*0.9, r*0.2); ctx.fillRect(p.x - r*0.45, p.y + r*0.25, r*0.9, r*0.2); ctx.fillRect(p.x - r*0.45, p.y - r*0.45, r*0.2, r*0.9); ctx.fillRect(p.x + r*0.25, p.y - r*0.45, r*0.2, r*0.9); }
  else { ctx.fillRect(p.x - r*0.1, p.y - r*0.55, r*0.2, r*1.1); ctx.fillRect(p.x - r*0.55, p.y - r*0.1, r*1.1, r*0.2); }
}
/* the ship, drawn at the origin pointing along angle a — player layer */
function drawShipSprite(pt, a, thrust){
  ctx.save(); ctx.rotate(a);
  if(thrust){
    ctx.fillStyle = (ARC.t >> 2) & 1 ? C.gold : C.blood;
    ctx.fillRect(-9, -1.5, 3, 3);
  }
  ctx.fillStyle = pt.d;
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3.5, 0); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pt.c;
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-4.5, -4.2); ctx.lineTo(-2.5, 0); ctx.lineTo(-4.5, 4.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.bone; ctx.fillRect(1, -1, 3, 2);
  ctx.restore();
}
