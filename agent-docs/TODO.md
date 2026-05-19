# Active Work Items

## TubeMapView: node-width scaling control (`widthPerBp`)

`widthPerBp` is a volatile field (default 10) that controls how many CSS pixels
each bp of sequence contributes to a node's rendered width. Currently it is
hardcoded — there is no UI to change it. Adding a control would let users expand
dense graphs (many short nodes) or compress sparse ones without changing the
pan/zoom transform.

**Suggested implementation:**
- Add `setWidthPerBp(v: number)` action to the model (clamp to e.g. 2–50).
- Add `rawGFA: string` volatile field; store the text in `applyGFA` so re-layout
  on `widthPerBp` change doesn't require a round-trip for file-loaded views.
  Track-loaded views can re-run the RPC instead (reuse `loadFromTabixSubgraph`).
- Re-run `layoutGFA(parseGFA(self.rawGFA), self.widthPerBp)` inside `setWidthPerBp`.
- Add a labeled slider or `+`/`-` pair to `TubeMapToolbar` (label: "Node width").
- Keep the existing `scale`/`translateX`/`translateY` transform independent —
  `widthPerBp` changes layout geometry, zoom/pan just moves the viewport.

**Files:** `model.ts` (`widthPerBp`, `rawGFA`, `applyGFA`), `TubeMapToolbar.tsx`

---

## `gfaParser.ts`: surface errors for malformed input

`parseGFA` in `packages/graph-core/src/gfaParser.ts` silently drops or produces
garbage for malformed lines (non-null assertions on split fields, unvalidated
`+val` conversions returning `NaN`, unknown record types ignored with no warning).
A user uploading a truncated or wrong-format file sees a blank canvas with no
feedback.

**Suggested implementation:**
- Wrap the per-line parsing block in a `try/catch` and collect parse warnings
  rather than crashing or silently skipping.
- Return `{ graph: GFAGraph, warnings: string[] }` from `parseGFA` (breaking
  change — both callers need updating: `TubeMapView/model.ts:applyGFA` and
  `GraphGenomeView`).
- Surface non-empty `warnings` in the view's status/error banner after load
  (e.g. "Loaded with 3 parse warnings — see console").
- Validate `+val` conversions: `Number.isNaN(result) ? undefined : result`.

**Files:** `packages/graph-core/src/gfaParser.ts`, both view model files,
`TubeMapView/components/ImportForm.tsx` (display warnings), `gfaParser.test.ts`
(add malformed-input cases).

---

**Updated:** 2026-05-07 | PRD.md holds invariants; this file is the categorized backlog.






## The synteny import form


Not working/overcomplicated ui now


## Synteny canavs export

- Use normal bezier drawing in svg export/canvas
- Try to improve beziers a bit in webgl/webgpu
- Significantly more pixel artifacts in webgl/webgpu when zoomed out
- Unclear how to reproduce: was side scrolling a lgv, synteny view was not updating, and gene glyphs were gone. maybe from lost context



## GWAS

recombination subtrack

## Refactors

why is renderermenuitems imported into gwas anyways, i thought we modularized it out to avoid having to use it at all in gwas

---

## Synteny: ideas borrowed from gggenes / SVbyEye

Survey notes after reading the `gggenes` R package (David Wilkins) and
`SVbyEye` (`~/src/vendor/SVbyEye`). Bezier-curve ribbons, CIGAR-op coloring, and
collinear-chain merging are already in our renderer — these items are
specifically the things we *don't* do yet.

### gggenes-inspired

**Anchor-feature row alignment in `MultiLGVSyntenyDisplay`.**
gggenes' `make_alignment_dummies()` shifts each facet so a chosen gene lands at
the same x in every row. Adapt for `MultiLGVSyntenyDisplay`: right-click feature
→ "Align rows on this feature" → compute per-row `offsetPx` so the feature
center lands at the same screen x across every genome row. No data-model change;
new feature-context-menu action plus one model action walking each row's LGV and
calling `centerAt` / setting `offsetPx`. Pairs naturally with
[[project_untangle_linearization]].

