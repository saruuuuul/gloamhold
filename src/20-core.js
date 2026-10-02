
/* ============================================================
   GLOAMHOLD — dichoptic side-by-side dungeon
   Rendering contract: every foreground sprite is drawn ON TOP of
   the floor fill, so alpha-compositing an element at alpha a gives
   L = a*L_obj + (1-a)*L_floor, i.e. its Michelson contrast against
   the floor is scaled by exactly a. "Contrast %" in the UI is that a.
   ============================================================ */

var BUILD = "__BUILD__";

var TS = 16, RW = 13, RH = 11;           // tile size (world units), room in tiles
var WW = RW*TS, WH = RH*TS;

/* ---------------- config + persistence ---------------- */
var cfg = { weakEye:'right', strong:0.40, mode:'rebalance', adapt:true, sep:0, zoom:1.0, tilt:false,
            lens:'off', k1:0.22, k2:0.10, chroma:0.003, lensOff:0, grid:false,
            mute:false, flat:false, kidSet:false,
            kidMode:true, speakLang:'mn', allIslands:false, music:true,
            /* study use: what "contrast" means (see stimAlpha), who is playing
               under which protocol, and whether the protocol is locked */
            contrastScale:'alpha', participant:'', protocol:'', locked:false };
try{ var raw = localStorage.getItem('gloamhold.cfg'); if(raw){ var o=JSON.parse(raw); for(var k in cfg) if(k in o) cfg[k]=o[k]; } }catch(e){}
function saveCfg(){ try{ localStorage.setItem('gloamhold.cfg', JSON.stringify(cfg)); }catch(e){} }

/* ---------------- session log ---------------- */
var S = {
  started:0, elapsed:0, rooms:0, cleanRooms:0, hits:0, kills:0,
  trail:[],            // {t, c}
  checks:[],           // {t, answer}
  roomLog:[],          // {room, name, inAt, clearedAt, clean, hitsIn}
  stepsDown:0, stepsUp:0, ended:false, won:false,
  knockdowns:0, sessionDone:false, starsGained:0, awarded:false
};
function logContrast(){ S.trail.push({ t:S.elapsed, c:cfg.strong }); if(S.trail.length>900) S.trail.splice(0,400); }

/* ---------------- canvas ---------------- */
var cv = document.getElementById('view');
var scene = document.createElement('canvas');
var ctx = scene.getContext('2d', {alpha:false});
var VW=0, VH=0, DPR=1;

/* --- WebGL output stage: barrel pre-distortion for the viewer lenses --- */
var gl=null, out2d=null, GLP=null, GLU={}, GLTEX=null;
var VSRC = 'attribute vec2 p; varying vec2 v; void main(){ v = vec2(p.x*0.5+0.5, 0.5 - p.y*0.5); gl_Position = vec4(p,0.0,1.0); }';
var FSRC = [
'precision highp float;',
'varying vec2 v;',
'uniform sampler2D tex;',
'uniform float k1, k2, chroma, aspect, lensOff;',
/* local coords -> distorted source sample, normalised so the corner stays put */
'vec2 warp(vec2 lc, float sc){',
'  vec2 q = vec2(lc.x*aspect, lc.y);',
'  float r2 = dot(q,q);',
'  float f = 1.0 + k1*r2 + k2*r2*r2;',
'  float fm = 1.0 + k1 + k2;',
'  return lc * (f/fm) * sc;',
'}',
'void main(){',
'  float e = step(0.5, v.x);',
'  float cx = e*0.5 + 0.25 + (e>0.5 ? -lensOff : lensOff);',
'  vec2 lc = vec2((v.x - cx)/0.25, (v.y - 0.5)/0.5);',
'  vec2 gc = warp(lc, 1.0);',
'  vec2 rc = warp(lc, 1.0 + chroma);',
'  vec2 bc = warp(lc, 1.0 - chroma);',
'  vec2 base = vec2(cx, 0.5);',
'  vec2 sg = base + vec2(gc.x*0.25, gc.y*0.5);',
'  vec2 sr = base + vec2(rc.x*0.25, rc.y*0.5);',
'  vec2 sb = base + vec2(bc.x*0.25, bc.y*0.5);',
/* anything that would sample outside its own eye half stays black */
'  float lo = e*0.5, hi = lo + 0.5;',
'  float ok = step(lo, sg.x)*step(sg.x, hi)*step(0.0, sg.y)*step(sg.y, 1.0);',
'  vec3 col = vec3(texture2D(tex, clamp(sr, vec2(lo,0.0), vec2(hi,1.0))).r,',
'                  texture2D(tex, clamp(sg, vec2(lo,0.0), vec2(hi,1.0))).g,',
'                  texture2D(tex, clamp(sb, vec2(lo,0.0), vec2(hi,1.0))).b);',
'  gl_FragColor = vec4(col*ok, 1.0);',
'}'
].join('\n');

