---
name: the-per-base-layer-takes-a-color-scale
description: "`pileup.bases.encoding.color` holds a `field` alone, so no config recolors a modification type or moves the end of the base-quality ramp. A scale there waits on a request or on the dark-theme palette call. Two reviews corrected the mechanism, which is recorded here so it is not re-derived."
---

# The per-base layer takes a color scale

`pileup.bases.encoding.color` names one of four fields (`modifications`,
`bisulfite`, `baseQuality`, `base`) and declares no `scale`.
[GRAMMAR_OF_GRAPHICS.md](../../reference/GRAMMAR_OF_GRAPHICS.md)'s release
audit lists it as the exception by design, after ADR-149.

- **Modification colors** come from a fixed table (`getColorForModification`,
  `plugins/alignments/src/util.ts`), and the worker packs the color into each
  call (`features/modification/extract.ts`).
- **Base quality** paints cividis over 0 to `BASE_QUALITY_RAMP_MAX`
  (`shared/qualityRamps.ts`), so every score above that end paints the top
  color.

A scale would let a config recolor a modification type and set the end of the
quality ramp, and would draw no picture the display cannot draw today. A Fable
design review and an Opus mechanism review on 2026-11-17 both said to park it,
since no request is recorded.

## What the scale waits on

- A request to recolor modifications or to move the end of the quality ramp.
- Or a "relight" answer in
  [dark-theme-palette-gaps](dark-theme-palette-gaps.md), which a declared
  `scale.range` would give an author.

## The surface

```jsonc
"color": { "field": "modifications",
           "scale": { "domain": ["m", "unmodified"], "range": ["#c0392b", "#2c7fb8"] } }
"color": { "field": "baseQuality", "scale": { "scheme": "viridis", "domainMax": 93 } }
```

- `modifications` and `bisulfite` take `domain` and `range`. The `unmodified`
  level paints while `unmodified.show` is on, and bisulfite's levels are `m`
  and `unmodified`.
- `baseQuality` takes `scheme` and `domainMax`. A score of 255, a read with no
  QUAL, keeps the plain read fill.
- `base` takes no scale. The base wall, the mismatches and the coverage
  alleles paint one variable from the theme.
- `value` and an identity scale are closed, since the layer has no painter for
  a constant.
- `names`, `legend.title`, `reverse` and `domainMin` are left out. A renamed
  level would have to reach the hover, the widget and the coverage tooltip.
- MAF's `alignments.bases` stays field-only.
- The ADR amends ADR-149 and ADR-241, and says that probability stays the
  alpha, so a `range` color's own alpha is ignored
  ([two-color-methylation-composites-by-draw-order-at-wide-zoom](two-color-methylation-composites-by-draw-order-at-wide-zoom.md)).

## The mechanism

The first plan moved the color bake to the main thread and stopped there. The
mechanism review found five places that plan would have left the old colors,
with no error. Paths below are under `plugins/alignments/src/`.

- **The GPU upload skips a recolor.** `GpuAlignmentsRenderer.ts` re-uploads
  the pileup and coverage marks when `readYs` changes and at no other time, so
  a new color array would reach Canvas2D and SVG and never WebGPU or WebGL.
  The memo needs the modification colors, the coverage modification colors
  and the quality ramp's identity, with a narrow re-upload and an upload-count
  test.
- **`tables.ts` reads the worker tier** (`host.rawDataByGroup`), so it takes
  the colors from the colored map.
- **The coverage tooltip index interns the worker's colors**
  (`shared/modTooltipIndex.ts`), so it needs a type-index lane.
- **The key's swatches come from the fixed table**
  (`detectedModificationsOf`, `LinearAlignmentsDisplay/alignmentsColorViews.ts`).
- **`setBases` replaces the color object whole on a field switch**
  (`LinearAlignmentsDisplay/model.ts`) and parks nothing, so Base quality and
  back would erase a written `range`. It parks the object as the read fill
  does, with a round-trip test.

The rest of the mechanism:

- **One level table per payload.** A mark's color depends on its type code and
  its no-mod flag in the by-type, two-color and bisulfite views; probability
  sets the alpha. `modificationTypes` is built per lane and region in arrival
  order, so a display-wide table would paint the wrong type.
- **The bake is a separate computed**, after layout, keyed on the bases
  color inputs. `groupLayoutContext` would relayout, `rpcProps()` would loop,
  and the read fill's bake would rebake on every read recolor.
- **The scale stays out of `baseLayer`**, which `rpcProps` ships whole.
- **Coverage bars** get their level key as a separate lane, and the bake
  writes into a copy of `modCovPackedBuffer`. A key in the color word would
  reach `tables.ts` as a color, and a write in place keeps the buffer's
  identity, which the upload memo compares.
- **The pileup and the coverage compute share one intern table.** Their type
  indices agree today because both walk one list in one order.
- **The lanes the color reads become required** on the payload type.
- **The GPU and Canvas2D quality painters take a per-display ramp.** Each
  reads a module constant today.
- **The work-moving step lands as the first commit of the surface.** By itself
  it moves a bake onto the main thread for no outcome.

## Gate

- Main-thread ms per bake, times how often it re-runs, plus the narrow
  re-upload, in the style of `benches/tagColorBake.bench.ts` on the
  `200x.longread.mod.bam` fixture `benches/modPhases.bench.ts` reads. The
  arrays are transferred, so payload bytes measure nothing.
- Alpha rebuilt from the shipped probability byte may differ from today's by
  one step, which the reviewer inferred and nobody measured. Either the worker
  ships the alpha byte or the goldens are refreshed.
- GPU and Canvas2D parity on a palette of all-distinct colors.
