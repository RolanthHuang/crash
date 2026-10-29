"""Build index.html (the playable page served by GitHub Pages) from src/template.html + src/engine.js.

usage: python3 build.py
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
tpl = open(os.path.join(ROOT, "src", "template.html"), encoding="utf-8").read()
engine = open(os.path.join(ROOT, "src", "engine.js"), encoding="utf-8").read()
assert tpl.count("/*__ENGINE__*/") == 1, "engine placeholder missing"
page = tpl.replace("/*__ENGINE__*/", engine)

# template = head material (title, fonts, style) followed by the body markup
head, sep, body = page.partition('\n<div class="wrap">')
assert sep, "body start not found"
head = "\n".join(line for line in head.splitlines() if "claude:viewport-fit-sides" not in line)

FAVICON = ("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>"
           "<rect width='64' height='64' rx='14' fill='%23081430'/>"
           "<path d='M10 52 Q34 50 52 14' stroke='%23FF7A2E' stroke-width='6' fill='none' stroke-linecap='round'/>"
           "<circle cx='52' cy='14' r='6' fill='%23FFE9C9'/></svg>")
DESC = "火箭 Crash 遊戲：無殺率／有殺率／盲測三個 session、後台殺率控制器視角與批量模擬；引擎與原始 Python 模擬逐局一致。"

html = f"""<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="{DESC}">
<meta property="og:title" content="Crash 殺率試玩台">
<meta property="og:description" content="{DESC}">
<meta property="og:type" content="website">
<link rel="icon" href="{FAVICON}">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}body{{margin:0}}</style>
{head}
</head>
<body>
<div class="wrap">{body}
</body>
</html>
"""
open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(html)
print("index.html", len(html.encode("utf-8")), "bytes")
