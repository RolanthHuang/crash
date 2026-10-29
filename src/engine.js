/* CrashEngine — port of crashsimulation.py (crash game with kill-rate control).
   Given the same random draws it reproduces the Python original bit-for-bit
   (targetfunction, crash points, kill trigger, powershift, settlement). */
(function (root) {
  'use strict';

  var PRO = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]; // pro=[0]*10+[1]
  var BOOM = [2, 4, 8, 16, 20];                // boom
  var CAP = 360;        // playerodds >= 360 pays 360x
  var HOT = 1.2;        // rtphistory[-1] > 1.2
  var DUR_LIMIT = 5;    // duration > 5
  var KILL_P = 0.3;     // np.random.uniform() < 0.3
  var BOUNCE = 2;       // 彈跳倍數 = 2
  var POWER_MAX = 2.5;  // powershift ceiling

  // Python round(x, d): correctly rounded, ties-to-even on the exact binary value.
  function pyRound(x, d) {
    var y = x * Math.pow(2, d + 1);
    if (isFinite(y) && Math.floor(y) === y && Math.abs(y % 2) === 1) { // exact .5 tie
      var p = Math.pow(10, d), f = Math.floor(x * p);
      return (f % 2 === 0 ? f : f + 1) / p;
    }
    return Number(x.toFixed(d));
  }

  function mean(arr) { var s = 0; for (var k = 0; k < arr.length; k++) s += arr[k]; return s / arr.length; }

  // targetfunction(a): split the sorted recent history (minus one min & one max) into
  // lower / middle / upper runs scored against m / Tave / M, return the mean of the
  // largest run = "typical stake". O(n^2) but every float op happens in the same order
  // as the original's O(n^3) loops, so results are identical.
  function targetFunction(hist) {
    var a = hist.length > 50 ? hist.slice(hist.length - 50) : hist.slice();
    var b = a.slice().sort(function (p, q) { return p - q; });
    var n = b.length, m = b[0], M = b[n - 1];
    var c = b.slice(1, n - 1), L = c.length, k, d;
    var S = 0;
    for (k = 0; k < a.length; k++) S += a[k];
    var Tave = S / a.length;
    if (L < 3) return Tave; // unreachable: caller guarantees len >= 5
    var low = new Float64Array(L), acc = 0;
    for (k = 0; k < L; k++) { d = c[k] - m; acc += d * d; low[k] = acc; }
    var up = new Float64Array(L + 1), s, u;
    for (s = 0; s < L; s++) { u = 0; for (k = s; k < L; k++) { d = c[k] - M; u += d * d; } up[s] = u; }
    var best = Infinity, bi = -1, bj = -1, i, j, A, mid, cost;
    for (i = 0; i < L - 2; i++) {
      A = low[i] / (i + 1);
      mid = 0;
      for (j = 1; j < L - i - 1; j++) {
        d = c[i + j] - Tave; mid += d * d;
        cost = A + mid / j + up[i + j + 1] / (L - i - j - 1);
        if (cost < best) { best = cost; bi = i; bj = j; }
      }
    }
    var lower = c.slice(0, bi + 1); lower.push(m);
    var middle = c.slice(bi + 1, bi + bj + 1);
    var higher = c.slice(bi + bj + 1); higher.push(M);
    if (higher.length > Math.max(lower.length, middle.length)) return mean(higher);
    if (middle.length > Math.max(lower.length, higher.length)) return mean(middle);
    return mean(lower);
  }

  function newSession(o) {
    o = o || {};
    return {
      killOn: !!o.killOn, power: o.power == null ? 1 : o.power, duration: 0,
      past: [], placed: 0, gained: 0, rtph: [0],
      capture: [], oboom: [], suppress: 0,
      captureAlways: o.captureAlways !== false, onBar: o.onBar || null
    };
  }

  // One round up to the crash point. R.roll / R.kill are RNGs; afterRoll (optional) runs
  // right after the crash roll — the bot draws its cash-out target there, as the original does.
  function beginRound(st, bet, R, afterRoll) {
    var i = st.past.length;
    st.past.push(bet);
    st.placed += bet;
    var rtpBefore = st.rtph[st.rtph.length - 1];
    var powerBefore = st.power;
    var roll = R.roll.uniform(0, 1);
    var natural = pyRound(1 / Math.pow(roll, 1 / st.power), 2);
    var odds = natural;
    var extra = afterRoll ? afterRoll(st) : null;

    var spikeDone = false, spike = false, bar = null;
    function evalSpike() {
      if (!spikeDone) {
        spikeDone = true;
        if (i > 4) {
          bar = targetFunction(st.past.slice(0, i));
          if (st.onBar) st.onBar(bar);
          if (st.past[i] > BOUNCE * bar) { spike = true; st.capture.push(i); }
        }
      }
      return spike;
    }
    if (st.captureAlways) evalSpike();

    var hot = rtpBefore > HOT && st.killOn;
    var checked = false, killRoll = null, forced = false;
    if (hot) {
      st.duration += 1;
      if (st.duration > DUR_LIMIT || evalSpike()) {
        checked = true;
        killRoll = R.kill.uniform();
        if (killRoll < KILL_P) {
          odds = pyRound(R.kill.uniform(1, 1.05), 2);
          st.oboom.push(i);
          if (st.power < POWER_MAX) st.power += 0.1;
          st.suppress += 1;
          forced = true;
        }
      }
    } else {
      st.duration = 0;
      st.power = 1;
    }
    return {
      i: i, bet: bet, rtpBefore: rtpBefore, hot: hot, duration: st.duration,
      spikeKnown: spikeDone, spike: spike, bar: bar, checked: checked, killRoll: killRoll,
      forced: forced, natural: natural, odds: odds, powerBefore: powerBefore,
      powerAfter: st.power, extra: extra
    };
  }

  // playerodds = cash-out multiplier (null = never cashed out). Returns the payout (stake included).
  function settle(st, bet, playerodds, odds) {
    var payout = 0;
    if (playerodds != null && playerodds <= odds) payout = (playerodds < CAP ? playerodds : CAP) * bet;
    st.gained += payout;
    st.rtph.push(st.gained / st.placed);
    return payout;
  }

  // The original's simulated player. model: 'coupled' (original: target = 1/V^(1/power)),
  // 'fixedDist' (target = 1/V, ignores power), 'fixed' (always fixedX).
  function botRound(st, R, model, fixedX) {
    var bet = 1 + R.bet.choice(PRO) * R.bet.choice(BOOM);
    var after;
    if (model === 'fixed') after = function () { return fixedX; };
    else if (model === 'fixedDist') after = function () { return pyRound(1 / R.player.uniform(), 2); };
    else after = function (s) { return pyRound(1 / Math.pow(R.player.uniform(), 1 / s.power), 2); };
    var info = beginRound(st, bet, R, after);
    var payout = settle(st, bet, info.extra, info.odds);
    return { bet: bet, payout: payout, info: info };
  }

  // ---------- RNGs ----------
  function tapeRng(tape) {
    var k = 0;
    function take(kind) {
      var e = tape[k];
      if (!e || e[0] !== kind) throw new Error('tape desync at ' + k + ' (want ' + kind + ')');
      k++;
      return e[1];
    }
    return {
      uniform: function () { return take('u'); },
      choice: function () { return take('c'); },
      pos: function () { return k; }
    };
  }

  function splitmix32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x9e3779b9) >>> 0;
      var z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return (z ^ (z >>> 16)) >>> 0;
    };
  }

  function makeRng(seed) { // sfc32, 53-bit doubles
    var sm = splitmix32(seed), a = sm(), b = sm(), c = sm(), d = sm();
    function next() {
      var t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return t >>> 0;
    }
    for (var k = 0; k < 15; k++) next();
    function u53() { return (next() * 2097152 + (next() >>> 11)) / 9007199254740992; }
    return {
      uniform: function (lo, hi) { return lo === undefined ? u53() : lo + (hi - lo) * u53(); },
      choice: function (arr) { return arr[Math.floor(u53() * arr.length)]; }
    };
  }

  function seedFor(seed, idx, stream) {
    var h = Math.imul(((seed >>> 0) ^ 0x9e3779b9) >>> 0, 0x85ebca6b) >>> 0;
    h = Math.imul((h ^ (idx >>> 0) ^ (h >>> 13)) >>> 0, 0xc2b2ae35) >>> 0;
    h = Math.imul((h ^ Math.imul(stream, 0x27d4eb2f) ^ (h >>> 16)) >>> 0, 0x165667b1) >>> 0;
    return (h ^ (h >>> 15)) >>> 0;
  }

  function cryptoRng() {
    var buf = new Uint32Array(2);
    var hasCrypto = typeof crypto !== 'undefined' && crypto && typeof crypto.getRandomValues === 'function';
    function u53() {
      if (!hasCrypto) return Math.random();
      crypto.getRandomValues(buf);
      return (buf[0] * 2097152 + (buf[1] >>> 11)) / 9007199254740992;
    }
    return {
      uniform: function (lo, hi) { return lo === undefined ? u53() : lo + (hi - lo) * u53(); },
      choice: function (arr) { return arr[Math.floor(u53() * arr.length)]; }
    };
  }

  // ---------- bulk simulation: OFF vs ON on identical random streams ----------
  // Like the original, `power` carries over from one session to the next.
  function createBulk(cfg) {
    var sessions = cfg.sessions, rounds = cfg.rounds, model = cfg.model || 'coupled';
    var fixedX = cfg.fixedX || 2, seed = (cfg.seed >>> 0);
    var modes = [{ key: 'off', killOn: false }, { key: 'on', killOn: true }];
    var res = {}, carry = {}, startPower = {};
    modes.forEach(function (md) {
      res[md.key] = { G: 0, P: 0, rounds: 0, sessions: 0, suppress: 0, stat: {}, powerstat: {},
        low105: 0, endOver12: 0, sumRtp: 0, killedSessions: 0, sessRtp: new Float64Array(sessions) };
      carry[md.key] = 1;
      startPower[md.key] = new Float64Array(sessions);
    });
    var killedFlag = new Uint8Array(sessions);
    var s = 0;

    function streams(idx) {
      return { bet: makeRng(seedFor(seed, idx, 1)), roll: makeRng(seedFor(seed, idx, 2)),
               player: makeRng(seedFor(seed, idx, 3)), kill: makeRng(seedFor(seed, idx, 4)) };
    }
    function runOne(md, idx, power, record, captureAlways) {
      var st = newSession({ killOn: md.killOn, power: power, captureAlways: captureAlways });
      var R = streams(idx), A = res[md.key], k, out, pk;
      st.crashes = [];
      for (k = 0; k < rounds; k++) {
        out = botRound(st, R, model, fixedX);
        if (!record) { st.crashes.push(out.info.odds); continue; }
        A.G += out.payout; A.P += out.bet; A.rounds++;
        pk = pyRound(st.power, 1);
        A.powerstat[pk] = (A.powerstat[pk] || 0) + 1;
        if (out.info.odds <= 1.05) A.low105++;
      }
      if (record) {
        var rtp = st.rtph[st.rtph.length - 1];
        var loc = Math.trunc(rtp * 10) / 10;
        A.stat[loc] = (A.stat[loc] || 0) + 1;
        A.sessRtp[A.sessions] = rtp;
        A.sessions++; A.sumRtp += rtp;
        if (rtp > HOT) A.endOver12++;
        A.suppress += st.suppress;
        if (st.suppress > 0) A.killedSessions++;
      }
      return st;
    }
    var api = {
      result: res, total: sessions, done: 0, sampleIdx: -1, cfg: cfg,
      step: function (budgetMs) {
        var t0 = Date.now();
        while (s < sessions) {
          for (var q = 0; q < modes.length; q++) {
            var md = modes[q];
            startPower[md.key][s] = carry[md.key];
            var st = runOne(md, s, carry[md.key], true, false);
            carry[md.key] = st.power;
            if (md.key === 'on' && st.suppress > 0) {
              killedFlag[s] = 1;
              if (api.sampleIdx < 0) api.sampleIdx = s;
            }
          }
          s++;
          if (budgetMs !== undefined && Date.now() - t0 > budgetMs) break;
        }
        api.done = s;
        return s >= sessions;
      },
      // rerun one session pair with full spike tracking (identical outcomes: no extra randomness)
      sample: function (idx) {
        var out = {};
        modes.forEach(function (md) { out[md.key] = runOne(md, idx, startPower[md.key][idx], false, true); });
        return out;
      },
      nextKilled: function (from, dir) {
        dir = dir || 1;
        for (var k = from + dir; k >= 0 && k < api.done; k += dir) if (killedFlag[k]) return k;
        return -1;
      }
    };
    return api;
  }

  var api = {
    PRO: PRO, BOOM: BOOM, CAP: CAP, HOT: HOT, DUR_LIMIT: DUR_LIMIT, KILL_P: KILL_P,
    BOUNCE: BOUNCE, POWER_MAX: POWER_MAX,
    pyRound: pyRound, targetFunction: targetFunction, newSession: newSession,
    beginRound: beginRound, settle: settle, botRound: botRound,
    tapeRng: tapeRng, makeRng: makeRng, seedFor: seedFor, cryptoRng: cryptoRng, createBulk: createBulk
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CrashEngine = api;
})(typeof window !== 'undefined' ? window : this);
