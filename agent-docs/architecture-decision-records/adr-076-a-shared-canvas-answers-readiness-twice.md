---
status: Accepted
summary: 'The comparative views answer readiness twice — a per-display phase for "still working" and the surface `settled` gate for "finished content" — because an error is terminal to one and not the other'
---

# ADR-076: A shared canvas answers readiness twice

## Status

Accepted

## Context

`AppReadyMarker` publishes `[data-app-phase]` from every display that publishes a
`displayPhase`. The two comparative views published none, so on a dotplot or a
synteny page the app reported itself `ready` over a canvas that had finished
fetching and not drawn — the blank-frame race the marker was added to close. Both
capture harnesses papered over it with a `waitForDisplaysDone` stage afterwards.

The obvious fix — a duck-typed `view.settled === false` term in the marker — is
wrong, and the reason is instructive. A dotplot showing its import form has drawn
no canvas, so `settled` is false and stays false; that term parks the whole app at
`loading` forever on every import-form figure.

Underneath it sits the real asymmetry. An LGV display owns both halves of
readiness: `RenderLifecycleMixin` gives it paint, its fetch mixin gives it
freshness, and `computeDisplayPhase` joins them. Here they live on **different
models**. A dotplot's plot rect and a synteny level's band are one surface that
several displays draw onto, so paint belongs to the surface and freshness to each
display, and every reader that wanted "is this finished" rejoined them itself —
twice, in two `settled` getters whose comments had drifted into describing
different things.

## Decision

**Join them once, and admit that the join has two answers.**
`packages/synteny-core/src/comparativeReadiness.ts` holds both, over one
`ComparativeSurface` (`painted`, `initPending`, `pendingAutoDiagonalize`) that
each view publishes as `surfaceReadiness`:

- **`comparativeDisplayPhase`** — is this display still WORKING? Built from
  `computeDisplayStatusPhase` and `computeLoadingTerm`, with each term in the slot
  its documented meaning names: `fetchInert` is the scrim-suppressing term,
  `loading || refetching` is `isLoadingOrCanceled`, and the surface supplies first
  paint plus the two not-the-answer-yet flags. Feeds each display's
  `displayPhase`, and through it the app marker.
- **`comparativeSurfaceSettled`** — is there FINISHED CONTENT on this canvas?
  Feeds each view's `settled`, and through it `data-display-drawn`.

**An error is terminal to the first and not to the second, and that is the whole
reason they are two functions.** A failed display is not working, so the app is
ready over it — the same answer `computeSvgReady` already gives, for the same
reason a data-only gate must not hang forever on data that is not coming. But an
error banner is not content, and `data-display-drawn` is what the screenshot
generator and the browser tests wait on, so `settled` holds the gate shut and a
golden regenerated during an outage fails loudly instead of absorbing the banner
as expected output.

Two supporting pieces make the answers reachable:

- **`AbstractViewModel.trackContainers`**, implemented by `LinearComparativeView`
  as its levels. The synteny view holds no `tracks` of its own — one list per band
  — so a walk of `view.tracks` found nothing that could be loading, and no phase
  on the display would have fixed that. `trackContainerFor` could not serve it:
  a walker has no id to ask with.
- **`RenderCanvas` requires a `phase`**, publishing `data-display-phase` beside
  `data-display-drawn`. `comparativeSurfacePhase` supplies the ranking over the
  surface's displays, since a shared canvas cannot carry one display's phase. Every
  DOM-level doneness wait keys on that attribute, and on a comparative page each of
  them was an assertion about a selector no element published.

## Rejected alternatives

**One predicate, with `settled` derived from the phases.** The smaller change, and
it reads better until the error case: it would make `settled` true over a failed
fetch, so a golden regenerated while a host was down would commit a picture of the
error banner and every later run would compare against it. The gate failing is
what makes that impossible. The two questions genuinely differ, and the split
mirrors the one `data-display-phase` and `data-display-drawn` already make for LGV
(ADR-065).

**Give the level a `displayPhase` and let the marker read levels directly.** The
level is not a display and not a view; teaching the marker a third node type buys
nothing that publishing the displays does not, and it would leave each display
still unable to answer for itself.

**Put the phase getter on `SyntenyFetchStateMixin`.** It reads `error`, which is a
`BaseDisplay` volatile; declaring it on the mixin would put a second `error` in the
compose chain, where one silently wins by argument order. That is the hazard the
mixin's own header documents, and it is why `loading` / `refetching` /
`dataCurrent` / `svgReady` are already per-display rather than shared. A shared
pure function, as `displaysSettled` and `computeSvgReady` already are, has none of
that problem.

## Consequences

`displaySettled(testid)` from `@jbrowse/capture` —
`[data-testid=…][data-display-phase="ready"]` — now resolves on both comparative
canvases, where it previously matched nothing. `waitForDisplayPhases` and the busy
selector become real gates on those pages rather than assertions about an absent
element, and `Instrumentation.displayPhase` stops reading `false` on a synteny-only
page.

A capture that times out now names each unpainted display's phase
(`pendingDisplayStates`), which separates the three cases a bare name ran
together: still fetching, finished badly, and finished-but-unpainted — the last
being a bug in the display, which no longer timeout will fix.

`agent-docs/reference/DISPLAYCHROME.md` describes the LGV half of this contract;
the comparative half now lives beside it in `comparativeReadiness.ts`.
