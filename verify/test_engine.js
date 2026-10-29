// Verifies engine.js against the original Python: targetfunction outputs and full
// draw-for-draw replays of recorded runs. usage: node verify/test_engine.js verify/tape_*.json
const fs = require('fs');
const path = require('path');
const E = require('../src/engine.js');

function cmpArr(a, b) {
  if (a.length !== b.length) return `length ${a.length} vs ${b.length}`;
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return `idx ${k}: js ${a[k]} vs py ${b[k]}`;
  return null;
}
function normDict(d) { const m = new Map(); for (const [k, v] of Object.entries(d)) m.set(parseFloat(k), v); return m; }
function cmpDict(a, b) {
  const A = normDict(a), B = normDict(b);
  if (A.size !== B.size) return `size ${A.size} vs ${B.size}`;
  for (const [k, v] of A) if (B.get(k) !== v) return `key ${k}: ${v} vs ${B.get(k)}`;
  return null;
}

let failures = 0;

// 1) targetfunction, exact equality
const tf = JSON.parse(fs.readFileSync(path.join(__dirname, 'tf_cases.json')));
let bad = 0;
tf.forEach((cs, idx) => {
  const v = E.targetFunction(cs.a);
  if (v !== cs.bar) { bad++; if (bad <= 3) console.log('  TF mismatch case', idx, 'py', cs.bar, 'js', v); }
});
console.log(`targetfunction: ${tf.length - bad}/${tf.length} identical`);
failures += bad;

// 2) pyRound edge cases vs Python's round()
const pr = [[1.125, 2, 1.12], [1.375, 2, 1.38], [2.675, 2, 2.67], [1.005, 2, 1.0], [0.25, 1, 0.2], [0.75, 1, 0.8], [1.2000000000000002, 1, 1.2]];
for (const [x, d, want] of pr) if (E.pyRound(x, d) !== want) { failures++; console.log('  pyRound', x, d, E.pyRound(x, d), 'want', want); }

// 3) draw-for-draw replay of recorded original runs
for (const f of process.argv.slice(2)) {
  const D = JSON.parse(fs.readFileSync(f));
  const tape = E.tapeRng(D.tape);
  const R = { bet: tape, roll: tape, player: tape, kill: tape };
  let power = 1, G = 0, P = 0, suppress = 0, badCycles = 0, first = null;
  const bars = [], stat = {}, powerstat = {};
  for (let c = 0; c < D.cycles; c++) {
    const st = E.newSession({ killOn: !!D.act, power, captureAlways: true, onBar: b => bars.push(b) });
    for (let r = 0; r < 100; r++) {
      const out = E.botRound(st, R, 'coupled');
      G += out.payout; P += out.bet;
      const pk = E.pyRound(st.power, 1);
      powerstat[pk] = (powerstat[pk] || 0) + 1;
    }
    power = st.power; suppress += st.suppress;
    const loc = Math.trunc(st.rtph[st.rtph.length - 1] * 10) / 10;
    stat[loc] = (stat[loc] || 0) + 1;
    const T = D.trace[c];
    const e = cmpArr(st.rtph, T.rtph) || cmpArr(st.oboom, T.oboom) || cmpArr(st.capture, T.capture);
    if (e) { badCycles++; if (!first) first = `cycle ${c}: ${e}`; }
  }
  const checks = {
    cycles: badCycles === 0 ? 'ok' : `${badCycles} differ (${first})`,
    grandgained: G === D.grandgained ? 'ok' : `${G} vs ${D.grandgained}`,
    grandplaced: P === D.grandplaced ? 'ok' : `${P} vs ${D.grandplaced}`,
    suppress: suppress === D.suppress ? 'ok' : `${suppress} vs ${D.suppress}`,
    bars: cmpArr(bars, D.bars) || `ok (${bars.length})`,
    stat: cmpDict(stat, D.stat) || 'ok',
    powerstat: cmpDict(powerstat, D.powerstat) || 'ok',
    tapeFullyConsumed: tape.pos() === D.tape.length ? 'ok' : `${tape.pos()} of ${D.tape.length}`
  };
  const okAll = Object.values(checks).every(v => String(v).startsWith('ok'));
  if (!okAll) failures++;
  console.log(`${f}: act=${D.act} cycles=${D.cycles} draws=${D.tape.length} RTP=${(G / P).toFixed(5)} ->`, okAll ? 'ALL IDENTICAL' : checks);
}
console.log(failures ? `FAILURES: ${failures}` : 'PASS');
process.exit(failures ? 1 : 0);
