
/* ---------------- entities ---------------- */
function mkFoe(type,x,y,opt){
  var t = TUNING[type] || TUNING.grub;
  var b = { type:type, x:x, y:y, vx:0, vy:0, hurt:0, t:(Math.random()*100)|0,
            hp:t.hp, w:t.w, h:t.h, spd:t.speed||0, dmg:t.damage };
  if(opt && opt.hp) b.hp += opt.hp;
  if(cfg.kidMode){
    var SS = TUNING.session;
    b.hp  = Math.max(1, Math.round(b.hp * SS.foeHpScale));
    b.spd = b.spd * SS.foeSpeedScale;
  }
  if(type==='bat')    b.ph = Math.random()*6.28;
  if(type==='sentry') b.cd = (t.cooldown*0.6)|0 + ((Math.random()*t.cooldown*0.6)|0);
  if(type==='hopper'){ b.z = 0; b.hop = 0; b.cd = (t.hopEvery*(0.4 + Math.random()*0.6))|0; }
  if(type==='slime' && opt && opt.small){
    b.small = true; b.hp = t.smallHp; b.w = b.h = 9;
    b.spd = t.smallSpeed * (cfg.kidMode ? TUNING.session.foeSpeedScale : 1);
  }
  if(type==='boss'){
    b.state='wait'; b.cd=t.restFrames; b.spawned=0; b.z = 0;
    /* every island's warden has its own way of fighting; from island 5 on it
       alternates between two of them */
    var id = ISLAND ? ISLAND.id : 1;
    b.pattern = BOSS_PATTERNS[(id - 1) % BOSS_PATTERNS.length];
    b.alt = id >= 5 ? BOSS_PATTERNS[id % BOSS_PATTERNS.length] : null;
  }
  b.maxhp = b.hp;
  return b;
}
var BOSS_PATTERNS = ['charge', 'ring', 'summon', 'leap'];
function solidAt(tx,ty){
  if(tx<0||ty<0||tx>=RW||ty>=RH) return true;
  var t = G.grid[ty][tx];
  if(tileSolid(t)) return true;
  if(t === T_DOOR && G.sealed) return true;
  return objSolidAt(tx, ty);
}
function blocked(x,y,w,h){
  var x0=Math.floor((x-w/2)/TS), x1=Math.floor((x+w/2-0.01)/TS);
  var y0=Math.floor((y-h/2)/TS), y1=Math.floor((y+h/2-0.01)/TS);
  for(var ty=y0;ty<=y1;ty++) for(var tx=x0;tx<=x1;tx++) if(solidAt(tx,ty)) return true;
  return false;
}
function moveBody(b,dx,dy){
  if(dx){ if(!blocked(b.x+dx,b.y,b.w,b.h)) b.x+=dx; else { b.vx=0; } }
  if(dy){ if(!blocked(b.x,b.y+dy,b.w,b.h)) b.y+=dy; else { b.vy=0; } }
}
function overlap(a,b){ return Math.abs(a.x-b.x) < (a.w+b.w)/2 && Math.abs(a.y-b.y) < (a.h+b.h)/2; }
/* is (x,y) in front of the player, within ~70 degrees of where they face? */
function facingToward(p, x, y){
  var v = DIRV[p.face], dx = x - p.x, dy = y - p.y, d = Math.hypot(dx, dy) || 1;
  return (dx*v[0] + dy*v[1]) / d > 0.35;
}
/* if something solid just appeared on top of the player, step them off it */
function unstick(){
  var p = G.p;
  if(!blocked(p.x, p.y, p.w, p.h)) return;
  for(var r=4; r<=40; r+=4){
    for(var a=0; a<8; a++){
      var x = p.x + Math.cos(a*0.785)*r, y = p.y + Math.sin(a*0.785)*r;
      if(!blocked(x, y, p.w, p.h)){ p.x = x; p.y = y; return; }
    }
  }
}

/* ---------------- adaptive staircase (3-down / 1-up on contrast) ----------------
   A SEGMENT is the unit a step is earned in: a dungeon room, or an arcade game's
   level part, wave or checkpoint section. stairSegment() opens one. The child-mode
   cap on step-ups counts per segment, whichever game is running. */
