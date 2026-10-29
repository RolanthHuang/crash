// Bankroll 1,000, flat bet 10, fixed cash-out x, no kill control (long sessions make ON ~ OFF).
// round(1/U,2) >= x  <=>  1/U >= x - 0.005  =>  P(win) = 1/(x - 0.005)
// usage: node analysis/ruin.js
function sim(x, sessions, maxRounds) {
  const q = 1 / (x - 0.005), win = Math.round(10 * (x - 1) * 100) / 100;
  const mu = 10 * (x * q - 1), v = (10 * x) ** 2 * q * (1 - q);
  let ruined = 0, tail = 0, ruinRounds = [];
  for (let s = 0; s < sessions; s++) {
    let b = 1000, r = 0;
    for (; r < maxRounds && b >= 10; r++) b += Math.random() < q ? win : -10;
    if (b < 10) { ruined++; ruinRounds.push(r); } else tail += Math.exp(-2 * mu * b / v); // survivors' leftover ruin risk
  }
  ruinRounds.sort((a, b) => a - b);
  return { x, theoryRuin: Math.exp(-2 * mu * 1000 / v).toFixed(3), mcRuin: (ruined / sessions).toFixed(3),
           mcRuinInclTail: ((ruined + tail) / sessions).toFixed(3), medianRoundsToRuin: ruinRounds[ruinRounds.length >> 1] || null,
           edgePerRound: mu.toFixed(4), sdPerRound: Math.sqrt(v).toFixed(3) };
}
console.log(sim(1.90, 4000, 300000));
console.log(sim(1.01, 4000, 100000));
console.log(sim(1.50, 4000, 300000));
// probability the 1.90x player is ahead after N rounds (normal approx)
const q = 1 / 1.895, mu = 10 * (1.9 * q - 1), sd = 10 * 1.9 * Math.sqrt(q * (1 - q));
const Phi = z => 0.5 * (1 + Math.sign(z) * Math.sqrt(1 - Math.exp(-2 * z * z / Math.PI))); // quick erf approx
for (const N of [1000, 10000, 45000, 75700, 220000]) console.log(N, 'P(ahead)≈', Phi(mu * N / (sd * Math.sqrt(N))).toFixed(3), 'E[net]', (mu * N).toFixed(0), 'sd', (sd * Math.sqrt(N)).toFixed(0));
