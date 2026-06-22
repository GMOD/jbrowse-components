# Circular genome support — thinking doc

Status: exploratory. No code written. Captures the problem space for
origin-spanning features (NCBI GFF3) and the two viable architectures so we can
pick a direction later.

## Why this came up

NCBI GFF3 encodes a feature that crosses the origin of a circular replicon as a
**single line** whose `end` runs past the sequence length into "virtual space"
(e.g. start 4,640,000, end 4,641,200 on a 4.64 Mb chromosome). NCBI also flags
the landmark `region` feature with `Is_circular=true`. This is common in the
bacterial / organellar / viral genomes we serve from jb2hubs (e.g.
pneumobrowse).

## What the codebase does today (baseline)

- **No topology anywhere in core.** `Region` MST model
  (`packages/core/src/util/types/mst.ts`) is `refName/start/end/reversed` only.
  Assembly manager, refseq adapters, sequence plugin have no `isCircular` /
  `topology`.
- **`Is_circular` is parsed but inert.** `gff-nostream` maps it to a feature
  attribute; the GFF3 save-type round-trips it; nothing reads it for rendering.
- **circular-view plugin is unrelated.** It is a whole-genome chord diagram
  (`ChordRenderer` / `ChordVariantDisplay`) for inter-region arcs. It does not
  render ordinary feature tracks and has no notion of an origin-spanning gene.

## The three concrete failures for origin-spanning features

1. **Draws into virtual space.** Near the contig end the feature is retrieved
   (its start is in range) but is drawn out to `bpToPx(end)` with
   `end > seqlength`. Best case the displayed-region clamp
   (`LinearGenomeView/util.ts:33`) clips it at the edge; the wrapped segment is
   simply lost.
2. **Wrapped portion invisible at the origin.** The feature's tabix-indexed
   `start` is near the contig end, so a query of `0..N` never returns it, and the
   adapter redispatch only expands to bounds of features already found in the
   query (`Gff3TabixAdapter.ts:84`). The piece that visually belongs at position
   0 is unreachable when you are looking at position 0.
3. **No flag to even know a contig is circular.** Without assembly/refseq
   topology, JBrowse can't show an origin marker, can't offer "view across the
   origin," and can't decide to wrap.

These are independent: even a perfect renderer can't fix #2 without a retrieval
change, and neither matters without #3.

## Why the cheap fix is not actually "accurate"

