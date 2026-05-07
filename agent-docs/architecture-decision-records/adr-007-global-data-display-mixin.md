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
- `GpuBackendLifecycleSlotMixin` and `RegionTooLargeMixin` included

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
