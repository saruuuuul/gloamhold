
/* ---------------- palette ---------------- */
var C = {
  void:'#07090d', floor:'#191e29', floor2:'#1c2130', speck:'#262e40',
  stone:'#39415a', stoneTop:'#59628a', stoneDk:'#232839',
  gold:'#e8b13f', blood:'#cf4a3e', jade:'#57bf92', jadeDk:'#2e7d5c',
  violet:'#8f6bd6', bone:'#ece6d8', dim:'#6d7490', arch:'#0c1018'
};
function hash2(a,b){ var h=(a*374761393 + b*668265263)>>>0; h=(h^(h>>13))*1274126177>>>0; return (h>>>0)/4294967296; }

/* ---------------- render ---------------- */
function render(){ renderScene(); present(); }
function renderScene(){
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle = C.void; ctx.fillRect(0,0,VW,VH);
  /* A viewer is a landscape device. Held upright the two eye viewports become
     tall slivers that fuse into nothing, and orientation lock is refused far
     more often than it is granted — so ask for the rotation instead of
     rendering something unusable. */
  if(VH > VW){ drawRotatePrompt(); return; }
  if(nonius.on){ drawEyeNonius('left'); drawEyeNonius('right'); }
  else if(MENU.id){ drawMenuEye('left'); drawMenuEye('right'); }
  else if(G){ drawEye('left'); drawEye('right'); }
  if(cfg.grid){ drawGrid('left'); drawGrid('right'); }
  drawSeam();
}
/* Rectilinear calibration grid: straight lines in scene space. Through the lenses
   they only LOOK straight once k1/k2 cancel the lens pincushion. */
function drawGrid(eye){
  var vp = viewportFor(eye), step = Math.max(20, Math.round(Math.min(vp.w,vp.h)/9));
  var cx = vp.x + vp.w/2, cy = vp.y + vp.h/2, i;
  ctx.save();
  ctx.beginPath(); ctx.rect(vp.x,vp.y,vp.w,vp.h); ctx.clip();
  ctx.fillStyle='rgba(7,9,13,.82)'; ctx.fillRect(vp.x,vp.y,vp.w,vp.h);
  ctx.strokeStyle='rgba(236,230,216,.34)'; ctx.lineWidth=1;
  ctx.beginPath();
  for(i=0;cx+i*step<vp.x+vp.w+step;i++){
    ctx.moveTo(Math.round(cx+i*step)+0.5, vp.y); ctx.lineTo(Math.round(cx+i*step)+0.5, vp.y+vp.h);
    ctx.moveTo(Math.round(cx-i*step)+0.5, vp.y); ctx.lineTo(Math.round(cx-i*step)+0.5, vp.y+vp.h);
  }
  for(i=0;cy+i*step<vp.y+vp.h+step;i++){
    ctx.moveTo(vp.x, Math.round(cy+i*step)+0.5); ctx.lineTo(vp.x+vp.w, Math.round(cy+i*step)+0.5);
    ctx.moveTo(vp.x, Math.round(cy-i*step)+0.5); ctx.lineTo(vp.x+vp.w, Math.round(cy-i*step)+0.5);
  }
  ctx.stroke();
  ctx.strokeStyle=C.gold; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(cx, vp.y); ctx.lineTo(cx, vp.y+vp.h);
  ctx.moveTo(vp.x, cy); ctx.lineTo(vp.x+vp.w, cy); ctx.stroke();
  ctx.strokeStyle='rgba(87,191,146,.85)';
  [2,4].forEach(function(n){ ctx.beginPath(); ctx.arc(cx,cy,n*step,0,6.2832); ctx.stroke(); });
  ctx.restore();
}
function drawSeam(){
  ctx.save(); ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.fillStyle='#000'; ctx.fillRect(VW/2-1,0,2,VH); ctx.restore();
}

function eyeGeom(eye){
  var vp = viewportFor(eye);
  var s = Math.min(vp.w/WW, vp.h/WH) * cfg.zoom * lensZoom();
  var shift = (eye==='left' ? -cfg.sep/2 : cfg.sep/2);
  return { vp:vp, s:s, ox: vp.x + (vp.w - WW*s)/2 + shift, oy: vp.y + (vp.h - WH*s)/2 };
}

