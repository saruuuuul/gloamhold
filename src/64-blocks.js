
/* ============================================================
   JELLY BLOCKS — falling jellies, shared out between the eyes.

   Layers (invariant 12):
     world  the jar's walls and floor, the lines-to-go bar    both eyes, full
     foe    the falling jelly, the next one, a bomb's blast
     item   the settled stack, its gems, the sparks of a clear
     clue   the landing guide: dotted drops to where it will land
   In forced fusion that puts the piece he is steering in the weaker eye
   and the stack it has to fit into in the stronger one — the same split
   the dungeon uses, applied to a game where the two have to meet.

   It is deliberately NOT Tetris. A court held Tetris's look protectable
   (Tetris Holding v. Xio, D.N.J. 2012): the 20x10 field, the seven
   four-square pieces and their colours, the ghost piece. This is an 8x14
   jar of round jellies, pieces of two and three squares only, colours
   that belong to no shape, and a dotted landing guide instead of a ghost.
   That lowers the risk; it is not legal advice.

   What makes it more than falling blocks: GEMS ride in some jellies and
   pay a star when their row clears, so he aims for rows; an occasional
   BOMB clears a hole; clears in a row climb in pitch; three at once is
   a BIG CLEAR. In child mode reaching the top never ends the game — a
   sweep clears the lower half and play carries on.
   ============================================================ */
var BK_W = 8, BK_H = 14, BK_CELL = 10, BK_X0 = 40, BK_Y0 = 20;
var BK_PIECES = {
  I3:{ n:3, cells:[[0,1],[1,1],[2,1]] },
  L3:{ n:2, cells:[[0,0],[0,1],[1,1]] },
  D2:{ n:2, cells:[[0,0],[1,0]] },
  B: { n:1, cells:[[0,0]], bomb:true }
};
/* a jelly's colour is picked when it spawns, so no colour stands for a shape */
var BK_JELLY = [
  { c:'#e86a8a', hi:'#f6b3c4' }, { c:'#7fd36a', hi:'#c2efb6' }, { c:'#b47be8', hi:'#dcc0f6' },
  { c:'#f0a040', hi:'#f8d39c' }, { c:'#5aa8e8', hi:'#acd4f6' }
];
var BK_FLOORS = ['#141a26', '#161d29', '#1b1826', '#14201a', '#221a1a', '#1c1c24', '#1a2024'];
var BK_KICKS = [[0,0], [-1,0], [1,0], [0,-1], [-2,0], [2,0], [0,-2]];