**Categorical fill by feature attribute (`colorBy: byTag`).**
gggenes' core aesthetic is `aes(fill = gene_family)` — color tied to homology
group, not alignment op. Add a `byTag` / `byAttribute` entry to the synteny
color mode enum alongside the existing strand/CIGAR/syri modes. Reads a
configurable attribute (`Name`, `gene_family`, custom tag), hashes to a stable
categorical palette. Makes the renderer usable for ortholog-cluster
visualization without producing a PAF.
**Files:** `syntenyColors.ts`, the synteny color-mode config schema, the
shader-side color-lookup uniform path.

**Strand-arrow glyph on synteny blocks.**
gggenes encodes strand by arrow-shape direction. Inversions in our ribbon today
are conveyed by a twist; for narrow / cluster-scale comparisons that's hard to
read. When a block is ≥N CSS pixels wide, overlay a small directional arrow
(SDF in shader, or a tiny extra triangle in Canvas2D). Optional via a config
toggle so chromosome-scale views aren't littered.

**Subgene / domain sub-ribbons.**
gggenes' `geom_subgene_arrow` draws domains nested in gene arrows. We render
subfeatures inside LGV displays but never connect them across LGVs. Allow a
synteny block to optionally render thinner inner ribbons connecting matching
sub-CIGAR / matching subfeature tags between the two genes. Not a quick win —
needs a data model for "sub-block" homology — but worth scoping.

### SVbyEye-inspired

**Identity-binned ribbon coloring (`colorBy: identityHeatmap`).**
`pafAlignmentToBins.R` splits each alignment into fixed-bp windows and reports
per-bin identity. Render the ribbon as a gradient of identity-binned segments
(e.g. ≥99.5% green, 99–99.5% yellow-green, 95–99% yellow, <95% red). Reveals
identity-dropoff zones (recombination hotspots, paralog mis-mapping) that the
current binary match/mismatch CIGAR coloring hides. Implementation: extend
`visitCigarRenderedSegments` to also emit a "binned" mode that accumulates match
counts over a configurable bp window and emits one segment per bin.
**Files:** `buildSyntenyGeometry.ts`, `syntenyColors.ts`.

**SV-aware CIGAR break-out (above-threshold indels).**
`breakPafAlignment.R` splits a PAF row at indels above a size threshold and
labels the gap as a structural variant. We already render I/D ops in red/blue
but they're treated as part of the ribbon. Add a config threshold ("indels
≥50bp render as labeled SV markers") and emit them as a distinct glyph (a small
chevron / bracket on the appropriate axis) rather than a thin ribbon segment.
Easier to spot real SVs amid base-level noise.

