#!/bin/bash
export PORT=5000
cd /home/runner/workspace/cloned-repo
exec pnpm --filter @workspace/api-server run dev