function bkCells(type, rot){
  var P = BK_PIECES[type], out = [], i, r;
  for(i=0; i<P.cells.length; i++){
    var x = P.cells[i][0], y = P.cells[i][1];
    for(r=0; r<(rot & 3); r++){ var t = x; x = P.n - 1 - y; y = t; }
    out.push([x, y]);
  }
  return out;
}
function bkFits(g, type, rot, px, py){
  var cs = bkCells(type, rot), i;
  for(i=0; i<cs.length; i++){
    var x = px + cs[i][0], y = py + cs[i][1];
    if(x < 0 || x >= BK_W || y >= BK_H) return false;
    if(y >= 0 && g.grid[y][x]) return false;
  }
  return true;
}
function bkGravity(g){
  var B = TUNING.blocks, f = Math.max(B.gravityMin, B.gravityBase - (g.lv - 1)*B.gravityStep);
  return Math.round(f * (cfg.kidMode ? B.kidGravityScale : 1));
}
function bkNextType(g){
  var B = TUNING.blocks;
  g.pieces++;
  if(B.bombEvery > 0 && g.pieces % Math.round(B.bombEvery) === 0) return 'B';
  if(!g.bag.length){
    g.bag = ['I3','L3','L3','D2','I3','L3'];
    for(var i = g.bag.length - 1; i > 0; i--){ var j = Math.floor(Math.random()*(i+1)), t = g.bag[i]; g.bag[i] = g.bag[j]; g.bag[j] = t; }
  }
  return g.bag.pop();
}
function bkSpawn(g){
  var type = g.next, cs = bkCells(type, 0), minY = 9, maxX = 0, i;
  var col = g.nextCol;
  g.next = bkNextType(g); g.nextCol = Math.floor(Math.random()*BK_JELLY.length);
  for(i=0; i<cs.length; i++){ minY = Math.min(minY, cs[i][1]); maxX = Math.max(maxX, cs[i][0]); }
  var P = { type:type, rot:0, x:Math.floor((BK_W - maxX - 1)/2), y:-minY, gem:-1, col:col || 0 };
  if(!BK_PIECES[type].bomb && Math.random() < TUNING.blocks.gemChance) P.gem = Math.floor(Math.random()*cs.length);
  g.fall = 0; g.lock = 0; g.resets = 0;
  if(!bkFits(g, P.type, 0, P.x, P.y)){ g.cur = null; bkTopOut(g); return; }
  g.cur = P;
}
/* the stack reached the top */
function bkTopOut(g){
  g.topouts++;
  arcSegFail();
  if(!cfg.kidMode){ arcGameOver(); return; }
  arcKnockdown();
  g.sweep = 44; sfx('bSweep'); arcSay('oops_ok', true);
}
function bkMove(g, dx, dy){
  var P = g.cur;
  if(!P || !bkFits(g, P.type, P.rot, P.x + dx, P.y + dy)) return false;
  P.x += dx; P.y += dy;
  if(g.lock > 0 && g.resets < TUNING.blocks.lockResets){ g.lock = 0; g.resets++; }
  return true;
}
function bkRotate(g, d){
  var P = g.cur, i;
  if(!P || BK_PIECES[P.type].n < 2) return;
  var r = (P.rot + d + 4) & 3;
  for(i=0; i<BK_KICKS.length; i++){
    var k = BK_KICKS[i];
    if(bkFits(g, P.type, r, P.x + k[0], P.y + k[1])){
      P.x += k[0]; P.y += k[1]; P.rot = r;
      if(g.lock > 0 && g.resets < TUNING.blocks.lockResets){ g.lock = 0; g.resets++; }
      sfx('bRotate');
      return;
    }
  }
}
function bkGhostY(g){
  var P = g.cur, y = P.y;
  while(bkFits(g, P.type, P.rot, P.x, y + 1)) y++;
  return y;
}
function bkLock(g){
  var P = g.cur, cs = bkCells(P.type, P.rot), i, x, y;
  g.cur = null;
  if(BK_PIECES[P.type].bomb){
    var bx = P.x + cs[0][0], by = P.y + cs[0][1];
    for(y = by - 1; y <= by + 1; y++) for(x = bx - 1; x <= bx + 1; x++){
      if(y >= 0 && y < BK_H && x >= 0 && x < BK_W) g.grid[y][x] = null;
    }
    fxBurst(g.fxFoe, BK_X0 + (bx + 0.5)*BK_CELL, BK_Y0 + (by + 0.5)*BK_CELL, 14, C.gold, 1.6, 22, 3);
    sfx('boom'); arcHitstop(5);
    bkSpawn(g);
    return;
  }
  for(i=0; i<cs.length; i++){
    x = P.x + cs[i][0]; y = P.y + cs[i][1];
    if(y >= 0) g.grid[y][x] = { c:BK_JELLY[P.col].c, hi:BK_JELLY[P.col].hi, gem: i === P.gem };
  }
  sfx('bLock');
  var rows = [];
  for(y=0; y<BK_H; y++){
    var full = true;
    for(x=0; x<BK_W; x++) if(!g.grid[y][x]){ full = false; break; }
    if(full) rows.push(y);
  }
  if(rows.length){
    g.clearing = { rows:rows, t:TUNING.blocks.clearFrames };
    sfx('bLine', g.combo);
    return;
  }
  g.combo = 0;
  bkSpawn(g);
}
function bkFinishClear(g){
  var rows = g.clearing.rows, n = rows.length, gems = 0, i, x;
  g.clearing = null;
  for(i=0; i<n; i++){
    for(x=0; x<BK_W; x++){
      var c = g.grid[rows[i]][x];
      if(c && c.gem) gems++;
      fxBurst(g.fxItem, BK_X0 + (x + 0.5)*BK_CELL, BK_Y0 + (rows[i] + 0.5)*BK_CELL, 1, c ? c.c : C.gold, 1.2, 20, 2.4);
    }
  }
  /* remove the rows, top-down indices stay valid because they are sorted */
  for(i=0; i<n; i++){ g.grid.splice(rows[i], 1); g.grid.unshift(bkEmptyRow()); }
  g.lines += n; g.segLines += n; g.combo++;
  S.score += [0, 100, 300, 600][Math.min(3, n)] * g.lv;
  if(gems){ g.gems += gems; sfx('bGem'); arcStar(gems); }
  if(n >= 3){ sfx('bBig'); arcBanner('BIG CLEAR!', C.gold); arcSay('wow', true); arcHitstop(6); }
  var B = TUNING.blocks;
  while(g.segLines >= B.segLines){
    g.segLines -= B.segLines;
    arcSegEnd();
    arcSegStart('Blocks level ' + g.lv + ' part ' + (++g.part));
  }
  if(g.lines >= g.goal){ arcLevelDone(3 - Math.min(2, g.topouts)); return; }
  bkSpawn(g);
}
function bkEmptyRow(){ var r = [], x; for(x=0; x<BK_W; x++) r.push(null); return r; }
function bkTopRow(g){
  for(var y=0; y<BK_H; y++) for(var x=0; x<BK_W; x++) if(g.grid[y][x]) return y;
  return BK_H;
}