**`plotSelf` — self-synteny / segmental-duplication arc view.**
SVbyEye renders intra-sequence homology as wide arcs above a single sequence
baseline. We have no equivalent: showing seg-dups within one chromosome
currently means opening a synteny view against itself, which is awkward. Add a
"self-synteny" display type on a single LGV that consumes a self-vs-self PAF
and draws arcs above the track. Arc height ∝ alignment span; direction encoded
by arc side (above = forward, below = inverted, à la SVbyEye's `y.reverse`).
This is a new display, not a tweak — list under [[project_large_scale_synteny]].

**Strand-majority autoflip on import (`syncRangesDir`).**
SVbyEye `flipPaf.R` / `syncRangesDir.R` votes per-chromosome on majority strand
and pre-flips alignments so the dominant strand runs forward. For PAFs where a
contig was assembled in reverse, this produces a much cleaner ribbon picture.
Add an opt-in adapter-level transform ("Flip to majority strand on load") to
the PAF / synteny adapter config.

**Interactive coordinate lift across alignments (`liftRangesToAlignment`).**
SVbyEye lifts an annotation range from query↔target space via CIGAR walking.
For us: right-click a feature in LGV-A → "Lift to LGV-B" → walk the underlying
synteny block's CIGAR to project the range and `centerAt` the corresponding
position in LGV-B. We can already pan-sync, but lifting a *specific bp range*
through a non-collinear alignment is what users actually want. The lift logic
mostly exists in `@jbrowse/synteny-core`'s CIGAR visitors — wire it to a menu
action.

**Overlapping-alignment disjoin (`disjoinPafAlignments`).**
For repeat-heavy regions, multiple PAF rows cover the same query and target
intervals, painting on top of each other and producing visual mud. SVbyEye
splits at intersection boundaries so each segment is owned by a single row.
Add an optional pre-pass in the PAF adapter (or in `chainCollinearAlignments`'s
neighbourhood) that disjoins overlapping intervals and stacks them onto
parallel sub-rows rather than overpainting. Trade-off: more ribbons → more
fill cost; gate behind a config flag.

**Genome-wide chromosome painting (`plotGenome`).**
SVbyEye's `plotGenome` paints query contigs as colored ribbons onto reference
chromosomes, filtered by minimum aligned bp. Closest analogue we have is
`CircularView` synteny. Worth considering a "linear genome painting" display
(reference chromosomes laid end-to-end, query contigs as colored blocks
overlaying), distinct from LGV-vs-LGV ribbons.

**Outline-only render mode.**
SVbyEye supports drawing alignment borders in gray without filling. For dense
plots where overlap obscures structure, an outline-only mode reveals geometry
without color saturation. Cheap shader uniform; expose via display settings.

---

### Additional ideas from gggenomes / clinker / second-pass SVbyEye

**Drag-to-reorder genome rows in `MultiLGVSyntenyDisplay`.**
`clinker` lets you click-and-drag a row label to reorder genomes; this is how
users explore which row-ordering minimizes ribbon crossings. We currently force
the user to remove the display and re-add in a new order. Implementation: a
drag handle on each row's gutter (the strip left of the LGV), `onDragEnd`
swaps array positions in the model's genome-row list. The clustering layout
(`clusterLayout` in `MultiLGVSyntenyDisplay/model.ts`) already orders rows; we
just need a manual-override mode.

**Per-row flip / reverse-complement action (`gggenomes::flip()`).**
gggenomes has a one-call `flip()` that reverse-complements a single sequence so
its alignments line up cleanly with neighbours — invaluable when a contig was
assembled in the "wrong" orientation. We have a coarse strand-majority autoflip
(suggested above) but no per-row toggle. Add "Flip this row" to the row context
menu in `MultiLGVSyntenyDisplay`; inverts the LGV's coordinate display and
re-projects ribbon endpoints. Cheaper than the adapter-level autoflip and
user-controlled.

**Annotation connector lines for grouped features** (SVbyEye `addAnnotation.R`).
SVbyEye draws horizontal connectors between annotation ranges that share an ID
— produces exon-style gene-model rendering across a row. We render subfeatures
inside a parent feature but don't render *across-feature* groupings (e.g.,
multiple BLAST hits forming one homology unit). Add an optional grouping key on
the synteny adapter config; ranges sharing the key get a thin connector line
drawn under the ribbon endpoints.

**Cross-LGV vertical bookmark band.**
Per-LGV bookmarks already exist. Add a "synteny bookmark" that, given a feature
in one row, computes the lifted ranges in all other rows (via the
`liftRangesToAlignment` machinery suggested above) and draws a translucent
vertical band through each row at the matching position. Persistent visual
landmark that survives panning. Pairs with the anchor-feature alignment idea
but layered, not destructive.

**Color-by-mapping-quality (`colorBy: mapq` / `colorBy: nm`).**
PAF column 12 (mapq) and the `NM:i:` tag (edit distance) are present in nearly
all PAFs we ingest but unused in coloring. Distinct from CIGAR-op coloring:
captures *aligner confidence* and *overall divergence per alignment* rather
than per-base op type. Two more entries in the `colorBy` enum; aligner-quality
filtering is what users often want when triaging messy PAFs.

### Ideas borrowed from SafFire (`~/src/SafFire`)

**Opacity-by-identity ribbon shading.**
SafFire (`lib.js:86-89`) maps percent identity directly to ribbon alpha (range
~0.5–0.7), so low-identity blocks read as faint and high-identity blocks pop —
without consuming the color channel. We already encode identity via CIGAR-op
coloring, which competes with strand/syri palettes. Add an additive alpha
modulation driven by per-block identity (computed from CIGAR or NM). Cheap
shader uniform on top of the existing color path; orthogonal to `colorBy`.

