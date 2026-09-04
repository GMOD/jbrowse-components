---
name: shared-canvas-views
description: The comparative views (synteny, dotplot) — how their fetch composes KeyedFetchMixin rather than either LGV foundation, how one canvas owned by a container model is shared by several displays, why the key must be sharedBackendKey and the empty frame must still paint, and how readiness is published as a required prop rather than a selector list. Read before touching a synteny or dotplot fetch, a shared backend's keyed upload, or a container that lays out a canvas for its children.
---

# Shared-canvas comparative views

Synteny and dotplot are a third display shape, alongside the two LGV fetch
foundations in
[ARCHITECTURE.md § Display stacks](../ARCHITECTURE.md#display-stacks). Two things
make them different, and they are independent: their fetch composes
`KeyedFetchMixin` rather than either LGV foundation, and their canvas belongs to
a container model rather than to a display. Everything below follows from one or
the other.

The rules here generalize past these two views. Any container that owns a canvas
several children draw on — a future stacked view, a multi-track overlay — hits
the keying, empty-frame and readiness sections unchanged.

## The third shape: a keyed fetch onto a canvas the view owns

Both comparative displays (`LinearSyntenyDisplay`, `DotplotDisplay`) compose
`BaseDisplay` + `ComparativeFetchMixin` (`@jbrowse/synteny-core`), which is
`KeyedFetchMixin` (`@jbrowse/display-kit`) — `FetchMixin` plus the
`currentFetchKey` / `loadedFetchKey` compare the LGV global family runs on —
under the two-way loading answer a shared canvas wants. Until 2026-09 they
composed `SyntenyFetchStateMixin` instead, a second spelling of every
`FetchMixin` member the overlay reads;
[ADR-054](../architecture-decision-records/adr-054-comparative-displays-keep-their-own-fetch.md)
kept that split and
[ADR-105](../architecture-decision-records/adr-105-the-comparative-displays-compose-fetchmixin.md)
records how each of its four grounds lapsed. What the family gets from the
shared mixins, and what stays its own:

- `FetchMixin`'s: the rotation `cancelFetchByUser` stops (lent to the skeleton
  at install, so the stop and the flag are one action — a flag alone is not a
  cancel, since nothing else rotates the token and the cancelled RPC would
  commit its plot over the load the user stopped), `isLoading`, `error`, the
  status window, `reloadCounter` + `reload()` behind Retry, `fetchCanceled` +
  `cancelFetchByUser()` behind Cancel, and the overridable `fetchInert` hook
  (see [SVG_EXPORT.md](SVG_EXPORT.md) and "the on-screen twin" in
  ARCHITECTURE.md's SVG export section).
- `KeyedFetchMixin`'s: the `viewSignature` hook each display fills with its two
  views' state, `currentFetchKey` over it plus the settings and adapter axes,
  the `loadedFetchKey` stamp `commitFetchResult` writes beside the display's own
  store, and `dataCurrent`.
- `ComparativeFetchMixin`'s own: the `fetchLanded` / `hasDrawable` hooks, `loading`
  (first load — full overlay) versus `refetching` (stale plot still on screen —
  corner chip), `svgReady`, and `assembliesSwapped`.

**A comparative cancel is durable until Retry**, and that is the one deliberate
difference from the LGV families: no clear-on-viewport-change autorun here,
because these displays sit on single RPCs that can run for minutes and a cancel
any pan undoes is not one — and their viewport *is* their fetch input, so the
LGV clear would un-cancel on every trigger.

`installComparativeFetchAutorun` (`@jbrowse/synteny-core`) is a declaration over
the shared `installFetch` skeleton the way `installGlobalFetchAutorun` is: the
lent rotation, `fetchMixinLifecycle`'s begin/end/error trio, `currentFetchKey`
as the freshness key against `loadedFetchKey`, `commitFetchResult` at commit.
What it adds is the refName rename a `run` here is handed; each display supplies
only the three `FetchPhases`. The skeleton logs whatever it `setError`s, so
neither display overrides `setError` to log it a second time. Its autorun body
is synchronous and kicks the awaits off into their own function: an async body
stops tracking at its first await, and saying so structurally beats every read
here happening to sit above it.

It installs `makeRetryContractCheck` too, so this family's Retry is watched like
the other two — `fetchInert` is the exemption, and it is the same field the LGV
displays publish (ADR-081).

`installAssemblySwapCheck` is the companion installer for the one-shot
reversed-assembly check, off the fetch path — shared for its two `isAlive`
guards (teardown fires the parent atom the gate reads; the RPC resolves long
after a view can be closed), each invisible until a user closes a view mid-load.

They also answer the shared `dataCurrent` freshness question and run the shared
`computeSvgReady` policy, just via a key compare (`isDataCurrent` over
`currentFetchKey`) rather than spatial coverage — which is where the
stale-capture bugs lived ([SVG_EXPORT.md](SVG_EXPORT.md) §"On-screen capture
gate").

Both autoruns track the one key computed (`currentFetchKey`, which carries the
adapter axis) and read every value behind it `untracked`, so a pan inside the
buffered window can't refire the fetch. The third tracked read is
`FetchMixin`'s `reloadCounter`, taken **before** `prepare()`'s bail-outs: after a failure every fetch input is unchanged, so `prepare`
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
Synteny scopes its query axis, dotplot its h axis; by default neither scopes the
other axis, the fetch being one-dimensional. Synteny's `bidirectionalFetch`
(off by default; ideas/two-axis-synteny-fetch.md) is the exception: it adds a
second query scoped to the target axis (`targetFetchRegions`), flipped into the
query perspective before drawing.

## The canvas belongs to the container, not the display

Both put their `RenderLifecycleMixin` *above* the display, so one canvas is
shared by several displays: dotplot on the view itself, synteny on
`LinearSyntenyViewHelper` — the per-level (row-gap) model — so a 3-row stack has
two canvases, one per band, each shared by that level's synteny tracks. That is
what makes their upload callbacks keyed rather than per-region: they diff through
`installUpload` and delete each departed key individually, because an
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
