#!/bin/bash
export PORT=3000
export BASE_PATH=/
cd /home/runner/workspace/cloned-repo
exec pnpm --filter @workspace/outlook-viewer run dev
