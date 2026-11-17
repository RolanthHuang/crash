"""RTP distribution per cycle vs cumulative, for fixed cash-out and ladder (dynamic-bet) strategies.

A cycle = N rounds. For each strategy and N we report
  1. single-cycle RTP distribution (every cycle of every session pooled)
  2. cumulative RTP after 100 cycles   (100*N rounds), across independent sessions
  3. cumulative RTP after 1000 cycles  (1000*N rounds), across independent sessions
RTP = total payout / total stake (stake-weighted, so ladder strategies are measured correctly).

Win probability of a fixed cash-out x with no kill control:
  floor rule  (playable build): p = (1-h)/x          RTP = 1-h at every x
  round rule  (original code) : p = 1/(x-0.005)      RTP = x/(x-0.005) > 100%
Wins are drawn per round (Bernoulli(p)); fixed strategies use the exactly equivalent Binomial(N, p).

usage: python3 analysis/rtp_dist.py [--rule floor|round] [--h 0.02] [--sessions 4000] [--out analysis/out]
"""
import argparse, os, time
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.rcParams["font.sans-serif"] = ["Noto Sans CJK TC", "Noto Sans CJK SC", "DejaVu Sans"]
plt.rcParams["axes.unicode_minus"] = False

BINS = np.array([0, 0.50, 0.60, 0.70, 0.80, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20,
                 1.30, 1.40, 1.50, 1.60, 1.80, 2.00, np.inf])
LABELS = [f"{BINS[i]*100:.0f}–{BINS[i+1]*100:.0f}%" if np.isfinite(BINS[i + 1]) else "200%+"
          for i in range(len(BINS) - 1)]
K_SHORT, K_LONG = 100, 1000


def win_prob(x, rule, h):
    return (1 - h) / x if rule == "floor" else 1 / (x - 0.005)


# ---------------- strategies ----------------
# Each strategy: dict(name, x, kind). 'fixed' = flat bet; others are bet ladders.
def fixed(x):
    return dict(name=f"固定 {x:g}× 離場", short=f"fixed_{x:g}x", x=x, kind="fixed")


STRATS = [fixed(1.01), fixed(1.05), fixed(2), fixed(5), fixed(10),
          dict(name="階梯 A：1.05× 輸了翻倍（上限 256 倍，贏了回底注）", short="ladder_a_martingale2",
               x=1.05, kind="mart2"),
          dict(name="階梯 B：1.08× 輸了 ×3（最多連 4 次）+ 每連贏 20 局底注減半（最低 1/8），輸一次回原位",
               short="ladder_b_mart3_decay", x=1.08, kind="mart3decay")]


def sim_fixed(x, p, N, K, S, rng):
    W = rng.binomial(N, p, size=(S, K))                 # wins per cycle
    cyc = x * W / N                                      # flat bet 1 per round
    cumw = np.cumsum(W, axis=1)
    cum = lambda k: x * cumw[:, k - 1] / (N * k)
    return cyc.ravel(), cum(K_SHORT), cum(K)


def sim_ladder(kind, x, p, N, K, S, rng):
    bet = np.ones(S)
    base = np.ones(S)          # mart3decay: current base stake
    j = np.zeros(S)            # consecutive busts (mart3decay)
    wst = np.zeros(S)          # consecutive wins (mart3decay)
    cyc_pay = np.zeros(S); cyc_stake = np.zeros(S)
    tot_pay = np.zeros(S); tot_stake = np.zeros(S)
    cyc_rtp = np.empty((K, S), dtype=np.float32)
    c100 = None
    for t in range(K * N):
        win = rng.random(S) < p
        cyc_pay += np.where(win, bet * x, 0.0); cyc_stake += bet
        if kind == "mart2":
            bet = np.where(win, 1.0, np.minimum(bet * 2, 256.0))
        else:  # mart3decay
            wst = np.where(win, wst + 1, 0.0)
            base = np.where(win, np.where((wst % 20 == 0), np.maximum(base / 2, 0.125), base), 1.0)
            j = np.where(win, 0.0, np.minimum(j + 1, 4.0))
            bet = base * 3.0 ** j
        if (t + 1) % N == 0:
            c = (t + 1) // N - 1
            cyc_rtp[c] = cyc_pay / cyc_stake
            tot_pay += cyc_pay; tot_stake += cyc_stake
            cyc_pay[:] = 0; cyc_stake[:] = 0
            if c + 1 == K_SHORT:
                c100 = tot_pay / tot_stake
    return cyc_rtp.ravel().astype(float), c100, tot_pay / tot_stake


