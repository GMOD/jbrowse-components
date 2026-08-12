---
status: Accepted
summary: "Synteny and dotplot corners are window-relative Float32 against a fetch-time base (supersedes ADR-010 and ADR-018)"
---

# ADR-067: Synteny and dotplot corners are window-relative Float32

## Status

Accepted. Supersedes ADR-010 (pre-projected pixel offsets) and ADR-018
(cumulative-bp hi/lo Float32) for **both** paths, and moots ADR-023
(per-instance pad memory), whose subject — `padTop`/`padBottom` — no longer
exists.

## Context

A synteny ribbon connects two views, and a dotplot segment two axes, each with
its own `bpPerPx` and its own region ordering. A corner is therefore
**cumulative bp across all displayedRegions of its view/axis**, not the
chromosome-local absolute uint32 the LGV plugins emit. On a large assembly that
value reaches Gbp — past Float32's 24-bit mantissa, and on the largest genomes
past uint32 — so the storage format is a real decision rather than a detail.

Two previous shapes:

- **ADR-010: pre-projected Float32 pixel offsets.** Drifted once zoom moved
  more than ~2× past the geometry's fetch `bpPerPx`, and had a hard ULP floor
  at genome-scale magnitudes (~64 px at 8×10⁸ px) that no refetch could fix,
  because the floor was in the storage format.
- **ADR-018: cumulative-bp hi/lo Float32 pairs** (4096-aligned `hi` + sub-4096
  `lo`), plus a per-instance `pad` pixel attribute for inter-region gaps. Fixed
  the drift, at 8 bytes per corner, and carried its own ceiling: `hi` is exact
  only while `cumBp < 2³⁶ ≈ 68.7 Gbp`.

Both were solving "how do we represent a genome-scale magnitude in Float32."
The observation that retired both is that **we never have to**.

## Decision

Each corner is stored as a **single Float32 holding `cumBp − base`**, where
`base` is the per-axis viewport-start cumBp captured when the geometry was
built (`base = offsetPx * bpPerPx`). The base travels with the geometry
(`base0`/`base1` for synteny's two views, `baseH`/`baseV` for dotplot's two
axes) and is never inferred by a consumer.

Screen position is reconstructed identically on GPU and CPU:

```
screenX = bpRel * bpPerPxInv + panPx        where panPx = (base − viewBp) * bpPerPxInv
```

`panPx` — how far the view has panned since the fetch — is folded on the CPU in
Float64 from a small delta and uploaded as one uniform per axis. There is no
hi/lo split, no per-region uniform table, no `MAX_REGIONS`, and no per-instance
padding attribute.

Four call sites must agree on that one line, and say so in SYNC comments:
`GpuSyntenyRenderer.writeUniforms`, `syntenyTypes.slang#computeCorners`,
`syntenyRibbonPath.ts#computeTransform`/`projectCorners` (Canvas2D, SVG and the
CPU pick engine all route through it), and the dotplot twins in
`GpuDotplotRenderer.render` / `dotplot.slang`.

## Why a single Float32 is enough

Error in the reconstructed position is proportional to the corner's distance
from the base **measured in pixels**, not in bp:

```
err ≈ (bpRel / bpPerPx) · 2⁻²³ = distanceFromBaseInPx · 2⁻²³
```

The base is recaptured near the view whenever the geometry is rebuilt, and the
fetch window is grid-snapped with a pan buffer of `max(width/2, 2000)` px
(`syntenyFetchWindow.ts`), so anything **on screen** sits within a few thousand
pixels of the base. Worst case is ~5×10⁻⁴ px — four orders of magnitude below a
pixel.

Far-off-screen corners (a distant-mate ribbon whose other end is on another
chromosome) do lose absolute precision. This is not a defect: the error at the
far corner is scaled by the visible fraction of the run, so a 64 px error
8×10⁸ px away contributes ~10⁻⁴ px where the ribbon is actually rasterized. The
imprecision lands entirely on the clipped-away sliver.

This is strictly better than both predecessors on both axes at once — half the
position bytes of ADR-018's hi/lo pair, **and** no whole-assembly ceiling at
all, so 100+ Gbp genomes (*Tmesipteris oblanceolata*, *Paris japonica*) render
correctly where the hi/lo shape degraded past 68.7 Gbp.

## Where the relative value lives, and why the two views differ

The two plugins put the conversion in different places:

- **Synteny** bakes it in the worker. `buildSyntenyGeometry` emits `bp1..bp4`
  already relative, and `base0`/`base1` ride along on `SyntenyGeometry`.
- **Dotplot** keeps geometry **absolute Float64 cumBp** and subtracts the base
  only in `instanceInterleave.ts` at GPU upload. The RPC payload
  (`p11/p12/p21/p22`) and the Canvas2D/SVG renderers all see absolute values.

