
/* ---------------- HUD ---------------- */
function drawHUD(eye, vp0){
  /* The warp compresses the edges, so with a lens profile on, the HUD moves
     inside the region that stays visible through the eyepiece. */
  var ins = (cfg.lens==='off' || !gl) ? 0 : Math.round(Math.min(vp0.w, vp0.h) * 0.13);
  var vp = { x:vp0.x+ins, y:vp0.y+ins, w:vp0.w-ins*2, h:vp0.h-ins*2 };
  var pad = 10, x = vp.x + pad, y = vp.y + pad + 2;
  var p = G.p, i;

  /* binocular fusion lock: identical corner brackets in both eyes, full contrast */
  ctx.strokeStyle = 'rgba(236,230,216,.30)'; ctx.lineWidth = 2;
  var m = 6, L = 22;
  [[vp.x+m, vp.y+m, 1, 1],[vp.x+vp.w-m, vp.y+m, -1, 1],[vp.x+m, vp.y+vp.h-m, 1,-1],[vp.x+vp.w-m, vp.y+vp.h-m,-1,-1]]
   .forEach(function(q){ ctx.beginPath(); ctx.moveTo(q[0]+q[2]*L, q[1]); ctx.lineTo(q[0], q[1]); ctx.lineTo(q[0], q[1]+q[3]*L); ctx.stroke(); });

  /* hearts */
  for(i=0;i<p.maxhp/2;i++){
    var full = p.hp >= (i+1)*2, half = !full && p.hp === i*2+1;
    hudHeart(x + i*15, y, full?2:(half?1:0));
  }
  /* keys */
  var rx = vp.x + vp.w - pad;
  if(G.bossKey){ hudKey(rx-10, y+5, C.violet); rx -= 24; }
  hudKey(rx-10, y+5, G.keys>0 ? C.gold : '#333a4c');
  ctx.textAlign='right'; ctx.textBaseline='middle';
  ctx.font='600 12px "IBM Plex Mono", monospace';
  ctx.fillStyle = G.keys>0 ? C.gold : '#4a5166';
  ctx.fillText(String(G.keys), rx-18, y+6);

  /* bottom strip: room name + which eye this is */
  var by = vp.y+vp.h-24;
  ctx.fillStyle='rgba(5,7,11,.72)'; ctx.fillRect(vp.x, by, vp.w, 24);
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.font = '400 10px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#6a718c';
  ctx.fillText(G.spec.name.toLowerCase(), vp.x+pad, by+12);
  ctx.textAlign='right';
  var isWeak = (eye===cfg.weakEye);
  ctx.fillStyle = isWeak ? '#5c9b80' : '#9b8452';
  ctx.fillText(isWeak ? 'weak eye \u00b7 100%' : 'strong eye \u00b7 '+Math.round(cfg.strong*100)+'%', vp.x+vp.w-pad, by+12);

  /* toast */
  if(toastT>0){
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='500 12px "IBM Plex Sans", sans-serif';
    ctx.globalAlpha = Math.min(1, toastT/40);
    var w = ctx.measureText(toastTxt).width + 22;
    ctx.fillStyle='rgba(6,8,12,.86)';
    ctx.fillRect(vp.x+vp.w/2-w/2, by-34, w, 24);
    ctx.strokeStyle='rgba(232,177,63,.35)'; ctx.lineWidth=1;
    ctx.strokeRect(vp.x+vp.w/2-w/2+0.5, by-33.5, w-1, 23);
    ctx.fillStyle=C.bone; ctx.fillText(toastTxt, vp.x+vp.w/2, by-22);
    ctx.globalAlpha=1;
  }
  /* end states */
  if(G.dead || G.won){
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle='rgba(4,6,10,.78)'; ctx.fillRect(vp.x, vp.y+vp.h/2-44, vp.w, 88);
    ctx.font='700 20px Silkscreen, monospace';
    ctx.fillStyle = G.won ? C.gold : C.blood;
    ctx.fillText(G.won ? 'THE WARDEN FALLS' : 'YOU FALL', vp.x+vp.w/2, vp.y+vp.h/2-12);
    ctx.font='400 11px "IBM Plex Mono", monospace'; ctx.fillStyle='#8e8a7e';
    ctx.fillText('any button / tap \u2192 session summary', vp.x+vp.w/2, vp.y+vp.h/2+16);
  }
  if(touch.active) drawTouchPads(eye, vp);
}
function hudHeart(x, y, fill){
  var px = [[1,0,3,1],[5,0,3,1],[0,1,10,3],[1,4,8,2],[3,6,4,2]];
  ctx.fillStyle = '#2d1a1d';
  px.forEach(function(r){ ctx.fillRect(x+r[0]*1.2, y+r[1]*1.2, r[2]*1.2, r[3]*1.2); });
  if(fill===0) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, fill===1 ? 6 : 13, 12); ctx.clip();
  ctx.fillStyle = C.blood;
  px.forEach(function(r){ ctx.fillRect(x+r[0]*1.2, y+r[1]*1.2, r[2]*1.2, r[3]*1.2); });
  ctx.restore();
}
function hudKey(x, y, col){
  ctx.fillStyle = col;
  ctx.fillRect(x-2, y-6, 4, 7); ctx.fillRect(x-4, y+1, 8, 3); ctx.fillRect(x+1, y+4, 4, 2);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x-1, y-5, 2, 2);
}
function drawTouchPads(eye, vp){
  var r = 46, cx = vp.x + r + 18, cy = vp.y + vp.h - r - 18;
  ctx.globalAlpha = 0.28; ctx.strokeStyle = C.bone; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + input.x*r*0.55, cy + input.y*r*0.55, 15, 0, 6.2832);
  ctx.fillStyle = C.bone; ctx.fill();
  var bx = vp.x + vp.w - 46 - 18, by = vp.y + vp.h - 46 - 18;
  ctx.beginPath(); ctx.arc(bx, by, 34, 0, 6.2832); ctx.strokeStyle=C.gold; ctx.stroke();
  ctx.globalAlpha = 1;
}

