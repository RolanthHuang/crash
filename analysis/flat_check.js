// Flat-bet player (bet 10, fixed auto cash-out) in the live-game setup: each session starts at p = 1.
// usage: node analysis/flat_check.js
const E = require('../src/engine.js');
function run(target, killOn, sessions, rounds, seed) {
  let G = 0, P = 0, profit = 0, forced = 0;
  for (let s = 0; s < sessions; s++) {
    const st = E.newSession({ killOn, captureAlways: false });
    const R = { roll: E.makeRng(E.seedFor(seed, s, 2)), kill: E.makeRng(E.seedFor(seed, s, 4)) };
    for (let r = 0; r < rounds; r++) {
      const info = E.beginRound(st, 10, R, null);
      const pay = E.settle(st, 10, target, info.odds);
      G += pay; P += 10;
    }
    if (st.gained > st.placed) profit++;
    forced += st.suppress;
  }
  return { rtp: G / P, pProfit: profit / sessions, forcedPerSess: forced / sessions };
}
const pct = (x, d = 3) => (x * 100).toFixed(d) + '%';
for (const [target, sessions, rounds] of [[1.9, 300, 75700], [1.01, 300, 75700], [1.9, 100000, 100], [1.01, 100000, 100], [5, 100000, 100]]) {
  const theo = target / (target - 0.005);
  const off = run(target, false, sessions, rounds, 7), on = run(target, true, sessions, rounds, 7);
  console.log(`target ${target}x  ${sessions} sessions x ${rounds} rounds | theory ${pct(theo)}`);
  console.log(`  OFF RTP ${pct(off.rtp)}  P(session ends in profit) ${pct(off.pProfit, 1)}`);
  console.log(`  ON  RTP ${pct(on.rtp)}  P(session ends in profit) ${pct(on.pProfit, 1)}  forced/session ${on.forcedPerSess.toFixed(2)}`);
}
// the user's own session: 75,700 rounds x 10 at 1.90x -> 759,659 returned
const q = 1 / 1.895, sd = 10 * 1.9 * Math.sqrt(q * (1 - q)) * Math.sqrt(75700), mu = 757000 * (1.9 * q - 1);
console.log({ expectedNet: mu.toFixed(0), sdNet: sd.toFixed(0), observedNet: 2659, z: ((2659 - mu) / sd).toFixed(2) });
