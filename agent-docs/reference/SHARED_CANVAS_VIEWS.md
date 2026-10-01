---
name: shared-canvas-views
description: What rules govern the comparative views (synteny, dotplot) — fetch on KeyedFetchMixin, one canvas owned by a container and shared by several displays, `sharedBackendKey`, the empty frame that must paint, readiness as a required prop?
kind: spec
---

# Shared-canvas comparative views

Synteny and dotplot are a third display shape beside the two LGV fetch
foundations in
[ARCHITECTURE.md § Display stacks](../ARCHITECTURE.md#display-stacks): their
fetch composes `KeyedFetchMixin`, and their canvas belongs to a container model
rather than a display. The keying, empty-frame and readiness rules apply to any
container owning a canvas that several children draw on.

## A keyed fetch onto a canvas the view owns

`LinearSyntenyDisplay` and `DotplotDisplay` compose `BaseDisplay` +
`ComparativeFetchMixin` (`@jbrowse/synteny-core`) over `KeyedFetchMixin`
(`@jbrowse/display-kit`).
[ADR-054](../architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md)
kept the separate fetch and
[ADR-105](../architecture-decision-records/adr-105-the-comparative-displays-compose-fetchmixin.md)
records why each ground lapsed. `installComparativeFetchAutorun` is a declaration
over the shared `installFetch` skeleton; each display supplies three
`FetchPhases`. Its autorun body is synchronous and kicks the awaits into their own
function, since an async body stops tracking at its first await.

**A comparative cancel is durable until Retry**, the one deliberate difference
from the LGV families: these displays sit on single RPCs that run for minutes, and
their viewport is their fetch input, so the LGV clear-on-viewport-change would
un-cancel on every pan.

**Tracked reads.** The autoruns track `currentFetchKey` and read every value
behind it `untracked`, so a pan inside the buffered window cannot refire the
fetch. Two more reads are tracked before `prepare()`'s bail-outs, and only a user
gesture moves either:

- `reloadCounter`: after a failure every input is unchanged, so without it Retry
  is inert ([FETCH_KEYS.md](FETCH_KEYS.md#the-global-fetch-trigger-list-must-be-read-unconditionally)).
- `fetchCanceled`, which closes the gate while a cancel stands. `reload()` is the
  only thing that reopens it, so a `reload()` that bumps the counter without
  clearing the flag wakes the autorun into a refused run.

**Nothing fetch-derived may join those reads, and `error` is the one that will be
reached for**: the skeleton clears it at every fetch start and sets it on failure,
so a tracked read turns one failure into an unbounded retry loop against the
server that just failed.

`syntenyFetchRegions` scopes both fetches (visible blocks widened by a pan buffer
and snapped to a grid). Synteny's `showOffscreenMates` adds a second query on the
target axis (SYNTENY_LOD.md § The second synteny fetch, on the target axis).

## The canvas belongs to the container, not the display

`RenderLifecycleMixin` sits above the display: on the dotplot view, and on
`LinearSyntenyViewHelper` (the per-level model) for synteny, so a 3-row stack has
two canvases. Upload callbacks key by `sharedBackendKey(self.id)` and diff through
`installUpload`, deleting each departed key individually, because an active-set
prune from one display's map would wipe its siblings' buffers. **Never key by a
list index**: it renumbers when a sibling is hidden or reordered, so the
survivor's key names a slot holding another display's bytes.

**The model that owns a shared canvas lays it out, never the displays drawing on
it.** The canvas is absolutely positioned and contributes no height, so the band
reserves its own (`level.height`). Sizing from displays breaks when a band has
none (an assembly pair with no synteny dataset, or the last track hidden):
`LinearSyntenyRenderArea` once reserved 0px while the canvas still painted.

## The empty frame is load-bearing

When the canvas belongs to the container, nothing else repaints it after a track is
hidden, so a render callback that skips the tick "because no display has geometry"
leaves the hidden track's pixels on screen with its buffer deleted. This family's
callback is therefore unconditional where the per-region family's is gated, and
both backends clear before drawing, so painting zero displays is the wipe:

- `renderState` is a resolved getter, never `undefined`; an empty block list is a
  real frame.
- `canRender` carries "view isn't measured yet" (`view.initialized`), so the
  autorun pair idles instead of the state going nullable.
- A view or level with nothing to show still resolves `canvasDrawn`, hence
  `settled` and `data-display-drawn`. `paintInert` says the other half (a plot
  with no tracks, a band with no ribbon track).

`products/jbrowse-web/src/tests/SharedCanvasHideTrack.test.tsx` holds both views
to this.

## Readiness is a required prop, not a selector list

Both views publish `settled` as `data-display-drawn`, a required prop on
`RenderCanvas` (ADR-065). `PENDING_DISPLAYS` (`@jbrowse/browser-test-utils`) waits
on that attribute. The hand-enumerated list it replaced forgot dotplot, so an
unpainted dotplot counted as finished and a capture landed blank. A readiness
signal published as a required prop cannot forget a view; a selector list can.
`canvasDrawn` means "a block drew"
([ADR-009](../architecture-decision-records/adr-009-canvas-drawn-reliability.md));
data-readiness rides separately through `displaysSettled`.
