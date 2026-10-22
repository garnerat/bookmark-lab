#!/usr/bin/env bash
# One command from this folder. Installs the pinned CPU stack if imports fail,
# then scores (or reuses saved scores) and writes outputs/.
set -euo pipefail
cd "$(dirname "$0")"
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-4}"
export MKL_NUM_THREADS="${MKL_NUM_THREADS:-4}"
if ! python3 -c "import torch, transformers, matplotlib" >/dev/null 2>&1; then
  python3 -m pip install -r requirements.txt
fi
exec python3 run.py "$@"
