from pathlib import Path
import base64

directory = Path(__file__).parent
html = (directory/'migration.template.html').read_text()
for marker, name in [('__MUSIC_ONE__','music-1.mp3'),('__MUSIC_TWO__','music-2.mp3')]:
    html = html.replace(marker, base64.b64encode((directory/name).read_bytes()).decode())
output = directory.parent/'artifacts/builds/migration/index.html'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html)
print(f'{output}\n{output.stat().st_size:,} bytes; no network resources')