Clamping the draw extent to contig length stops the misrender (#1) but is a lie:
the gene looks truncated at the contig boundary when biologically it continues
at the origin. If we want *correctness* (the user's stated goal) rather than
just "not broken," we need one of the two architectures below.

## Option A — Repeated-linear concatenation

Render the circular sequence as a linear coordinate space of length `2L` (or
`L + viewWidth`): the contig followed by a copy of itself. Origin-spanning
features become ordinary non-wrapping features in the doubled space, and the user
can scroll continuously through the origin.

- **Pros:** Reuses the entire LGV rendering/layout/track stack unchanged. Tracks,
  glyphs, labels, search, export all "just work." Smallest rendering surface.
- **Cons:**
  - Coordinate duality: every bp maps to two pixels. Need a canonical
    `bp = pos mod L` for feature identity, search results, URL/bookmark state,
    and to avoid double-counting in stats/coverage.
  - **Retrieval is the hard part.** Either the adapter must synthesize the
    wrapped copy (fetch `[start, L)` and `[0, end-L)` and stitch, re-emitting the
    origin-spanning feature at both `start` and `start-L`), or a generic
    "circular adapter wrapper" sits in front of any adapter and does the modular
    fetch + coordinate offset. This is where the real work is, and it touches
    tabix/BAM/CRAM/BigWig alike if we want it to generalize.
  - Coverage/quantitative tracks at the seam need careful handling so the doubled
    region isn't summed twice.
- **Scope:** topology flag (#3) + a circular adapter-wrapper doing modular
  fetch/offset + a `2L` displayed-region mode in LGV + canonicalization of
  coordinates for search/share/stats.

## Option B — True circular viewer

A dedicated polar viewer that lays features out on a ring (radius = track, angle =
position). Origin-spanning is geometrically free — angle wraps mod 2π.

- **Pros:** Biologically honest; the canonical way to show plasmids/bacterial
  chromosomes (cf. CGView, Artemis DNAPlotter). Origin, GC skew, replication
  terminus all have natural homes.
- **Cons:**
  - Large new rendering stack: glyph layout, collision/stacking, labels,
    hit-testing, zoom/pan, export — all reimplemented in polar coords. Our
    existing circular-view is chords-only and is **not** a starting point for
    feature glyphs.
  - GPU path: the canvas renderer is built around linear x = bp→px. A ring needs
    either a polar transform in the shader or CPU-side arc tessellation. Non-
    trivial against the webgl-poc architecture.
  - Readability of dense feature detail is worse than linear at high zoom;
    typically you still want a linear inset, so you may end up building both.

## Recommendation (tentative)

For *accuracy with least new surface*, **Option A (repeated-linear)** is the
better near-term bet — it keeps one rendering stack and isolates the genuinely
new work into (a) a topology flag and (b) a circular adapter wrapper that does
modular fetch + coordinate offset. The hard, reusable nugget is that wrapper;
everything downstream is the existing LGV.

**Option B** is the "right" long-term visualization but is a whole new viewer and
GPU layout effort; worth it only if circular genomes become a first-class product
focus rather than a correctness patch.

A pragmatic sequencing:

- First: add the **topology flag** (assembly/refseq + consume parsed
  `Is_circular`) and the **draw-extent clamp** so nothing misrenders. Cheap,
  unblocks honesty about "this contig is circular."
- Then: prototype the **circular adapter wrapper + 2L LGV mode** (Option A) on a
  single bacterial test config (pneumobrowse) before committing to generalize
  across adapters.
- Defer Option B unless product direction demands a true ring.

## Open questions

- Where does topology live — assembly refNameAliases/refseq metadata, or a new
  per-refseq `topology: 'circular' | 'linear'`? NCBI gives it per-`region`
  feature in the GFF, but it logically belongs to the assembly.
- Do we trust `end > seqlength` as the wrap signal, or require the topology flag
  before interpreting virtual-space coordinates? (Defensive: require the flag.)
- Coverage/BigWig seam double-counting in Option A — acceptable to ignore for a
  v1 that targets feature tracks only?
- Does jb2hubs actually have origin-spanning *features*, or just `Is_circular`
  contigs with no crossing genes? If the latter, this is purely cosmetic
  (origin marker) and neither option is urgent. **Worth confirming before any
  build.**

## Enabling the workflow for Option A

The central realization: **`displayedRegions` already IS linear concatenation.**
The LGV coordinate space is `Region[]` summed end to end
(`model.ts:746` totals `r.end - r.start`; `displayedRegionsTotalPx` at
`model.ts:814`). Each region carries its own true `refName/start/end`, blocks
fetch per-region with those true coords (`blockTypes.ts`), and the location box /
search / share report per-region coordinates. So the entire `2L` coordinate
space, scrolling, and coordinate canonicalization come **for free** — we do not
build a new coordinate system. We only need to (a) populate displayedRegions and
(b) make retrieval wrap.

### What's free vs. what's new

| Concern | Status |
| --- | --- |
| `2L` coordinate space, bpToPx, blocks | free — list the contig twice in `displayedRegions` |
| Location box / search / bookmarks show true bp | free — regions carry true coords; the second copy still reads `chr:0..` |
| Scroll continuously through the origin | free |
| Origin-spanning feature retrieval near origin | **new** — circular adapter decorator |
| Splitting a feature with `end > L` into abutting halves | **new** — in the decorator |
| Seam with no inter-region gap | small — zero `interRegionPadding` at the seam |
| Cross-seam intron/connector line for one glyph | not solved — cosmetic casualty (see below) |

### The seam-abutment insight

If region 1 is `chr:0-L` and region 2 is `chr:0-L` placed adjacent with zero
padding, a gene at `[L-1200, L+1200]` rendered as `[L-1200, L]` in region 1 plus
`[0, 1200]` in region 2 **abuts exactly at the seam** — the two boxes touch and
read as continuous. Perfect single-glyph continuity (one connector line crossing
the seam) is *not* achievable because JBrowse lays out features per-region and
never joins a glyph across a region boundary. For most genes the abutting-boxes
result is good enough; the missing cross-seam intron line is the known cosmetic
limit of Option A.

### The one piece of real new code: a circular adapter decorator

A `BaseFeatureDataAdapter` wrapper, parameterized by contig length `L`, sitting
in front of any feature adapter:

- For a region query `[qs, qe]` on a circular refName, fetch `[qs, qe]` from the
  inner adapter as normal.
- Re-emit any feature whose `end > L` as two features: `[start, L]` and
  `[0, end - L]`, each tagged so layout draws them in the right region frame.
- When `qs` is near the origin, also issue a wrap fetch of `[L - margin, L]` to
  catch origin-spanners whose tabix-indexed start sits near the contig end
  (failure #2). This mirrors the existing redispatch idea in
  `Gff3TabixAdapter.ts:84` — same "expand the fetch" muscle, applied modularly.
- Give both halves a stable id derived from the canonical bp (`pos mod L`) so
  selection/highlight reconcile across copies and the split isn't double-counted.

Isolating the wrap here keeps the LGV, glyph layout, and GPU path untouched, and
makes it reusable across adapter types later.

### De-risking sequence (cheap first)

- **Step 0 — config-only POC, zero code.** On a bacterial config (pneumobrowse),
  hand-set `displayedRegions` to the contig listed twice with the seam padding
  zeroed. Confirms the scroll UX and that box-abutment reads correctly, and tells
  us whether the cosmetic seam limit is acceptable — before writing any adapter
  code.
- **Step 1 — circular decorator for gff3-tabix only.** Implement modular fetch +
  split-at-`L`; test against a real origin-spanning gene.
- **Step 2 — topology + UX.** Add assembly/refseq `topology: 'circular'` (and/or
  consume parsed `Is_circular`), an LGV "linearize circular contig" action that
  builds the doubled displayedRegions + wires the decorator, and an origin marker
  at the seam.
- **Step 3 — generalize.** Extend the decorator to other adapters; decide BigWig
  / coverage seam double-count policy.

### Remaining issues specific to Option A

- Cross-seam connector line for a single multi-exon glyph (cosmetic; accept v1).
- Feature identity / dedup across the two copies and across the split halves —
  needs canonical-bp ids.
- `interRegionPadding` is inserted between regions generally; we need it zeroed
  *only* at a circular seam (or replaced by an explicit origin marker), not
  globally.
- Quantitative (BigWig/coverage) seam double-counting in the doubled space.
