
/* ============================================================
   TUNING — every balance, therapy and optics number in one place.
   The engine reads these at runtime, so the dev panel can change
   them mid-session without a reload and without a rebuild.
   Add a numeric field here and the dev panel grows a slider for it
   automatically; no panel code to write.
   ============================================================ */
var TUNING_DEFAULTS = {
  player: {
    speed: 1.15, accel: 0.45, friction: 0.72,
    maxHp: 6, iframes: 70, flashFrames: 18, knockback: 2.6,
    atkFrames: 20, atkActiveFrom: 12,
    swordLength: 18, swordWidth: 9, swordReach: 10,
    attackSlow: 0.25
  },
  grub:   { hp:3, w:13, h:13, speed:0.34, damage:1, accel:0.30, friction:0.85, dutyCycle:110, dutyMove:60 },
  bat:    { hp:2, w:11, h:11, speed:0.92, damage:1, accel:0.25, friction:0.88, wobble:0.55, wobbleRate:0.09 },
  sentry: { hp:4, w:15, h:15, damage:1, friction:0.80, cooldown:95, shotSpeed:1.5, shotLife:220 },
  boss:   { hp:18, w:26, h:26, speed:0.55, damage:2, chargeFrames:55, restFrames:60, chargeBoost:2.1,
            spawnBelowHp:9, maxSpawns:3, spawnEvery:150 },
  combat: { foeHurtFrames:14, foeKnockback:2.2 },
  therapy: {
    stepDownFactor: 0.85,     /* contrast x this after a clean room */
    stepUpFactor: 1.18,       /* contrast x this after taking a hit */
    stepUpFloorBump: 0.02,
    minContrast: 0.05,
    splitItemFloor: 0.35,     /* strong-eye items never fall below this in split mode */
    checkReminderMin: 6,      /* minutes between nonius-check nudges */
    quantise: 0.05
  },
  optics: {
    presets: {
      off:       { k1:0,    k2:0,    chroma:0     },
      cardboard: { k1:0.22, k2:0.10, chroma:0.003 },
      strong:    { k1:0.34, k2:0.22, chroma:0.006 }
    }
  },
  feel: { toastFrames:140, fadeSpeed:0.09 }
};

var TUNING = JSON.parse(JSON.stringify(TUNING_DEFAULTS));

/* live handles so hot edits land without a reload */
function T(path){
  var p = path.split('.'), o = TUNING, i;
  for(i=0;i<p.length;i++){ if(o==null) return undefined; o = o[p[i]]; }
  return o;
}
function setT(path, val){
  var p = path.split('.'), o = TUNING, i;
  for(i=0;i<p.length-1;i++){ if(o[p[i]]==null) o[p[i]]={}; o = o[p[i]]; }
  o[p[p.length-1]] = val;
}
function walkTuning(obj, prefix, out){
  out = out || []; prefix = prefix || '';
  for(var k in obj){
    var v = obj[k], path = prefix ? prefix+'.'+k : k;
    if(typeof v === 'number') out.push({ path:path, value:v });
    else if(v && typeof v === 'object') walkTuning(v, path, out);
  }
  return out;
}
function loadTuning(){
  try{
    var raw = localStorage.getItem('gloamhold.tuning');
    if(!raw) return;
    var o = JSON.parse(raw);
    (function merge(dst, src){
      for(var k in src){
        if(src[k] && typeof src[k]==='object' && dst[k] && typeof dst[k]==='object') merge(dst[k], src[k]);
        else if(typeof src[k] === typeof dst[k]) dst[k] = src[k];
      }
    })(TUNING, o);
  }catch(e){}
}
function saveTuning(){ try{ localStorage.setItem('gloamhold.tuning', JSON.stringify(TUNING)); }catch(e){} }
function resetTuning(){ TUNING = JSON.parse(JSON.stringify(TUNING_DEFAULTS)); saveTuning(); }
