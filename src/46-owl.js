
/* ============================================================
   THE OWL — a friend who follows him, says the prompts out loud
   in Mongolian, and helps when he is stuck. It gives the voice a
   face, which matters more to a five-year-old than the words do.

   It is drawn on the player layer (both eyes, full contrast), so
   its hint is a DIRECTION and a spoken line — it turns to look at
   the thing — never a glow on the thing itself. Brightening a clue
   would change its contrast, and a marker drawn to both eyes would
   hand the answer to the eye that is not supposed to have it.
   ============================================================ */
var OWL = { x:0, y:0, vx:0, vy:0, t:0, look:null, lastProgress:0, hinted:0, lastSay:-99999, warnedHp:false, talk:0 };

function owlReset(){
  var p = G.p;
  OWL.x = p.x - 14; OWL.y = p.y - 18; OWL.vx = OWL.vy = 0;
  OWL.lastProgress = G.t; OWL.hinted = 0; OWL.look = null; OWL.warnedHp = false;
}
function owlProgress(){ OWL.lastProgress = G.t; OWL.hinted = 0; OWL.look = null; }
function owlSay(key, force){
  var gap = TUNING.owl.speakGapSec * 60;
  if(!force && G && G.t - OWL.lastSay < gap) return;
  OWL.lastSay = G ? G.t : 0; OWL.talk = 70;
  say(key);
}
function owlEnterRoom(){
  owlReset();
  var st = rs(G.key), sp = G.spec;
  if(sp.puzzle && !st.solved) owlSay(sp.puzzle === 'push' ? 'push' : 'torch', true);
  else if(G.sealed) owlSay('sealed', true);
  else if(G.objs.some(function(o){ return o.k === 'sparkle' && !o.dug; })) owlSay('sparkle');
}
function owlHintTarget(){
  var st = rs(G.key), i, o;
  if(G.spec.puzzle && !st.solved){
    for(i=0; i<G.objs.length; i++){
      o = G.objs[i];
      if(G.spec.puzzle === 'push' && o.k === 'plate' && !blockAt(o.x, o.y)) return { x:o.x*TS+8, y:o.y*TS+8, say: OWL.hinted ? 'reset' : 'push' };
      if(G.spec.puzzle === 'torch' && o.k === 'torch' && !o.lit) return { x:o.x*TS+8, y:o.y*TS+8, say:'torch' };
    }
  }
  for(i=0; i<G.objs.length; i++){
    o = G.objs[i];
    if(o.k === 'chest' && o.shown && !o.open) return { x:o.x*TS+8, y:o.y*TS+8, say:'look' };
  }
  for(i=0; i<G.objs.length; i++){
    o = G.objs[i];
    if(o.k === 'sparkle' && !o.dug) return { x:o.x*TS+8, y:o.y*TS+8, say:'sparkle' };
    if(o.k === 'crack' && !o.broken && PROG.tools.bombs) return { x:o.x*TS+8, y:o.y*TS+8, say:'crack' };
    if(o.k === 'eye' && !o.hit && PROG.tools.bow) return { x:o.x*TS+8, y:o.y*TS+8, say:'eye' };
  }
  if(G.foes.length) return { x:G.foes[0].x, y:G.foes[0].y, say:'look' };
  return null;
}
function owlTick(){
  var p = G.p, O = TUNING.owl;
  OWL.t++;
  if(OWL.talk > 0) OWL.talk--;
  var tx = p.x + (p.face === 'w' ? 14 : -14), ty = p.y - 18 + Math.sin(OWL.t*O.bobRate)*2;
  OWL.vx = OWL.vx*O.damping + (tx - OWL.x)*O.follow;
  OWL.vy = OWL.vy*O.damping + (ty - OWL.y)*O.follow;
  OWL.x += OWL.vx; OWL.y += OWL.vy;
  /* first hint after hintAfterSec with no progress; a second, different one
     (e.g. "go out and back in to reset the stones") after twice that */
  var idle = G.t - OWL.lastProgress, H = O.hintAfterSec*60;
  if((OWL.hinted === 0 && idle > H) || (OWL.hinted === 1 && idle > H*2.2)){
    var h = owlHintTarget();
    if(h){ OWL.look = h; owlSay(h.say, true); }
    OWL.hinted++;
  }
  if(!OWL.warnedHp && p.hp > 0 && p.hp <= 2){ OWL.warnedHp = true; owlSay('careful', true); }
}
function drawOwl(){
  var x = OWL.x, y = OWL.y, flap = OWL.talk > 0 ? ((OWL.t >> 2) & 1) : 0;
  var lx = OWL.look ? OWL.look.x : G.p.x + FACEV[G.p.face][0]*40, ly = OWL.look ? OWL.look.y : G.p.y + FACEV[G.p.face][1]*40;
  var dx = lx - x, dy = ly - y, d = Math.hypot(dx, dy) || 1;
  var ex = Math.round(dx/d), ey = Math.round(dy/d);
  ctx.fillStyle = '#5a4430'; ctx.fillRect(x-5, y-4, 10, 9);                       /* body */
  ctx.fillStyle = '#8a6a48'; ctx.fillRect(x-4, y-3, 8, 5);
  ctx.fillStyle = '#5a4430';                                                      /* wings */
  ctx.fillRect(x-7, y-1 - flap*2, 2, 5); ctx.fillRect(x+5, y-1 - flap*2, 2, 5);
  ctx.fillRect(x-4, y-6, 2, 2); ctx.fillRect(x+2, y-6, 2, 2);                     /* ear tufts */
  ctx.fillStyle = C.bone; ctx.fillRect(x-4, y-3, 3, 3); ctx.fillRect(x+1, y-3, 3, 3);
  ctx.fillStyle = '#12151d'; ctx.fillRect(x-3 + (ex>0?1:0), y-2 + (ey>0?1:0), 1, 1); ctx.fillRect(x+2 + (ex>0?1:0), y-2 + (ey>0?1:0), 1, 1);
  ctx.fillStyle = C.gold; ctx.fillRect(x-1, y, 2, 2);                             /* beak */
}
