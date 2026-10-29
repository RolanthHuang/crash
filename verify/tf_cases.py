"""Dump targetfunction() outputs of the ORIGINAL code for many bet histories
into verify/tf_cases.json.  usage: python3 verify/tf_cases.py"""
import os, json
import numpy as np
import matplotlib
matplotlib.use("Agg")

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "..", "original", "crashsimulation.py"), encoding="utf-8-sig").read().replace("\r\n", "\n")
g = {"__name__": "defs"}
exec(src.split("stat={}")[0], g)  # function definitions only
tf = g["targetfunction"]

rng = np.random.default_rng(7)
cases = []
for k in range(4000):
    n = int(rng.integers(5, 90))
    kind = k % 6
    if kind == 0:  # the sim's bot bets
        a = [int(1 + (rng.integers(0, 11) == 10) * rng.choice([2, 4, 8, 16, 20])) for _ in range(n)]
    elif kind == 1:  # human-like: a base stake with raises / halvings / all-ins
        base = int(rng.choice([1, 5, 10, 20, 50, 100]))
        a = []
        for _ in range(n):
            r = rng.random()
            v = base if r < 0.7 else base * int(rng.integers(2, 6)) if r < 0.85 else max(1, base // 2) if r < 0.95 else base * int(rng.integers(5, 21))
            a.append(int(v))
    elif kind == 2:
        a = [int(x) for x in rng.integers(1, 501, size=n)]
    elif kind == 3:
        a = [int(rng.choice([10, 20, 50]))] * n
    elif kind == 4:
        a = [int(x) for x in rng.choice([10, 20, 30, 40, 50, 100, 200], size=n)]
    else:  # numpy int64 path, exactly like the sim
        a = list(np.int64(1) + rng.choice([0] * 10 + [1], size=n) * rng.choice([2, 4, 8, 16, 20], size=n))
    bar = tf(list(a))
    cases.append({"a": [int(x) for x in a], "bar": float(bar)})
json.dump(cases, open(os.path.join(HERE, "tf_cases.json"), "w"))
print(len(cases), "cases")