This looks like an inconsistency and is not one: it falls out of **where each
plugin builds geometry**. Dotplot builds it on the main thread, in an autorun,
so "absolute in the model, relative at upload" costs nothing. Synteny builds it
*in the worker*, so its geometry object **is** its RPC payload — there is no
seam between the two at which to change representation. Making synteny's
payload absolute would mean Float64 corners (16 bytes/instance → 32; roughly
+8 MB per region at the 500k-instance target the plugin sizes for) with no
consumer that wants them, or the worse option of converting on arrival, which
is that cost plus a copy.

Synteny's departure from the repo `CLAUDE.md` rule that worker output is
absolute is therefore narrow and deliberate. It is also bounded: the rule holds
in full for synteny's **feature** payload — `starts`/`ends`/`mateStarts`/
`mateEnds` in `SyntenyFeatureData` are absolute chromosome-local uint32 — and
only the geometry arrays are relative. Note that neither plugin could satisfy
the letter of the rule anyway, since a corner is cumBp rather than
chromosome-local bp; the coordinate family the rule describes does not apply
here.

## Consequences

- No whole-assembly size ceiling. The former ~68.7 Gbp cap is gone; see
  `reference/HISTORICAL.md`.
- 4 bytes per corner. Per-instance `pad` is gone entirely (ADR-023's subject),
  as are the `viewPad0`/`viewPad1` uniforms and `hpmath.slang`'s
  `hpCornerScreenX`. The LGV in-shader `hpSplitUint`/`hpToClipX` path is
  untouched — this ADR is about the comparative views only.
- Pan and zoom within a fetch window remain uniform-only updates.
- **`base0`/`base1` are a coupling that travels with the data.** Every consumer
  of `bp1..bp4` must account for the base. Three of the four do so implicitly —
  `getCigarOpAtInstance` is correct only because the base *cancels* in a
  within-axis subtraction, and the draw/pick paths are correct only because
  they route through `computeTransform`. This is a bug class the dotplot shape
  cannot have, and it is why the SYNC comments and
  `buildSyntenyGeometry.precision.test.ts` /
  `syntenyPickRenderAgreement.test.ts` / `syntenyShaderParity.test.ts` are
  load-bearing rather than decorative.
- `base0` derives from the raw `offsetPx` at fetch time, not from the snapped
  fetch window, so the same snapped window fetched from two pan positions
  inside one grid cell produces different bytes for identical data. Harmless
  today; it only rules out content-addressing the payload by `fetchKey`.
- Dotplot's **v-axis** pan is not bounded by a fetch window — the fetch is
  h-axis-scoped and the geometry autorun reads `offsetPx` untracked, so only a
  zoom recaptures `baseV`. The error bound still holds, and reaching 1 px needs
  ~8.4M px of purely vertical panning with no zoom, so this is documented
  rather than fixed.

## Rejected alternatives

**Cumulative-bp hi/lo Float32 (ADR-018).** What this replaces. Twice the
position bytes and a 68.7 Gbp ceiling, to solve a problem the base subtraction
removes for free.

**Pre-projected pixel offsets (ADR-010).** Zoom-dependent, and its ULP floor
was in the storage format.

**Per-region uniform table, per-(region-pair) draw calls, 1D-texture region
table.** All three were rejected in ADR-010 and again in ADR-018, for
`MAX_REGIONS`, O(N×M) draw scaling, and parallel-data-path cost respectively.
Nothing here revives them; the base subtraction sidesteps per-region addressing
entirely.

**Making synteny's RPC payload absolute Float64 for consistency with dotplot.**
Declined — see the section above. `reference/BP_PRECISION.md` states the
conditions that would change the verdict.

**Converting synteny's payload to absolute on arrival.** Explicitly not the
compromise: it pays the memory cost *and* a copy, and leaves the coupling in
place across the RPC where it is hardest to see.

## Revisit if

- A third main-thread consumer needs absolute cumBp from synteny geometry. Two
  exist today and neither does: the draw/pick paths want screen px, and
  anything needing a genuine position correspondence takes the
  `SyntenyResolveMatchingRegion` worker round trip instead (which walks the
  real CIGAR — see `reference/BP_PRECISION.md` on why interpolating `FeatPos`
  is wrong). At that point synteny pays the conversion anyway and the byte
  argument weakens.
- Someone decides one coordinate story across the fleet is worth the bytes
  regardless. A legitimate call, and not the implementer's to make.
- Dotplot v-axis pan drift becomes measurable — track `vview.offsetPx` in the
  geometry autorun, or scope the fetch on both axes.

## References

- `reference/BP_PRECISION.md` §"Synteny + dotplot" — the coordinate families
  table and the full error argument.
- `reference/HISTORICAL.md` §"The former ~68.7 Gbp synteny/dotplot ceiling".
- `plugins/linear-comparative-view/src/LinearSyntenyRPC/buildSyntenyGeometry.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyDisplay/syntenyRibbonPath.ts`
- `plugins/dotplot-view/src/DotplotDisplay/dotplotGeometry.ts`,
  `instanceInterleave.ts`
- `packages/synteny-core/src/syntenyFetchWindow.ts` — the pan buffer that
  bounds the base-to-view distance.
