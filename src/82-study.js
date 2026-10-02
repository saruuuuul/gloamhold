
/* ============================================================
   STUDY DATA — what a clinic or research group needs in order to
   evaluate this: every run kept on the phone, exportable as JSON
   and CSV, tagged with a pseudonymous participant code and a
   protocol id, and a way to LOCK the settings a protocol fixes so
   nobody changes them halfway through.

   Nothing leaves the phone. There is no account, no network call
   and no name: the participant code is random unless the study
   team types its own. The grown-up exports by copying or saving a
   file from the flat panel, and can delete the history there.

   It records what the game did — contrast over time, segments,
   hits, alignment answers, how long each per-eye layer had
   something on it. It does not measure vision, and nothing in it
   is an outcome measure. RESEARCH.md says how to read it.
   ============================================================ */
var HIST_KEY = 'gloamhold.history', PENDING_KEY = 'gloamhold.pending';
var HIST = { v:1, runs:[], tunings:{} };

function histLoad(){
  try{
    var raw = localStorage.getItem(HIST_KEY);
    if(raw){ var o = JSON.parse(raw); if(o && o.runs) HIST = { v:1, runs:o.runs, tunings:o.tunings || {} }; }
  }catch(e){}
}
function histSave(){
  try{ localStorage.setItem(HIST_KEY, JSON.stringify(HIST)); return true; }
  catch(e){
    /* storage full: drop the oldest tenth and try once more, rather than lose this run */
    HIST.runs.splice(0, Math.max(1, Math.floor(HIST.runs.length/10)));
    try{ localStorage.setItem(HIST_KEY, JSON.stringify(HIST)); return true; }catch(e2){ return false; }
  }
}
function studyRunCount(){ return HIST.runs.length; }

/* a short stable id for a tuning set, so 500 runs do not store 500 copies of it */
function tuningId(){
  var s = JSON.stringify(TUNING), h = 5381, i;
  for(i=0; i<s.length; i++) h = ((h*33) ^ s.charCodeAt(i)) >>> 0;
  var id = 't' + h.toString(36);
  if(!HIST.tunings[id]) HIST.tunings[id] = JSON.parse(s);
  return id;
}
function newRunId(){ return 'r' + Date.now().toString(36) + Math.floor(Math.random()*1296).toString(36); }
function ensureParticipant(){
  if(cfg.participant) return;
  var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'P-', i;
  for(i=0; i<5; i++) s += a[Math.floor(Math.random()*a.length)];
  cfg.participant = s; saveCfg();
}

/* the run as it is right now, in the shape the history keeps */
function runRecord(end){
  var r = sessionRecord();
  delete r.tuning;
  r.tuningId = tuningId();
  r.runId = S.runId || newRunId();
  r.participant = cfg.participant;
  r.protocol = cfg.protocol || '';
  r.startedAt = S.startedAt ? new Date(S.startedAt).toISOString() : null;
  r.endedAt = new Date().toISOString();
  r.end = end;
  return r;
}
/* Keep this run in the history, once. Runs shorter than study.minRunSec (an
   accidental tap into a game) are not worth a row. */
function archiveRun(end){
  if(S.archived) return;
  S.archived = true;
  try{ localStorage.removeItem(PENDING_KEY); }catch(e){}
  if(S.elapsed < TUNING.study.minRunSec*1000) return;
  HIST.runs.push(runRecord(end));
  var max = Math.round(TUNING.study.maxRuns);
  if(HIST.runs.length > max) HIST.runs.splice(0, HIST.runs.length - max);
  histSave();
  studyPanelSync();
}
/* called from resetRunStats(): a run that is replaced without ending (TRY
   AGAIN, a new game started from a menu) is still kept */
function studyBeforeReset(){
  if(S.runId && !S.archived && S.elapsed > 0) archiveRun(S.won ? 'won' : 'replaced');
  S.runId = newRunId(); S.startedAt = Date.now(); S.archived = false;
}
/* A phone that is put away or closed mid-run never reaches an end screen.
   The run so far is parked here and filed as 'interrupted' on the next launch
   — or replaced by its proper ending if play carries on. */
function savePending(){
  if(!LIVE || S.archived || S.elapsed < TUNING.study.minRunSec*1000) return;
  try{ localStorage.setItem(PENDING_KEY, JSON.stringify(runRecord('interrupted'))); }catch(e){}
}
function recoverPending(){
  try{
    var raw = localStorage.getItem(PENDING_KEY);
    if(!raw) return;
    localStorage.removeItem(PENDING_KEY);
    var r = JSON.parse(raw);
    if(r && r.runId && !HIST.runs.some(function(x){ return x.runId === r.runId; })){ HIST.runs.push(r); histSave(); }
  }catch(e){}
}

