"""Install the first arena release from the three verified files uploaded to /tmp."""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import zipfile

manifest = json.loads(Path('/tmp/deployment-arena.json').read_text())
assert manifest['domain'] == 'arena.yomage.com'
release = manifest['release']
assert re.fullmatch(r'\d{8}T\d{6}Z', release)
archive = Path('/tmp/ai-arena-deploy.zip')
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['archiveSha256']
base = Path('/var/www/arena.yomage.com')
available = Path('/etc/nginx/sites-available/arena.yomage.com')
enabled = Path('/etc/nginx/sites-enabled/arena.yomage.com')
assert not base.exists() and not available.exists() and not enabled.is_symlink()

destination = base / 'releases' / release
expected = {item['path']: item['sha256'] for item in manifest['files']}
with zipfile.ZipFile(archive) as bundle:
    assert {item.filename for item in bundle.infolist() if not item.is_dir()} == set(expected)
    for name, digest in expected.items():
        relative = Path(name)
        assert not relative.is_absolute() and not any(p.startswith('.') for p in relative.parts)
        data = bundle.read(name)
        assert hashlib.sha256(data).hexdigest() == digest, name
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        target.chmod(0o644)
(base / 'acme' / '.well-known' / 'acme-challenge').mkdir(parents=True)
shutil.copyfile('/tmp/deployment-arena.json', base / f'{release}.json')
(base / 'current').symlink_to(destination, target_is_directory=True)
shutil.copyfile('/tmp/arena.yomage.com.nginx.conf', available)
available.chmod(0o644)
enabled.symlink_to(available)
try:
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
except Exception:
    enabled.unlink()
    available.unlink()
    subprocess.run(['nginx', '-t'], check=True)
    subprocess.run(['systemctl', 'reload', 'nginx'], check=True)
    raise
print(f'Published {len(expected)} files at {destination}; Nginx reloaded.')