function sh(t,src){ var s=gl.createShader(t); gl.shaderSource(s,src); gl.compileShader(s); return s; }
function initGL(){
  try{
    gl = cv.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false})
      || cv.getContext('experimental-webgl',{alpha:false,antialias:false,depth:false,stencil:false});
  }catch(e){ gl=null; }
  if(!gl){ out2d = cv.getContext('2d',{alpha:false}); return false; }
  var vs=sh(gl.VERTEX_SHADER,VSRC), fs=sh(gl.FRAGMENT_SHADER,FSRC);
  GLP = gl.createProgram(); gl.attachShader(GLP,vs); gl.attachShader(GLP,fs); gl.linkProgram(GLP);
  if(!gl.getProgramParameter(GLP, gl.LINK_STATUS)){ gl=null; out2d = cv.getContext('2d',{alpha:false}); return false; }
  gl.useProgram(GLP);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(GLP,'p'); gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  ['k1','k2','chroma','aspect','lensOff','tex'].forEach(function(n){ GLU[n]=gl.getUniformLocation(GLP,n); });
  GLTEX = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, GLTEX);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(GLU.tex, 0);
  return true;
}
function present(){
  if(!gl){ if(out2d) out2d.drawImage(scene,0,0); return; }
  gl.viewport(0,0,cv.width,cv.height);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GLTEX);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE, scene);
  var on = cfg.lens !== 'off';
  gl.uniform1f(GLU.k1, on?cfg.k1:0); gl.uniform1f(GLU.k2, on?cfg.k2:0);
  gl.uniform1f(GLU.chroma, on?cfg.chroma:0);
  gl.uniform1f(GLU.aspect, (VW/2)/Math.max(VH,1));
  gl.uniform1f(GLU.lensOff, on ? (cfg.lensOff/Math.max(VW,1)) : 0);
  gl.drawArrays(gl.TRIANGLES,0,6);
}