**Identity-as-histogram axis** (a third row).
SafFire draws a separate Y-band under the main ribbons where each block sits at
its percent-identity (lib.js around line 210) — a literal histogram of identity
along the alignment. Reveals identity gradients (recombination, paralog mis-
mapping) at a glance even when ribbons are saturated. In our world this would
be a sibling subdisplay under `LinearSyntenyDisplay` ("identity histogram
strip"), aligned to the same x scale but with y = percent identity.

**Weighted query-contig auto-centering.**
SafFire's `difference_in_mid_point()` (lib.js:120-140) offsets each query
contig so its *length-weighted alignment midpoint* sits below the target's
matching midpoint. The result is a much cleaner ribbon picture without manual
panning. For `LinearSyntenyView` / `MultiLGVSyntenyDisplay`: add a "Center
query on target alignment centroid" action that computes per-row `offsetPx`
from PAF weights. Sibling action to the anchor-feature alignment idea above —
this one is automatic / data-driven, the other is user-picked.

**Query-contig ordering by min target start.**
SafFire (`order_q_names_by_start_point` lib.js:85-107) orders query contigs
by their minimum target-axis start, not by length. Groups related alignments
spatially → fewer ribbon crossings. In `MultiLGVSyntenyDisplay` add this as
an alternative to `clusterLayout` — "Order by target position" toggle. Trivial
sort; pairs with the drag-to-reorder manual override.

**Animated zoom-to-region for URL navigation.**
SafFire's `pos=chr1:X-Y` triggers a 750ms D3 zoom transition rather than a
jump cut (lib.js:508-528). Easier to track context visually, and the
intermediate frames make the spatial relationship between source and
destination obvious. We already animate some navigations; would be worth
applying to LGV deep-link navigation (`?loc=` URL parameter) and to the
"Center on this feature" action. Pure UX polish, no data-model change.

**Auto-export SVG via URL parameter (`save=true` / `view=true`).**
SafFire's URL API includes `save=true` (auto-download SVG after zoom) and
`view=true` (open SVG inline). Enables scriptable, reproducible figure
generation from a CI job or notebook — point at a URL, get an SVG. We have
SVG export already; surface it as a URL hash parameter so external
pipelines can drive `jbrowse-web` to emit figures without browser
interaction. Pairs with our existing session-share URL infrastructure.

**Pre-computed PAF statistics format (`rb stats --paf` TSV).**
SafFire consumes rustybam's tabular stats output (per-block columns:
`perID_by_matches`, `matches`, `mismatches`, `insertion_events`,
`deletion_events`) rather than raw PAF. All CIGAR work happens server-side
in the preprocessing pipeline (`rb trim-paf | rb break-paf | rb orient | rb
filter | rb stats`). For large pangenome PAFs this is a real cost win: no
client-side CIGAR walking for per-block stats. Worth supporting an
"enriched PAF" adapter input that consumes this format directly, falling
back to live CIGAR parsing when only raw PAF is present. Aligns with
`agent-docs/CS_ENRICHED_PAF_PLAN.md`.

**BED density capping + simplification helper.**
SafFire caps annotation rendering at `max_bed_items=500` and drops items
smaller than 1/3000 of the view width at the current zoom (lib.js:441).
A bundled `simplify_bed.py` collapses gene annotations by keeping the
largest representative per `(name, strand, contig)` group. Useful for
overlay tracks on dense regions; we currently rely on RBush culling but
don't have a "merge near-duplicates by name" pre-step. Could ship as a
small CLI tool in `tools/` alongside `gfa-to-tabix`.

**Live UCSC Browser snapshot mirror.**
SafFire fetches a UCSC `hgRenderTracks` PNG synced to the current viewport
(lib.js:537-552) — a *live* image, not a deep link. Lets users see how a
locus looks in UCSC without leaving the comparative view. We could expose
this as an optional side-panel widget in `LinearGenomeView`: given an
hgsid and a target assembly, fetch the snapshot whenever the view's
`displayedRegions` change. Read-only context, no data flow back. Low
priority but a small footprint.