function drawEye(eye){
  var g = eyeGeom(eye), vp=g.vp, s=g.s;
  ctx.save();
  ctx.beginPath(); ctx.rect(vp.x, vp.y, vp.w, vp.h); ctx.clip();
  ctx.fillStyle = C.void; ctx.fillRect(vp.x,vp.y,vp.w,vp.h);

  ctx.save();
  ctx.translate(g.ox, g.oy); ctx.scale(s,s);

  drawRoom(eye);

  var aItem = alphaFor(eye,'item');
  if(aItem>0){ ctx.globalAlpha = aItem; G.items.forEach(drawItem); drawLocks(); ctx.globalAlpha=1; }

  drawSwing();
  drawPlayer();

  var aFoe = alphaFor(eye,'foe');
  if(aFoe>0){
    ctx.globalAlpha = aFoe;
    G.foes.forEach(drawFoe);
    G.shots.forEach(drawShot);
    /* Inside the foe alpha, not after it. A death poof drawn at full contrast
       tells the stronger eye exactly where an enemy it cannot see just died,
       which leaks the signal the split mode exists to withhold. */
    drawPoofs(aFoe);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  if(G.fade>0){ ctx.globalAlpha=G.fade; ctx.fillStyle='#04060a'; ctx.fillRect(vp.x,vp.y,vp.w,vp.h); ctx.globalAlpha=1; }
  drawHUD(eye, vp);
  ctx.restore();
}

function tileAt(x,y){
  if(x<0||y<0||x>=RW||y>=RH) return 1;
  return G.grid[y][x];
}
function drawRoom(eye){
  /* Overfill: the lens warp pulls in content from beyond the room, so the
     surrounding rock is drawn too rather than leaving black corners. */
  var over = (cfg.lens==='off' || !gl) ? 0 : 9;
  var x,y,t;
  ctx.fillStyle = C.stoneDk; ctx.fillRect(-over*TS, -over*TS, WW+over*TS*2, WH+over*TS*2);
  ctx.fillStyle = C.floor; ctx.fillRect(0,0,WW,WH);
  for(y=-over;y<RH+over;y++) for(x=-over;x<RW+over;x++){
    t = tileAt(x,y);
    var px=x*TS, py=y*TS;
    if(t===0 || t===3){
      if(((x+y)&1)===0){ ctx.fillStyle=C.floor2; ctx.fillRect(px,py,TS,TS); }
      var h=hash2(x+G.key.charCodeAt(0)*7, y+G.key.charCodeAt(2)*11);
      if(h>0.86){ ctx.fillStyle=C.speck; ctx.fillRect(px+((h*10)|0)+3, py+((h*100)%9|0)+3, 2, 2); }
      if(t===3){ ctx.fillStyle=C.arch; ctx.fillRect(px,py,TS,TS); ctx.fillStyle='#10161f'; ctx.fillRect(px+2,py+2,TS-4,TS-4); }
    } else if(t===1 || t===4){
      var out = (x<0||y<0||x>=RW||y>=RH);
      ctx.fillStyle = C.stoneDk; ctx.fillRect(px,py,TS,TS);
      ctx.fillStyle = out ? '#2b3145' : C.stone;   ctx.fillRect(px,py+3,TS-1,TS-4);
      ctx.fillStyle = out ? '#3f465f' : C.stoneTop;ctx.fillRect(px,py,TS-1,3);
      /* a few courses of blockwork so walls read as masonry, not as a slab */
      if(!out && ((x*3+y) % 4) === 0){
        ctx.fillStyle = '#2f364c'; ctx.fillRect(px+1, py+6, TS-3, 1);
      }
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px+TS-1,py,1,TS); ctx.fillRect(px,py+TS-1,TS,1);
      /* Sconce: lit wall, but deliberately NO pool of light on the floor. A
         gradient down there would make floor luminance vary from tile to tile,
         and "contrast against the floor" would stop being a single number. */
      if(!out && y < RH-1 && tileAt(x, y+1) === 0){
        var hs = hash2(x*13 + G.key.charCodeAt(0), y*7 + G.key.charCodeAt(2));
        if(hs > 0.80){
          var fl = ((G.t >> 3) + x) & 1;
          ctx.fillStyle = '#4a3c22'; ctx.fillRect(px+7, py+9, 2, 4);
          ctx.fillStyle = C.gold;    ctx.fillRect(px+6, py+5+fl, 4, 4);
          ctx.fillStyle = C.blood;   ctx.fillRect(px+7, py+4+fl, 2, 2);
        }
      }
    }
  }
}
function drawLocks(){
  var x,y;
  for(y=0;y<RH;y++) for(x=0;x<RW;x++){
    if(G.grid[y][x]!==4) continue;
    ctx.fillStyle = C.gold;
    ctx.fillRect(x*TS+6, y*TS+5, 4, 4);
    ctx.fillRect(x*TS+7, y*TS+9, 2, 3);
  }
}