function resize(){
  DPR = Math.min(window.devicePixelRatio||1, 2.5);
  VW = cv.clientWidth; VH = cv.clientHeight;
  var bw = Math.round(VW*DPR), bh = Math.round(VH*DPR);
  cv.width = bw; cv.height = bh;
  scene.width = bw; scene.height = bh;
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', function(){ setTimeout(resize,250); });

/* The warp magnifies the centre by 1/fn, so the scene is rendered at 1/fn to
   cancel it: standard overfill. Net apparent size at the centre stays 1:1. */
function lensZoom(){ return (cfg.lens==='off' || !gl) ? 1 : 1/(1 + cfg.k1 + cfg.k2); }
function viewportFor(eye){
  var half = VW/2;
  return { x: eye==='left'?0:half, y:0, w:half, h:VH };
}
/* ---------------- what "contrast" means ----------------
   The canvas blends in gamma-ENCODED sRGB values, so drawing at alpha a scales
   the encoded difference from the floor by exactly a — but not the LUMINANCE
   difference, which is what an eye responds to. Over the dungeon floor a
   sprite drawn at alpha 0.40 keeps roughly 67-87% of its full luminance
   Michelson contrast, and at 0.10 about 21-43%, depending on its colour.

   cfg.contrastScale picks which one cfg.strong names:
     'alpha'      (default) cfg.strong is the blend alpha, as it always was
     'luminance'  cfg.strong is the fraction of full luminance Michelson
                  contrast, averaged over the reference sprite colours below,
                  on an ideal sRGB display; stimAlpha() finds the alpha for it
   Either way the session record carries both numbers. Neither is a
   photometric measurement — real phones are not ideal sRGB displays. */
var CONTRAST_FLOOR = '#191e29';
var CONTRAST_REF = ['#5d9257', '#8f6bd6', '#cf4a3e', '#e8b13f', '#ece6d8', '#7a6c48', '#5aa8e8'];
var LUM_TABLE = null;
function srgbLin(v){ v /= 255; return v <= 0.04045 ? v/12.92 : Math.pow((v + 0.055)/1.055, 2.4); }
function hexRgb(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
function lumOf(rgb){ return 0.2126*srgbLin(rgb[0]) + 0.7152*srgbLin(rgb[1]) + 0.0722*srgbLin(rgb[2]); }
/* the fraction of full luminance contrast one colour keeps at alpha a over a floor */
function lumRatio(a, objHex, floorHex){
  var o = hexRgb(objHex), f = hexRgb(floorHex || CONTRAST_FLOOR), lf = lumOf(f);
  var mix = [a*o[0] + (1-a)*f[0], a*o[1] + (1-a)*f[1], a*o[2] + (1-a)*f[2]];
  var full = Math.abs(lumOf(o) - lf)/(lumOf(o) + lf), now = Math.abs(lumOf(mix) - lf)/(lumOf(mix) + lf);
  return full > 0 ? now/full : 0;
}
/* the reference colours at alpha a: mean, min and max of that fraction */
function lumContrastOf(a){
  var sum = 0, lo = 1, hi = 0, i, r;
  for(i=0; i<CONTRAST_REF.length; i++){ r = lumRatio(a, CONTRAST_REF[i]); sum += r; lo = Math.min(lo, r); hi = Math.max(hi, r); }
  return { mean:sum/CONTRAST_REF.length, min:lo, max:hi };
}
/* the alpha to draw at for a stronger-eye contrast c, in whichever scale is chosen */
function stimAlpha(c){
  if(cfg.contrastScale !== 'luminance') return c;
  if(c <= 0) return 0;
  if(c >= 1) return 1;
  if(!LUM_TABLE){ LUM_TABLE = []; for(var i=0; i<=1000; i++) LUM_TABLE.push(lumContrastOf(i/1000).mean); }
  var lo = 0, hi = 1000;
  while(hi - lo > 1){ var mid = (lo + hi) >> 1; if(LUM_TABLE[mid] < c) lo = mid; else hi = mid; }
  return hi/1000;
}
/* the estimated luminance-contrast fraction the stronger eye is actually getting */
function strongLumContrast(){ return cfg.contrastScale === 'luminance' ? cfg.strong : lumContrastOf(cfg.strong).mean; }

function alphaFor(eye, layer){
  var weak = (eye===cfg.weakEye), s = stimAlpha(cfg.strong);
  if(layer==='world' || layer==='player' || layer==='hud') return 1;
  if(cfg.mode==='split'){
    if(layer==='foe')  return weak?1:0;
    if(layer==='item') return weak?0:stimAlpha(Math.max(cfg.strong, TUNING.therapy.splitItemFloor));
    /* clues — plates, sparkles, cracks, eye switches — are the things worth
       finding, so in forced fusion they belong to the eye doing the work */
    if(layer==='clue') return weak?1:0;
  }
  return weak?1:s;
}

/* ---------------- tiles ---------------- */
var T_FLOOR = 0, T_WALL = 1, T_DOOR = 3, T_LOCK = 4, T_BUSH = 5, T_POT = 6, T_CRACK = 9;
function tileSolid(t){ return t === T_WALL || t === 2 || t === T_LOCK || t === T_BUSH || t === T_POT || t === T_CRACK; }

/* ---------------- dungeon ---------------- */
function blank(){ var g=[],y,x; for(y=0;y<RH;y++){ g.push([]); for(x=0;x<RW;x++) g[y].push( (x===0||y===0||x===RW-1||y===RH-1) ? 1 : 0 ); } return g; }
var CC = 6, CR = 5; // centre col / row

var PATTERNS = {
  empty: function(){},
  pillars: function(g){ var ps=[[3,3],[9,3],[3,7],[9,7]]; ps.forEach(function(p){ g[p[1]][p[0]]=1; g[p[1]+1][p[0]]=1; }); },
  cross: function(g){ for(var x=4;x<=8;x++){ if(x!==6){ g[3][x]=1; g[7][x]=1; } } g[5][2]=1; g[5][10]=1; },
  ring: function(g){ var i; for(i=4;i<=8;i++){ g[3][i]=1; g[7][i]=1; } for(i=4;i<=6;i++){ g[i][4]=1; g[i][8]=1; } g[5][4]=0; g[5][8]=0; },
  maze: function(g){ var y; for(y=2;y<=4;y++) g[y][4]=1; for(y=6;y<=8;y++) g[y][4]=1; for(y=2;y<=4;y++) g[y][8]=1; for(y=6;y<=8;y++) g[y][8]=1; g[2][6]=1; g[8][6]=1; }
};

/* Island 1, hand-built. Nine of its enemies used to spawn INSIDE pattern walls
   (every Rookery and Reliquary foe sat on the ring's wall tiles), frozen in the
   stone and harmless. They are on floor tiles now, and tests/smoke.mjs checks
   every spawn on every island so it cannot come back. */
var HOME_ROOMS = {
  '1,2':{ name:'Threshold',       doors:'new',  pat:'empty',   foes:[['grub',6,3],['hopper',9,5]],
          deco:[['bush',1,1],['bush',2,1],['bush',1,2],['bush',11,1],['bush',10,1],['pot',11,2],['bush',1,9],['bush',1,8],['pot',11,9],['bush',10,9]],
          objs:[{k:'sparkle', x:3, y:8, secret:true}] },
  '0,2':{ name:'The Cistern',     doors:'ne',   pat:'pillars', foes:[['grub',3,5],['grub',9,5],['grub',6,8]], drop:'heart',
          deco:[['pot',1,1],['pot',2,1],['pot',1,9],['pot',2,9],['pot',11,9]],
          objs:[{k:'eye', x:9, y:0}, {k:'chest', x:10, y:1, item:'coins', amount:15, hidden:'eye', secret:true}] },
  '2,2':{ name:'Rookery',         doors:'nw',   pat:'ring',    foes:[['bat',3,2],['bat',9,2],['bat',6,8]],
          walls:[[11,2],[10,2]],
          deco:[['bush',1,9],['bush',2,9],['bush',1,8]],
          objs:[{k:'crack', x:10, y:1}, {k:'chest', x:11, y:1, item:'coins', amount:15, secret:true}] },
  '1,1':{ name:'The Crossing',    doors:'nsew', pat:'cross',   foes:[['bat',3,3],['bat',9,7],['grub',6,5],['slime',9,3]], lock:{n:'boss'},
          deco:[['pot',1,1],['pot',11,1],['pot',1,9],['pot',11,9]] },
  '0,1':{ name:'Watchpost',       doors:'nse',  pat:'pillars', foes:[['sentry',2,3],['sentry',10,7],['grub',6,5],['hopper',6,8]],
          deco:[['bush',1,1],['bush',1,9],['bush',11,1]] },
  '2,1':{ name:'Long Gallery',    doors:'nsw',  pat:'maze',    foes:[['sentry',6,3],['bat',3,6],['bat',9,6],['grub',6,7]], lock:{n:'small'}, drop:'smallkey' },
  '0,0':{ name:'Reliquary',       doors:'s',    pat:'ring',    foes:[['sentry',4,2],['sentry',8,2],['grub',4,8],['grub',8,8]], drop:'bosskey' },
  '2,0':{ name:'The Cache',       doors:'s',    pat:'empty',   foes:[], puzzle:'push',
          deco:[['pot',1,1],['pot',11,1],['pot',1,9]],
          objs:[{k:'block', x:4, y:4}, {k:'plate', x:4, y:7}, {k:'chest', x:8, y:4, item:'vessel', hidden:'puzzle'}] },
  '1,0':{ name:"Warden's Floor",  doors:'s',    pat:'empty',   foes:[['boss',6,3]], boss:true }
};
var ROOMS = HOME_ROOMS;
var DIRV = { n:[0,-1], s:[0,1], e:[1,0], w:[-1,0] };

var roomState = {};
function rs(key){
  if(!roomState[key]) roomState[key] = { cleared:false, taken:false, unlocked:{},
    cut:{}, cracked:{}, opened:{}, dug:{}, lit:{}, solved:false, eyeHit:false, blocks:null };
  return roomState[key];
}

/* Pure: a spec plus its saved state gives a tile grid. The island generator
   validates candidate rooms through this without touching live game state. */
function roomGrid(spec, st){
  var g = blank(), i;
  PATTERNS[spec.pat](g);
  (spec.walls || []).forEach(function(w){ g[w[1]][w[0]] = T_WALL; });
  (spec.deco || []).forEach(function(d){
    if(st && st.cut[d[1] + ',' + d[2]]) return;
    g[d[2]][d[1]] = d[0] === 'pot' ? T_POT : T_BUSH;
  });
  (spec.objs || []).forEach(function(o){
    if(o.k === 'crack') g[o.y][o.x] = (st && st.cracked[o.x + ',' + o.y]) ? T_FLOOR : T_CRACK;
  });
  'nsew'.split('').forEach(function(d){
    if(spec.doors.indexOf(d) < 0) return;
    var locked = spec.lock && spec.lock[d] && !(st && st.unlocked[d]);
    var t = locked ? T_LOCK : T_DOOR;
    if(d === 'n') for(i=CC-1;i<=CC+1;i++) g[0][i] = t;
    if(d === 's') for(i=CC-1;i<=CC+1;i++) g[RH-1][i] = t;
    if(d === 'w') for(i=CR-1;i<=CR+1;i++) g[i][0] = t;
    if(d === 'e') for(i=CR-1;i<=CR+1;i++) g[i][RW-1] = t;
  });
  return g;
}
function buildGrid(key){ return roomGrid(ROOMS[key], rs(key)); }

/* ---------------- game state ---------------- */
var G = null;
function kidMaxHp(){
  return TUNING.player.maxHp + (cfg.kidMode ? TUNING.session.extraHearts * 2 : 0);
}
function newGame(islandId){
  loadIsland(islandId || CUR_ISLAND || 1);
  G = {
    key:ISLAND.start, grid:null, spec:null,
    p:{ x:WW/2, y:WH/2+30, w:11, h:11, vx:0, vy:0, face:'n', hp:kidMaxHp(), maxhp:kidMaxHp(), inv:0, atk:0, flash:0 },
    foes:[], shots:[], items:[], fx:[], objs:[], bombs:[], arrows:[],
    keys:0, bossKey:false, cleanRoom:true, coins:0, tool:firstTool(), toolCd:0, hold:null,
    sealed:false, pushT:0, pushDir:null,
    fade:0, fadeDir:0, pending:null, won:false, dead:false, t:0
  };
  /* stats are cleared BEFORE the first room is entered, so the opening room
     shows up in the log like every other one */
  resetRunStats('islands');
  roomState = {};
  enterRoom(ISLAND.start, null);
  logContrast();
}

/* Every activity — the islands and each arcade game — starts a run here, so the
   session log, the stars and the exposure telemetry mean the same thing in all
   of them. In an arcade game a "room" is a segment: a level part, a wave, a
   checkpoint section. */
function resetRunStats(activity){
  studyBeforeReset();
  S.started = performance.now(); S.elapsed=0; S.rooms=0; S.cleanRooms=0; S.hits=0; S.kills=0;
  S.trail=[]; S.checks=[]; S.roomLog=[]; S.stepsDown=0; S.stepsUp=0; S.ended=false; S.won=false;
  S.knockdowns=0; S.sessionDone=false; S.starsGained=0; S.warned=false; S.awarded=false;
  S.coins=0; S.secrets=0; S.firstLight=false; S.sig={ foe:0, item:0, clue:0, any:0 };
  S.activity = activity || 'islands'; S.bonusStars = 0; S.levelStars = 0; S.level = 0; S.score = 0; S.place = 0;
}

function enterRoom(key, fromDir){
  G.key = key; G.spec = ROOMS[key]; G.grid = buildGrid(key);
  G.foes = []; G.shots = []; G.items = []; G.fx = []; G.bombs = []; G.arrows = [];
  var st = rs(key);
  if(!st.cleared){
    (G.spec.foes||[]).forEach(function(f){ G.foes.push(mkFoe(f[0], f[1]*TS+TS/2, f[2]*TS+TS/2, f[3])); });
  }
  if(G.spec.drop && !st.taken && (st.cleared || G.spec.dropNow)) spawnDrop(key);
  if(G.foes.length===0){ st.cleared = true; }
  G.cleanRoom = true; stairSegment();
  G.sealed = !!(G.spec.seal && G.foes.length);
  worldEnterRoom(st);
  if(fromDir){
    var p=G.p;
    if(fromDir==='n'){ p.x=CC*TS+TS/2; p.y=WH-TS-6; p.face='n'; }
    if(fromDir==='s'){ p.x=CC*TS+TS/2; p.y=TS+6;    p.face='s'; }
    if(fromDir==='w'){ p.x=WW-TS-6;    p.y=CR*TS+TS/2; p.face='w'; }
    if(fromDir==='e'){ p.x=TS+6;       p.y=CR*TS+TS/2; p.face='e'; }
    p.vx=p.vy=0;
  }
  S.rooms++;
  S.roomLog.push({ room:key, name:G.spec.name, inAt:Math.round(S.elapsed/1000),
                   foes:G.foes.length, hitsBefore:S.hits, contrast:+cfg.strong.toFixed(2) });
  owlEnterRoom();
  sittingBreakpoint();
}
function spawnDrop(key){
  var k = ROOMS[key].drop;
  G.items.push({ type:k, x:WW/2, y:WH/2, r:6, bob:0 });
}
