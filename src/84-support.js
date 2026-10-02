
/* ============================================================
   FREE SOFTWARE AND SUPPORT

   Gloamhold is free software (AGPL-3.0-or-later). The AGPL asks that
   people using it over a network can get its source, so the source
   link is shown on the grown-up pages and the safety screen.

   Donations are asked for in exactly one place: the grown-up flat
   panel. Never on a screen a child lands on, never in a game, never
   as a reward or a lock — a five-year-old cannot consent to being
   asked for money, and tools/check.mjs fails a child-facing file
   that mentions it. Fill in a handle below to show its link; an
   empty one stays hidden.
   ============================================================ */
var SUPPORT = {
  source:   'https://github.com/saruuuuul/gloamhold',
  sponsors: 'https://github.com/sponsors/saruuuuul',
  kofi:     '',          /* e.g. 'https://ko-fi.com/yourname' */
  bmc:      ''           /* e.g. 'https://www.buymeacoffee.com/yourname' */
};
function supportWire(){
  [['lnkSource', SUPPORT.source], ['lnkSponsors', SUPPORT.sponsors], ['lnkKofi', SUPPORT.kofi], ['lnkBmc', SUPPORT.bmc]]
  .forEach(function(p){
    var a = el(p[0]);
    if(!a) return;
    if(p[1]){ a.href = p[1]; a.hidden = false; } else a.hidden = true;
  });
}
supportWire();