function drawItem(it){
  var b = Math.sin(it.bob)*1.5, x=it.x, y=it.y+b;
  if(it.type==='heart'){ heartShape(x,y,C.blood); }
  else if(it.type==='vessel'){ heartShape(x,y,C.blood); ctx.strokeStyle=C.gold; ctx.lineWidth=1; ctx.strokeRect(x-7,y-7,14,14); }
  else {
    ctx.fillStyle = it.type==='bosskey' ? C.violet : C.gold;
    ctx.fillRect(x-2,y-6,4,8); ctx.fillRect(x-4,y+2,8,3); ctx.fillRect(x+1,y+5,4,2);
    ctx.fillStyle = C.bone; ctx.fillRect(x-1,y-5,2,2);
  }
}
function heartShape(x,y,col){
  ctx.fillStyle=col;
  ctx.fillRect(x-5,y-4,4,3); ctx.fillRect(x+1,y-4,4,3);
  ctx.fillRect(x-6,y-2,12,3); ctx.fillRect(x-4,y+1,8,2); ctx.fillRect(x-2,y+3,4,2);
}

function drawPlayer(){
  var p = G.p, spd = Math.hypot(p.vx, p.vy);
  if(spd > 0.12){ p.anim = (p.anim || 0) + spd*0.26; if(p.anim > 1e6) p.anim = 0; }
  else p.anim = 0;
  var f = (p.anim | 0) % 4;
  var step = (f === 1) ? 1 : (f === 3 ? -1 : 0);
  var y = p.y + ((f === 1 || f === 3) ? -1 : 0);
  var base = ctx.globalAlpha;
  if(p.inv > 0 && (G.t>>2)%2 === 0) ctx.globalAlpha = base*0.35;

  ctx.fillStyle = '#0b1016'; ctx.fillRect(p.x-5, p.y+5, 10, 2);          /* shadow */
  ctx.fillStyle = '#22321f';                                              /* boots */
  ctx.fillRect(p.x-4+step, y+3, 3, 4);
  ctx.fillRect(p.x+1-step, y+3, 3, 4);
  ctx.fillStyle = C.jadeDk; ctx.fillRect(p.x-6, y-6, 12, 10);            /* cloak */
  ctx.fillStyle = C.jade;   ctx.fillRect(p.x-5, y-5, 10, 7);             /* tunic */
  ctx.fillStyle = C.gold;   ctx.fillRect(p.x-5, y+0, 10, 1);             /* belt  */
  ctx.fillStyle = '#d9c9a3'; ctx.fillRect(p.x-4, y-10, 8, 5);            /* face  */
  ctx.fillStyle = C.bone;   ctx.fillRect(p.x-5, y-12, 10, 3);            /* hood  */
  ctx.fillRect(p.x-5, y-10, 1, 3); ctx.fillRect(p.x+4, y-10, 1, 3);
  if(p.face === 'n'){ ctx.fillStyle = '#c2b28c'; ctx.fillRect(p.x-4, y-10, 8, 5); }
  else {
    ctx.fillStyle = '#0d1520';
    if(p.face === 's'){ ctx.fillRect(p.x-3, y-8, 2, 2); ctx.fillRect(p.x+1, y-8, 2, 2); }
    else if(p.face === 'w'){ ctx.fillRect(p.x-4, y-8, 2, 2); }
    else { ctx.fillRect(p.x+2, y-8, 2, 2); }
  }
  if(p.flash > 0){
    ctx.globalAlpha = base * (p.flash/TUNING.player.flashFrames) * 0.6;
    ctx.fillStyle = C.blood; ctx.fillRect(p.x-7, y-13, 14, 21);
  }
  ctx.globalAlpha = base;
}
function drawSwing(){
  var p=G.p; if(p.atk<=12) return;
  var b = swordBox(p);
  ctx.fillStyle = C.bone;
  ctx.fillRect(b.x-b.w/2, b.y-b.h/2, b.w, b.h);
  ctx.fillStyle = '#9aa2b8';
  ctx.fillRect(b.x-b.w/2+1, b.y-b.h/2+1, Math.max(1,b.w-2), Math.max(1,b.h-2));
}