var STAIR = { ups:0 };
function stairSegment(){ STAIR.ups = 0; }
function stepDown(){
  if(!cfg.adapt) return;
  var th = TUNING.therapy, q = th.quantise;
  var n = Math.max(th.minContrast, Math.round((cfg.strong*th.stepDownFactor)/q)*q);
  if(n < cfg.strong-0.001){ cfg.strong = n; S.stepsDown++; syncSliders(); saveCfg(); logContrast(); sfx('stepDown'); toast('stronger eye ↓ ' + Math.round(cfg.strong*100) + '%'); }
}
function stepUp(){
  if(!cfg.adapt) return;
  /* Without this cap a child who is struggling gets hit repeatedly, the
     stronger eye is pushed back up each time, and the harder he finds it the
     less dichoptic load he actually receives — the opposite of the point. */
  if(cfg.kidMode && STAIR.ups >= TUNING.session.stepUpsPerRoom) return;
  var th = TUNING.therapy, q = th.quantise;
  var n = Math.min(1, Math.round((cfg.strong*th.stepUpFactor + th.stepUpFloorBump)/q)*q);
  if(n > cfg.strong+0.001){ cfg.strong = n; S.stepsUp++; STAIR.ups++; syncSliders(); saveCfg(); logContrast(); sfx('stepUp'); toast('stronger eye ↑ ' + Math.round(cfg.strong*100) + '%'); }
}
var toastTxt='', toastT=0;
function toast(s){ toastTxt=s; toastT=TUNING.feel.toastFrames; }

/* ---------------- damage ---------------- */
function hurtPlayer(n, sx, sy){
  var p = G.p;
  if(p.inv>0 || G.dead) return;
  p.hp -= n; p.inv = TUNING.player.iframes; p.flash = TUNING.player.flashFrames;
  sfx('hurt');
  S.hits++; G.cleanRoom = false;
  var a = Math.atan2(p.y-sy, p.x-sx);
  p.vx = Math.cos(a)*TUNING.player.knockback; p.vy = Math.sin(a)*TUNING.player.knockback;
  stepUp();
  if(p.hp<=0){
    if(cfg.kidMode){
      /* A five-year-old who dies stops playing, and a session that ends at
         minute three delivered nothing. In child mode you get knocked down
         and helped back up instead. */
      p.hp = Math.min(p.maxhp, TUNING.session.knockdownHp);
      p.inv = TUNING.session.knockdownIframes;
      S.knockdowns = (S.knockdowns || 0) + 1;
      sfx('roomClear'); toast('up you get');
    } else { p.hp = 0; G.dead = true; }
  }
}
function hurtFoe(f,n){
  f.hp -= n; f.hurt = TUNING.combat.foeHurtFrames;
  sfx(f.hp<=0 ? 'foeDie' : 'hitFoe');
  G.fx.push({ x:f.x, y:f.y, t:10, type:'spark', seed:Math.random()*6.28 });
  var a = Math.atan2(f.y-G.p.y, f.x-G.p.x), kb = TUNING.combat.foeKnockback;
  f.vx = Math.cos(a)*kb; f.vy = Math.sin(a)*kb;
  owlProgress();
  if(f.hp<=0){
    S.kills++;
    G.fx.push({x:f.x,y:f.y,t:22,type:'poof'});
    var idx = G.foes.indexOf(f);
    if(idx >= 0) G.foes.splice(idx,1);
    /* a slime splits into two quick halves */
    if(f.type === 'slime' && !f.small){
      /* the halves bounce apart and cannot be hit for a moment, or the swing
         that split the slime would take both of them with it */
      [-1, 1].forEach(function(side){
        var h = mkFoe('slime', f.x + side*6, f.y, { small:true });
        h.vx = side*1.6; h.hurt = TUNING.combat.foeHurtFrames + 6;
        G.foes.push(h);
      });
      sfx('split');
    }
    /* In child mode a beaten foe is worth a coin, straight to the counter.
       Not dropped on the floor: in forced fusion a coin appearing where a foe
       died would show the stronger eye where a foe it cannot see had been. */
    if(cfg.kidMode && f.type !== 'boss') addCoins(1);
    /* the warden does not end the run by dying: it leaves this island's
       light behind, and picking THAT up is the moment the island is done */
    if(f.type === 'boss'){
      G.items.push({ type:'orb', x:Math.max(TS*2, Math.min(WW-TS*2, f.x)), y:Math.max(TS*2, Math.min(WH-TS*2, f.y)), r:6, bob:0 });
      sfx('win');
    }
    if(G.foes.length===0) onRoomClear();
  }
}
function onRoomClear(){
  var st = rs(G.key);
  if(st.cleared) return;
  st.cleared = true;
  if(G.cleanRoom){ S.cleanRooms++; stepDown(); }
  for(var ri=S.roomLog.length-1; ri>=0; ri--){
    if(S.roomLog[ri].room === G.key && S.roomLog[ri].clearedAt == null){
      S.roomLog[ri].clearedAt = Math.round(S.elapsed/1000);
      S.roomLog[ri].clean = !!G.cleanRoom;
      S.roomLog[ri].hitsTaken = S.hits - S.roomLog[ri].hitsBefore;
      break;
    }
  }
  if(G.sealed){ G.sealed = false; sfx('unlock'); }
  if(G.spec.drop && !st.taken) spawnDrop(G.key);
  sfx('roomClear');
  G.fx.push({x:WW/2,y:WH/2,t:40,type:'clear'});
  /* a boss room is not a place to stop: the light is still on the floor */
  if(!G.spec.boss) sittingBreakpoint();
}

