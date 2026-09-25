---
status: Accepted
summary: "The mark display's fifth mark is `link`, spelt as GenomeSpy spells it: a stroked curve from `x` to `x2`, where `x2` may be a locus on another sequence, `size` a channel through a linear or log scale, and a `mate` transform step reading a paired record's other end. Both feet place through a uniform table of the view's displayed regions, so a curve between two regions draws on the GPU from every block holding a foot and a pan writes one uniform. `@jbrowse/plugin-arc` and its two displays are deleted; their configs are rewritten in the mark spelling"
---

# ADR-163: A link is a mark, and the arc plugin is gone

## Status

Accepted (2026-09-25), Colin's call of 2026-09-24 to delete `plugins/arc`
outright rather than keep its display types as presets.
[GRAMMAR_OF_GRAPHICS.md](../reference/GRAMMAR_OF_GRAPHICS.md),
[MARK_ENCODING.md](../reference/MARK_ENCODING.md) and
[mark_display.md](../../website/docs/config_guides/mark_display.md) §"Links"
carry the operational description. Amends
[ADR-108](adr-108-a-display-declares-its-colour-scales.md) and
[ADR-153](adr-153-every-display-resolves-its-colour-through-one-function.md),
whose arc clauses describe displays that no longer exist.

## Context

The tree drew "a curve between two genomic positions" in four hand-written
places: the arc plugin (`LinearArcDisplay`, `LinearPairedArcDisplay`), the
alignments read-connection band, the breakpoint split view's bezier
connectors and the circular view's chords. The arc plugin was the odd one
out among linear displays: main-thread Canvas2D with no rendering backend,
its own byte-gated RPC shipping `Feature` objects to the main thread, a
per-arc layout reading `bpToPx` on the main thread, its own hit test, SVG
path, fetch model and chrome entry, and every channel a `jexl:` callback —
thickness by log score, the paired display's `lineWidth` beside the single
one's `thickness`, and a score filter as a bespoke mixin where the mark
display has a `filter` step. It was 4.4k lines, and the copy rule 1 of the
grammar handoff rejects.

Two facts decided the shape of the replacement. The worker's positions are
chromosome coordinates, with no refName lane and no genome-wide offset
table, so a mate on another sequence could not be spelt as an `x2`. And
every mark draws per block through a block-only uniform, which is the wall
the alignments band hit and worked around with a view-space DOM overlay:
"no GPU pass can join two displayed regions".

## Decision

- **The mark is `link`, spelt as GenomeSpy spells it**, since Vega-Lite has
  none, the precedent ADR-162 set for `text`: `mark: 'link'`, from `x` up
  and over to `x2`. `linkShape` is `dome`, the apex the pair's half-width
  clamped to the band, or `arc`, a true semicircle; a `y` puts the apex at a
  value on the display's axis. Past three block widths the ellipse
  degenerates to a circle whose legs rise from each foot, the alignments
  band's rule and reasoning.
- **`x2` takes GenomeSpy's `{ chrom, pos }` form beside a field.** The
  encoder files each feature's far sequence in an `x2Ref` dictionary lane,
  and the display resolves it once per fetch, through the assembly's
  aliases, into an `x2Region` lane naming the displayed region holding the
  foot, or none.
- **Both feet place through a uniform table of the view's displayed
  regions.** Each entry is anchored at the region's bp under the view's
  left edge, so a foot's offset from it stays inside float32; `x` places
  through the block's own entry and `x2` through the one its instance
  names. A curve between two regions is drawn by every block holding a
  foot, each clipped to its column, and a pan or zoom writes the table and
  no buffer. A foot on no region draws a stem at the placed one. This is
  the mechanism the band lacked, and it is what lets the band retire its
  overlay when it adopts the mark.
- **`size` is a channel**, the second consumer the grammar doc said it was
  waiting for: a field through a linear or log scale into a px range,
  shipped as a raw lane with a scale table whose open domain ends the
  display unions over its regions, the way a ramp's are, so every region
  strokes a value at one width. The mark-level `size` is the constant a
  link strokes at otherwise, 2 px unwritten; a point's stays the constant
  it was.