/* ---------------- nonius / suppression check ----------------
   eye-alpha: intentional — the nonius test deliberately drives each eye's bar
   directly (weak eye at full contrast, strong eye at cfg.strong) rather than
   through alphaFor(). That IS the measurement: if the strong-eye bar vanishes
   its contrast is below threshold, and if the weak-eye bar vanishes that is
   suppression. Routing it through the layer system would hide both answers. */
var nonius = { on:false, answer:null };
function drawEyeNonius(eye){
  var g = eyeGeom(eye), vp=g.vp, s=g.s;
  var cx = g.ox + WW/2*s, cy = g.oy + WH/2*s;
  ctx.save();
  ctx.beginPath(); ctx.rect(vp.x,vp.y,vp.w,vp.h); ctx.clip();
  ctx.fillStyle = C.floor; ctx.fillRect(vp.x,vp.y,vp.w,vp.h);
  /* shared fusion lock: ring + corner ticks, both eyes, full contrast */
  ctx.strokeStyle = C.bone; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx,cy, 62, 0, 6.2832); ctx.stroke();
  ctx.lineWidth = 4;
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(q){
    ctx.beginPath();
    ctx.moveTo(cx+q[0]*108, cy+q[1]*108); ctx.lineTo(cx+q[0]*108, cy+q[1]*78);
    ctx.moveTo(cx+q[0]*108, cy+q[1]*108); ctx.lineTo(cx+q[0]*78,  cy+q[1]*108);
    ctx.stroke();
  });
  var isWeak = (eye===cfg.weakEye);
  ctx.lineWidth = 6; ctx.lineCap='butt';
  if(isWeak){
    ctx.globalAlpha = 1; ctx.strokeStyle = '#8fd8b4';
    ctx.beginPath(); ctx.moveTo(cx, cy-58); ctx.lineTo(cx, cy+58); ctx.stroke();
  } else {
    ctx.globalAlpha = Math.max(cfg.strong, 0.08); ctx.strokeStyle = '#f0c76a';
    ctx.beginPath(); ctx.moveTo(cx-58, cy); ctx.lineTo(cx+58, cy); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.font='400 11px "IBM Plex Mono", monospace'; ctx.fillStyle='#6d7490';
  ctx.fillText('how many bars do you see?', cx, Math.max(vp.y+16, cy-138));
  ctx.restore();
}
function noniusAnswer(a){
  S.checks.push({ t:S.elapsed, a:a });
  var msg;
  if(a===1){ msg = 'Both bars visible — both eyes are contributing. Settings are usable; play on.'; }
  else if(a===2){
    msg = 'The stronger eye’s bar is gone. Its contrast is set below what that eye can pick up, so it is out of the task entirely. Raising it one step.';
    cfg.strong = Math.min(1, Math.round((cfg.strong*1.25+0.03)/0.05)*0.05); syncSliders(); saveCfg(); logContrast();
  } else {
    msg = 'The weaker eye’s bar is gone — that is suppression, and it is exactly what this is meant to catch. Dropping the stronger eye further. If it still disappears near 10%, stop and take this to your eye clinician.';
    cfg.strong = Math.max(0.05, Math.round((cfg.strong*0.7)/0.05)*0.05); syncSliders(); saveCfg(); logContrast();
  }
  nonius.on = false;
  el('checkResult').hidden = false;
  el('checkText').textContent = msg;
  el('pCheck').hidden = false;
  el('nonBar').hidden = true;
  render();
}

