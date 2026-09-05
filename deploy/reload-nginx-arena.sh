#!/bin/sh
set -eu
if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/arena.yomage.com ]; then
    /usr/sbin/nginx -t
    /bin/systemctl reload nginx
fi
