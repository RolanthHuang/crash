"""Run the ORIGINAL crashsimulation.py unchanged except for cycles / Oboomactivate,
optionally recording every np.random draw (the "tape") plus per-cycle traces,
so a port can be replayed against it draw-for-draw.

usage: python3 verify/trace_original.py SEED CYCLES ACT OUT.json [tape]
  ACT = 1 kill-rate control on, 0 off; add "tape" to record every random draw.
"""
import os, sys, json
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

plt.show = lambda *a, **k: None
_subplots = plt.subplots
plt.subplots = lambda *a, **k: _subplots(figsize=(2, 2), dpi=40)  # skip the 16x12@300dpi canvases

seed, cycles, act, out = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
record = len(sys.argv) > 5 and sys.argv[5] == "tape"

tape = []
_choice, _uniform = np.random.choice, np.random.uniform


def choice(a, *args, **kw):
    v = _choice(a, *args, **kw)
    if record:
        tape.append(["c", int(v)])
    return v


def uniform(*args, **kw):
    v = _uniform(*args, **kw)
    if record:
        tape.append(["u", float(v)])
    return v


np.random.choice, np.random.uniform = choice, uniform
np.random.seed(seed)

ORIGINAL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "original", "crashsimulation.py")
src = open(ORIGINAL, encoding="utf-8-sig").read().replace("\r\n", "\n")
for anchor in ("cycles=10**1", "Oboomactivate=1", "    #rtphistorydiagram(rtphistory)",
               "            bar=targetfunction(pastbehavior[:i])"):
    assert anchor in src, anchor
src = src.replace("cycles=10**1", f"cycles={cycles}").replace("Oboomactivate=1", f"Oboomactivate={act}")
if record:
    src = src.replace("    #rtphistorydiagram(rtphistory)",
                      "    #rtphistorydiagram(rtphistory)\n"
                      "    TRACE.append(dict(rtph=[float(x) for x in rtphistory], oboom=[int(x) for x in Oboom],"
                      " capture=[int(x) for x in capture]))")
    src = src.replace("            bar=targetfunction(pastbehavior[:i])",
                      "            bar=targetfunction(pastbehavior[:i])\n            BARS.append(float(bar))")

g = {"__name__": "__main__", "TRACE": [], "BARS": []}
exec(compile(src, "crashsimulation.py", "exec"), g)

res = dict(seed=seed, cycles=cycles, act=act,
           grandgained=float(g["grandgainedbonus"]), grandplaced=float(g["grandplacedbets"]),
           suppress=int(g["suppresscount"]),
           stat={str(k): int(v) for k, v in g["stat"].items()},
           powerstat={str(k): int(v) for k, v in g["powerstat"].items()})
if record:
    res.update(trace=g["TRACE"], bars=g["BARS"], tape=tape)
json.dump(res, open(out, "w"))
print(f"act={act} cycles={cycles} RTP={res['grandgained'] / res['grandplaced']:.5f} "
      f"suppress/cycle={res['suppress'] / cycles:.3f}")
