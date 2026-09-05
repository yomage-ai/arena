"""Verify a published release over HTTPS against its deployment manifest."""
import hashlib
import json
from pathlib import Path
import sys
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import urlopen

manifest = json.loads(Path(sys.argv[1]).read_text())
origin = 'https://' + manifest['domain']
mime = {'.html': 'text/html', '.js': 'application/javascript',
        '.mjs': 'application/javascript', '.css': 'text/css',
        '.json': 'application/json', '.woff2': 'font/woff2'}
for item in manifest['files']:
    url = origin + '/' + quote(item['path'])
    try:
        response = urlopen(url, timeout=20)
    except HTTPError as error:
        response = error
    expected_status = 404 if item['path'] == '404.html' else 200
    assert response.status == expected_status, (url, response.status)
    assert hashlib.sha256(response.read()).hexdigest() == item['sha256'], url
    suffix = Path(item['path']).suffix
    if suffix in mime:
        assert response.headers.get_content_type() == mime[suffix], url
for missing in ['/not-a-work', '/.git/config', '/source-projects/lunar-explorer/package.json']:
    try:
        urlopen(origin + missing, timeout=20)
        raise AssertionError('Unexpected accessible path: ' + missing)
    except HTTPError as error:
        assert error.code == 404
print(f'HTTPS verified: {len(manifest["files"])} files match, MIME types correct, missing/private paths return 404.')
