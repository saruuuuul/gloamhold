
/* ============================================================
   TOOLS — the shield (island 2), bombs (island 3), bow (island 5).
   One tool is in hand at a time; the second button uses it and a
   shoulder button swaps. That is the ceiling: action + tool, never
   a third button a five-year-old has to remember.

   Bombs, arrows and the blast are the player's own, so they sit on
   the player layer — both eyes, full contrast — exactly like the
   sword swing. No ammo: running out is a punishment, not a puzzle.
   ============================================================ */
var TOOL_ORDER = ['shield', 'bombs', 'bow'];
function ownedTools(){ return TOOL_ORDER.filter(function(t){ return PROG.tools[t]; }); }
function firstTool(){ var o = ownedTools(); return o.length ? o[o.length-1] : null; }

function toolsPre(){
  var p = G.p;
  if(input.cycle){
    input.cycle = false;
    var o = ownedTools();
    if(o.length > 1){ G.tool = o[(o.indexOf(G.tool) + 1) % o.length]; sfx('uiMove'); toast(ITEMNAME[G.tool]); }
  }
  if(!G.tool || !PROG.tools[G.tool]) G.tool = firstTool();
  p.shield = !!(G.tool === 'shield' && input.tool);
}
function toolsTick(){
  var TT = TUNING.tools, p = G.p, i, j;
  if(G.toolCd > 0) G.toolCd--;
  if(input.toolPress){
    input.toolPress = false;
    if(G.tool === 'bombs' && G.toolCd <= 0 && G.bombs.length === 0){
      G.bombs.push({ x:p.x, y:p.y + 2, t:TT.bombFuse });
      G.toolCd = TT.bombCooldown; sfx('bombSet');
    } else if(G.tool === 'bow' && G.toolCd <= 0){
      var v = FACEV[p.face];
      G.arrows.push({ x:p.x + v[0]*8, y:p.y + v[1]*8, vx:v[0]*TT.arrowSpeed, vy:v[1]*TT.arrowSpeed, w:4, h:4, life:TT.arrowLife, face:p.face });
      G.toolCd = TT.arrowCooldown; sfx('arrow');
    }
  }
  for(i=G.bombs.length-1; i>=0; i--){
    var b = G.bombs[i];
    if(--b.t <= 0){ G.bombs.splice(i, 1); explode(b); }
  }
  for(i=G.arrows.length-1; i>=0; i--){
    var a = G.arrows[i], gone = false;
    a.x += a.vx; a.y += a.vy; a.life--;
    for(j=G.foes.length-1; j>=0 && !gone; j--){
      var f = G.foes[j];
      if(f.hurt <= 0 && overlap(a, f)){ hurtFoe(f, TT.arrowDamage); gone = true; }
    }
    if(!gone && blocked(a.x, a.y, 3, 3)){
      /* the collision is on the arrow's leading edge, so the tile it struck is
         the one AHEAD of its centre — from the centre, every arrow reported the
         tile before the eye switch and no bow secret could ever open */
      worldArrowHit(Math.floor((a.x + Math.sign(a.vx)*3)/TS), Math.floor((a.y + Math.sign(a.vy)*3)/TS));
      G.fx.push({ x:a.x, y:a.y, t:8, type:'dust' });
      gone = true;
    }
    if(gone || a.life <= 0) G.arrows.splice(i, 1);
  }
}
function explode(b){
  var TT = TUNING.tools, R = TT.bombRadius, i;
  G.fx.push({ x:b.x, y:b.y, t:22, type:'boom' });
  sfx('boom');
  for(i=G.foes.length-1; i>=0; i--){
    var f = G.foes[i];
    if(f && Math.hypot(f.x - b.x, f.y - b.y) < R + f.w/2) hurtFoe(f, TT.bombDamage);
  }
  worldBlast(b.x, b.y, R);
  owlProgress();
}

/* ---------------- drawing (player layer) ---------------- */
function drawTools(){
  G.bombs.forEach(function(b){
    var lit = (b.t >> 2) & 1;
    ctx.fillStyle = '#0b1016'; ctx.fillRect(b.x-4, b.y+4, 8, 2);
    ctx.fillStyle = '#2b2f3a'; ctx.fillRect(b.x-5, b.y-4, 10, 9);
    ctx.fillStyle = '#454b5a'; ctx.fillRect(b.x-4, b.y-4, 4, 3);
    ctx.fillStyle = '#6b5530'; ctx.fillRect(b.x-1, b.y-7, 2, 3);
    ctx.fillStyle = lit ? C.gold : C.blood; ctx.fillRect(b.x-1, b.y-9, 2, 2);
  });
  G.arrows.forEach(function(a){
    ctx.fillStyle = C.bone;
    if(a.face === 'n' || a.face === 's'){ ctx.fillRect(a.x-1, a.y-5, 2, 10); ctx.fillStyle = '#9aa2b8'; ctx.fillRect(a.x-2, a.face==='n' ? a.y-6 : a.y+4, 4, 2); }
    else { ctx.fillRect(a.x-5, a.y-1, 10, 2); ctx.fillStyle = '#9aa2b8'; ctx.fillRect(a.face==='w' ? a.x-6 : a.x+4, a.y-2, 2, 4); }
  });
  var p = G.p;
  if(p.shield){
    var v = FACEV[p.face], sx = p.x + v[0]*7, sy = p.y - 2 + v[1]*7;
    var horiz = (p.face === 'n' || p.face === 's');
    ctx.fillStyle = '#3c4d78'; ctx.fillRect(sx - (horiz?6:2), sy - (horiz?2:6), horiz?12:4, horiz?4:12);
    ctx.fillStyle = C.gold;   ctx.fillRect(sx - 1, sy - 1, 2, 2);
  }
}
function drawToolIcon(tool, x, y, s){
  s = s || 1;
  if(tool === 'shield'){ ctx.fillStyle = '#3c4d78'; ctx.fillRect(x-4*s, y-5*s, 8*s, 9*s); ctx.fillStyle = C.gold; ctx.fillRect(x-1*s, y-3*s, 2*s, 5*s); }
  else if(tool === 'bombs'){ ctx.fillStyle = '#454b5a'; ctx.fillRect(x-4*s, y-3*s, 8*s, 7*s); ctx.fillStyle = C.gold; ctx.fillRect(x-1*s, y-6*s, 2*s, 3*s); }
  else if(tool === 'bow'){ ctx.fillStyle = '#8a5a30'; ctx.fillRect(x-4*s, y-5*s, 2*s, 10*s); ctx.fillStyle = C.bone; ctx.fillRect(x-2*s, y-1*s, 7*s, 2*s); }
}
