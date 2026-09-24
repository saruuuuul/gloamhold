
/* ============================================================
   ISLANDS — the sea is a row of small dungeons. Island 1 is the
   hand-built Gloamhold (HOME_ROOMS in 20-core.js). Every other
   island is generated from a FIXED seed: island 3 is the same
   island every time, which is what makes "come back when you have
   bombs" work — the cracked wall you walked past is still there.

   Every island is checked by islandProblems() before it is used,
   and tests/smoke.mjs runs that check over dozens of them: doors
   that match on both sides, no enemy inside a wall, push puzzles
   with a clear lane, and a boss key you can reach before its lock.
   ============================================================ */
var ISLAND_DEFS = [
  null,
  { name:'Gloamhold',   mn:'Гломхолд',      col:'#57bf92', pal:null },
  { name:'Green Isle',  mn:'Ногоон арал',   col:'#6fcf6f', tool:'shield',
    pal:{ floor:'#172219', floor2:'#1a261c', speck:'#26382a', stone:'#35503a', stoneTop:'#4f7a55', stoneDk:'#1f3023', arch:'#0b120d' } },
  { name:'Blue Isle',   mn:'Цэнхэр арал',   col:'#5aa8e8', tool:'bombs',
    pal:{ floor:'#161d29', floor2:'#19212f', speck:'#243145', stone:'#34496a', stoneTop:'#4e6d9c', stoneDk:'#1f2b40', arch:'#0b0f18' } },
  { name:'Red Isle',    mn:'Улаан арал',    col:'#e0645a',
    pal:{ floor:'#241818', floor2:'#291b1b', speck:'#3a2626', stone:'#5a3533', stoneTop:'#86504b', stoneDk:'#361f1e', arch:'#140b0b' } },
  { name:'Yellow Isle', mn:'Шар арал',      col:'#e8c84a', tool:'bow',
    pal:{ floor:'#23201a', floor2:'#28241d', speck:'#39332a', stone:'#5a4f33', stoneTop:'#86764b', stoneDk:'#362f1e', arch:'#13110b' } },
  { name:'White Isle',  mn:'Цагаан арал',   col:'#e6e2d6',
    pal:{ floor:'#1f2126', floor2:'#23262c', speck:'#33363e', stone:'#5e636f', stoneTop:'#8c93a3', stoneDk:'#383b43', arch:'#101114' } },
  { name:'Purple Isle', mn:'Нил ягаан арал', col:'#a47be0',
    pal:{ floor:'#1e1826', floor2:'#221b2b', speck:'#32283f', stone:'#4a3a66', stoneTop:'#6c5796', stoneDk:'#2b2240', arch:'#100c16' } },
  { name:'Dark Isle',   mn:'Хар арал',      col:'#8a90a8',
    pal:{ floor:'#131519', floor2:'#16181d', speck:'#22252c', stone:'#2c303a', stoneTop:'#424856', stoneDk:'#1a1c22', arch:'#08090b' } }
];
var ISLAND_COUNT = ISLAND_DEFS.length - 1;
var ROOM_NAMES = ['Grove', 'Tide Pool', 'Old Steps', 'Mossy Hall', 'Lantern Room', 'Deep Well',
                  'Stone Garden', 'Crab Hollow', 'Echo Hall', 'Root Cellar', 'Shell Court', 'Salt Cave'];

var ISLAND = null, CUR_ISLAND = 1, ISLAND_CACHE = {};

