---
status: Accepted
summary: "Synteny and dotplot corners are window-relative Float32 against a fetch-time base (supersedes ADR-010 and ADR-018)"
---

# ADR-067: Synteny and dotplot corners are window-relative Float32

## Status

Accepted. Supersedes ADR-010 (pre-projected pixel offsets) and ADR-018 (hi/lo
Float32), and moots ADR-023, whose subject — per-instance `padTop`/`padBottom` —
no longer exists.

## Context

A synteny ribbon connects two views, a dotplot segment two axes, each with its
own `bpPerPx` and region ordering. So a corner is **cumulative bp across the
whole axis**, not the chromosome-local uint32 LGV emits — Gbp scale, past
Float32's mantissa and past uint32 on large assemblies.

ADR-010 stored pre-projected pixels (drifted on zoom, ULP floor in the format).
ADR-018 stored a 4096-aligned hi/lo Float32 pair (8 bytes/corner, exact only
below `2³⁶ ≈ 68.7 Gbp`). Both were answering "how do we fit a genome-scale
magnitude into Float32." We never have to.

## Decision

Store each corner as **one Float32 holding `cumBp − base`**, where `base` is the
per-axis viewport-start cumBp at build time (`offsetPx * bpPerPx`). The base
travels with the geometry — `base0`/`base1` (synteny), `baseH`/`baseV`
(dotplot) — and is never inferred.

```
screenX = bpRel * bpPerPxInv + panPx      panPx = (base − viewBp) * bpPerPxInv
```

`panPx` is folded on the CPU in Float64 from a small delta and uploaded as one
uniform per axis. No hi/lo split, no per-region uniform table, no `MAX_REGIONS`,
no per-instance padding.

## Why one Float32 is enough

Error scales with distance from the base **in pixels**, not in bp:

```
err ≈ (bpRel / bpPerPx) · 2⁻²³ = distanceFromBaseInPx · 2⁻²³
```

The fetch window is grid-snapped with a `max(width/2, 2000)` px pan buffer
(`syntenyFetchWindow.ts`) and the base is recaptured whenever geometry rebuilds,
so anything on screen is within a few thousand px of the base — worst case
~5×10⁻⁴ px. Far-off-screen corners do lose precision, but the error at the far
end is scaled by the visible fraction of the run, so it lands on the
clipped-away sliver.

Strictly better than both predecessors at once: half the bytes of hi/lo, **and**
no whole-assembly ceiling, so 100+ Gbp genomes render correctly.

## Why synteny bakes it in and dotplot doesn't

Synteny emits relative values from the worker; dotplot keeps absolute Float64
and subtracts only at GPU upload. That is not a convention disagreement — it
follows from **where each plugin builds geometry**:

- Dotplot builds it on the main thread, so there is a seam between the data and
  the vertex buffer at which to change representation.
- Synteny builds it in the worker, so its geometry object **is** its RPC
  payload. No seam exists. Making it absolute means Float64 corners (~+8 MB per
  region at the 500k-instance target) with no consumer that wants them.

Synteny's departure from the `CLAUDE.md` absolute-uint32 rule is therefore
narrow and deliberate. The rule still holds in full for its *feature* payload
(`starts`/`ends`/`mateStarts`/`mateEnds` are absolute chromosome-local uint32);
only geometry is relative. Neither plugin could satisfy the letter of the rule
anyway, since a corner is cumBp rather than chromosome-local bp.

## Consequences

- No whole-assembly size ceiling; the former ~68.7 Gbp cap is gone
  (`reference/HISTORICAL.md`).
- 4 bytes per corner. `padTop`/`padBottom`, the `viewPad0`/`viewPad1` uniforms
  and `hpmath.slang`'s `hpCornerScreenX` are all gone. The LGV
  `hpSplitUint`/`hpToClipX` path is untouched.
- Pan and zoom within a fetch window stay uniform-only updates.
- **So a rule that reads the pan cannot be answered where the geometry is
  built.** The geometry outlives the pan by design, and `panPx` is the only thing
  that moves, so anything derived from it has to be re-derived per frame. The
  trap is a rule keyed to the two axes' pan *difference*: each axis's own window
  is safe to cull against at build time, because the emit window is the pan
  buffer and the fetch key snaps to it, but nothing bounds how far the two views
  drift APART inside one fetch — the buffer is per axis, and 2000px of it is
  wider than a viewport. Synteny's location-marker travel cap was answered at
  build time and went stale exactly on the pan that made it wrong (ticks that had
  become near-horizontal kept drawing; ticks whose ends a pan had brought
  together stayed dropped). It is `markerTravelsTooFar` in syntenyTypes.slang
  now, asked by `isCulled` and `isRibbonCulled` per frame. The rest of the
  worker's culls were audited at the time and are all per-axis, so this was the
  only one.
- `panPx` and `bpPerPxInv` have **one** implementation, `computeTransform` in
  `syntenyRibbonPath.ts`, which the GPU renderer imports rather than re-spells.
  The only hand-written twin is the final `bpRel * inv + panPx`: once in
  `projectCorners` (TS), once in `computeCorners` (Slang). That duplication is
  forced — ADR-051 caps the shader→JS codegen at scalar decisions, and
  `computeCorners` takes structs and returns `float4` — so a SYNC comment is the
  sanctioned mechanism here, not a shortcut.
- The precision tests (`buildSyntenyGeometry.precision.test.ts`,
  `dotplotPrecision.test.ts`) verify the **scheme** — that a Float32
  window-relative round-trip stays sub-pixel at genome scale — by re-spelling
  the formula locally. They would not catch the TS and Slang twins diverging.
- Dotplot's **v-axis** pan is not window-bounded: the fetch is h-axis-scoped and
  the geometry autorun reads `offsetPx` untracked, so only a zoom recaptures
  `baseV`. The error bound holds; reaching 1 px needs ~8.4M px of purely
  vertical pan, so this is documented rather than fixed.

## Rejected alternatives

- **hi/lo Float32 (ADR-018)** — twice the bytes and a 68.7 Gbp ceiling, for a
  problem the base subtraction removes for free.
- **Pre-projected pixels (ADR-010)** — zoom-dependent, ULP floor in the format.
- **Per-region uniform table / per-region-pair draws / 1D-texture table** —
  rejected in ADR-010 and again in ADR-018 for `MAX_REGIONS`, O(N×M) draw
  scaling, and parallel-data-path cost. The base subtraction sidesteps
  per-region addressing entirely.
- **Absolute Float64 across synteny's RPC, for consistency with dotplot** —
  declined; see above and `reference/BP_PRECISION.md` for the conditions that
  would change the verdict. Converting on arrival instead is the worst of both:
  the memory cost plus a copy.

## Revisit if

- A third main-thread consumer needs absolute cumBp from synteny geometry.
  Neither of today's two does — draw and pick want screen px, and a real
  position correspondence takes the `SyntenyResolveMatchingRegion` round trip.
- Someone decides one coordinate story across the fleet is worth the bytes.
- Dotplot v-axis drift becomes measurable → track `vview.offsetPx` in the
  geometry autorun, or scope the fetch on both axes.
