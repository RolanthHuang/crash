# Crash 殺率試玩台

### ▶ [直接開玩](https://rolanthhuang.github.io/crash/)

火箭 Crash 遊戲的可玩版本。「無殺率」、「有殺率」、「盲測」三個 session 各自獨立，可以直接比較 RTP 的體感。引擎由我的 Python 模擬 [`original/crashsimulation.py`](original/crashsimulation.py) 逐行移植到 JavaScript，並和原碼逐局對拍到位元等級。

*A playable crash game (rocket multiplier) with and without a kill-rate controller, ported line by line from my Python simulation and verified bit-exact against it. It includes a blind A/B mode, a house-side view of every controller decision, and a bulk simulator.*

## 怎麼玩

- 設好注額後按「起飛」或空白鍵，倍數照 `m(t) = e^(0.16t)` 往上爬。
- 爆炸前按「收手」，拿回「注額 × 當下倍數」；來不及就整注沒收。可以設自動收手倍數，到 360× 自動收手。
- **盲測**：有一半機率開著殺率控制，玩一陣子再猜答案。
- **後台視角**：每局的累計 RTP、連續熱局數、尾巴指數 p、典型注額、30% 擲骰結果，以及被強制爆時本來的「自然爆點」。
- **自動連玩 + 瞬間**：幾萬局幾秒跑完。
- **批量模擬**：用原碼的機器人玩家，讓有殺率和無殺率吃同一組亂數，比較 RTP 分布、p 分布和樣本場次。

## 遊戲數學

爆點：

```
odds = round(1 / U^(1/p), 2)      U ~ Uniform(0, 1)
P(爆點 ≥ x) = x^(−p)
```

p = 1 時，任何「在 x 倍收手」的策略期望 RTP 都是 x × 1/x = 100%。

殺率控制器只在有殺率時動作，看的是「到上一局為止的本 session 累計 RTP」：

```
RTP > 120%:
    duration += 1
    若 duration > 5 或 本局注額 > 2 × 典型注額:
        30% 機率 → 爆點改成 round(Uniform(1, 1.05), 2)，p += 0.1（上限 2.5）
RTP ≤ 120%:
    duration = 0，p = 1
```

典型注額來自 `targetfunction(最近 50 注)`：排序後各去掉一個最小、最大值，切成低、中、高三段，分別以 min、平均、max 為中心算平均平方差，取總和最小的切法，回傳人數最多那段的平均。

## 發現

| 玩家 | 每場局數 | 無殺率 RTP | 有殺率 RTP | 差 |
|---|---:|---:|---:|---:|
| 原碼機器人 | 100 | 100.21% | 94.86% | −5.35 pp |
| 原碼機器人 | 1,000 | 99.97% | 97.78% | −2.19 pp |
| 原碼機器人 | 10,000 | 99.92% | 99.55% | −0.37 pp |
| 平注，5× 收手 | 100 | 100.21% | 96.28% | −3.93 pp |
| 平注，1.9× 收手 | 100 | 100.30% | 99.53% | −0.77 pp |
| 平注，1.9× 收手 | 75,700 | 100.268% | 100.267% | 0.00 pp |
| 平注，1.01× 收手 | 75,700 | 100.497% | 100.497% | 0.00 pp |

1. **沒有殺率時莊家沒有優勢。** 爆點用四捨五入而不是無條件捨去，等於每個爆點多送 0.005，固定在 x 倍收手的 RTP 是 x / (x − 0.005)：1.01× 是 100.50%，1.9× 是 100.26%，5× 是 100.10%。
2. **控制器有盲區。** 它只看「session 累計 RTP > 120%」和「相對自己注額的暴衝」。平注、低倍收手、長 session 幾乎不會觸發；1.01× 收手時累計 RTP 最高只有 101%，控制器永遠不會出手，每局穩定 +0.5%。
3. **抽成隨 session 變長而變薄。** 累計 RTP 越玩越難衝過 120%，所以控制器主要在 session 前段出手，本質上是對前段波動收稅。
4. **強制爆會留下痕跡。** 原碼機器人、每場 100 局時，爆點 ≤ 1.05× 的局從 5.2% 升到 8.6%。

建議修法：把莊家優勢寫進爆點公式，例如 `odds = max(1.00, floor(100·(1−h)/U) / 100)`。這樣每個收手點的 RTP 都是 1 − h，跟玩家選哪個收手點無關；殺率控制器只用來控管曝險。

## 驗證

- `targetfunction`：4,000 組注額歷史，回傳值逐位元相同。JS 版是 O(n²)，但浮點運算順序和原碼的 O(n³) 迴圈一樣。
- 整局流程：錄下原碼每一次 `np.random` 的輸出，再餵給 JS 引擎重播。殺率開、關共 13,000 局，每局的累計 RTP、`Oboom`、`capture`、`powerstat`、`stat` 和總數全部相同，亂數也剛好用完。

重跑對拍（Python 3 + numpy + matplotlib，Node 18 以上）：

```bash
python3 verify/tf_cases.py
python3 verify/trace_original.py 1 20 1 verify/tape_on.json tape
python3 verify/trace_original.py 1 20 0 verify/tape_off.json tape
node verify/test_engine.js verify/tape_on.json verify/tape_off.json
```

## 檔案

| 路徑 | 內容 |
|---|---|
| `index.html` | 可玩頁面，由 `build.py` 產生，引擎已內嵌 |
| `src/engine.js` | 引擎：爆點、殺率控制器、`targetfunction`、批量模擬 |
| `src/template.html` | 頁面原始檔 |
| `build.py` | 把 `src/` 組成 `index.html` |
| `original/crashsimulation.py` | 原始 Python 模擬 |
| `verify/` | 與原碼對拍的腳本 |
| `analysis/` | 大樣本、平注策略與破產機率的模擬 |

## 試玩版和原碼的差異

- 收手點由玩家決定；原碼的 1/V^(1/p) 機器人只用在批量模擬。
- 每個試玩 session 從 p = 1 開始；原碼的 p 會延續到下一個 cycle，批量模擬保留這個行為。
- 到 360× 自動收手；原碼是「目標 ≥ 360 時賠 360」，只有目標超過 360 且爆點落在兩者之間時結果不同。