/* mulberry32: small, fast, and the same numbers on every device */
function islandRng(seed){
  var a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function islandCost(n){
  if(n <= 1) return 0;
  var I = TUNING.islands, k = n - 2;
  return I.unlockBase + I.unlockStep*k + I.unlockGrow*k*(k-1)/2;
}
function islandUnlocked(n){ return n === 1 || cfg.allIslands || PROG.stars >= islandCost(n); }
function getIsland(n){
  if(!ISLAND_CACHE[n]) ISLAND_CACHE[n] = (n === 1) ? homeIsland() : genIsland(n);
  return ISLAND_CACHE[n];
}
function loadIsland(n){
  if(n < 1 || n > ISLAND_COUNT) n = 1;
  ISLAND = getIsland(n); ROOMS = ISLAND.rooms; CUR_ISLAND = n;
}
function islandSecrets(rooms){
  var out = [];
  Object.keys(rooms).forEach(function(key){
    (rooms[key].objs || []).forEach(function(o, idx){ if(o.secret) out.push(key + ':' + idx); });
  });
  return out;
}
function homeIsland(){
  var d = ISLAND_DEFS[1];
  return { id:1, name:d.name, mn:d.mn, col:d.col, pal:null, rooms:HOME_ROOMS,
           start:'1,2', boss:'1,0', tool:null, secrets:islandSecrets(HOME_ROOMS), fallback:false };
}

/* islands past the eight on the map reuse a palette (and never a tool); the
   game only sails to eight, but the generator is tested over many more seeds */
function islandDef(n){
  if(ISLAND_DEFS[n]) return ISLAND_DEFS[n];
  var d = ISLAND_DEFS[((n - 2) % (ISLAND_COUNT - 1)) + 2], o = {};
  for(var k in d) o[k] = d[k];
  o.tool = null; o.name = d.name + ' ' + n;
  return o;
}
function genIsland(n){
  var def = islandDef(n), attempt, isl;
  for(attempt = 0; attempt < 40; attempt++){
    isl = genIslandTry(n, def, islandRng((n*7919 + attempt*104729) >>> 0));
    if(isl && islandProblems(isl).length === 0){ isl.attempt = attempt; return isl; }
  }
  /* never expected — the smoke test generates every island — but a broken
     island must not take the game down with it */
  var home = homeIsland(); home.id = n; home.fallback = true;
  return home;
}

/* ---- room-building helpers: a reservation set keeps lanes, doorways and
   spawn points clear while things are scattered around them ---- */
function reserveDoorways(spec, res){
  var i;
  if(spec.doors.indexOf('n') >= 0) for(i=CC-1;i<=CC+1;i++){ res[i+',1'] = 1; res[i+',2'] = 1; }
  if(spec.doors.indexOf('s') >= 0) for(i=CC-1;i<=CC+1;i++){ res[i+','+(RH-2)] = 1; res[i+','+(RH-3)] = 1; }
  if(spec.doors.indexOf('w') >= 0) for(i=CR-1;i<=CR+1;i++){ res['1,'+i] = 1; res['2,'+i] = 1; }
  if(spec.doors.indexOf('e') >= 0) for(i=CR-1;i<=CR+1;i++){ res[(RW-2)+','+i] = 1; res[(RW-3)+','+i] = 1; }
  res[CC+','+CR] = 1;                    /* drops appear in the centre */
}
function isFree(g, res, x, y){ return y >= 0 && y < RH && x >= 0 && x < RW && g[y][x] === T_FLOOR && !res[x+','+y]; }
function pickFree(g, res, rnd, x0, x1, y0, y1){
  for(var t=0; t<120; t++){
    var x = x0 + Math.floor(rnd()*(x1-x0+1)), y = y0 + Math.floor(rnd()*(y1-y0+1));
    if(isFree(g, res, x, y)) return [x, y];
  }
  return null;
}
function placeFoes(spec, g, res, rnd, count, pool){
  for(var i=0; i<count; i++){
    var t = pickFree(g, res, rnd, 2, RW-3, 2, RH-3);
    if(!t) return;
    res[t[0]+','+t[1]] = 1;
    spec.foes.push([pool[Math.floor(rnd()*pool.length)], t[0], t[1]]);
  }
}
function placePush(spec, g, res, rnd, pairs){
  var placed = 0, tries, s;
  for(tries=0; tries<300 && placed < pairs; tries++){
    var dir = ['n','s','e','w'][Math.floor(rnd()*4)], v = DIRV[dir], dist = 2 + Math.floor(rnd()*2);
    var bx = 3 + Math.floor(rnd()*7), by = 3 + Math.floor(rnd()*5);
    var cells = [[bx - v[0], by - v[1]], [bx, by]];
    for(s=1; s<=dist; s++) cells.push([bx + v[0]*s, by + v[1]*s]);
    var ok = cells.every(function(c){ return c[0] >= 2 && c[1] >= 2 && c[0] <= RW-3 && c[1] <= RH-3 && isFree(g, res, c[0], c[1]); });
    if(!ok) continue;
    cells.forEach(function(c){ res[c[0]+','+c[1]] = 1; });
    spec.objs.push({ k:'block', x:bx, y:by });
    spec.objs.push({ k:'plate', x:bx + v[0]*dist, y:by + v[1]*dist });
    placed++;
  }
  return placed === pairs;
}
function placeTorches(spec, g, res, rnd, count){
  var spots = [[3,3],[9,3],[3,7],[9,7]], i;
  for(i = spots.length - 1; i > 0; i--){ var j = Math.floor(rnd()*(i+1)), t = spots[i]; spots[i] = spots[j]; spots[j] = t; }
  var used = 0;
  for(i=0; i<spots.length && used < count; i++){
    var x = spots[i][0], y = spots[i][1];
    if(!isFree(g, res, x, y)) continue;
    res[x+','+y] = 1;
    res[(x < CC ? x+1 : x-1) + ',' + y] = 1;       /* a free side to swing from */
    spec.objs.push({ k:'torch', x:x, y:y });
    used++;
  }
  return used === count;
}
function placeChest(spec, g, res, chest){
  var spots = [[6,3],[6,7],[4,5],[8,5],[4,3],[8,7]];
  for(var i=0; i<spots.length; i++){
    if(isFree(g, res, spots[i][0], spots[i][1])){
      res[spots[i][0]+','+spots[i][1]] = 1;
      chest.k = 'chest'; chest.x = spots[i][0]; chest.y = spots[i][1];
      spec.objs.push(chest);
      return true;
    }
  }
  return false;
}
var ALCOVES = [
  { chest:[1,1],  crack:[2,1],  walls:[[1,2],[2,2]],   front:[3,1]  },
  { chest:[11,1], crack:[10,1], walls:[[11,2],[10,2]], front:[9,1]  },
  { chest:[1,9],  crack:[2,9],  walls:[[1,8],[2,8]],   front:[3,9]  },
  { chest:[11,9], crack:[10,9], walls:[[11,8],[10,8]], front:[9,9]  }
];
function placeAlcove(spec, g, res, rnd, item, amount){
  var off = Math.floor(rnd()*4);
  for(var i=0; i<4; i++){
    var a = ALCOVES[(i+off) % 4];
    var need = [a.chest, a.crack, a.front].concat(a.walls);
    if(!need.every(function(c){ return isFree(g, res, c[0], c[1]); })) continue;
    need.forEach(function(c){ res[c[0]+','+c[1]] = 1; });
    a.walls.forEach(function(w){ spec.walls.push([w[0], w[1]]); g[w[1]][w[0]] = T_WALL; });
    spec.objs.push({ k:'crack', x:a.crack[0], y:a.crack[1] });
    spec.objs.push({ k:'chest', x:a.chest[0], y:a.chest[1], item:item, amount:amount, secret:true });
    return true;
  }
  return false;
}
function placeEye(spec, g, res, rnd){
  var xs = rnd() < 0.5 ? [3, 9] : [9, 3];
  for(var i=0; i<2; i++){
    var x = xs[i];
    if(g[0][x] !== T_WALL) continue;
    if(!isFree(g, res, x, 1) || !isFree(g, res, x, 2) || !isFree(g, res, x, 3)) continue;
    res[x+',1'] = 1; res[x+',2'] = 1; res[x+',3'] = 1;
    spec.objs.push({ k:'eye', x:x, y:0 });
    spec.objs.push({ k:'chest', x:x, y:1, item:'coins', amount:TUNING.world.secretChestCoins, hidden:'eye', secret:true });
    return true;
  }
  return false;
}
function placeSparkle(spec, g, res, rnd){
  var t = pickFree(g, res, rnd, 2, RW-3, 2, RH-3);
  if(!t) return false;
  res[t[0]+','+t[1]] = 1;
  spec.objs.push({ k:'sparkle', x:t[0], y:t[1], secret:true });
  return true;
}
function placeDeco(spec, g, res, rnd, count){
  for(var i=0; i<count; i++){
    var t = pickFree(g, res, rnd, 1, RW-2, 1, RH-2);
    if(!t) return;
    res[t[0]+','+t[1]] = 1;
    spec.deco.push([rnd() < 0.6 ? 'bush' : 'pot', t[0], t[1]]);
  }
}

function genIslandTry(n, def, rnd){
  var I = TUNING.islands, W = TUNING.world;
  var count = I.roomsMin + Math.floor(rnd()*(I.roomsMax - I.roomsMin + 1));
  var DIRS = [['n',0,-1],['s',0,1],['e',1,0],['w',-1,0]], OPP = { n:'s', s:'n', e:'w', w:'e' };
  var cells = { '0,0':{ x:0, y:0 } }, order = ['0,0'], depth = { '0,0':0 }, parent = {};
  var guard = 0, i;

  /* grow a tree of rooms, biased toward the newest so islands have depth */
  while(order.length < count && guard++ < 800){
    var base = order[Math.floor(Math.pow(rnd(), 0.55) * order.length)], b = cells[base];
    var dd = DIRS[Math.floor(rnd()*4)], nx = b.x + dd[1], ny = b.y + dd[2], nk = nx + ',' + ny;
    if(cells[nk] || Math.abs(nx) > 3 || Math.abs(ny) > 3) continue;
    cells[nk] = { x:nx, y:ny }; order.push(nk); depth[nk] = depth[base] + 1; parent[nk] = { from:base, dir:dd[0] };
  }
  if(order.length < count) return null;

  /* the warden's floor hangs off the deepest room that has a free side */
  var byDepth = order.slice().sort(function(a, c){ return depth[c] - depth[a]; });
  var D = null, B = null, bdir = null;
  for(i=0; i<byDepth.length && !D; i++){
    if(byDepth[i] === '0,0') continue;
    var cc = cells[byDepth[i]], off = Math.floor(rnd()*4);
    for(var j=0; j<4; j++){
      var d2 = DIRS[(j + off) % 4], bk = (cc.x + d2[1]) + ',' + (cc.y + d2[2]);
      if(!cells[bk]){ D = byDepth[i]; B = bk; bdir = d2[0]; cells[bk] = { x:cc.x + d2[1], y:cc.y + d2[2] }; break; }
    }
  }
  if(!D) return null;

  /* the key lives on a different branch from the boss door when there is one */
  var anc = {}, a = D;
  while(a){ anc[a] = true; a = parent[a] ? parent[a].from : null; }
  var K = null;
  for(i=0; i<byDepth.length; i++) if(!anc[byDepth[i]]){ K = byDepth[i]; break; }
  if(!K) K = D;

  var R = {};
  order.concat([B]).forEach(function(key){ R[key] = { doors:'', pat:'empty', foes:[], deco:[], objs:[], walls:[] }; });
  order.forEach(function(key){
    if(parent[key]){ R[key].doors += OPP[parent[key].dir]; R[parent[key].from].doors += parent[key].dir; }
  });
  R[D].doors += bdir; R[B].doors += OPP[bdir];
  R[D].lock = {}; R[D].lock[bdir] = 'boss';

  var pool = n >= 3 ? ['grub', 'bat', 'sentry'] : ['grub', 'bat'];
  var nf = Math.min(I.foesMax, Math.round(I.foesBase + (n-2)*I.foesPerIsland));
  var pats = ['empty', 'pillars', 'cross', 'ring', 'maze'];
  var names = ROOM_NAMES.slice();
  var plain = order.filter(function(key){ return key !== '0,0' && key !== K; });

  /* pick which plain rooms carry the two built secrets */
  var alcoveRoom = plain.length ? plain[Math.floor(rnd()*plain.length)] : null;
  var eyeChoices = plain.filter(function(key){ return key !== alcoveRoom; });
  var eyeRoom = eyeChoices.length ? eyeChoices[Math.floor(rnd()*eyeChoices.length)] : null;
  var sparkleRoom = plain.length ? plain[Math.floor(rnd()*plain.length)] : null;

  var ok = true;
  Object.keys(R).forEach(function(key){
    if(!ok) return;
    var r = R[key], role = key === '0,0' ? 'start' : key === K ? 'key' : key === B ? 'boss' : 'plain';
    r.pat = (role === 'plain') ? pats[Math.floor(rnd()*pats.length)] : 'empty';
    r.name = role === 'start' ? 'Landing' : role === 'boss' ? "Warden's Floor"
           : names.splice(Math.floor(rnd()*names.length), 1)[0] || 'Chamber';
    var g = roomGrid(r, null), res = {};
    reserveDoorways(r, res);

    if(role === 'start'){
      res['6,6'] = 1; res['6,7'] = 1; res['6,8'] = 1;         /* where the player lands */
      ok = placeSparkle(r, g, res, rnd);
      placeDeco(r, g, res, rnd, I.decoMax + 2);
      return;
    }
    if(role === 'boss'){
      r.boss = true;
      r.foes.push(['boss', 6, 3, { hp:(n-1) * I.bossHpPerIsland }]);
      return;
    }
    if(role === 'key'){
      r.puzzle = (n % 2 === 0) ? 'push' : 'torch';
      ok = r.puzzle === 'push' ? placePush(r, g, res, rnd, n >= 6 ? 2 : 1)
                               : placeTorches(r, g, res, rnd, n >= 5 ? 4 : 3);
      if(!ok) return;
      /* the puzzle chest holds this island's tool if it has one — the big
         moment — and the warden's key then drops when the room is cleared */
      if(def.tool){ ok = placeChest(r, g, res, { item:def.tool, hidden:'puzzle' }); r.drop = 'bosskey'; }
      else ok = placeChest(r, g, res, { item:'bosskey', hidden:'puzzle' });
      if(!ok) return;
      placeFoes(r, g, res, rnd, nf, pool);
      r.seal = r.foes.length > 0;
      placeDeco(r, g, res, rnd, I.decoMin);
      return;
    }
    /* plain rooms */
    if(key === alcoveRoom) placeAlcove(r, g, res, rnd, n % 3 === 0 ? 'vessel' : 'coins', W.secretChestCoins);
    if(key === eyeRoom) placeEye(r, g, res, rnd);
    if(key === sparkleRoom) placeSparkle(r, g, res, rnd);
    placeFoes(r, g, res, rnd, Math.max(1, nf + Math.floor(rnd()*3) - 1), pool);
    r.seal = r.foes.length > 0 && rnd() < 0.3;
    placeDeco(r, g, res, rnd, I.decoMin + Math.floor(rnd()*(I.decoMax - I.decoMin + 1)));
  });
  if(!ok) return null;

  /* shift so every key is non-negative, then hand it over */
  var minX = 0, minY = 0;
  Object.keys(cells).forEach(function(key){ minX = Math.min(minX, cells[key].x); minY = Math.min(minY, cells[key].y); });
  var out = {}, map = function(key){ var c = cells[key]; return (c.x - minX) + ',' + (c.y - minY); };
  Object.keys(R).forEach(function(key){ out[map(key)] = R[key]; });
  return { id:n, name:def.name, mn:def.mn, col:def.col, pal:def.pal, rooms:out,
           start:map('0,0'), boss:map(B), keyRoom:map(K), tool:def.tool || null,
           secrets:islandSecrets(out), fallback:false };
}

/* Everything that would make an island unwinnable or broken, as sentences.
   Empty list means playable. Used by the generator and by the smoke test. */
function islandProblems(isl){
  var out = [], R = isl.rooms, OPP = { n:'s', s:'n', e:'w', w:'e' };
  if(!R[isl.start]) out.push('no start room ' + isl.start);
  if(!R[isl.boss] || !(R[isl.boss].foes || []).some(function(f){ return f[0] === 'boss'; })) out.push('no warden in ' + isl.boss);
  Object.keys(R).forEach(function(key){
    var r = R[key], c = key.split(',').map(Number), g = roomGrid(r, null);
    r.doors.split('').forEach(function(d){
      var nk = (c[0] + DIRV[d][0]) + ',' + (c[1] + DIRV[d][1]);
      if(!R[nk]) out.push(key + ': door ' + d + ' leads nowhere');
      else if(R[nk].doors.indexOf(OPP[d]) < 0) out.push(key + ': door ' + d + ' has no partner in ' + nk);
    });
    (r.foes || []).forEach(function(f){
      if(tileSolid(g[f[2]][f[1]])) out.push(key + ': ' + f[0] + ' spawns inside a wall at ' + f[1] + ',' + f[2]);
    });
    (r.objs || []).forEach(function(o){
      if(o.k === 'eye'){ if(g[o.y][o.x] !== T_WALL) out.push(key + ': eye switch is not on a wall'); return; }
      if(o.k === 'crack') return;
      if(g[o.y][o.x] !== T_FLOOR) out.push(key + ': ' + o.k + ' is not on floor at ' + o.x + ',' + o.y);
    });
    if(r.puzzle === 'push'){
      var blocks = (r.objs || []).filter(function(o){ return o.k === 'block'; });
      var plates = (r.objs || []).filter(function(o){ return o.k === 'plate'; });
      if(blocks.length !== plates.length || !blocks.length) out.push(key + ': push puzzle has ' + blocks.length + ' blocks and ' + plates.length + ' plates');
      plates.forEach(function(pl){
        var fits = blocks.some(function(bl){
          if(bl.x !== pl.x && bl.y !== pl.y) return false;
          var dx = Math.sign(pl.x - bl.x), dy = Math.sign(pl.y - bl.y), x = bl.x, y = bl.y;
          if(!dx && !dy) return false;
          var fx = bl.x - dx, fy = bl.y - dy;
          if(g[fy][fx] !== T_FLOOR) return false;
          while(x !== pl.x || y !== pl.y){
            x += dx; y += dy;
            if(g[y][x] !== T_FLOOR) return false;
            if(x < 2 || y < 2 || x > RW-3 || y > RH-3) return false;
          }
          return true;
        });
        if(!fits) out.push(key + ': plate at ' + pl.x + ',' + pl.y + ' has no block with a clear lane');
      });
    }
    (r.objs || []).forEach(function(o){
      if(o.k === 'chest' && o.hidden === 'eye' && (o.item === 'bosskey' || o.item === 'smallkey'))
        out.push(key + ': a key is behind an eye switch, which needs the bow');
    });
  });
  /* reachability: keep opening what the keys you can reach will open */
  var bossKey = false, smallKey = false, reach = {}, changed = true, loops = 0;
  function yields(r, item){
    if(r.drop === item) return true;
    return (r.objs || []).some(function(o){ return o.k === 'chest' && o.item === item && o.hidden !== 'eye'; });
  }
  while(changed && loops++ < 12){
    changed = false; reach = {};
    var stack = [isl.start];
    while(stack.length){
      var key = stack.pop();
      if(reach[key] || !R[key]) continue;
      reach[key] = true;
      var r = R[key], c = key.split(',').map(Number);
      r.doors.split('').forEach(function(d){
        var lock = r.lock && r.lock[d];
        if(lock === 'boss' && !bossKey) return;
        if(lock === 'small' && !smallKey) return;
        stack.push((c[0] + DIRV[d][0]) + ',' + (c[1] + DIRV[d][1]));
      });
    }
    Object.keys(reach).forEach(function(key){
      if(!bossKey && yields(R[key], 'bosskey')){ bossKey = true; changed = true; }
      if(!smallKey && yields(R[key], 'smallkey')){ smallKey = true; changed = true; }
    });
  }
  if(!reach[isl.boss]) out.push('the warden cannot be reached');
  return out;
}