- **A `mate` transform step does the pairing in the worker**: one feature
  per other end a record states, from its `mate` field (BEDPE, STAR-Fusion)
  or each VCF `ALT`, with `mate.refName`, `mate.start`, `mate.end`, both
  ends' directions, `alt` and `svtype` written, a record naming no other end
  dropped and a pair of ends answered once. The SV ALT parsing moved from
  sv-core into core for it, which took `@gmod/vcf` for its 2.4KB breakend
  parser.
- **The shape is render-core's `linkMark`**: the band's 130-vertex
  triangle-strip hull inflated by the half stroke plus one antialiasing
  ramp, a fragment measuring the true distance to the analytic curve, and
  `//! coverage: analytic`. `sdEllipse` and `distToWideCircle` moved into
  render-core's `curveDistance.slang`, which the band imports, and the
  float64 `ellipseDistance` beside them gained `ellipseNearest`, since a
  hit must name the nearest ink point. The sweep's recording context
  flattens `ellipse` and `arc` into edges so a stroked curve is swept like
  a polyline.
- **`@jbrowse/plugin-arc` is deleted**, with its two display types, its
  RPC, its jexl functions (`logThickness`, `defaultPairedArcColor`) and
  its config pages. Every config, doc, figure spec and test that named
  them is rewritten in the mark spelling; there is no migration.

## Consequences

- A BEDPE, STAR-Fusion or SV VCF track draws its arcs as
  `{ mark: 'link', encoding: { x2: { chrom: 'mate.refName', pos:
  'mate.start' } }, transform: [{ type: 'mate' }] }`, and a BED of
  start-end pairs as `{ mark: 'link' }` alone. Thickness by score is
  `encoding.size: { field: 'score', scale: 'log', range: [1, 8] }`, a label
  a `text` mark beside it, and a score floor a `filter` step.
- Arcs draw on the GPU: a zoom writes a uniform and touches no DOM, which
  the `census: links` arm of `ZoomRenderCensus` holds. The cost that
  remains is the strip per instance, the budget the band already spends,
  and the density tier covers the counts past it.
- The view's displayed regions cap at 256 table entries; a mate on a
  region past that draws its stem.
- Dropped with the plugin: mate-direction ticks, the score-filter slider,
  the display-mode menu, the hover recolour and the one-ended stem a plain
  SNV drew by accident. A link's hover highlight is its box, and its hit
  the curve's own.
- `DisplayStatusChrome` keeps its entry point with no display rendering it
  directly.
- The alignments band and the circular view's chords are the next
  consumers, in that order; the band's Y scale, apex clamp, palette and
  feet are policy that would feed the channels, and a chord needs the link
  to know it is under a polar stage.

## Rejected alternatives

- **Keep `LinearArcDisplay` and `LinearPairedArcDisplay` as presets over
  the mark display.** Colin's call: a preset keeps two display types, their
  slot names and the plugin package alive to say what one `marks` entry
  says.
- **A view-space DOM overlay for cross-region links, as the band has.** A
  second drawing path with its own hover and export; the region table draws
  them on the GPU from the block holding each foot.
- **Resolve the far foot's region in the worker, from the displayed regions
  sent with the request.** Every region change would refetch every region;
  the display resolves it on the main thread once per fetch instead, and
  the worker stays pure over the parser's output.
- **A bezier on the GPU.** A cubic has no exact distance, so its
  antialiasing would need a per-fragment minimum over segments; the
  half-ellipse the band already drew has one. A display wanting the old
  bezier look passes the same height under `dome`.
- **A `size` channel resolved to px in the worker.** An open domain
  resolved per region would stroke one value at different widths in two
  blocks, and thicken arcs as a pan changed the fetched extent; the raw lane
  through a uniform scale is the rule-3 form.
