#!/bin/bash
# Runs "$@" holding one of JB_HEAVY_SLOTS machine-wide slots, so the agent
# worktrees that typecheck or type-aware lint at the same time queue instead of
# all resident at once. Per-run budgets cannot do this: each run sizes itself as
# though alone. Each gated run is a whole-repo tsgo program at ~4GB, so twelve
# agents ungated is ~48GB on a 30GB box, and the wall-clock cost is paging.
#
# The slot directory is fixed under /tmp rather than under rootDir or $TMPDIR.
# Every worktree is a full checkout and a session may set its own TMPDIR, and a
# private set of slots gates nothing.
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

dir=/tmp/jb-heavy-slots
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
      break 2
    fi
    exec {fd}>&-
  done
  # Once, on the first full sweep that finds nothing. A run that queues behind
  # three others is indistinguishable from a hung one otherwise, and the whole
  # point of the gate is that queueing is the expected case.
  if [ -z "$waited" ]; then
    waited=1
    echo "waiting for one of $slots machine-wide slots (JB_HEAVY_SLOTS=0 disables)" >&2
  fi
done

# A slot is the one thing a run can know about the machine, so say so rather
# than leaving each child to re-derive it: `jest.config.js` sizes its workers
# off the load average precisely because nothing gates it, and that reading is
# wrong for a command that reached here.
export JB_HEAVY_SLOT=$i

# This shell holds the lock and the command runs as its child, never via
# `exec`. An inherited lock fd does not survive the command re-executing
# itself: typescript7's tsc wrapper hands off to the native binary with Node's
# process.execve, which drops it, so an exec'd slot freed the moment tsc
# started and gated nothing. The kernel still drops the lock however this shell
# dies, so a slot is never left stale.
#
# Backgrounded so a trap can forward signals while it waits, with stdin handed
# over explicitly since a background command otherwise reads /dev/null.
child=
trap '[ -n "$child" ] && kill -TERM "$child" 2>/dev/null' TERM INT HUP
exec {stdin}<&0
"$@" <&"$stdin" {stdin}<&- {fd}>&- &
child=$!
while :; do
  wait "$child"
  status=$?
  kill -0 "$child" 2>/dev/null || exit "$status"
done
