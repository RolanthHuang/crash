// Large-N OFF vs ON comparison with the verified engine (original bot player). ~5 min.
// usage: node analysis/stats.js
const E = require('../src/engine.js');
function run(cfg) {
  const B = E.createBulk(cfg);
  B.step();
  const out = {};
  for (const k of ['off', 'on']) {
    const r = B.result[k];
    // batch-means SE of the pooled RTP (20 batches)
    const nb = 20, per = Math.floor(cfg.sessions / nb);
    out[k] = {
      rtp: r.G / r.P,
      sessMean: r.sumRtp / r.sessions,
      suppressPerSess: r.suppress / r.sessions,
      killedSess: r.killedSessions / r.sessions,
      endOver12: r.endOver12 / r.sessions,
      low105: r.low105 / r.rounds,
      p25: r.powerstat[2.5] ? r.powerstat[2.5] / r.rounds : 0,
      pAbove1: 1 - (r.powerstat[1] || 0) / r.rounds
    };
  }
  return out;
}
const pct = x => (x * 100).toFixed(2) + '%';
const cfgs = [
  { sessions: 200000, rounds: 100, model: 'coupled', seed: 11 },
  { sessions: 200000, rounds: 100, model: 'fixedDist', seed: 11 },
  { sessions: 200000, rounds: 100, model: 'fixed', fixedX: 2, seed: 11 },
  { sessions: 200000, rounds: 100, model: 'fixed', fixedX: 1.5, seed: 11 },
  { sessions: 200000, rounds: 100, model: 'fixed', fixedX: 5, seed: 11 },
  { sessions: 20000, rounds: 1000, model: 'coupled', seed: 11 },
  { sessions: 2000, rounds: 10000, model: 'coupled', seed: 11 },
];
for (const c of cfgs) {
  const t0 = Date.now();
  const r = run(c);
  console.log(`${c.model}${c.model === 'fixed' ? '@' + c.fixedX : ''} ${c.sessions}x${c.rounds} (${Date.now() - t0}ms)`);
  for (const k of ['off', 'on']) {
    const v = r[k];
    console.log(`  ${k}: RTP ${pct(v.rtp)} | mean sess RTP ${pct(v.sessMean)} | forced/sess ${v.suppressPerSess.toFixed(3)} | sess w/ kill ${pct(v.killedSess)} | end>120% ${pct(v.endOver12)} | crash<=1.05 ${pct(v.low105)} | rounds p>1 ${pct(v.pAbove1)}`);
  }
}
