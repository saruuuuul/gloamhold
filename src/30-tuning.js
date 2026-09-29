
/* ============================================================
   TUNING — every balance, therapy, audio and optics number in one
   place. The engine reads these at runtime, so the dev panel can
   change them mid-session without a reload and without a rebuild.
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
  feel: { toastFrames:140, fadeSpeed:0.09 },

  /* ---- stereo menu chrome ----
     Sizes are in viewport units (1 unit = 1% of the smaller side of one
     eye's viewport), so a menu reads the same on a 5" phone and a tablet. */
  menu: {
    rowHeight: 9.5, rowGap: 1.4, titleSize: 8.5, labelSize: 5.0, hintSize: 3.4,
    iconSize: 7.0, padX: 5.0, cursorPulse: 0.11, cursorWidth: 0.7,
    repeatDelay: 26, repeatRate: 7, maxRows: 7,
    safeInsetLens: 0.13, safeInsetFlat: 0.035
  },

  /* ---- sound ----
     Nothing is loaded; these drive oscillators in 35-audio.js. */
  audio: {
    master: 0.5, game: 0.9, ui: 0.55,
    swingHz: 300, hitHz: 200, hurtHz: 180, pickupHz: 660,
    uiMoveHz: 420, uiOkHz: 620, uiBackHz: 380,
    clickDur: 0.05, tailDur: 0.22,
    speechRate: 0.85, speechPitch: 1.15
  },

  /* ---- the child setup wizard ----
     huntRounds descending presentations of a target shown to the STRONGER
     eye only, each at huntStepFactor of the last. The lowest one the child
     still catches, backed off one step, becomes the starting contrast.
     It is a detection threshold, not a clinical measurement. */
  kid: {
    huntRounds: 6, huntStartContrast: 0.9, huntStepFactor: 0.72, huntFloor: 0.08,
    huntMissesToStop: 2, targetHoldFrames: 150, waitMinFrames: 40, waitVarFrames: 70,
    feedbackFrames: 28, rewardFrames: 170, safetyBackoff: 1.0,
    /* Catch trials: rounds where nothing is presented at all. A child who
       simply mashes the button will press on these too, and that is the only
       way to tell a real threshold from mashing. Above falseAlarmLimit the
       run is discarded rather than reported as a number.
       catchTrials is a COUNT, not a rate: leaving it to a per-round
       probability meant a short run could arm only one blank and wave a
       masher straight through. Exactly this many are now interleaved. */
    catchTrials: 3, falseAlarmLimit: 2
  },

  /* ---- session shape: difficulty, length and rewards ----
     Compliance is what this whole thing lives or dies on, so these matter as
     much as the therapy numbers. In child mode the player cannot die and a
     bad room can only cost stepUpsPerRoom steps of contrast — otherwise a
     struggling child gets LESS dichoptic load for struggling, which is
     exactly backwards. */
  session: {
    minutes: 12, warnMinutes: 2,
    extraHearts: 3, foeSpeedScale: 0.7, foeHpScale: 0.75,
    knockdownHp: 4, knockdownIframes: 160, stepUpsPerRoom: 1,
    starsFinish: 2, starsCleanRoom: 1, starsImproved: 2,
    graceMinutes: 2          /* once time is up, finish at the next natural break, or after this */
  },

  /* ---- the world: things to cut, push, light and dig ---- */
  world: {
    bushCoinChance: 0.45, potCoinChance: 0.6, heartChance: 0.18,
    coinMagnetRange: 24, coinMagnetPull: 0.2, coinBurst: 1.6, coinFriction: 0.86,
    pushFrames: 14, pushSlideFrames: 12, holdFrames: 84,
    sparkleCoins: 6, secretChestCoins: 15, digRange: 13
  },

  /* ---- tools, found on islands 2, 3 and 5 ---- */
  tools: {
    shieldSlow: 0.55, bombFuse: 90, bombRadius: 26, bombDamage: 3, bombCooldown: 40,
    arrowSpeed: 3.2, arrowLife: 90, arrowDamage: 1, arrowCooldown: 22
  },

  /* ---- the owl: follows, speaks, and hints when he is stuck ---- */
  owl: { follow: 0.07, damping: 0.8, hintAfterSec: 22, speakGapSec: 6, bobRate: 0.07 },

  /* ---- the sea ---- */
  islands: {
    roomsMin: 5, roomsMax: 7, foesBase: 2, foesPerIsland: 0.5, foesMax: 5,
    bossHpPerIsland: 3, decoMin: 3, decoMax: 7,
    unlockBase: 4, unlockStep: 6, unlockGrow: 1,
    starsIsland: 5, starsSecret: 1, coinsPerStar: 20,
    winDelayFrames: 110, sailFrames: 70
  }
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
