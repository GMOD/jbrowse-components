---
status: Accepted
summary: "A SyntenyTrack draws on the circular view as ChordSyntenyDisplay, and an alignment is a RIBBON rather than a chord: a record has a span on both sides where a translocation has a point on both sides, and the span is what the figure is read for. The display lives beside ChordVariantDisplay in circular-view and takes @jbrowse/synteny-core behind the lazy state model, so a product with no synteny plugins pays for a config schema and nothing else. Both ends resolve against their own assembly through a slice index keyed by assembly AND refName, which is what let the view's `assembly` become a list — each assembly lays its contigs out in turn, and a two-assembly circle is authored rather than opened from the import form"
---

# ADR-116: A synteny alignment is a ribbon on the circle

## Status

Accepted (2026-09-10). Builds on the chord machinery
[ADR-019](adr-019-synteny-cpu-picking.md) and the GPU synteny stack do not
touch: the circular view's displays are React SVG, drawn on the main thread
from features fetched whole.

## Context

The circular view drew one thing: a `VariantTrack`'s translocations, as chords
through `ChordVariantDisplay`. A chord's geometry is a record's own locus and
its mate's locus (`svMateLocus`, `chordGeometry.ts`), and a synteny record has
exactly that shape — `mate` carries `refName`/`start`/`end` and an
`assemblyName`, filled in by every pairwise adapter (PAF, delta, chain,
MashMap, BLAST tabular, PIF). So the picture nobody could draw was one the data
already supported, and the Circos-style ribbon plot is the most-asked-for view
of a whole-genome alignment.

Two things stood between the data and the figure. The chord components keyed
their slice lookup by refName alone, and the view resolved one `assembly` at
launch — so the two-assembly case, which is most synteny, had nowhere to put
the second genome's contigs.

## Decision

### A ribbon, not a chord

A chord joins two points. An alignment is two spans, and the spans are the
thing a synteny figure is read for — which stretch of the query covers which
stretch of the target, and how much of each. Drawing the midpoints throws that
away, and it throws away the strand with it.

`ribbonPath` emits a closed path: the anchor's arc, a quadratic curve to the
mate, the mate's arc, and a curve home. **The strand lives in the order the
mate's arc is walked and nowhere else** — a forward alignment pairs the spans
start-to-start and walks the mate high-to-low, so its two curves do not cross;
a reverse one pairs the anchor's start with the mate's end and takes the twist,
which is how an inversion reads on a circle. `ribbonAngles` is that ordering on
its own, so a test pins the twist without measuring a path string.

The curves bow toward the centre through `chordControlRadius`, the rule the
variant chords already use, so a figure carrying both draws them as one family.

**Each end has a floor of `minRibbonEndPx` (2px of arc), centred on where the
span sits.** A 5 kb PAF record on a 250 Mb chromosome is 2e-5 of the circle:
without the floor it is a zero-width quad — invisible, and with nothing to
point at. The floor costs nothing on the blocks big enough to read, and it is
also what keeps a ribbon into an elided slice drawn, since `bpToRadians`
collapses an elision to its midpoint.

A filled path is also a better hit target than a 1px stroke, so hover and click
come free where the chord needed the stroke to be findable.

### The display lives in circular-view, on synteny-core

`ChordSyntenyDisplay` sits beside `ChordVariantDisplay`, the shape the tree
already has: the circular plugin owns the displays that draw into its circle,
and it reaches the track's vocabulary through that track's **core package** —
`@jbrowse/sv-core` for the variant chords, `@jbrowse/synteny-core` for the
ribbons. No plugin-to-plugin dependency, and `getMate` moved into synteny-core
so the ribbons and the linear displays read a mate through one function.

Every synteny-shaped import is behind the lazily-loaded state model, so
`jbrowse-react-circular-genome-view` — which ships no synteny plugin and so can
never open a `SyntenyTrack` — pays for the eager config schema and nothing
else. The strand colours are a `jexl:` literal in that schema's `color`
default rather than the imported `colorSchemes.strand`, for the same reason.

### An end resolves against its own assembly

The slice index is keyed by assembly **and** refName. Both genomes on a circle
can carry a `chr1`, and a refName-keyed table answers whichever slice it wrote
last — placing both ends of every alignment on one genome, silently and
plausibly. The keys are written in the ADAPTER's namespace (its spelling of the
assembly, its spelling of the contig), because that is what a feature off the
wire carries: `renameRegionsForAdapter` respells the request on the way out and
`getRefNameMapForAdapter` gives the reverse table per assembly, both resolved
on the main thread since a worker has no assembly manager.

### The view's `assembly` takes a list

`CircularViewCommands.assembly` is `string | string[]`, and each assembly lays
its contigs out in turn — so hg38 takes one arc of the circle and mm39 the
next, which is the layout the ribbon plot is read on. This was bounded because
almost nothing in the view was ever single-assembly: `displayedRegions` carries
an `assemblyName` per region, `assemblyNames` is already the set of them, and
the slices, the ruler and the track selector's filter all work per region. What
was single was the **launch** — `applyInit` resolved one name, and the
`initialized`, `error` and `loadingAssembly` gates waited on one. Those now
iterate. `displayedRegionNames` resolves against each assembly separately, so a
list naming contigs of both restricts both and each reports its own misses.

## Alternatives rejected

- **A chord between the two midpoints.** Cheapest, and identical to the variant
  path, but it draws a synteny track as if it were a translocation callset: no
  block extent, no strand, and a 1px stroke to hit.
- **The display in `linear-comparative-view`**, which owns `SyntenyTrack`. It
  keeps synteny-core out of the circular product's dependency list, but at the
  price of a plugin-to-plugin dependency on `@jbrowse/plugin-circular-view` and
  a new public export surface on it (the slice geometry, the chord frame) —
  ABI for one caller. The lazy boundary buys the same bundle outcome without
  either.
- **An `onChordClick` jexl slot on the synteny display.** The variant display
  has one because the SV inspector drives its circle's clicks; nothing drives
  this one, and a click that opens the feature details panel is what a ribbon
  should do by default. `featureWidgetType` names the linear views' own
  `SyntenyFeatureWidget`, so one drawer entry serves both.
- **A second assembly selector in the import form.** A two-assembly circle is
  authored today. Adding the control means answering what the form does with
  three, and with a track that covers only two of them — a question the
  synteny import forms already answer at length, and not one this display
  needed settled to ship.
- **Disambiguating the ruler labels.** Two assemblies each with a `chr1` draw
  two identically labelled arcs. Threading "which assembly" into
  `regionLabelText` reaches the padding reservation and the SVG export's gutter
  measurement, and the fix belongs with whatever else the two-assembly circle
  needs on screen.

## Consequences

- A whole-genome PAF is fetched entire, like the variant chords: one
  `CoreGetFeatures` over every displayed region, one React `<path>` per record.
  There is no LOD tier and no cap. A million-row alignment will not draw; a
  chromosome-scale one will. **PIF's coarse tier is the lever if that becomes a
  complaint**, and it is a fetch-side change, not a geometry one.
- `ChordDisplayFrame` now owns the error/loading/phase chrome both chord
  displays publish, including the `data-display-drawn` census attribute — so a
  third circular display gets it by composing the frame rather than by
  remembering the four attributes.
- The two-assembly circle is reachable only from a `defaultSession` view, a
  session spec or `LaunchView-CircularView`.