GAMES.blocks = {
  id:'blocks', name:'JELLY BLOCKS', say:'g_blocks', col:'#e86a8a', label:'PLAY',
  W:160, H:176, surround:'#10141e',
  doneSub: function(){ return ARC.g ? ARC.g.lines + ' lines' : ''; },
  start: function(lv){
    var B = TUNING.blocks, y, g = { lv:lv, grid:[], bag:[], cur:null, next:null, fall:0, lock:0, resets:0,
      dasDir:0, das:0, upPrev:false, lines:0, goal:Math.round(B.linesBase + lv*B.linesStep), segLines:0, part:1,
      combo:0, pieces:0, gems:0, topouts:0, clearing:null, sweep:0,
      fxItem:[], fxFoe:[], floor:BK_FLOORS[(lv - 1) % BK_FLOORS.length] };
    for(y=0; y<BK_H; y++) g.grid.push(bkEmptyRow());
    g.next = bkNextType(g); g.nextCol = Math.floor(Math.random()*BK_JELLY.length);
    bkSpawn(g);
    arcSegStart('Blocks level ' + lv + ' part 1');
    arcBanner('LEVEL ' + lv, C.jade);
    return g;
  },
  update: function(g){
    var B = TUNING.blocks;
    fxStep(g.fxItem, 0.05); fxStep(g.fxFoe, 0);
    if(g.clearing){ if(--g.clearing.t <= 0) bkFinishClear(g); return; }
    if(g.sweep > 0){
      if(--g.sweep === 0){
        for(var i=0; i<Math.floor(BK_H/2); i++){ g.grid.pop(); g.grid.unshift(bkEmptyRow()); }
        bkSpawn(g);
      }
      return;
    }
    if(!g.cur){ bkSpawn(g); return; }
    var dir = input.x > 0.5 ? 1 : (input.x < -0.5 ? -1 : 0);
    if(dir !== g.dasDir){ g.dasDir = dir; g.das = 0; if(dir && bkMove(g, dir, 0)) sfx('bMove'); }
    else if(dir){
      g.das++;
      if(g.das >= B.dasFrames && (g.das - B.dasFrames) % Math.max(1, B.arrFrames) === 0 && bkMove(g, dir, 0)) sfx('bMove');
    }
    var up = input.y < -0.5;
    if(up && !g.upPrev) bkRotate(g, 1);
    g.upPrev = up;
    if(input.atk) bkRotate(g, 1);
    if(input.cycle) bkRotate(g, -1);
    if(input.toolPress){
      var gy = bkGhostY(g), dist = gy - g.cur.y;
      g.cur.y = gy; S.score += dist*2;
      sfx('bDrop'); arcHitstop(2);
      bkLock(g);
      return;
    }
    var soft = input.y > 0.5, gf = bkGravity(g);
    if(soft) gf = Math.min(gf, B.softFrames);
    if(++g.fall >= gf){ g.fall = 0; if(bkMove(g, 0, 1) && soft) S.score += 1; }
    if(!g.cur) return;
    if(!bkFits(g, g.cur.type, g.cur.rot, g.cur.x, g.cur.y + 1)){
      if(++g.lock >= B.lockFrames) bkLock(g);
    } else g.lock = 0;
  },
  idle: function(g){ fxStep(g.fxItem, 0.05); fxStep(g.fxFoe, 0); },
  busy: function(g){ return { foe:!!g.cur, item:bkTopRow(g) < BK_H, clue:!!g.cur }; },
  intense: function(g){
    var h = (BK_H - bkTopRow(g)) / BK_H, v = 0;
    if(h > 0.65) v = Math.min(1, 0.62 + (h - 0.65)*1.4);
    if(g.goal - g.lines <= 2) v = Math.max(v, 0.66);
    return v;
  },
  draw: function(g, eye, m){
    var W = this.W, H = this.H, i, x, y;
    /* world: the surround, the well, the next-piece box, the progress bar */
    ctx.fillStyle = this.surround; ctx.fillRect(-m.mx, -m.my, W + m.mx*2, H + m.my*2);
    ctx.fillStyle = '#39415a'; ctx.fillRect(BK_X0 - 4, BK_Y0 - 4, BK_W*BK_CELL + 8, BK_H*BK_CELL + 8);
    ctx.fillStyle = '#59628a'; ctx.fillRect(BK_X0 - 4, BK_Y0 - 4, BK_W*BK_CELL + 8, 2);
    ctx.fillStyle = g.floor; ctx.fillRect(BK_X0, BK_Y0, BK_W*BK_CELL, BK_H*BK_CELL);
    var nx = BK_X0 + BK_W*BK_CELL + 8, ny = BK_Y0 + 4;
    ctx.fillStyle = '#39415a'; ctx.fillRect(nx - 2, ny - 2, 30, 30);
    ctx.fillStyle = g.floor; ctx.fillRect(nx, ny, 26, 26);
    var bx = 14, by = BK_Y0 + 20, bh = BK_H*BK_CELL - 40;
    ctx.fillStyle = '#39415a'; ctx.fillRect(bx - 2, by - 2, 12, bh + 4);
    ctx.fillStyle = '#10141e'; ctx.fillRect(bx, by, 8, bh);
    var k = Math.min(1, g.lines / g.goal);
    ctx.fillStyle = C.jade; ctx.fillRect(bx, by + bh*(1 - k), 8, bh*k);
    mtext(String(Math.max(0, g.goal - g.lines)), bx + 4, by - 9, 9, C.bone, 'center', 700, F_MONO);

    /* item: the stack (a clear shrinks its rows; the sweep shrinks the lower half) */
    withLayer(eye, 'item', function(){
      for(y=0; y<BK_H; y++){
        var shrink = 1;
        if(g.clearing && g.clearing.rows.indexOf(y) >= 0) shrink = g.clearing.t / TUNING.blocks.clearFrames;
        if(g.sweep > 0 && y >= Math.floor(BK_H/2)) shrink = Math.min(1, g.sweep / 44 + (BK_H - 1 - y)*0.02);
        for(x=0; x<BK_W; x++){ var c = g.grid[y][x]; if(c) bkDrawCell(x, y, c.c, c.hi, c.gem, shrink); }
      }
      fxDraw(g.fxItem);
    });
    if(!g.cur) { withLayer(eye, 'foe', function(){ fxDraw(g.fxFoe); bkDrawNext(g, nx, ny); }); return; }
    /* clue: the landing guide — a dotted drop under each column of the
       jelly, ending in a bar where it will land. Every dot is in an empty
       cell the jelly falls through, so it composites over the floor. */
    var P = g.cur, gy = bkGhostY(g), cs = bkCells(P.type, P.rot);
    withLayer(eye, 'clue', function(){
      if(gy === P.y) return;
      var bottom = {}, c2, k2;
      for(i=0; i<cs.length; i++){ c2 = P.x + cs[i][0]; bottom[c2] = Math.max(bottom[c2] == null ? -99 : bottom[c2], cs[i][1]); }
      ctx.fillStyle = BK_JELLY[P.col].hi;
      for(k2 in bottom){
        var col = +k2, from = P.y + bottom[k2] + 1, to = gy + bottom[k2], cx = BK_X0 + col*BK_CELL + BK_CELL/2;
        for(y = Math.max(0, from); y <= to; y++){
          var cy = BK_Y0 + y*BK_CELL;
          if(y < to){ ctx.fillRect(cx - 1, cy + 2, 2, 2); ctx.fillRect(cx - 1, cy + 6, 2, 2); }
          else ctx.fillRect(BK_X0 + col*BK_CELL + 2, cy + BK_CELL - 3, BK_CELL - 4, 2);
        }
      }
    });
    /* foe: the falling piece, the next one, and a bomb's blast */
    withLayer(eye, 'foe', function(){
      for(i=0; i<cs.length; i++){
        var yy = P.y + cs[i][1];
        if(yy < 0) continue;
        if(BK_PIECES[P.type].bomb) bkDrawBomb(BK_X0 + (P.x + cs[i][0] + 0.5)*BK_CELL, BK_Y0 + (yy + 0.5)*BK_CELL, BK_CELL);
        else bkDrawCell(P.x + cs[i][0], yy, BK_JELLY[P.col].c, BK_JELLY[P.col].hi, i === P.gem, 1);
      }
      bkDrawNext(g, nx, ny);
      fxDraw(g.fxFoe);
    });
  },
  icon: function(cx, cy, s, t){
    var c = s/4.2, i, rows = [[1,1,0,1,1,1,1,1], [1,1,1,1,1,0,1,1]];
    ctx.fillStyle = '#141a26'; ctx.fillRect(cx - c*4, cy - s, c*8, s*2);
    for(i=0; i<16; i++){
      if(!rows[i >> 3][i & 7]) continue;
      bkJelly(cx - c*4 + (i & 7)*c, cy + s - c*(2 - (i >> 3)), c, BK_JELLY[i % BK_JELLY.length], false);
    }
    var fy = cy - s + ((t*0.5) % (s*1.2));
    bkJelly(cx - c*1.5, fy, c, BK_JELLY[2], false); bkJelly(cx - c*0.5, fy, c, BK_JELLY[2], false); bkJelly(cx + c*0.5, fy, c, BK_JELLY[2], false);
  }
};
/* a round jelly with a face: flat fills only, so its alpha stays its contrast */
function bkJelly(px, py, sz, J, gem){
  var e = Math.max(1, sz*0.12);
  ctx.fillStyle = J.c;
  ctx.fillRect(px + e, py, sz - e*2, sz); ctx.fillRect(px, py + e, sz, sz - e*2);
  ctx.fillStyle = J.hi; ctx.fillRect(px + e*1.5, py + e, sz*0.22, sz*0.16);
  ctx.fillStyle = '#1a1420';
  ctx.fillRect(px + sz*0.28, py + sz*0.42, sz*0.12, sz*0.14); ctx.fillRect(px + sz*0.6, py + sz*0.42, sz*0.12, sz*0.14);
  if(gem){
    var cx = px + sz/2, cy = py + sz*0.74, r = sz*0.16;
    ctx.fillStyle = C.bone; ctx.fillRect(cx - r*0.5, cy - r, r, r*2); ctx.fillRect(cx - r, cy - r*0.5, r*2, r);
  }
}
function bkDrawCell(x, y, col, hi, gem, shrink){
  var s = (BK_CELL - 1) * shrink, px = BK_X0 + x*BK_CELL + (BK_CELL - s)/2, py = BK_Y0 + y*BK_CELL + (BK_CELL - s)/2;
  if(s < 0.5) return;
  if(shrink < 1){ ctx.fillStyle = col; ctx.fillRect(px, py, s, s); return; }
  bkJelly(px, py, s, { c:col, hi:hi }, gem);
}
function bkDrawBomb(x, y, s){
  ctx.fillStyle = '#2b2f3a'; ctx.fillRect(x - s*0.42, y - s*0.36, s*0.84, s*0.78);
  ctx.fillStyle = '#5a6076'; ctx.fillRect(x - s*0.3, y - s*0.3, s*0.28, s*0.2);
  ctx.fillStyle = (ARC.t >> 3) & 1 ? C.gold : C.blood; ctx.fillRect(x - 1, y - s*0.62, 2, s*0.26);
}
function bkDrawNext(g, nx, ny){
  if(!g.next) return;
  var P = BK_PIECES[g.next], cs = bkCells(g.next, 0), sz = 7, i;
  var ox = nx + 13 - (P.n*sz)/2, oy = ny + 13 - (P.n*sz)/2;
  for(i=0; i<cs.length; i++){
    if(P.bomb){ bkDrawBomb(nx + 13, ny + 13, 9); continue; }
    bkJelly(ox + cs[i][0]*sz, oy + cs[i][1]*sz, sz - 1, BK_JELLY[g.nextCol || 0], false);
  }
}
