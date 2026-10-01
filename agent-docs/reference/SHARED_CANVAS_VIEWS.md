---
name: shared-canvas-views
description: The comparative views (synteny, dotplot): fetch on KeyedFetchMixin, one canvas owned by a container and shared by several displays, `sharedBackendKey`, the empty frame that must paint, readiness as a required prop. Read before touching either view or building a shared canvas.
kind: spec
---

# Shared-canvas comparative views

Synteny and dotplot are a third display shape, alongside the two LGV fetch
foundations in
[ARCHITECTURE.md § Display stacks](../ARCHITECTURE.md#display-stacks). Two
independent things make them different: their fetch composes `KeyedFetchMixin`
rather than either LGV foundation, and their canvas belongs to a container model
rather than a display. The keying, empty-frame and readiness rules apply to any
container owning a canvas that several children draw on.

## The third shape: a keyed fetch onto a canvas the view owns

Both comparative displays (`LinearSyntenyDisplay`, `DotplotDisplay`) compose
`BaseDisplay` + `ComparativeFetchMixin` (`@jbrowse/synteny-core`), which is
`KeyedFetchMixin` (`@jbrowse/display-kit`: `FetchMixin` plus the
`currentFetchKey` / `loadedFetchKey` compare) under the two-way loading answer a
shared canvas wants.
[ADR-054](../architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md)
kept the separate fetch and
[ADR-105](../architecture-decision-records/adr-105-the-comparative-displays-compose-fetchmixin.md)
records why each ground lapsed. The split of members:

- **`FetchMixin`**: the rotation `cancelFetchByUser` stops (lent to the skeleton, so
  the stop and the flag are one action; a flag alone is not a cancel), `isLoading`,
  `error`, the status window, `reloadCounter` + `reload()` behind Retry,
  `fetchCanceled`, and the `fetchInert` hook ([SVG_EXPORT.md](SVG_EXPORT.md)).
- **`KeyedFetchMixin`**: the `viewSignature` hook each display fills with its two
  views' state, `currentFetchKey` over it plus settings and adapter axes, the
  `loadedFetchKey` stamp `commitFetchResult` writes, and `dataCurrent`.
- **`ComparativeFetchMixin`**: `fetchLanded` / `hasDrawable` hooks, `loading` (first
  load, full overlay) versus `refetching` (stale plot on screen, corner chip),
  `svgReady`, `assembliesSwapped`.

**A comparative cancel is durable until Retry**, the one deliberate difference from
the LGV families: these displays sit on single RPCs that run for minutes, a cancel any
pan undoes is not one, and their viewport *is* their fetch input, so the LGV
clear-on-viewport-change would un-cancel on every trigger.

`installComparativeFetchAutorun` (`@jbrowse/synteny-core`) is a declaration over the
shared `installFetch` skeleton: the lent rotation, `fetchMixinLifecycle`'s
begin/end/error trio, `currentFetchKey` against `loadedFetchKey`, `commitFetchResult`.
It adds the refName rename a `run` is handed; each display supplies three
`FetchPhases`. The skeleton logs what it `setError`s, so displays do not log twice.
Its autorun body is synchronous and kicks the awaits into their own function, since an
async body stops tracking at its first await. It installs `makeRetryContractCheck`
too, exempted by `fetchInert` (ADR-081). `installAssemblySwapCheck` is the companion
for the one-shot reversed-assembly check, shared for its two `isAlive` guards. The
family runs the shared `computeSvgReady` policy through a key compare
(`isDataCurrent`), which is where the stale-capture bugs lived
([SVG_EXPORT.md](SVG_EXPORT.md) §"On-screen capture gate").

**Tracked reads.** The autoruns track `currentFetchKey` (carrying the adapter axis) and
read every value behind it `untracked`, so a pan inside the buffered window cannot
refire the fetch. Two more reads are tracked **before** `prepare()`'s bail-outs, and
only a user gesture moves either:

- `reloadCounter`: after a failure every input is unchanged, so `prepare` recomputes the
  same key and nothing refires; this is why clearing the error left Retry inert
  ([FETCH_KEYS.md](FETCH_KEYS.md#the-global-fetch-trigger-list-must-be-read-unconditionally);
  "reload() refires the fetch with no input change" pins it).
- `fetchCanceled`, which CLOSES the gate while a cancel stands. `reload()` is the only
  thing that reopens it, so a `reload()` bumping the counter without clearing the flag
  wakes the autorun into a refused run ("reload() reopens the gate" pins it).

**Nothing fetch-derived may join those reads, and `error` is the one that will be
reached for**: the skeleton clears it at every fetch start and sets it on failure, so a
tracked read turns one failure into an unbounded retry loop against the server that just
failed. Nothing checks it (same law as `installGlobalFetchAutorun`'s "`rpcProps()` must
never return fetch-derived state").

Both scope their fetch through `syntenyFetchRegions`: the visible blocks widened by a
pan buffer and snapped to a buffer-sized grid, so a pan inside the buffer neither
refetches nor exposes an unfetched strip. Synteny scopes its query axis, dotplot its h
axis. Synteny's `showOffscreenMates` adds a second query on the target axis
(`targetFetchRegions`), flipped into the query perspective before drawing
(SYNTENY_LOD.md § The second synteny fetch, on the target axis).

## The canvas belongs to the container, not the display

Both put their `RenderLifecycleMixin` *above* the display: dotplot on the view,
synteny on `LinearSyntenyViewHelper` (the per-level model), so a 3-row stack has two
canvases, each shared by that level's tracks. Upload callbacks therefore key by
`sharedBackendKey` and diff through `installUpload`, deleting each departed key
individually, because an active-set prune from one display's map would wipe its
siblings' buffers.

**A shared canvas is laid out by the model that owns it, never by the displays drawing
on it.** The canvas is absolutely positioned and contributes no height, so the band
reserves its own (`level.height`). Sizing from displays works until a band has none (an
assembly pair with no synteny dataset, which the import form launches deliberately, or
the last track hidden): `LinearSyntenyRenderArea` reserved 0px while the canvas still
painted the level's height. `SVGLinearSyntenyView` lays out from `level.height`
directly.

## Key by `sharedBackendKey(self.id)`, never a list index

An index renumbers when a sibling is hidden or reordered, so the survivor's key names a
slot holding another display's bytes: the identity diff re-uploads every later buffer,
and a frame landing between draws one display's geometry under another's parameters.

## The empty frame is load-bearing

When the canvas belongs to the container, nothing else repaints it after a track is
hidden, so a render callback that skips the tick "because no display has geometry"
leaves the hidden track's pixels on screen with its buffer deleted. This family's
callback is therefore *unconditional* where the per-region family's is gated, and both
backends clear before drawing, so painting zero displays is the wipe:

- `renderState` is a **resolved getter**, never `undefined`; an empty block list is a
  real frame.
- `canRender` carries "view isn't measured yet" (`view.initialized`), so the autorun
  pair idles instead of the state going nullable.
- The render repaints the whole canvas through `renderBlocks`, whose scaffold clears
  whether or not a block survives (transparent for dotplot; synteny declares a
  `clearColor` because its indel wedges are pre-blended against a known colour).
- A view or level with nothing to show still resolves `canvasDrawn`, hence `settled` and
  `data-display-drawn`. Both return what `renderBlocks` answered and say the other half
  through `paintInert` (a plot with no tracks, a band with no ribbon track); a track
  still fetching leaves the map empty too, and only one of the two is finished.

`products/jbrowse-web/src/tests/SharedCanvasHideTrack.test.tsx` holds both views to
this.

## Readiness is a required prop, not a selector list

Both views publish `settled` as `data-display-drawn`, a **required** prop on
`RenderCanvas` (ADR-065 deleted the per-view `_done` testids). `PENDING_DISPLAYS`
(`@jbrowse/browser-test-utils`) waits on that attribute, so these two answer "has
everything painted?" as every LGV display does. It is required because the
hand-enumerated list forgot dotplot (an unpainted dotplot counted as finished and a
capture landed blank) and a stale third copy lived in the desktop harness. **A readiness
signal published as a required prop cannot forget a view; a selector list can.** Use
that shape wherever a cross-cutting check would be a list someone must append to (as
`fetchInert` is a mixin hook, not a getter each display invents).

`canvasDrawn` means "a block drew" on both
([ADR-009](../architecture-decision-records/adr-009-canvas-drawn-reliability.md)'s
meaning). Data-readiness rides separately through `displaysSettled`, and neither view
drives a scrim off `canvasDrawn`.