/* ---------------- export ---------------- */
function studyExport(){
  return { format:'gloamhold-history', version:1, exportedAt:new Date().toISOString(), build:BUILD,
           participant:cfg.participant, protocol:cfg.protocol || '', locked:!!cfg.locked,
           note:'Game telemetry, not a vision measurement. See RESEARCH.md for every field.',
           runs:HIST.runs, tunings:HIST.tunings };
}
function csvCell(v){
  if(v == null) return '';
  var s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csvRows(head, rows){ return [head.join(',')].concat(rows.map(function(r){ return r.map(csvCell).join(','); })).join('\n') + '\n'; }
var RUN_COLUMNS = ['run_id','participant','protocol','build','started_at','ended_at','end','activity','level','island',
  'duration_sec','weak_eye','mode','adaptive','child_mode','contrast_scale','contrast_start','contrast_end','contrast_best',
  'contrast_end_lum_est','segments','segments_clean','hits','knockdowns','steps_down','steps_up',
  'exposure_foe_sec','exposure_item_sec','exposure_clue_sec','exposure_any_sec','exposure_any_frac',
  'nonius_checks','nonius_both','nonius_strong_gone','nonius_weak_gone','won','stars_gained','tuning_id'];
function runsCsv(){
  return csvRows(RUN_COLUMNS, HIST.runs.map(function(r){
    var st = r.settings || {}, o = r.outcome || {}, x = r.exposure || {}, n = r.noniusChecks || [];
    var count = function(a){ return n.filter(function(c){ return c.answer === a; }).length; };
    return [r.runId, r.participant, r.protocol, r.build, r.startedAt, r.endedAt, r.end, r.activity, o.level, o.island,
      o.elapsedSec, st.weakEye, st.mode, st.adapt, st.kidMode, st.contrastScale, o.contrastStart, o.contrastEnd, o.contrastBest,
      o.contrastEndLumEst, o.roomsEntered, o.roomsClean, o.hits, o.knockdowns, o.stepsDown, o.stepsUp,
      x.foeSec, x.itemSec, x.clueSec, x.anySec, x.anyFrac,
      n.length, count(1), count(2), count(3), o.endedWon, o.starsGained, r.tuningId];
  }));
}
var SEGMENT_COLUMNS = ['run_id','participant','activity','index','name','in_sec','cleared_sec','clean','hits_taken','contrast_at_start'];
function segmentsCsv(){
  var rows = [];
  HIST.runs.forEach(function(r){
    (r.rooms || []).forEach(function(s, i){
      rows.push([r.runId, r.participant, r.activity, i, s.name, s.inAt, s.clearedAt, s.clean, s.hitsTaken, s.contrast]);
    });
  });
  return csvRows(SEGMENT_COLUMNS, rows);
}
function studyCopy(text, what){
  var note = el('studyNote');
  function ok(){ note.textContent = what + ' copied (' + HIST.runs.length + ' runs).'; }
  function fail(){ var b = el('studyOut'); b.hidden = false; b.value = text; b.focus(); b.select(); note.textContent = 'Clipboard blocked — ' + what + ' is in the box below, selected; copy it by hand.'; }
  try{
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fail);
    else fail();
  }catch(e){ fail(); }
}
function studySaveFile(){
  try{
    var blob = new Blob([JSON.stringify(studyExport(), null, 1)], { type:'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gloamhold-' + (cfg.participant || 'history') + '-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    el('studyNote').textContent = 'Saved to your downloads.';
  }catch(e){ el('studyNote').textContent = 'This browser blocked the download — use Copy instead.'; }
}

/* ---------------- protocol and lock ----------------
   A protocol is a small JSON the study team hands out:
     { "protocol": { "id":"STUDY-01", "lock":true,
                     "cfg":{ "weakEye":"right", "strong":0.6, "mode":"rebalance", "adapt":true,
                             "kidMode":true, "contrastScale":"luminance" },
                     "tuning":{ "therapy":{ "stepDownFactor":0.9 }, "session":{ "minutes":15 } } } }
   Only the settings a protocol is about can be set this way. */
var PROTOCOL_CFG = ['weakEye', 'strong', 'mode', 'adapt', 'kidMode', 'contrastScale'];
function applyProtocol(pr){
  if(!pr || typeof pr.id !== 'string' || !pr.id.trim()) throw new Error('a protocol needs an "id"');
  var c = pr.cfg || {}, k;
  for(k in c){
    if(PROTOCOL_CFG.indexOf(k) < 0) throw new Error('"' + k + '" cannot be set by a protocol');
    if(typeof c[k] !== typeof cfg[k]) throw new Error('"' + k + '" should be a ' + typeof cfg[k]);
  }
  if('weakEye' in c && c.weakEye !== 'left' && c.weakEye !== 'right') throw new Error('weakEye is "left" or "right"');
  if('mode' in c && c.mode !== 'rebalance' && c.mode !== 'split') throw new Error('mode is "rebalance" or "split"');
  if('contrastScale' in c && c.contrastScale !== 'alpha' && c.contrastScale !== 'luminance') throw new Error('contrastScale is "alpha" or "luminance"');
  if('strong' in c && !(c.strong >= 0.05 && c.strong <= 1)) throw new Error('strong is between 0.05 and 1');
  for(k in c) cfg[k] = c[k];
  if(pr.tuning) (function merge(dst, src){
    for(var key in src){
      if(src[key] && typeof src[key] === 'object' && dst[key] && typeof dst[key] === 'object') merge(dst[key], src[key]);
      else if(typeof src[key] === typeof dst[key]) dst[key] = src[key];
    }
  })(TUNING, pr.tuning);
  cfg.protocol = pr.id.trim();
  cfg.locked = !!pr.lock;
  saveCfg(); saveTuning(); logContrast(); syncSliders(); paintSeg();
  studyPanelSync();
}
/* the flat-panel controls a locked protocol freezes */
var LOCKED_CONTROLS = ['segEye', 'segAdapt', 'segMode', 'segScale', 'rngStrong', 'rngStrong2', 'btnDevTitle', 'btnDev', 'btnLoadProtocol', 'protocolIn'];
function studyPanelSync(){
  if(!el('studyCount')) return;
  el('studyCount').textContent = HIST.runs.length + ' runs saved on this phone' + (HIST.runs.length ? ', the latest ' + (HIST.runs[HIST.runs.length-1].endedAt || '').slice(0, 10) : '');
  if(document.activeElement !== el('participantIn')) el('participantIn').value = cfg.participant || '';
  if(document.activeElement !== el('protocolIn')) el('protocolIn').value = cfg.protocol || '';
  el('lockNote').textContent = cfg.locked
    ? 'Locked to protocol ' + cfg.protocol + ': weaker eye, contrast and its scale, mode, staircase, child mode and session length cannot be changed here or in the viewer. Type the protocol id below to unlock.'
    : (cfg.protocol ? 'Protocol ' + cfg.protocol + ' is set but not locked.' : 'No protocol. Settings are free to change.');
  el('btnLock').hidden = !!cfg.locked; el('unlockRow').hidden = !cfg.locked;
  el('btnLock').disabled = !cfg.protocol;
  LOCKED_CONTROLS.forEach(function(id){
    var n = el(id); if(!n) return;
    var all = n.querySelectorAll ? n.querySelectorAll('button') : [];
    if(all.length) Array.prototype.forEach.call(all, function(b){ b.disabled = !!cfg.locked; });
    else n.disabled = !!cfg.locked;
  });
}

/* ---------------- wiring ---------------- */
seg('segScale', function(){ return cfg.contrastScale; }, function(v){ cfg.contrastScale = v; logContrast(); });
el('participantIn').addEventListener('change', function(){
  var v = el('participantIn').value.trim().slice(0, 32);
  if(/[^A-Za-z0-9_.-]/.test(v)){ el('studyNote').textContent = 'Use letters, digits, - _ . only — never a name.'; studyPanelSync(); return; }
  cfg.participant = v; ensureParticipant(); saveCfg(); studyPanelSync();
});
el('protocolIn').addEventListener('change', function(){
  if(cfg.locked) return;
  cfg.protocol = el('protocolIn').value.trim().slice(0, 32); saveCfg(); studyPanelSync();
});
el('btnLoadProtocol').onclick = function(){
  try{
    var o = JSON.parse(el('protocolJson').value);
    applyProtocol(o.protocol || o);
    el('studyNote').textContent = 'Protocol ' + cfg.protocol + ' loaded' + (cfg.locked ? ' and locked.' : '.');
  }catch(e){ el('studyNote').textContent = 'Not loaded: ' + e.message; }
};
el('btnLock').onclick = function(){ if(!cfg.protocol) return; cfg.locked = true; saveCfg(); studyPanelSync(); el('studyNote').textContent = 'Locked.'; };
el('btnUnlock').onclick = function(){
  if(el('unlockIn').value.trim() !== cfg.protocol){ el('studyNote').textContent = 'That is not this phone’s protocol id.'; return; }
  cfg.locked = false; el('unlockIn').value = ''; saveCfg(); studyPanelSync(); el('studyNote').textContent = 'Unlocked.';
};
el('btnCopyRuns').onclick = function(){ studyCopy(runsCsv(), 'Runs CSV'); };
el('btnCopySegs').onclick = function(){ studyCopy(segmentsCsv(), 'Segments CSV'); };
el('btnCopyHist').onclick = function(){ studyCopy(JSON.stringify(studyExport(), null, 1), 'Full history JSON'); };
el('btnSaveHist').onclick = studySaveFile;
el('btnClearHist').onclick = function(){
  if(!window.confirm('Delete all ' + HIST.runs.length + ' saved runs from this phone? Export them first if they are needed.')) return;
  HIST = { v:1, runs:[], tunings:{} }; histSave(); studyPanelSync();
  el('studyNote').textContent = 'History deleted.';
};
try{ if(window.claude){ el('btnSaveHist').hidden = true; } }catch(e){}
document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden') savePending(); });
window.addEventListener('pagehide', savePending);

histLoad();
recoverPending();
ensureParticipant();
studyPanelSync();