/* ---------------- input ---------------- */
var input = { x:0, y:0, atk:false };
var keys = {};
var touch = { active:false, id:-1, ox:0, oy:0 };
var tilt = { on:false, base:null, beta:0, gamma:0 };
var padPrev = false;

addEventListener('keydown', function(e){
  keys[e.key.toLowerCase()] = true;
  if([' ','arrowup','arrowdown','arrowleft','arrowright'].indexOf(e.key.toLowerCase())>=0) e.preventDefault();
  if(e.key===' '||e.key.toLowerCase()==='j'||e.key.toLowerCase()==='z') input.atk = true;
  if(e.key==='Escape'||e.key.toLowerCase()==='p'){ if(running) doPause(); }
  if(nonius.on && ['1','2','3'].indexOf(e.key)>=0) noniusAnswer(+e.key);
  if(G && (G.dead||G.won) && (e.key===' '||e.key==='Enter')) endRun();
});
addEventListener('keyup', function(e){ keys[e.key.toLowerCase()] = false; });

function readKeys(){
  var x=0,y=0;
  if(keys['arrowleft']||keys['a']) x-=1;
  if(keys['arrowright']||keys['d']) x+=1;
  if(keys['arrowup']||keys['w']) y-=1;
  if(keys['arrowdown']||keys['s']) y+=1;
  return [x,y];
}
function readPad(){
  var gp = navigator.getGamepads ? navigator.getGamepads() : [];
  for(var i=0;i<gp.length;i++){
    var g = gp[i]; if(!g) continue;
    var x = g.axes[0]||0, y = g.axes[1]||0;
    if(Math.abs(x)<0.2) x=0; if(Math.abs(y)<0.2) y=0;
    if(g.buttons[14] && g.buttons[14].pressed) x=-1;
    if(g.buttons[15] && g.buttons[15].pressed) x=1;
    if(g.buttons[12] && g.buttons[12].pressed) y=-1;
    if(g.buttons[13] && g.buttons[13].pressed) y=1;
    var fire = false, b;
    for(b=0;b<4;b++) if(g.buttons[b] && g.buttons[b].pressed) fire = true;
    if(g.buttons[7] && g.buttons[7].pressed) fire = true;
    if(fire && !padPrev){
      input.atk = true;
      if(nonius.on) noniusAnswer(1);
      if(G && (G.dead||G.won)) endRun();
    }
    padPrev = fire;
    if(g.buttons[9] && g.buttons[9].pressed && running) doPause();
    if(x||y) return [x,y];
    return [0,0];
  }
  padPrev = false; return null;
}
cv.addEventListener('pointerdown', function(e){
  cv.setPointerCapture(e.pointerId);
  if(nonius.on) return;
  if(G && (G.dead||G.won)){ endRun(); return; }
  touch.active = true;
  if(e.clientX < VW*0.5){ touch.id = e.pointerId; touch.ox = e.clientX; touch.oy = e.clientY; }
  else { input.atk = true; }
  e.preventDefault();
});
cv.addEventListener('pointermove', function(e){
  if(e.pointerId !== touch.id) return;
  var dx = (e.clientX - touch.ox)/46, dy = (e.clientY - touch.oy)/46;
  var m = Math.hypot(dx,dy); if(m>1){ dx/=m; dy/=m; }
  touch.tx = dx; touch.ty = dy;
});
function endTouch(e){ if(e.pointerId===touch.id){ touch.id=-1; touch.tx=0; touch.ty=0; } }
cv.addEventListener('pointerup', endTouch);
cv.addEventListener('pointercancel', endTouch);

function onTilt(e){
  if(e.beta==null) return;
  if(!tilt.base) tilt.base = { b:e.beta, g:e.gamma };
  tilt.beta = e.beta - tilt.base.b; tilt.gamma = e.gamma - tilt.base.g;
}
function readTilt(){
  if(!tilt.on) return null;
  var dz = 4, full = 16;
  function map(v){ var s = Math.sign(v), a = Math.abs(v); if(a<dz) return 0; return s*Math.min(1,(a-dz)/(full-dz)); }
  return [ map(tilt.gamma), map(tilt.beta) ];
}
function gatherInput(){
  var k = readKeys(), pd = readPad(), tl = readTilt();
  var x=k[0], y=k[1];
  if(!x && !y && pd){ x=pd[0]; y=pd[1]; }
  if(!x && !y && tl){ x=tl[0]; y=tl[1]; }
  if(!x && !y && touch.id>=0){ x=touch.tx||0; y=touch.ty||0; }
  input.x = x; input.y = y;
}