/* ---------------- the item-held-up moment ---------------- */
var ITEMNAME = { heart:'heart', vessel:'heart vessel — more life', smallkey:'small key', bosskey:"warden's key",
                 coins:'treasure', coin:'coin', orb:'the light of the island',
                 shield:'the shield', bombs:'the bombs', bow:'the bow' };
function grantItem(item, amount){
  var p = G.p;
  if(item === 'heart') p.hp = Math.min(p.maxhp, p.hp + 2);
  else if(item === 'vessel'){ p.maxhp += 2; p.hp = p.maxhp; }
  else if(item === 'smallkey') G.keys++;
  else if(item === 'bosskey') G.bossKey = true;
  else if(item === 'coins') addCoins(amount || TUNING.world.secretChestCoins);
  else if(item === 'shield' || item === 'bombs' || item === 'bow'){
    PROG.tools[item] = true; G.tool = item; saveProg();
  }
}
function addCoins(n){ G.coins += n; S.coins += n; PROG.coins += n; PROG.wallet += n; }
function startHold(item){
  G.hold = { item:item, t:TUNING.world.holdFrames };
  sfx(item === 'orb' ? 'fanfare' : 'chest');
  toast(ITEMNAME[item] || item);
  var line = { coins:'chest', bosskey:'key', smallkey:'key', vessel:'heart', heart:'heart',
               shield:'shield', bombs:'bombs', bow:'bow', orb:'orb' }[item];
  if(line) owlSay(line, true);
}
function holdTick(){
  G.hold.t--;
  if(G.hold.t > 0) return;
  var item = G.hold.item;
  G.hold = null;
  if(item === 'orb'){
    G.won = true;
    if(!PROG.lit[ISLAND.id]){ PROG.lit[ISLAND.id] = true; S.firstLight = true; }
    saveProg();
  }
}