# ---------------- plotting ----------------
def stats(d):
    return f"mean {d.mean()*100:.2f}%  median {np.median(d)*100:.1f}%  P(RTP≥100%) {np.mean(d >= 1 - 1e-9)*100:.1f}%  P(<50%) {np.mean(d < 0.5)*100:.1f}%"


def panel(ax, data, title):
    data = np.asarray(data, dtype=float) + 1e-9
    counts, _ = np.histogram(data, bins=BINS)
    pct = counts / len(data) * 100
    xs = np.arange(len(LABELS))
    ax.bar(xs, pct, color="royalblue", alpha=0.8)
    ax.axvline(8 - 0.5, color="crimson", ls="--", lw=1, alpha=0.7)   # 100% boundary
    ax.set_xticks(xs); ax.set_xticklabels(LABELS, rotation=45, ha="right")
    ax.set_ylabel("Frequency (%)")
    ax.set_title(f"{title}\n{stats(data - 1e-9)}", fontsize=10)
    ax.grid(axis="y", alpha=0.25)
    for i, v in enumerate(pct):
        if v >= 0.5:
            ax.text(i, v, f"{v:.1f}%", ha="center", va="bottom", fontsize=8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rule", default="floor", choices=["floor", "round"])
    ap.add_argument("--h", type=float, default=0.02)
    ap.add_argument("--sessions", type=int, default=4000)
    ap.add_argument("--ns", default="10,100")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "out"))
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    Ns = [int(v) for v in a.ns.split(",")]
    rng = np.random.default_rng(a.seed)
    rows = []
    rule_txt = f"floor + {a.h*100:g}% 抽成" if a.rule == "floor" else "原碼 round"
    for s in STRATS:
        p = win_prob(s["x"], a.rule, a.h)
        ns = [100] if s["x"] == 1.01 and s["kind"] == "fixed" else Ns   # 1.01×: N<100 hardly ever reaches 100%
        fig, axes = plt.subplots(len(ns) * 3, 1, figsize=(16, 4.6 * len(ns) * 3), dpi=110)
        axes = np.atleast_1d(axes)
        for r, N in enumerate(ns):
            t0 = time.time()
            if s["kind"] == "fixed":
                cyc, c100, c1000 = sim_fixed(s["x"], p, N, K_LONG, a.sessions, rng)
            else:
                S = min(a.sessions, 2000)
                cyc, c100, c1000 = sim_ladder(s["kind"], s["x"], p, N, K_LONG, S, rng)
            panel(axes[3 * r], cyc, f"{s['name']}｜N={N}｜單週期 RTP 分布（{N} 局一週期）")
            panel(axes[3 * r + 1], c100, f"N={N}｜累計 RTP，跑完 {K_SHORT} 週期（{K_SHORT*N:,} 局）後，{len(c100)} 個獨立 session")
            panel(axes[3 * r + 2], c1000, f"N={N}｜累計 RTP，跑完 {K_LONG} 週期（{K_LONG*N:,} 局）後，{len(c1000)} 個獨立 session")
            for lab, d in (("cycle", cyc), (f"cum{K_SHORT}", c100), (f"cum{K_LONG}", c1000)):
                rows.append((s["name"], N, lab, d.mean(), np.median(d), np.mean(d >= 1 - 1e-9), np.mean(d < 0.5), np.percentile(d, 5), np.percentile(d, 95)))
            print(f"{s['short']:24s} N={N:<4d} {time.time()-t0:5.1f}s  cum{K_LONG} mean {c1000.mean()*100:.2f}%  P>=100% {np.mean(c1000>=1-1e-9)*100:.1f}%", flush=True)
        fig.suptitle(f"{s['name']}   規則：{rule_txt}", fontsize=13, y=0.999)
        fig.tight_layout(rect=(0, 0, 1, 0.99))
        fig.savefig(os.path.join(a.out, f"rtp_{a.rule}_{s['short']}.png"))
        plt.close(fig)
    with open(os.path.join(a.out, f"summary_{a.rule}.md"), "w", encoding="utf-8") as f:
        f.write(f"# RTP summary — rule: {rule_txt}\n\n| 策略 | N | 統計對象 | 平均 | 中位數 | P(RTP≥100%) | P(RTP<50%) | 5% 分位 | 95% 分位 |\n|---|---:|---|---:|---:|---:|---:|---:|---:|\n")
        for n, N, lab, m, md, p100, p50, q5, q95 in rows:
            f.write(f"| {n} | {N} | {lab} | {m*100:.2f}% | {md*100:.1f}% | {p100*100:.1f}% | {p50*100:.1f}% | {q5*100:.0f}% | {q95*100:.0f}% |\n")


if __name__ == "__main__":
    main()
