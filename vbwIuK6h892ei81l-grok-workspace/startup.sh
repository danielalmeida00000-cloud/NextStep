#!/bin/sh
set -eu
cd /workspace

export STRIPE_WEBHOOK_SECRET='whsec_iYn5J1CFGLIr90Kg8RFYzIiWAlUhXhGO'
node scripts/preview.mjs stop || true
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