/* ---------------- update ---------------- */
function update(){
  G.t++;
  var p = G.p, i, f, PT = TUNING.player;

  if(G.fadeDir){
    G.fade += G.fadeDir*TUNING.feel.fadeSpeed;
    if(G.fade>=1 && G.fadeDir>0){ G.fade=1; enterRoom(G.pending.key, G.pending.dir); G.pending=null; G.fadeDir=-1; }
    else if(G.fade<=0 && G.fadeDir<0){ G.fade=0; G.fadeDir=0; }
    return;
  }
  if(G.dead || G.won){ stepFx(); return; }
  /* the world holds still while he holds the thing up — that pause IS the reward */
  if(G.hold){ holdTick(); stepFx(); owlTick(); return; }

  /* --- player --- */
  toolsPre();
  var ix = input.x, iy = input.y;
  var m = Math.hypot(ix,iy); if(m>1){ ix/=m; iy/=m; }
  var slow = 1;
  if(p.atk>0){ p.atk--; slow *= PT.attackSlow; }
  if(p.shield) slow *= TUNING.tools.shieldSlow;
  var mx = ix*slow, my = iy*slow;
  if(!p.shield && (Math.abs(ix)>0.15||Math.abs(iy)>0.15)){
    if(Math.abs(ix)>Math.abs(iy)) p.face = ix>0?'e':'w'; else p.face = iy>0?'s':'n';
  }
  p.vx = p.vx*PT.friction + mx*PT.speed*PT.accel;
  p.vy = p.vy*PT.friction + my*PT.speed*PT.accel;
  moveBody(p, p.vx, 0); moveBody(p, 0, p.vy);
  worldPush(ix, iy);
  if(p.inv>0) p.inv--; if(p.flash>0) p.flash--;
  /* one button: open or dig if there is something to open or dig, else swing */
  if(input.atk && p.atk<=0 && !p.spin && !worldInteract()){
    p.atk = PT.atkFrames; sfx('swing'); G.fx.push({x:p.x,y:p.y,t:8,type:'swing',face:p.face});
  }
  input.atk = false;
  /* keep holding after the swing and the sword charges; let go and it goes
     all the way round */
  if(input.act && p.atk <= 0 && !p.spin){
    p.charge = (p.charge || 0) + 1;
    if(p.charge === PT.spinChargeFrames) sfx('charged');
  } else if(!input.act){
    if((p.charge || 0) >= PT.spinChargeFrames && !p.spin){ p.spin = PT.spinFrames; sfx('spin'); }
    p.charge = 0;
  }

  /* sword hitbox */
  if(p.atk > PT.atkFrames - PT.atkActiveFrom){
    var sb = swordBox(p);
    for(i=G.foes.length-1;i>=0;i--){ f=G.foes[i]; if(f && f.hurt<=0 && !(f.z > 6) && overlap(sb,f)) hurtFoe(f,1); }
    for(i=G.shots.length-1;i>=0;i--){ if(overlap(sb,G.shots[i])) G.shots.splice(i,1); }
    worldSwordHit(sb);
  }
  if(p.spin > 0){
    p.spin--;
    var R = PT.spinRadius, spinBox = { x:p.x, y:p.y, w:R*2, h:R*2 };
    for(i=G.foes.length-1;i>=0;i--){ f=G.foes[i]; if(f && f.hurt<=0 && !(f.z > 6) && Math.hypot(f.x-p.x, f.y-p.y) < R + f.w/2) hurtFoe(f,1); }
    for(i=G.shots.length-1;i>=0;i--){ if(Math.hypot(G.shots[i].x-p.x, G.shots[i].y-p.y) < R) G.shots.splice(i,1); }
    worldSwordHit(spinBox);
  }
  toolsTick();

  /* --- foes --- */
  for(i=G.foes.length-1;i>=0;i--){
    f = G.foes[i]; if(!f) continue;
    f.t++; if(f.hurt>0) f.hurt--;
    var dx = p.x-f.x, dy = p.y-f.y, d = Math.hypot(dx,dy)||1;
    var TF = TUNING[f.type];
    if(f.type==='grub'){
      if(f.t%TF.dutyCycle < TF.dutyMove){ f.vx = f.vx*TF.friction + (dx/d)*f.spd*TF.accel; f.vy = f.vy*TF.friction + (dy/d)*f.spd*TF.accel; }
      else { f.vx*=TF.friction; f.vy*=TF.friction; }
    } else if(f.type==='bat'){
      f.ph += TF.wobbleRate;
      var per = Math.sin(f.ph)*TF.wobble;
      f.vx = f.vx*TF.friction + ((dx/d)*f.spd + (-dy/d)*per)*TF.accel;
      f.vy = f.vy*TF.friction + ((dy/d)*f.spd + ( dx/d)*per)*TF.accel;
    } else if(f.type==='sentry'){
      f.vx*=TF.friction; f.vy*=TF.friction; f.cd--;
      if(f.cd<=0){ f.cd = TF.cooldown;
        var ax = Math.abs(dx)>Math.abs(dy) ? Math.sign(dx) : 0;
        var ay = ax===0 ? Math.sign(dy) : 0;
        G.shots.push({x:f.x,y:f.y,vx:ax*TF.shotSpeed,vy:ay*TF.shotSpeed,w:6,h:6,life:TF.shotLife});
        sfx('shot');
      }
    } else if(f.type==='hopper'){
      /* sits, then leaps at where he was standing */
      if(f.hop > 0){
        f.hop--;
        f.z = Math.sin((1 - f.hop/TF.hopFrames)*Math.PI)*TF.hopHeight;
        f.vx = f.hx; f.vy = f.hy;
        if(f.hop === 0){ f.z = 0; f.vx *= 0.3; f.vy *= 0.3; }
      } else {
        f.vx *= TF.friction; f.vy *= TF.friction;
        if(--f.cd <= 0){ f.cd = TF.hopEvery + ((Math.random()*30)|0); f.hop = TF.hopFrames; f.hx = dx/d*f.spd; f.hy = dy/d*f.spd; sfx('frog'); }
      }
    } else if(f.type==='slime'){
      f.vx = f.vx*TF.friction + (dx/d)*f.spd*TF.accel;
      f.vy = f.vy*TF.friction + (dy/d)*f.spd*TF.accel;
    } else if(f.type==='boss'){
      bossTick(f, TF, dx, dy, d);
    }
    if(f.type === 'boss' && f.state === 'leap'){ f.x += f.vx; f.y += f.vy; }
    else { moveBody(f, f.vx, 0); moveBody(f, 0, f.vy); }
    if(overlap(p,f) && !(f.z > 6)){
      if(p.shield && facingToward(p, f.x, f.y)){
        var ka = Math.atan2(f.y-p.y, f.x-p.x);
        f.vx = Math.cos(ka)*TUNING.combat.foeKnockback*1.4; f.vy = Math.sin(ka)*TUNING.combat.foeKnockback*1.4;
        if(G.t % 8 === 0) sfx('block');
      } else hurtPlayer(f.dmg, f.x, f.y);
    }
  }

  /* --- shots --- */
  for(i=G.shots.length-1;i>=0;i--){
    var s=G.shots[i]; s.x+=s.vx; s.y+=s.vy; s.life--;
    if(s.life<=0 || blocked(s.x,s.y,4,4)){ G.shots.splice(i,1); continue; }
    if(p.shield && Math.hypot(s.x-p.x, s.y-p.y) < 14 && facingToward(p, s.x, s.y)){
      G.shots.splice(i,1); sfx('block'); continue;
    }
    if(overlap(p,s)){ hurtPlayer(1,s.x,s.y); G.shots.splice(i,1); }
  }

  /* --- items --- */
  var WD = TUNING.world;
  for(i=G.items.length-1;i>=0;i--){
    var it=G.items[i]; it.bob+=0.08;
    if(it.type === 'coin'){
      var cd = Math.hypot(p.x-it.x, p.y-it.y);
      if(cd < WD.coinMagnetRange){ it.vx = (it.vx||0) + (p.x-it.x)/cd*WD.coinMagnetPull; it.vy = (it.vy||0) + (p.y-it.y)/cd*WD.coinMagnetPull; }
      it.x += it.vx||0; it.y += it.vy||0;
      it.vx = (it.vx||0)*WD.coinFriction; it.vy = (it.vy||0)*WD.coinFriction;
      it.x = Math.max(TS+4, Math.min(WW-TS-4, it.x)); it.y = Math.max(TS+4, Math.min(WH-TS-4, it.y));
    }
    if(Math.abs(it.x-p.x)<12 && Math.abs(it.y-p.y)<12){
      G.items.splice(i,1);
      if(it.type === 'coin'){ addCoins(1); sfx('coin'); continue; }
      if(it.type === 'heart'){ p.hp = Math.min(p.maxhp, p.hp+2); sfx('pickup'); if(!it.loose) rs(G.key).taken = true; continue; }
      rs(G.key).taken = true;
      grantItem(it.type);
      startHold(it.type);
      owlProgress();
    }
  }
  worldTick();
  owlTick();
  stepFx();

  /* --- doors --- */
  checkDoors();
}
function stepFx(){ for(var i=G.fx.length-1;i>=0;i--){ G.fx[i].t--; if(G.fx[i].t<=0) G.fx.splice(i,1); } }

