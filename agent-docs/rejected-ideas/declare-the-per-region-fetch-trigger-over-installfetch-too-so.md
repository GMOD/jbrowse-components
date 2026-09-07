---
name: declare-the-per-region-fetch-trigger-over-installfetch-too-so
description: Declare the per-region fetch trigger over `installFetch` too, so all four families share one autorun
area: rendering-and-displays
---

# Declare the per-region fetch trigger over `installFetch` too, so all four families share one autorun

scoped and declined 2026-08-31, after
`installGlobalFetchAutorun` and `installPrerequisiteFetch` became declarations
over the skeleton and this was the last hand-rolled trigger left.

The convergence buys no rule that **porting** does not buy far cheaper.
`installPerRegionFetchAutoruns` already reads `reloadCounter` unconditionally
and `fetchCanceled` tracked, already runs on `leadingEdgeAutorun` through
`autorunOnReadyView`, already installs both contract checks, already reaches
`runFetchOnce` (through `FetchMixin.runFetch`, lifecycle and all), and already
classifies its runs in the skeleton's own outcome vocabulary through
`retryOutcomeForPlan` — using an outcome the skeleton's own body never emits,
`deferred`. The one rule it was missing when this was written is the case in
point: liveness above the gate, promoted into `installFetch` 34 minutes
earlier the same day, and ported into `autorunOnReadyView` in two lines rather
than by conversion.

What it genuinely cannot express is the **concurrency policy**, and that is
the fact to lead with. The skeleton's is supersede-on-rerun; this family's is
skip-while-in-flight and wake at the end, and it is the streaming commit that
forces it — every `ctx.commitRegion` writes `loadedRegions`, a *tracked* plan
input, so under skeleton semantics a fetch's own first landing re-runs the
body, finds the remaining blocks uncovered and supersedes itself, once per
region. `deferred` is the companion: without it the in-flight run after a
retry consumes the reload bump against a run that predates it. The coverage
gate is NOT part of this — "N regions covered" is prepare-shaped and could
live in `prepare` — so do not reach for that as the reason.

The cost lands on the rotation, not the trigger. A lent
`rotation: self.fetchRotation` means the skeleton's `begin()` runs first and
`runFetch`'s own `begin()` then supersedes the fetch that just started, so
`fetchNeeded` would have to take the skeleton's `ctx` instead of opening a
fetch of its own — nine overrides, the three fan-out helpers, `fetchRegions`,
a `runPerRegionFetchOnce` for the canvas caller that fetches outside the
autorun deliberately, and the displays that decline INSIDE `fetchNeeded`
(sequence past base resolution, variants until `sourcesBase` lands) hoisting
those conditions up into `prepare` — because after `begin()` a decline is a
phantom begun-and-ended fetch, misclassified `fetched`, bumping
`fetchGeneration` into a re-wake. Not lending the rotation is worse, not
better: a second rotation needs a second `report`, which is a second writer
over the one status field (ADR-081), and `cancelFetch` would reach only the
inner one.

**Revisit if the streaming-commit contract changes** — if this family ever
stops committing per region mid-flight, or stops skipping while a fetch is in
flight, the rotation objection dissolves and this is worth re-scoping. A new
rule in the skeleton is not the trigger: port the rule. The narrower form — a
shared trigger preamble over the two hand-rolled bodies rather than a
conversion — is declined separately in `FETCH_SKELETON.md`, on its own
grounds: the two consume the same two signals differently, and the liveness
skip is not in the per-region body to share.
