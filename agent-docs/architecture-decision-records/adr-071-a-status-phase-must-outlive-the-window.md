---
status: Accepted
summary: 'Every RPC status write goes through the one throttle window, the phase-end clear included, so a phase shorter than the window never paints'
---

# ADR-071: A status phase must outlive the throttle window to paint

## Status

Accepted

## Context

An RPC `statusCallback` carries two kinds of write. A phase helper
(`updateStatus`, `withProgress`, `downloadStatus`) writes a label when work
begins and `''` when it ends; inside a phase, byte ticks and loop counters write
a determinate `{message, current, total}` several times a second.
`createStatusThrottle` thins the stream to one write per 100ms, because each
write lands on an observable that repaints whatever loading indicator is up.

`createGuardedStatusSink` exempted `''` from that window. The exemption ran
through `runNow`, which applies the write immediately **and** reopens the window
— so the write after a `''` also passed on the leading edge. A phase boundary is
a close immediately followed by the next phase's open, so every boundary got a
free pass in both directions, and the window applied to nothing but the ticks
inside a phase.

`executeRenderFeatureData` opens four phases in sequence (byte gate, feature
download, layout, collect). On a track whose adapter index is already cached,
three of them run in under 10ms. Driving the real executor through the real sink
and recording what `LoadingOverlay` would render:

```
 3ms  Downloading features     [indeterminate sweep]
18ms  Loading                  [indeterminate sweep]
18ms  Computing layout 0%      [determinate bar]
19ms  Loading                  [indeterminate sweep]
19ms  Collecting render data   [indeterminate sweep]
27ms  Loading                  [indeterminate sweep]
```

Six repaints in 27ms. None of the six is up long enough to read, the label
alternates with a bare "Loading" (`statusMessageText('')` is `undefined`, and the
overlay renders `statusMessage || 'Loading'`), and the bar mounts for one frame
at 0% because `withProgress` writes `report(0)` before the loop and a
sub-millisecond loop never reaches its next time-gated emit. On a cold fetch the
same tail runs after the download, so the bar goes 92% → gone → 0% → gone.

The exemption was deliberate, and its stated reason names this behavior as the
goal: charging the clear a full window "drops outright the label of any phase
shorter than one". Which is the rule we want. A phase that lives 3ms carries no
information a reader can collect, and paints anyway.

## Decision

Route every status through `throttle.run`, `''` included.
`createGuardedStatusSink` no longer takes `runNow`.

The invariant the exemption protected holds without it. `''` lands in the
throttle's single `pending` slot, so it displaces the percentage queued behind it
rather than queueing after it, and a finished phase's progress can never reappear
on screen. What the change costs is latency: a `''` with nothing behind it lands
up to a window late. No owner depends on that, because each ends its stream with
an explicit clear of its own — `FetchMixin.stopActiveFetch`,
`createStopTokenRotation.end`, `assembly.loadPre`'s `finally`, `useFetch`'s
`finally`, and the clustering autorun's `setStatusMessage(undefined)`.

The three remaining sinks end differently and need nothing: `useMateDiscovery`
and `DiagonalizeDialog` close their own `isCurrent` when the work settles, so a
queued `''` is dropped rather than delivered, and neither renders the status
after that point.

`runNow` stays on `createStatusThrottle` for exactly those hand-written clears.

Measured over the same harness, 30 repetitions each:

| fetch                            | before | after |
| -------------------------------- | ------ | ----- |
| warm cache, ~30ms                | 6      | 1.00  |
| cold, 200–278ms download         | 9      | 2.9   |
| cold, durations aligned to 100ms | 9      | 4.0   |
| four regions, ~600ms             | 12     | 7     |

A bar that runs backwards appeared in 0 of 30 jittered runs and 1 of 30 with
every duration deliberately placed on a window edge.

## Rejected alternatives

**Wrap the executor body in one outer phase**, so inner phases close back to a
stable label instead of `''`. Rejected: it does not reduce the write count at
all — still one write per boundary, carrying "Loading features" instead of
"Loading" — and it makes the first painted label the generic outer one rather
than "Downloading features". The channel stops claiming idle mid-operation, which
is a real correctness gain, but nothing observes the channel at that resolution:
`pageBusy` ORs the status message with `[data-display-phase="loading"]`, so a
transient `''` cannot make a loading page read as quiet.

**Report one weighted fraction per fetch** (download 0→0.8, layout 0.8→0.95,
collect 0.95→1) so the bar is monotonic across the whole RPC. Rejected: the
weights are wrong by construction — download dominates a cold fetch, layout
dominates a dense region — it costs the phase name, which is the useful half when
diagnosing a slow track, and every RPC that reports progress would have to adopt
it in step or `aggregateStatus` mixes a fraction with a byte count. Nothing needs
it once sub-window phases stop painting.

**Dwell on label changes**: hold a new label on the trailing edge and let a newer
status supersede it, so a label paints only if it will stay. Strictly better than
this ADR on paper, and it removes the one repaint a warm fetch still spends.
Rejected for now because it needs state in the throttle (the pending write's
label) to buy one frame, and 1 repaint per fetch is not a stutter.

**Suppress a determinate bar at `current === 0`**, so a phase mounts a bar only
once it has real progress. Held, not rejected: it is the fix if the 0% frame ever
reads badly, and it is a one-line change to the determinate-vs-indeterminate
decision. Measured at 1 occurrence in 30 worst-case fetches, which does not earn
a change to a helper every status consumer shares.

## Consequences

- The overlay is a coarser view of the channel than it was, deliberately. A phase
  is now something a reader can see, or something that finished too fast to
  matter — never a flash. Anything that needs the full stream reads the
  `RpcStatus` values, not the model field: `SaveTrackData` renders
  `statusProgressLabel(status)` from the raw status and is untouched.
- Every display gets it, not just canvas. Alignments and variants open phases the
  same way and had the same tail.
- `''` losing its leading edge changes what a test observes at the moment it
  writes. `progress.test.ts` asserted the clear appears synchronously; it now
  asserts the clear displaced the percentage and lands on the trailing edge,
  which is the guarantee that was always the point.
- Keeping sub-window statuses off the screen hid a second defect rather than
  fixing it: `aggregateStatus` summed `current`/`total` across slots in different
  phases, so a fan-out where one region downloaded bytes while another laid out
  features produced a fraction scaled by whichever slot held the larger raw
  total. ADR-072 addresses that separately.

## Revisit if

- A single label swap per fetch still reads as a flicker when panning. The fix is
  the label dwell above, in the throttle, not a longer window — a longer window
  delays real progress without touching the boundary.
- A phase that genuinely matters becomes invisible because it consistently
  finishes inside the window. That is an argument about the window's length
  (100ms) and belongs at `STATUS_THROTTLE_MS`, not at the exemption.
