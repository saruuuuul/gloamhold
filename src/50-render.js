
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
  if(nonius.on){ drawEyeNonius('left'); drawEyeNonius('right'); }
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
    ctx.globalAlpha = 1;
  }
  drawPoofs();
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
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(px+TS-1,py,1,TS); ctx.fillRect(px,py+TS-1,TS,1);
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
  var p=G.p;
  var ghost = (p.inv>0 && (G.t>>2)%2===0);
  if(ghost) ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#0b1a14'; ctx.fillRect(p.x-6, p.y+4, 12, 3);
  ctx.fillStyle = C.jadeDk; ctx.fillRect(p.x-6, p.y-7, 12, 14);
  ctx.fillStyle = C.jade;   ctx.fillRect(p.x-5, p.y-6, 10, 9);
  ctx.fillStyle = C.bone;   ctx.fillRect(p.x-4, p.y-7, 8, 3);
  ctx.fillStyle = '#0d1520';
  if(p.face==='n'){ ctx.fillRect(p.x-3,p.y-6,2,2); ctx.fillRect(p.x+1,p.y-6,2,2); }
  if(p.face==='s'){ ctx.fillRect(p.x-3,p.y-2,2,2); ctx.fillRect(p.x+1,p.y-2,2,2); }
  if(p.face==='w'){ ctx.fillRect(p.x-5,p.y-3,2,2); }
  if(p.face==='e'){ ctx.fillRect(p.x+3,p.y-3,2,2); }
  if(p.flash>0){ ctx.globalAlpha = p.flash/18*0.6; ctx.fillStyle=C.blood; ctx.fillRect(p.x-7,p.y-8,14,16); }
  ctx.globalAlpha = 1;
}
function drawSwing(){
  var p=G.p; if(p.atk<=12) return;
  var b = swordBox(p);
  ctx.fillStyle = C.bone;
  ctx.fillRect(b.x-b.w/2, b.y-b.h/2, b.w, b.h);
  ctx.fillStyle = '#9aa2b8';
  ctx.fillRect(b.x-b.w/2+1, b.y-b.h/2+1, Math.max(1,b.w-2), Math.max(1,b.h-2));
}

function drawFoe(f){
  var flash = f.hurt>0 && (f.hurt>>1)%2===0;
  if(f.type==='grub'){
    ctx.fillStyle = flash?C.bone:'#3f6b41'; ctx.fillRect(f.x-6,f.y-5,12,10);
    ctx.fillStyle = flash?C.bone:'#5d9257'; ctx.fillRect(f.x-5,f.y-6,10,5);
    ctx.fillStyle = '#101a14'; ctx.fillRect(f.x-3,f.y-3,2,2); ctx.fillRect(f.x+1,f.y-3,2,2);
  } else if(f.type==='bat'){
    var w = Math.sin(f.ph*2)*3;
    ctx.fillStyle = flash?C.bone:'#6b53a8';
    ctx.fillRect(f.x-9, f.y-2+w, 6, 3); ctx.fillRect(f.x+3, f.y-2+w, 6, 3);
    ctx.fillStyle = flash?C.bone:C.violet; ctx.fillRect(f.x-4,f.y-4,8,8);
    ctx.fillStyle = C.blood; ctx.fillRect(f.x-2,f.y-2,1,2); ctx.fillRect(f.x+1,f.y-2,1,2);
  } else if(f.type==='sentry'){
    ctx.fillStyle = flash?C.bone:'#4b4433'; ctx.fillRect(f.x-7,f.y-7,14,14);
    ctx.fillStyle = flash?C.bone:'#7a6c48'; ctx.fillRect(f.x-6,f.y-6,12,10);
    ctx.fillStyle = C.blood; ctx.fillRect(f.x-2,f.y-2, 4,4);
    ctx.fillStyle = C.gold;  ctx.fillRect(f.x-7,f.y+5,14,2);
  } else if(f.type==='boss'){
    ctx.fillStyle = flash?C.bone:'#2b2145'; ctx.fillRect(f.x-13,f.y-13,26,26);
    ctx.fillStyle = flash?C.bone:'#4a3878'; ctx.fillRect(f.x-11,f.y-11,22,18);
    ctx.fillStyle = C.gold;  ctx.fillRect(f.x-9,f.y-15,18,3); ctx.fillRect(f.x-9,f.y-18,3,4); ctx.fillRect(f.x-1,f.y-18,3,4); ctx.fillRect(f.x+6,f.y-18,3,4);
    ctx.fillStyle = C.blood; ctx.fillRect(f.x-6,f.y-5,4,4); ctx.fillRect(f.x+2,f.y-5,4,4);
    ctx.fillStyle = '#12102a'; ctx.fillRect(f.x-7,f.y+3,14,4);
  }
}
function drawShot(s){
  ctx.fillStyle = C.blood; ctx.fillRect(s.x-3,s.y-3,6,6);
  ctx.fillStyle = C.gold;  ctx.fillRect(s.x-1,s.y-1,2,2);
}
function drawPoofs(){
  G.fx.forEach(function(e){
    if(e.type==='poof'){ var k=(22-e.t)/22; ctx.globalAlpha=1-k; ctx.fillStyle=C.bone;
      ctx.fillRect(e.x-2-k*7, e.y-2, 4,4); ctx.fillRect(e.x-2+k*7, e.y-2, 4,4);
      ctx.fillRect(e.x-2, e.y-2-k*7, 4,4); ctx.fillRect(e.x-2, e.y-2+k*7, 4,4); ctx.globalAlpha=1; }
  });
}
