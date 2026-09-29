
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
    attackSlow: 0.25,
    /* hold the action button this long, let go, and the sword goes all the way round */
    spinChargeFrames: 36, spinFrames: 18, spinRadius: 21
  },
  grub:   { hp:3, w:13, h:13, speed:0.34, damage:1, accel:0.30, friction:0.85, dutyCycle:110, dutyMove:60 },
  bat:    { hp:2, w:11, h:11, speed:0.92, damage:1, accel:0.25, friction:0.88, wobble:0.55, wobbleRate:0.09 },
  sentry: { hp:4, w:15, h:15, damage:1, friction:0.80, cooldown:95, shotSpeed:1.5, shotLife:220 },
  /* leaps at him in arcs; only dangerous once it has landed */
  hopper: { hp:2, w:11, h:11, speed:1.5, damage:1, friction:0.82, hopEvery:84, hopFrames:30, hopHeight:10 },
  /* slow, and splits in two when it is beaten — the halves are quick */
  slime:  { hp:3, w:13, h:13, speed:0.30, damage:1, accel:0.28, friction:0.85, smallHp:1, smallSpeed:0.55 },
  boss:   { hp:18, w:26, h:26, speed:0.55, damage:2, chargeFrames:55, restFrames:60, chargeBoost:2.1,
            spawnBelowHp:9, maxSpawns:3, spawnEvery:150,
            /* every island's warden fights differently: charge, ring, summon, leap */
            windupFrames:42, ringShots:8, ringShotSpeed:1.15, summonCount:2, summonMax:4,
            leapFrames:44, leapHeight:28, quakeRadius:34, quakeFrames:18 },
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
    safeInsetLens: 0.13, safeInsetFlat: 0.035,
    grownupHoldFrames: 90      /* hold B this long on the game picker for the grown-up screen */
  },

  /* ---- sound ----
     Nothing is loaded; these drive oscillators in 35-audio.js. */
  audio: {
    master: 0.5, game: 0.9, ui: 0.55,
    swingHz: 300, hitHz: 200, hurtHz: 180, pickupHz: 660,
    uiMoveHz: 420, uiOkHz: 620, uiBackHz: 380,
    clickDur: 0.05, tailDur: 0.22,
    speechRate: 0.85, speechPitch: 1.15,
    music: 0.4                 /* the carol's bus, under game sounds */
  },

  /* ---- Carol of the Bells, synthesised, in intense moments ----
     Tempo rises with intensity; startAt is the intensity that brings it in,
     holdSec how long it keeps playing after things calm down. */
  music: {
    bpmLow: 140, bpmHigh: 176, startAt: 0.6, holdSec: 6, lookahead: 0.16,
    leadVol: 0.2, bellVol: 0.12, bassVol: 0.34, lineVol: 0.12, tickVol: 0.05
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
    minutes: 0, warnMinutes: 2,  /* 0 = play until the grown-up stops; set a length on the grown-up screen */
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
    sparkleCoins: 6, secretChestCoins: 15, digRange: 13,
    /* glow-bugs: drift on the clue layer in ordinary rooms, one coin each */
    bugsMin: 2, bugsMax: 4, bugSpeed: 0.22, bugCatch: 9
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
    winDelayFrames: 110, sailFrames: 70,
    extraFoes: 1               /* added per ordinary room after generation, from their own seed */
  },

  /* ---- the arcade games, shared ---- */
  arcade: { speakGapSec: 4, endDelayFrames: 100, hitstopFrames: 4, bannerFrames: 90 },

  /* ---- the paint shop: coins buy colours for the hero, truck, ship and car ---- */
  shop: { basePrice: 20, priceStep: 15 },

  /* ---- Blocks ----
     gravity is frames per row; lines to finish a level = linesBase + level*linesStep.
     A segment (one staircase step) is segLines lines. */
  blocks: {
    gravityBase: 50, gravityStep: 4, gravityMin: 6, kidGravityScale: 1.7,
    softFrames: 3, dasFrames: 12, arrFrames: 4, lockFrames: 32, lockResets: 12, clearFrames: 18,
    linesBase: 6, linesStep: 2, segLines: 4, gemChance: 0.3, bombEvery: 14
  },

  /* ---- Space Rocks ---- speeds in field units per frame */
  rocks: {
    shipAccel: 0.16, shipMax: 1.9, shipFriction: 0.92, fireEvery: 11, rapidEvery: 5,
    bulletSpeed: 3.4, bulletLife: 46, shieldFrames: 130, shieldCooldown: 300, invFrames: 110,
    rockSpeed: 0.34, rockSpeedStep: 0.04, kidRockScale: 0.8, wavesPerLevel: 3,
    bigR: 14, midR: 9, smallR: 5, saucerEvery: 620, saucerHp: 3, saucerShotEvery: 95,
    cometSpeed: 1.5, kingHp: 10, kingSpawnEvery: 170, powerEvery: 700, powerLife: 560,
    powerFrames: 600, lives: 3, chainFrames: 60
  },

  /* ---- Racer (top-down) ---- distances in field units */
  race: {
    roadW: 84, lanes: 4, vmax: 2.6, kidVmax: 2.1, accel: 0.03, brake: 0.08, drag: 0.004,
    steer: 1.35, grassDrag: 0.05, iceGrip: 0.25, rivals: 5, rivalSpeed: 1.95, rivalStep: 0.05,
    kidRivalScale: 0.86, lenBase: 3200, lenStep: 400, crashFrames: 42, oilFrames: 30,
    jumpFrames: 34, jumpHeight: 9, boostFrames: 60, nitroFrames: 90, boostGain: 1.45, curveAmp: 26
  },

  /* ---- Gator Truck (side view) ---- */
  truck: {
    gravity: 0.12, moonGravity: 0.05, accel: 0.04, maxSpeed: 1.7, miniSpeed: 1.9,
    subLandSpeed: 0.45, subSwim: 0.05, subMax: 1.2, hopV: 2.6, miniHopV: 2.1, drag: 0.99,
    lean: 0.010, leanDamp: 0.92, landTol: 1.2, flipStarsMax: 3, crashFrames: 60, stageBase: 2200, stageStep: 250,
    hintSec: 4, autoSec: 9, flipStars: 1, crushCoins: 3, bounce: 1.4
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
/* Saved tuning holds every number, so a changed default never reaches a phone
   that has ever saved it. A revision bump drops just the stored values whose
   defaults moved on purpose. Rev 2: the session no longer ends at 12 minutes. */
var TUNING_REV = 2;
function loadTuning(){
  try{
    var raw = localStorage.getItem('gloamhold.tuning');
    var rev = +(localStorage.getItem('gloamhold.tuningRev') || 0);
    localStorage.setItem('gloamhold.tuningRev', String(TUNING_REV));
    if(!raw) return;
    var o = JSON.parse(raw);
    if(rev < 2 && o.session) delete o.session.minutes;
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
