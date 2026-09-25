"""Install a verified static release and atomically switch the arena site to it.

Run as root on the existing server with the uploaded manifest and ZIP paths.
The previous release remains available for rollback.
"""

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import zipfile


manifest_path = Path(sys.argv[1])
archive_path = Path(sys.argv[2])
manifest = json.loads(manifest_path.read_text())
assert manifest["domain"] == "arena.yomage.com"
release = manifest["release"]
assert re.fullmatch(r"\d{8}T\d{6}Z", release)
assert hashlib.sha256(archive_path.read_bytes()).hexdigest() == manifest["archiveSha256"]

base = Path("/var/www/arena.yomage.com")
releases = base / "releases"
current = base / "current"
destination = releases / release
temporary = releases / (".install-" + release)
next_link = base / (".current-" + release)
assert releases.is_dir() and current.is_symlink()
assert current.resolve().is_dir()
assert not destination.exists() and not temporary.exists() and not next_link.exists()

expected = {item["path"]: item["sha256"] for item in manifest["files"]}
assert len(expected) == len(manifest["files"])
assert "index.html" in expected and "catalog.json" in expected

with zipfile.ZipFile(archive_path) as bundle:
    actual = {item.filename for item in bundle.infolist() if not item.is_dir()}
    assert actual == set(expected), "Archive and manifest contain different files"
    for name, digest in expected.items():
        relative = Path(name)
        assert not relative.is_absolute() and relative.parts
        assert all(part not in (".", "..") and not part.startswith(".") for part in relative.parts)
        assert hashlib.sha256(bundle.read(name)).hexdigest() == digest, name

    try:
        temporary.mkdir(mode=0o755)
        for name in expected:
            target = temporary / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(bundle.read(name))
            target.chmod(0o644)
        temporary.rename(destination)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise

previous = current.resolve()
shutil.copyfile(manifest_path, base / (release + ".json"))
next_link.symlink_to(destination, target_is_directory=True)
os.replace(next_link, current)
print(json.dumps({"release": release, "files": len(expected), "previous": str(previous), "current": str(current.resolve())}))
