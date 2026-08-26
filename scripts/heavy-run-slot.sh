#!/bin/bash
# Runs "$@" holding one of JB_HEAVY_SLOTS machine-wide slots, so the several
# agent worktrees that typecheck concurrently queue instead of all resident at
# once. Per-run budgets cannot do this: each run sizes itself as though alone,
# so N agents each politely taking one checker still total N checkers. Measured
# on 16 cores at load 55: 7 concurrent tsc processes held 10.2GB and the box
# was 33GB into swap, where the wall-clock cost is paging, not CPU.
#
# The slot directory is deliberately machine-global rather than under rootDir.
# Every worktree is a full checkout, so a per-checkout path would give each its
# own private set of slots and gate nothing.
#
# Holding the lock is an fd this shell keeps across `exec`, which is what makes
# a crash safe: the kernel drops flock when the process dies, however it dies,
# so a slot is never left stale and nothing has to clean up after a SIGKILL.
set -u

slots=${JB_HEAVY_SLOTS:-3}

# Agent runs only. A human at a terminal gets the machine undiluted, and an
# unset slot count or a missing flock(1) falls through rather than failing a
# typecheck over a gate that is only ever an optimisation.
case $slots in
  '' | *[!0-9]*) exec "$@" ;;
esac
if [ "$slots" -eq 0 ] || [ -z "${CLAUDECODE:-}" ] || ! command -v flock >/dev/null
then
  exec "$@"
fi

dir=${TMPDIR:-/tmp}/jb-heavy-slots
mkdir -p "$dir" 2>/dev/null || exec "$@"

# Sweep the slots rather than blocking on one. Blocking on a slot picked up
# front convoys: a waiter queued behind a long run sits there while a different
# slot frees, which measured 7s against an ideal 4s on six 2s jobs over three
# slots. Re-sweeping with a short timeout brought that to 5s.
waited=
while :; do
  for i in $(seq 1 "$slots"); do
    exec {fd}>"$dir/$i" || exec "$@"
    if flock -w 0.25 "$fd"; then
      exec "$@"
    fi
    eval "exec $fd>&-"
  done
  # Once, on the first full sweep that finds nothing. A run that queues behind
  # three others is indistinguishable from a hung one otherwise, and the whole
  # point of the gate is that queueing is the expected case.
  if [ -z "$waited" ]; then
    waited=1
    echo "waiting for one of $slots machine-wide slots (JB_HEAVY_SLOTS=0 disables)" >&2
  fi
done