/* ---------------- the wardens ----------------
   charge (island 1): rests, then charges; bats come once it is hurt
   ring:   winds up, then fires a ring of shots
   summon: winds up, then calls grubs and bats (never more than summonMax)
   leap:   jumps to where he stands and lands with a shockwave
   The windup is a tell he can learn: the eyes go gold before anything happens. */
function bossTick(f, TF, dx, dy, d){
  var pat = f.pattern || 'charge', i;
  f.cd--;
  if(pat === 'charge'){
    if(f.state==='wait'){ f.vx*=0.9; f.vy*=0.9; if(f.cd<=0){ f.state='charge'; f.cd=TF.chargeFrames; f.dirx=dx/d; f.diry=dy/d; sfx('bossWake'); } }
    else { f.vx = f.dirx*f.spd*TF.chargeBoost; f.vy = f.diry*f.spd*TF.chargeBoost; if(f.cd<=0){ f.state='wait'; f.cd=TF.restFrames; bossNext(f); } }
    if(f.hp<=TF.spawnBelowHp && f.spawned<TF.maxSpawns && f.t%TF.spawnEvery===0){ f.spawned++; G.foes.push(mkFoe('bat', f.x+20, f.y)); }
    return;
  }
  if(f.state === 'wait'){
    f.vx = f.vx*0.9 + (dx/d)*f.spd*0.08; f.vy = f.vy*0.9 + (dy/d)*f.spd*0.08;
    if(f.cd <= 0){ f.state = 'windup'; f.cd = TF.windupFrames; sfx('windup'); }
    return;
  }
  if(f.state === 'windup'){
    f.vx *= 0.8; f.vy *= 0.8;
    if(f.cd > 0) return;
    if(pat === 'ring'){
      var n = Math.round(TF.ringShots), off = (f.t % 60)*0.05;
      for(i=0; i<n; i++){
        var a = off + i*6.2832/n;
        G.shots.push({ x:f.x, y:f.y, vx:Math.cos(a)*TF.ringShotSpeed, vy:Math.sin(a)*TF.ringShotSpeed, w:6, h:6, life:230 });
      }
      sfx('ring');
      f.state = 'wait'; f.cd = Math.round(TF.restFrames*1.6); bossNext(f);
    } else if(pat === 'summon'){
      var alive = G.foes.length - 1;
      for(i=0; i<TF.summonCount && alive < TF.summonMax; i++, alive++){
        var kind = (f.t >> 4) % 2 ? 'grub' : 'bat', sx = f.x + (i ? 22 : -22);
        sx = Math.max(TS*2, Math.min(WW - TS*2, sx));
        G.foes.push(mkFoe(kind, sx, f.y + 10));
        G.fx.push({ x:sx, y:f.y + 10, t:22, type:'poof' });
      }
      sfx('bossWake');
      f.state = 'wait'; f.cd = Math.round(TF.restFrames*2.2); bossNext(f);
    } else {
      /* the leap: aim at where he is now, clamped inside the room */
      var tx = Math.max(TS*2, Math.min(WW - TS*2, G.p.x)), ty = Math.max(TS*2, Math.min(WH - TS*2, G.p.y));
      f.state = 'leap'; f.cd = TF.leapFrames; f.lx = tx; f.ly = ty;
      f.vx = (tx - f.x)/TF.leapFrames; f.vy = (ty - f.y)/TF.leapFrames;
      sfx('frog');
    }
    return;
  }
  if(f.state === 'leap'){
    f.z = Math.sin((1 - f.cd/TF.leapFrames)*Math.PI)*TF.leapHeight;
    if(f.cd <= 0){
      f.z = 0; f.vx = f.vy = 0; f.state = 'wait'; f.cd = Math.round(TF.restFrames*1.4);
      G.fx.push({ x:f.x, y:f.y, t:TF.quakeFrames, type:'quake' });
      sfx('quake');
      if(Math.hypot(G.p.x - f.x, G.p.y - f.y) < TF.quakeRadius) hurtPlayer(1, f.x, f.y);
      unstick();
      bossNext(f);
    }
  }
}
function bossNext(f){ if(f.alt){ var t = f.pattern; f.pattern = f.alt; f.alt = t; f.state = 'wait'; } }
/* how intense this moment is, 0..1 — the carol comes in above music.startAt */
function dungeonIntense(){
  if(!G || G.dead || G.won || G.hold) return 0;
  var v = 0, i;
  for(i=0; i<G.foes.length; i++) if(G.foes[i].type === 'boss') return 1;
  if(G.sealed && G.foes.length) v = 0.7;
  if(G.p.hp <= 2 && G.foes.length) v = Math.max(v, 0.8);
  if(G.foes.length >= 5) v = Math.max(v, 0.62);
  return v;
}

