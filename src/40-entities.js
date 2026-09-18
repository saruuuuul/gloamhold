
/* ---------------- entities ---------------- */
function mkFoe(type,x,y){
  var t = TUNING[type] || TUNING.grub;
  var b = { type:type, x:x, y:y, vx:0, vy:0, hurt:0, t:(Math.random()*100)|0,
            hp:t.hp, w:t.w, h:t.h, spd:t.speed||0, dmg:t.damage };
  if(cfg.kidMode){
    var SS = TUNING.session;
    b.hp  = Math.max(1, Math.round(b.hp * SS.foeHpScale));
    b.spd = b.spd * SS.foeSpeedScale;
  }
  if(type==='bat')    b.ph = Math.random()*6.28;
  if(type==='sentry') b.cd = (t.cooldown*0.6)|0 + ((Math.random()*t.cooldown*0.6)|0);
  if(type==='boss'){  b.state='wait'; b.cd=t.restFrames; b.spawned=0; }
  return b;
}
function solidAt(tx,ty){
  if(tx<0||ty<0||tx>=RW||ty>=RH) return true;
  var t = G.grid[ty][tx];
  return t===1 || t===2 || t===4;
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

/* ---------------- adaptive staircase (3-down / 1-up on contrast) ---------------- */
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
  if(cfg.kidMode && G && (G.stepUps||0) >= TUNING.session.stepUpsPerRoom) return;
  var th = TUNING.therapy, q = th.quantise;
  var n = Math.min(1, Math.round((cfg.strong*th.stepUpFactor + th.stepUpFloorBump)/q)*q);
  if(n > cfg.strong+0.001){ cfg.strong = n; S.stepsUp++; if(G) G.stepUps = (G.stepUps||0) + 1; syncSliders(); saveCfg(); logContrast(); sfx('stepUp'); toast('stronger eye ↑ ' + Math.round(cfg.strong*100) + '%'); }
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
  if(f.hp<=0){
    S.kills++;
    G.fx.push({x:f.x,y:f.y,t:22,type:'poof'});
    var wasBoss = (f.type==='boss');
    G.foes.splice(G.foes.indexOf(f),1);
    if(wasBoss){ G.won=true; }
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
  if(G.spec.drop && !st.taken) spawnDrop(G.key);
  sfx('roomClear');
  G.fx.push({x:WW/2,y:WH/2,t:40,type:'clear'});
}

/* ---------------- update ---------------- */
function update(){
  G.t++;
  var p = G.p, i, f;

  if(G.fadeDir){
    G.fade += G.fadeDir*TUNING.feel.fadeSpeed;
    if(G.fade>=1 && G.fadeDir>0){ G.fade=1; enterRoom(G.pending.key, G.pending.dir); G.pending=null; G.fadeDir=-1; }
    else if(G.fade<=0 && G.fadeDir<0){ G.fade=0; G.fadeDir=0; }
    return;
  }
  if(G.dead || G.won) { if(G.fx.length) stepFx(); return; }

  /* --- player --- */
  var ix = input.x, iy = input.y;
  var m = Math.hypot(ix,iy); if(m>1){ ix/=m; iy/=m; }
  var PT = TUNING.player, SPD = PT.speed;
  if(p.atk>0){ p.atk--; ix*=PT.attackSlow; iy*=PT.attackSlow; }
  if(Math.abs(ix)>0.15||Math.abs(iy)>0.15){
    if(Math.abs(ix)>Math.abs(iy)) p.face = ix>0?'e':'w'; else p.face = iy>0?'s':'n';
  }
  p.vx = p.vx*PT.friction + ix*SPD*PT.accel;
  p.vy = p.vy*PT.friction + iy*SPD*PT.accel;
  moveBody(p, p.vx, 0); moveBody(p, 0, p.vy);
  if(p.inv>0) p.inv--; if(p.flash>0) p.flash--;
  if(input.atk && p.atk<=0){ p.atk = PT.atkFrames; sfx('swing'); G.fx.push({x:p.x,y:p.y,t:8,type:'swing',face:p.face}); }
  input.atk = false;

  /* sword hitbox */
  if(p.atk > PT.atkFrames - PT.atkActiveFrom){
    var sb = swordBox(p);
    for(i=G.foes.length-1;i>=0;i--){ f=G.foes[i]; if(f.hurt<=0 && overlap(sb,f)) hurtFoe(f,1); }
    for(i=G.shots.length-1;i>=0;i--){ if(overlap(sb,G.shots[i])) G.shots.splice(i,1); }
  }

  /* --- foes --- */
  for(i=G.foes.length-1;i>=0;i--){
    f = G.foes[i]; f.t++; if(f.hurt>0) f.hurt--;
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
    } else if(f.type==='boss'){
      f.cd--;
      if(f.state==='wait'){ f.vx*=0.9; f.vy*=0.9; if(f.cd<=0){ f.state='charge'; f.cd=TF.chargeFrames; f.dirx=dx/d; f.diry=dy/d; sfx('bossWake'); } }
      else { f.vx = f.dirx*f.spd*TF.chargeBoost; f.vy = f.diry*f.spd*TF.chargeBoost; if(f.cd<=0){ f.state='wait'; f.cd=TF.restFrames; } }
      if(f.hp<=TF.spawnBelowHp && f.spawned<TF.maxSpawns && f.t%TF.spawnEvery===0){ f.spawned++; G.foes.push(mkFoe('bat', f.x+20, f.y)); }
    }
    moveBody(f, f.vx, 0); moveBody(f, 0, f.vy);
    if(overlap(p,f)) hurtPlayer(f.dmg, f.x, f.y);
  }

  /* --- shots --- */
  for(i=G.shots.length-1;i>=0;i--){
    var s=G.shots[i]; s.x+=s.vx; s.y+=s.vy; s.life--;
    if(s.life<=0 || blocked(s.x,s.y,4,4)){ G.shots.splice(i,1); continue; }
    if(overlap(p,s)){ hurtPlayer(1,s.x,s.y); G.shots.splice(i,1); }
  }

  /* --- items --- */
  for(i=G.items.length-1;i>=0;i--){
    var it=G.items[i]; it.bob+=0.08;
    if(Math.abs(it.x-p.x)<12 && Math.abs(it.y-p.y)<12){
      rs(G.key).taken = true;
      if(it.type==='heart'){ p.hp = Math.min(p.maxhp, p.hp+2); }
      if(it.type==='vessel'){ p.maxhp += 2; p.hp = p.maxhp; }
      if(it.type==='smallkey'){ G.keys++; }
      if(it.type==='bosskey'){ G.bossKey = true; }
      sfx((it.type==='smallkey'||it.type==='bosskey') ? 'keyGet' : 'pickup');
      toast(ITEMNAME[it.type]);
      G.items.splice(i,1);
    }
  }
  stepFx();

  /* --- doors --- */
  checkDoors();
}
function stepFx(){ for(var i=G.fx.length-1;i>=0;i--){ G.fx[i].t--; if(G.fx[i].t<=0) G.fx.splice(i,1); } }
var ITEMNAME = { heart:'heart recovered', vessel:'vessel of the deep — max life up', smallkey:'small key', bosskey:"warden's key" };

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
    var reach = locked ? 26 : 10;
    if(along < reach && perp < TS*1.4){ d=dd; break; }
  }
  if(!d) return;
  if(spec.lock && spec.lock[d] && !st.unlocked[d]){
    var need = spec.lock[d];
    if(need==='small' && G.keys>0){ G.keys--; st.unlocked[d]=true; G.grid=buildGrid(G.key); sfx('unlock'); toast('the lock gives'); }
    else if(need==='boss' && G.bossKey){ st.unlocked[d]=true; G.grid=buildGrid(G.key); sfx('unlock'); toast('the warden stirs'); }
    else if(G.t%90===0){ sfx('locked'); toast(need==='boss' ? "sealed \u2014 the warden's key is missing" : 'locked \u2014 you need a small key'); }
    return;
  }
  var nk = (cur[0]+DIRV[d][0]) + ',' + (cur[1]+DIRV[d][1]);
  if(!ROOMS[nk]) return;
  G.pending = { key:nk, dir:d }; G.fadeDir=1;
}
