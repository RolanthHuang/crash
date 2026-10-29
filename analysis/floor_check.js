// Fixed cash-out RTP under the playable build's crash rule (floor + house edge h), no kill control.
// usage: node analysis/floor_check.js
const fs = require('fs'), path = require('path');
const E = new Function(fs.readFileSync(path.join(__dirname, '..', 'src', 'engine.js'), 'utf8') + '; return CrashEngine;')();
const rng = E.makeRng(12345), N = 4000000;
for (const mode of ['round', 'floor']) for (const x of [1.01, 1.5, 1.9, 5, 20]) {
  let pay = 0;
  for (let i = 0; i < N; i++) { const c = E.crashFrom(rng.uniform(0, 1), 1, mode, mode === 'floor' ? 0.02 : 0); if (x <= c) pay += x; }
  console.log(mode.padEnd(5), String(x).padStart(5) + '×', 'RTP', (pay / N * 100).toFixed(2) + '%');
}