/* Every sprite here is flat fills only — no gradient, no shadow, no composite
   mode — because each one is composited over the floor at exactly the layer
   alpha, and anything non-linear would stop "contrast %" being true. */
function drawFoe(f){
  var flash = f.hurt > 0 && (f.hurt>>1)%2 === 0;
  if(f.type === 'grub') drawGrub(f, flash);
  else if(f.type === 'bat') drawBat(f, flash);
  else if(f.type === 'sentry') drawSentry(f, flash);
  else if(f.type === 'boss') drawBoss(f, flash);
}
function drawGrub(f, flash){
  var ph = Math.sin(f.t*0.13), sq = ph*1.3;
  var w = 12 + sq, h = 10 - sq, x0 = f.x - w/2, y0 = f.y - h/2;
  ctx.fillStyle = '#0b1016'; ctx.fillRect(f.x-5, f.y+5, 10, 2);
  ctx.fillStyle = flash ? C.bone : '#2f5233'; ctx.fillRect(x0, y0+1, w, h);
  ctx.fillStyle = flash ? C.bone : '#5d9257'; ctx.fillRect(x0+1, y0, w-2, h-3);
  ctx.fillStyle = flash ? C.bone : '#43703f';
  ctx.fillRect(f.x-2, y0, 1, h-3); ctx.fillRect(f.x+2, y0, 1, h-3);
  ctx.fillStyle = flash ? C.bone : '#2f5233';
  ctx.fillRect(f.x-3, y0-3 + (ph>0?0:1), 1, 3);
  ctx.fillRect(f.x+2, y0-3 + (ph>0?1:0), 1, 3);
  ctx.fillStyle = '#101a14';
  ctx.fillRect(f.x-3, f.y-2, 2, 2); ctx.fillRect(f.x+1, f.y-2, 2, 2);
}
function drawBat(f, flash){
  var wy = Math.sin(f.ph*2.2)*3;
  ctx.fillStyle = flash ? C.bone : '#6b53a8';
  ctx.fillRect(f.x-10, f.y-3+wy, 6, 3); ctx.fillRect(f.x-13, f.y-4+wy*1.4, 3, 2);
  ctx.fillRect(f.x+4,  f.y-3+wy, 6, 3); ctx.fillRect(f.x+10, f.y-4+wy*1.4, 3, 2);
  ctx.fillStyle = flash ? C.bone : C.violet;
  ctx.fillRect(f.x-4, f.y-4, 8, 8);
  ctx.fillRect(f.x-4, f.y-7, 2, 3); ctx.fillRect(f.x+2, f.y-7, 2, 3);
  ctx.fillStyle = C.blood;
  ctx.fillRect(f.x-2, f.y-2, 2, 2); ctx.fillRect(f.x+1, f.y-2, 2, 2);
  ctx.fillStyle = C.bone;
  ctx.fillRect(f.x-2, f.y+2, 1, 2); ctx.fillRect(f.x+1, f.y+2, 1, 2);
}
function drawSentry(f, flash){
  var dx = G.p.x - f.x, dy = G.p.y - f.y, d = Math.hypot(dx, dy) || 1;
  var ex = Math.round(dx/d*2), ey = Math.round(dy/d*2);
  var winding = f.cd < 22;                     /* a tell before it shoots */
  ctx.fillStyle = '#0b1016'; ctx.fillRect(f.x-6, f.y+6, 12, 2);
  ctx.fillStyle = flash ? C.bone : '#3b3527'; ctx.fillRect(f.x-7, f.y-7, 14, 14);
  ctx.fillStyle = flash ? C.bone : '#7a6c48'; ctx.fillRect(f.x-6, f.y-6, 12, 10);
  ctx.fillStyle = flash ? C.bone : '#9c8a5c';
  ctx.fillRect(f.x-6, f.y-6, 2, 2); ctx.fillRect(f.x+4, f.y-6, 2, 2);
  ctx.fillStyle = '#1b1710'; ctx.fillRect(f.x-3, f.y-3, 6, 6);
  ctx.fillStyle = winding ? C.gold : C.blood;
  ctx.fillRect(f.x-1+ex, f.y-1+ey, 3, 3);
  ctx.fillStyle = winding ? C.gold : (flash ? C.bone : '#5a5136');
  ctx.fillRect(f.x-7, f.y+5, 14, 2);
}
function drawBoss(f, flash){
  var charging = (f.state === 'charge'), sq = charging ? 2 : 0;
  ctx.fillStyle = '#0b1016'; ctx.fillRect(f.x-11, f.y+12, 22, 3);
  ctx.fillStyle = flash ? C.bone : '#241b3a'; ctx.fillRect(f.x-13, f.y-13+sq, 26, 26-sq);
  ctx.fillStyle = flash ? C.bone : '#4a3878'; ctx.fillRect(f.x-11, f.y-11+sq, 22, 18-sq);
  ctx.fillStyle = C.gold;
  ctx.fillRect(f.x-10, f.y-16+sq, 20, 3);
  ctx.fillRect(f.x-10, f.y-20+sq, 3, 4);
  ctx.fillRect(f.x-2,  f.y-21+sq, 3, 5);
  ctx.fillRect(f.x+7,  f.y-20+sq, 3, 4);
  ctx.fillStyle = charging ? C.gold : C.blood;
  ctx.fillRect(f.x-7, f.y-6+sq, 5, 4); ctx.fillRect(f.x+2, f.y-6+sq, 5, 4);
  ctx.fillStyle = '#12102a'; ctx.fillRect(f.x-8, f.y+2+sq, 16, 5);
  ctx.fillStyle = C.bone;
  for(var i=0;i<4;i++) ctx.fillRect(f.x-6+i*4, f.y+2+sq, 2, 2);
}
function drawShot(s){
  ctx.fillStyle = C.blood; ctx.fillRect(s.x-3,s.y-3,6,6);
  ctx.fillStyle = C.gold;  ctx.fillRect(s.x-1,s.y-1,2,2);
}
function drawPoofs(base){
  base = base == null ? 1 : base;
  G.fx.forEach(function(e){
    if(e.type === 'poof'){
      var k = (22-e.t)/22;
      ctx.globalAlpha = base*(1-k);
      ctx.fillStyle = C.bone;
      ctx.fillRect(e.x-2-k*7, e.y-2, 4, 4); ctx.fillRect(e.x-2+k*7, e.y-2, 4, 4);
      ctx.fillRect(e.x-2, e.y-2-k*7, 4, 4); ctx.fillRect(e.x-2, e.y-2+k*7, 4, 4);
      ctx.globalAlpha = base;
    } else if(e.type === 'spark'){
      var s = e.t/10, i;
      ctx.globalAlpha = base*s;
      ctx.fillStyle = C.gold;
      for(i=0;i<4;i++){
        var a = e.seed + i*1.571, r = (1-s)*8;
        ctx.fillRect(e.x + Math.cos(a)*r - 1, e.y + Math.sin(a)*r - 1, 2, 2);
      }
      ctx.globalAlpha = base;
    }
  });
}
