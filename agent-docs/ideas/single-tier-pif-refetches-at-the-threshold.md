---
name: single-tier-pif-refetches-at-the-threshold
description: A `.pif.gz` built without a coarse tier still flips tiers at 10,000 bp/px, because the flip is resolved from a config slot both indexed adapters declare while whether the file HAS the tier is an async adapter-side fact. Identical bytes refetched once per crossing; the fix is a capability the main thread can read, and the design question is where it lives in the cache key. The `#pif` header now carries the bound as a value, and the same one-shot `meta` RPC closes the unenforced threshold slot and the approximate-walk claim with it.
---

# A single-tier PIF refetches itself crossing the LOD threshold

`resolveLodTier` (`packages/synteny-core/src/lodTier.ts`) resolves `auto` from
`coarseBpPerPxThreshold`, and it resolves on the **main thread** on purpose:
the tier is a fetch input, and resolving it adapter-side leaves the display's
refetch key blind to the change. That reasoning is right and is not what to
revisit.

What it cannot see is whether the file has a coarse tier at all. Both indexed
PIF adapters declare the threshold slot regardless — `trackHasLodTiers` tests
for the slot precisely because there is no second signal — while the fact itself
is `PifFile.hasCoarseTier`, async and on the adapter side of the RPC. So for a
file built with `make-pif --no-coarse`:

1. crossing 10,000 bp/px changes the resolved tier, so the fetch key changes;
2. the display refetches;
3. `resolveCoarseTier` (`plugins/comparative-adapters/src/util.ts`) sees
   `hasCoarseTier: false` and serves the fine tier again.

Identical bytes, once per crossing, both ways. Waste rather than wrong output —
which is why it is parked rather than fixed, and also why a fix must not make
the output worse.

## What a fix needs

A capability the main thread can read before it builds the key. Options, in
increasing cost:

- **Report it once and cache it on the display.** An RPC the display makes when
  the adapter is first resolved, stored in volatile state; `resolveLodTier`
  takes `hasCoarseTier` alongside the threshold and returns `'fine'` when it is
  false. The awkward part is the window before the answer arrives: the key must
  not change when it lands, or the first crossing refetches anyway.
- **Put it in the config.** `make-pif` knows at build time whether it wrote a
  coarse tier, so `add-track` could record it. Then it is synchronous and free —
  and wrong for every file already configured, which is the whole installed
  base.
- **Make the tier not part of the key.** Ask the adapter for the tier it
  actually served and let the display accept either. Largest change; removes the
  class of bug rather than this instance.

The menu already says the fallback out loud (`lodMenuItems`' `helpText` for
"Alignment blocks only"), so the user-facing half is not silent. Only the
network is.

## The `#pif` header makes the first option cheap, and it answers two more

Filed 2026-09-02 when `handoffs/pif-coarse-tier-rollout.md` closed. The writer
now emits a `#pif` header and `PifFile.meta` carries `coarse:i:`, the accuracy
bound the file was built with, so the capability the main thread cannot see is
already sitting on the adapter side as a value rather than a flag to invent.
One shape delivers it: a one-shot RPC in `afterAttach` that returns `meta`, the
way `LinearHicDisplay` learns its binsize, stored on the display and read by
`resolveLodTier`.

Two further defects close with it, which is what changes the price:

- `coarseBpPerPxThreshold` is a config slot that must be `>= --coarse` for the
  served tier to be as accurate as the display claims, and nothing enforces it.
  With `meta` on the display it is checkable.
- `LinearSyntenyDisplay.coarseWalkIsApproximate` reads the tier that was
  REQUESTED, not the one served, so a `--no-coarse` file reports an approximate
  walk over fine-tier geometry.
