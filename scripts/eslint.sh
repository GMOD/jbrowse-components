#!/bin/sh
# ESLint's `--concurrency=auto` starts one worker per two cores, each ~1.1GB:
# 7.4GB and seven cores for one whole-tree run on this 16-core box. A dozen
# agents doing that at once swap the machine, so an agent run (CLAUDECODE, the
# same signal heavy-run-slot.sh and jest use) caps it at two workers.
# JB_ESLINT_CONCURRENCY overrides either default.
if [ -n "${CLAUDECODE:-}" ]; then
  default=2
else
  default=auto
fi
exec eslint --concurrency="${JB_ESLINT_CONCURRENCY:-$default}" "$@"
