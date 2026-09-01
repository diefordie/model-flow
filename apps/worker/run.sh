#!/usr/bin/env bash
# Worker launcher — sets up LD_LIBRARY_PATH for numpy/sklearn wheels in the
# Nix Python venv. Add new libs to SROOT as needed.
#
# Usage:
#   ./run.sh                                # boot uvicorn on $WORKER_PORT (8001)
#   ./run.sh test                           # run pytest
#   .venv/bin/python <args>                 # raw python (LD_LIBRARY_PATH already set)

set -euo pipefail

cd "$(dirname "$0")"
SROOT="/nix/store/y5sszfsvxi1q1pnpxxm9r0c72imwmcs4-steam-run-1.0.0.87-fhsenv-rootfs"
export LD_LIBRARY_PATH="$SROOT/usr/lib64:$SROOT/lib64:$SROOT/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"

cmd="${1:-serve}"

case "$cmd" in
    serve)
        shift || true
        exec .venv/bin/python -m uvicorn src.main:app \
            --host 0.0.0.0 --port "${WORKER_PORT:-8001}" "$@"
        ;;
    test)
        shift || true
        exec .venv/bin/python -m pytest "$@"
        ;;
    python)
        shift || true
        exec .venv/bin/python "$@"
        ;;
    *)
        echo "usage: $0 {serve|test|python} [args...]" >&2
        exit 64
        ;;
esac