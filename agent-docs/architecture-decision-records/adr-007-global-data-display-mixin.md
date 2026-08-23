---
status: Accepted
summary: "`GlobalDataDisplayMixin` — fetch lifecycle for monolithic-dataset GPU displays"
---

# ADR-007: GlobalDataDisplayMixin — fetch lifecycle for monolithic-dataset GPU displays

## Status

Accepted. Implemented for HiC and LDDisplay.

## Context

HiC and LD displays fetch a single global dataset per viewport change — no
per-region tracking, no `loadedRegions` map. Before this ADR they each had a
monolithic `afterAttach` autorun that manually managed a cancel token and
read `renderingStopToken` / `error` via `untracked()` to avoid re-triggering
the autorun when those volatile values changed.

The pattern was duplicated and error-prone: two plugins with nearly identical
token-dance logic, each with two `untracked` calls that were reactivity bypasses
signalling structural mismatch.

## Decision

Extract the shared lifecycle into
`plugins/linear-genome-view/src/BaseLinearDisplay/models/GlobalDataDisplayMixin.ts`.

The mixin provides:
- `isLoading` view (token presence)
- `withFetchLifecycle(work)` action — cancels the previous token, creates a new
  one, runs `work`, and bumps `fetchGeneration` on completion so the autorun
  re-evaluates if the viewport moved while the fetch was in flight
- `error`, `statusMessage`, `setError`, `setStatusMessage` volatile state
- `RenderLifecycleMixin` and `RegionTooLargeMixin` included

Each display's `afterAttach` autorun reads its trigger conditions (viewport,
`rpcProps()`, display-specific toggles), then calls `self.performXFetch()` which
calls `self.withFetchLifecycle(async ctx => { ... })`. The mixin owns all
cancellation logic; the display body contains only the fetch-specific work.

## Consequences

- All `untracked` calls removed from HiC and LDDisplay `afterAttach.ts`
- `withFetchLifecycle` is the canonical pattern for non-per-region GPU displays
- Future displays with a single-global-dataset fetch model (e.g., variant matrix
  if it moves off `MultiRegionDisplayMixin`) should use this mixin
- `MultiRegionDisplayMixin` remains the right base for per-region displays;
  `GlobalDataDisplayMixin` is for displays where the entire viewport maps to one
  fetch

## Since (2026-08-23): merged into `GlobalFetchMixin`

`GlobalDataDisplayMixin` is gone as a name; what it did is `GlobalFetchMixin`,
which now composes `RenderLifecycleMixin` along with `RegionTooLargeMixin` and
`FetchMixin`. Nothing in the decision above changes — this is still one fetch
lifecycle for a display whose whole viewport maps to one dataset — only the
number of mixins it takes to say so.

The split into two halves came later than this ADR and was for arc, which paints
main-thread JSX `<path>`s and attaches no rendering backend, so it composed the
lower half and the three getters on the upper one (`canRender`, `paintInert`,
`displayPhase`) were unreachable from it. What arc saves by declining the render
lifecycle is five unused volatiles and two autoruns that are never installed
(`attachRenderingBackend` installs them, and arc never calls it); what the split
cost was a foundation row naming a mixin two displays composed, and a display's
choice of foundation deciding which of those three getters it could express. Arc
narrows the one genuinely backend-shaped getter itself, through
`foundationDisplayStatusPhase`. See ARCHITECTURE.md §"Display stacks".
