#!/usr/bin/env python3
"""Bundle the editable source files into one offline HTML file."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
template = (ROOT / "src" / "index.template.html").read_text(encoding="utf-8")
styles = (ROOT / "src" / "styles.css").read_text(encoding="utf-8")
game = (ROOT / "src" / "game.js").read_text(encoding="utf-8")

assert template.count("/*__STYLES__*/") == 1
assert template.count("/*__GAME__*/") == 1
assert "</script" not in game.lower()

output = template.replace("/*__STYLES__*/", styles).replace("/*__GAME__*/", game)
target = ROOT / "index.html"
target.write_text(output, encoding="utf-8")
print(f"Built {target} ({target.stat().st_size:,} bytes)")
