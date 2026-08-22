---
name: shared-canvas-views
description: The comparative views (synteny, dotplot) — why they own their fetch instead of composing FetchMixin, how one canvas owned by a container model is shared by several displays, why the key must be sharedBackendKey and the empty frame must still paint, and how readiness is published as a required prop rather than a selector list. Read before touching a synteny or dotplot fetch, a shared backend's keyed upload, or a container that lays out a canvas for its children.
---

# Shared-canvas comparative views

Synteny and dotplot are a third display shape, alongside the two LGV fetch
foundations in
[ARCHITECTURE.md § Display stacks](../ARCHITECTURE.md#display-stacks). Two things
make them different, and they are independent: they own their fetch rather than
composing `FetchMixin`, and their canvas belongs to a container model rather than
to a display. Everything below follows from one or the other.

The rules here generalize past these two views. Any container that owns a canvas
several children draw on — a future stacked view, a multi-track overlay — hits
the keying, empty-frame and readiness sections unchanged.

## The third shape: displays that own their fetch

Folding them onto `FetchMixin` was proposed and rejected in
[ADR-054](../architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md),
which is the thing to read before re-proposing it. This is deliberate, not a
migration nobody finished.

Both comparative displays (`LinearSyntenyDisplay`, `DotplotDisplay`) compose
`BaseDisplay` + `SyntenyFetchStateMixin` (`@jbrowse/synteny-core`) and own their
fetch in a bare autorun. Neither gets `FetchMixin`'s cancel/stale machinery,
`RegionTooLargeMixin` or `loadedRegions`; instead the pieces are shared à la
carte:

- `SyntenyFetchStateMixin` holds `fetching` / `loadedFetchKey` /
  `assembliesSwapped` plus the overridable `fetchInert` hook (see
  [SVG_EXPORT.md](SVG_EXPORT.md) and "the on-screen twin" in ARCHITECTURE.md's
  SVG export section) — and the overlay's two buttons: `reloadCounter` +
  `reload()` behind Retry, `fetchCanceled` + `cancelFetchByUser()` behind
  Cancel. Those two are the same names `FetchMixin` publishes, so one overlay
  set draws all three families; what they are not is `FetchMixin`'s
  *implementation* of them, and one difference is deliberate. **A comparative
  cancel is durable until Retry** — no clear-on-viewport-change autorun here,
  because these displays sit on single RPCs that can run for minutes and a
  cancel any pan undoes is not one.
- The stop behind that cancel comes back the other way: the rotation lives in
  the installer's closure, so it hands `cancel` to the mixin at install
  (`setStopActiveFetch`). The flag alone would not do — nothing else rotates
  the token, so the cancelled RPC stays `isCurrent()` and commits its plot over
  the load the user stopped.
- `createStopTokenRotation` (core) does latest-wins token rotation plus the
  `isCurrent()` guard every post-await write is gated on.
- The autorun is `leadingEdgeAutorun`, the same leading-edge scheduler the
  other two fetch installers run on.

`installComparativeFetchAutorun` (`@jbrowse/synteny-core`) welds those together
with the loading/error flags and the refName rename into one skeleton both
displays install, so each supplies only the three `FetchPhases` — the same
contract the LGV global family runs on, over this family's own context. The
skeleton logs whatever it `setError`s, so neither display overrides `setError` to
log it a second time. Its autorun body is synchronous and kicks the awaits off
into their own function: an async body stops tracking at its first await, and
saying so structurally beats every read here happening to sit above it.

It installs `makeRetryContractCheck` too, so this family's Retry is watched like
the other two — `fetchInert` is the exemption, and it is the same field name the
LGV displays publish (ADR-081).

`installAssemblySwapCheck` is the companion installer for the one-shot
reversed-assembly check, off the fetch path — shared for its two `isAlive`
guards (teardown fires the parent atom the gate reads; the RPC resolves long
after a view can be closed), each invisible until a user closes a view mid-load.

They also answer the shared `dataCurrent` freshness question and run the shared
`computeSvgReady` policy, just via a signature compare (`isDataCurrent` over
`dotplotFetchKey` / synteny's `currentFetchKey`) rather than spatial coverage —
which is where the stale-capture bugs lived
([SVG_EXPORT.md](SVG_EXPORT.md) §"On-screen capture gate").

Both autoruns track the one signature computed (`currentFetchKey`) plus
`adapterConfig`, and read every value behind it `untracked`, so a pan inside the
buffered window can't refire the fetch. The third tracked read is
`SyntenyFetchStateMixin`'s `reloadCounter`, taken **before** `prepare()`'s
bail-outs: after a failure every fetch input is unchanged, so `prepare`
recomputes the same key and nothing refires the autorun — which is why clearing
the error was not enough and the banner's Retry was inert on both views. Same
law, and the same one-line fix, as the global family's `reloadCounter`; see
[ARCHITECTURE.md § the trigger
list](../ARCHITECTURE.md#the-global-fetch-trigger-list-must-be-read-unconditionally).
`installComparativeFetchAutorun.test.ts` ("reload() refires the fetch with no
input change") pins it.

The fourth is `fetchCanceled`, read in the same breath and above the same
bail-outs, gating the run while a cancel stands. It is the mirror image of the
counter — it CLOSES the gate — so the two belong together: `reload()` is the
only thing that reopens it, and a `reload()` that bumped the counter without
clearing the flag would wake the autorun into a run the gate still refuses. That
is the failure the "reload() reopens the gate" test in the same file catches.
Both reads are safe in the tracked half for one reason, which is the rule for
anything added beside them: only a user gesture moves either. **Nothing
fetch-derived may join them, and `error` is the one that will be reached
for** — the skeleton clears it at every fetch start and sets it on failure, so
a tracked read turns one failure into an unbounded retry loop paced by the
debounce, against the server that just failed. Nothing checks it; the same law
is `installGlobalFetchAutorun`'s "`rpcProps()` must never return fetch-derived
state".

Both scope their fetch through the shared `syntenyFetchRegions`
(`@jbrowse/synteny-core`): the visible blocks widened by a pan buffer and snapped
to a buffer-sized grid, so a pan inside the buffer neither refetches nor exposes
an unfetched strip, and the freshness key stays stable across the gesture.
Synteny scopes its query axis, dotplot its h axis; neither scopes the other axis,
because the fetch is one-dimensional in both.

## The canvas belongs to the container, not the display

Both put their `RenderLifecycleMixin` *above* the display, so one canvas is
shared by several displays: dotplot on the view itself, synteny on
`LinearSyntenyViewHelper` — the per-level (row-gap) model — so a 3-row stack has
two canvases, one per band, each shared by that level's synteny tracks. That is
what makes their upload callbacks keyed rather than per-region: they diff through
`createKeyedUploadSync` and delete each departed key individually, because an
active-set prune computed from one display's map would wipe its siblings'
buffers.

**A shared canvas is laid out by the model that owns it, never by the displays
drawing on it.** The canvas is absolutely positioned over the whole band, so it
contributes no height; the band has to reserve its own (`level.height` for a
synteny level). Sizing it from the displays instead looks equivalent — every
display in a level reports the level's height — right up to the legal case of a
band with *no* display: an assembly pair with no synteny dataset between it (the
import form launches those deliberately), or the last track on a level hidden.
`LinearComparativeRenderArea` reserved 0px there while its canvas still painted
the level's height, overlapping the genome row below. The SVG export never had
the bug because `SVGLinearSyntenyView` lays its rows out from `level.height`
directly — the on-screen path is the one that has to be told.

## Key by `sharedBackendKey(self.id)`, never a list index

An index renumbers the moment a sibling is hidden or reordered, and then the
survivor's key names a slot holding another display's bytes: the identity diff
sees a changed reference and re-uploads every later display's whole buffer (a
full re-pack of every segment), and any frame that lands between the two draws
one display's geometry under another's parameters. Dotplot keyed by track index
until that was fixed.

## The empty frame is load-bearing

A shared canvas makes the empty frame load-bearing, and that is why this family's
render callback is *unconditional* where the per-region family's is gated. When
each display owns its canvas, hiding a track unmounts the canvas with it. When
the canvas belongs to the container, nothing else ever repaints it — so a
callback that skips the tick "because no display has geometry" leaves the hidden
track's pixels on screen, its buffer deleted and nothing drawn over them. Both
plugins' backends clear before drawing, so painting zero displays *is* the wipe.
One shape, in both:

- `renderState` is a **resolved getter**, never `undefined`; an empty
  `displayKeys` / `perTrack` is a real frame.
- `canRender` carries the "view isn't measured yet" precondition
  (`view.initialized`), so the autorun pair idles instead of the state going
  nullable.
- `backend.render(state)` returns `void` and always repaints the whole canvas:
  clear, then draw every key it holds geometry for.
- The callback returns `true` — the canvas now reflects the model, which is what
  lets `canvasDrawn`, and so `settled` and the `*_done` testid, resolve on a view
  or level that legitimately has nothing to show.

`products/jbrowse-web/src/tests/SharedCanvasHideTrack.test.tsx` holds both views
to this.

## Readiness is a required prop, not a selector list

**Both views publish that `settled` as `data-display-drawn`, a *required* prop on
`RenderCanvas`.** The per-view `synteny_canvas_done` /
`dotplot_webgl_canvas_done` testids still exist and are still what a spec's own
`readySelector` names, but the attribute is what `PENDING_DISPLAYS`
(`@jbrowse/browser-test-utils`) waits on, so these two answer "has everything
painted?" with the same attribute every LGV display does.

It is required because the previous version enumerated views by hand:
`PENDING_DISPLAYS` named `synteny_canvas` and simply forgot dotplot, so an
unpainted dotplot counted as finished and a capture could land on it blank — and
a third, hand-copied version of the list lived in the desktop harness, already
stale and matching only by accident. **A readiness signal published as a required
prop cannot forget a view; a selector list can.** Reach for that shape whenever a
cross-cutting check would otherwise be a list someone has to remember to append
to — it is the same move as `fetchInert` being a mixin hook rather than a getter
each display invents.

`canvasDrawn` therefore means "painted at least once" here rather than "real
content reached the canvas"
([ADR-009](../architecture-decision-records/adr-009-canvas-drawn-reliability.md),
written for the per-region family, whose loading scrim reads it through
`computeLoadingTerm`'s `rendersCanvas && !canvasDrawn` term). Nothing is lost:
both `settled` getters carry data-readiness separately through `displaysSettled`,
and neither view drives a scrim off `canvasDrawn`. Dotplot keyed by track index
and gated its render on having geometry until both were fixed; synteny reached
the same place by a different route, with a nullable state and a `clear()` method
on the backend interface for the empty case.