function swordBox(p){
  var L=TUNING.player.swordLength, W=TUNING.player.swordWidth, o=TUNING.player.swordReach;
  if(p.face==='n') return {x:p.x, y:p.y-o, w:W, h:L};
  if(p.face==='s') return {x:p.x, y:p.y+o, w:W, h:L};
  if(p.face==='w') return {x:p.x-o, y:p.y, w:L, h:W};
  return {x:p.x+o, y:p.y, w:L, h:W};
}

function doorCentre(d){
  if(d==='n') return [CC*TS+TS/2, 0];
  if(d==='s') return [CC*TS+TS/2, WH];
  if(d==='w') return [0, CR*TS+TS/2];
  return [WW, CR*TS+TS/2];
}
function checkDoors(){
  var p=G.p, spec=G.spec, st=rs(G.key), cur=G.key.split(',').map(Number);
  var dirs='nsew'.split(''), d=null, i;
  for(i=0;i<dirs.length;i++){
    var dd=dirs[i]; if(spec.doors.indexOf(dd)<0) continue;
    var c=doorCentre(dd);
    var along = (dd==='n'||dd==='s') ? Math.abs(p.y-c[1]) : Math.abs(p.x-c[0]);
    var perp  = (dd==='n'||dd==='s') ? Math.abs(p.x-c[0]) : Math.abs(p.y-c[1]);
    var locked = spec.lock && spec.lock[dd] && !st.unlocked[dd];
    var reach = (locked || G.sealed) ? 26 : 10;
    if(along < reach && perp < TS*1.4){ d=dd; break; }
  }
  if(!d) return;
  if(G.sealed){
    if(G.t%90===0){ sfx('locked'); toast('the doors are shut — beat the monsters'); }
    return;
  }
  if(spec.lock && spec.lock[d] && !st.unlocked[d]){
    var need = spec.lock[d];
    if(need==='small' && G.keys>0){ G.keys--; st.unlocked[d]=true; G.grid=buildGrid(G.key); sfx('unlock'); toast('the lock gives'); }
    else if(need==='boss' && G.bossKey){ st.unlocked[d]=true; G.grid=buildGrid(G.key); sfx('unlock'); toast('the warden stirs'); }
    else if(G.t%90===0){ sfx('locked'); toast(need==='boss' ? "sealed — the warden's key is missing" : 'locked — you need a small key'); }
    return;
  }
  var nk = (cur[0]+DIRV[d][0]) + ',' + (cur[1]+DIRV[d][1]);
  if(!ROOMS[nk]) return;
  G.pending = { key:nk, dir:d }; G.fadeDir=1;
}
