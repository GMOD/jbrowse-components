
  Synteny data model: JBrowse vs. plotsr / ntSynt-viz

  1. What JBrowse's stack actually is

  JBrowse's synteny pipeline is an alignment-centric, viewport-indexed, GPU-rendered pairwise system.
  The three pieces you named form one tight chain:

  make-pif (products/jbrowse-cli/src/commands/make-pif/) takes a PAF and emits each alignment twice —
  once indexed by target coords (t-prefix) and once by query coords (q-prefix) — so a tabix range
  query works no matter which genome you're looking at. The clever bit is the CIGAR rewrite in
  pif-generator.ts: the q-line's CIGAR is transformed so it stays valid when query becomes the
  "primary" axis (swapIndelCigar for +, flipCigar for -). It also optionally emits an uppercase coarse
  tier (T/Q), which is a no-CIGAR LOD summary that splits alignments at indels ≥10kb so each coarse
  row's bounding box stays tight.

  PairwiseIndexedPAFAdapter reads that file. pickPifPrefix decides q/t/Q/T from flip (which assembly
  you're viewing) × bpPerPx vs. threshold. Every feature carries a mate: {refName, start, end,
  assemblyName} and a shared syntenyId — that's the cross-genome linkage that lets the renderer draw a
  quadrilateral.

  LinearSyntenyView stacks N LinearGenomeView levels with N−1 strictly-pairwise synteny levels between
  adjacent rows. Geometry (4 hp-math corners per ribbon) is built in an RPC worker; the main thread
  renders via Slang/WebGL with a Canvas2D fallback. CIGAR segments become separate instances only when
  a feature is ≥4px wide.

  The whole thing is absolute-coordinate, 0-based half-open, alignment-block native. There is no
  notion of "this block is an inversion vs. a translocation" — strand is the only typing, derived from
  the PAF strand column (and strand1*strand2 for MCScan).

  2. The core philosophical difference

  ┌──────────────────┬────────────────────┬───────────────────────────┬───────────────────────────┐
  │                  │      JBrowse       │          plotsr           │        ntSynt-viz         │
  ├──────────────────┼────────────────────┼───────────────────────────┼───────────────────────────┤
  │                  │ Alignment (PAF row │ Classified SV block       │ Synteny block             │
  │ Primitive        │  + CIGAR)          │ (SYN/INV/TRANS/DUP)       │ (multi-genome, shared     │
  │                  │                    │                           │ block_id)                 │
  ├──────────────────┼────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Genomes          │ N rows, pairwise   │ Linear chain A→B→C→D,     │ Native N-way, block_id    │
  │                  │ N−1 levels         │ pairwise                  │ groups all genomes        │
  ├──────────────────┼────────────────────┼───────────────────────────┼───────────────────────────┤
  │ SV typing        │ None (strand only) │ 6 explicit types,         │ Inferred from strand      │
  │                  │                    │ distinct colors + z-order │ concordance               │
  ├──────────────────┼────────────────────┼───────────────────────────┼───────────────────────────┤
  │                  │ Manual (+          │                           │ Auto: NJ tree from        │
  │ Ordering         │ diagonalize by     │ Manual genome-file order  │ synteny distance          │
  │                  │ density)           │                           │                           │
  ├──────────────────┼────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Zoom/interaction │ Live, indexed,     │ Static matplotlib         │ Static gggenomes/ggplot2  │
  │                  │ base-level CIGAR   │                           │                           │
  ├──────────────────┼────────────────────┼───────────────────────────┼───────────────────────────┤
  │ Rendering        │ WebGL + Canvas2D,  │ matplotlib bezier patches │ gggenomes ribbons         │
  │                  │ bezier or straight │                           │                           │
  └──────────────────┴────────────────────┴───────────────────────────┴───────────────────────────┘

  The two vendor tools are static publication-figure generators operating on pre-classified,
  whole-genome block sets. JBrowse is a live, zoomable browser operating on raw alignments. That's why
  JBrowse uniquely has: tabix viewport indexing, the dual q/t encoding, CIGAR base-level detail, LOD
  tiers, and GPU instancing. None of that exists in plotsr/ntSynt-viz because they never need to
  fetch-on-pan or draw a million features.

  Conversely, JBrowse is missing the semantic layer both vendor tools center on.

  3. Three concrete things JBrowse could learn

  (a) Explicit SV-type classification — the biggest gap.
  plotsr's VARS = ['SYN','INV','TRANS','INVTR','DUP','INVDP'] with a fixed coldict
  (gray/orange/green/cyan) and z-ordering (SYN at z=0 background, everything else z=1 foreground) is
  genuinely more expressive than JBrowse's strand-only model. A user looking at a JBrowse ribbon can't
  tell an inversion from a translocation from a duplication except by reading geometry. The PIF
  format could carry an SV-type tag cheaply (it already passes through arbitrary PAF tags), and
  syntenyColors.ts already does main-thread recoloring without an RPC — so a colorBy: 'svType' mode
  would be low-cost to add if the upstream classification existed. The honest caveat: JBrowse ingests
  minimap2/nucmer PAF which doesn't classify SVs; you'd need a SyRI/BEDPE adapter to get the labels.
  That's the actual missing piece, not the rendering.
  The two vendor tools are static publication-figure generators operating on pre-classified, whole-genome block sets. JBrowse is a live, zoomable browser operating on raw alignments. That's why JBrowse
  uniquely has: tabix viewport indexing, the dual q/t encoding, CIGAR base-level detail, LOD tiers, and GPU instancing. None of that exists in plotsr/ntSynt-viz because they never need to fetch-on-pan or
  draw a million features.

  Conversely, JBrowse is missing the semantic layer both vendor tools center on.

  3. Three concrete things JBrowse could learn

  (a) Explicit SV-type classification — the biggest gap.
  plotsr's VARS = ['SYN','INV','TRANS','INVTR','DUP','INVDP'] with a fixed coldict (gray/orange/green/cyan) and z-ordering (SYN at z=0 background, everything else z=1 foreground) is genuinely more
  expressive than JBrowse's strand-only model. A user looking at a JBrowse ribbon can't tell an inversion from a translocation from a duplication except by reading geometry. The PIF format could carry an
  SV-type tag cheaply (it already passes through arbitrary PAF tags), and syntenyColors.ts already does main-thread recoloring without an RPC — so a colorBy: 'svType' mode would be low-cost to add if the
  upstream classification existed. The honest caveat: JBrowse ingests minimap2/nucmer PAF which doesn't classify SVs; you'd need a SyRI/BEDPE adapter to get the labels. That's the actual missing piece, not
  the rendering.

  (b) BEDPE / SyRI as a first-class input.
  Both tools key off SyRI output and BEDPE. JBrowse has a bed plugin with a BedpeAdapter (it's in your git status), but it's not wired into the comparative view as a typed-SV source. ntSynt-viz's
  convert_syri_to_ntsynt_blocks.py shows the conversion is trivial. This is the highest-leverage, lowest-risk addition.

  (c) Phylogeny-aware row ordering.
  ntSynt-viz auto-orders genomes via an NJ tree built from synteny distance (compute_distances → quicktree → cladogram). JBrowse's row order is manual; diagonalize.ts reorders chromosomes by density but
  not rows by relatedness. For >3-genome views this is a real usability win.

  4. Two things to not copy (and where JBrowse is already ahead)

  - Don't adopt ntSynt's strand-conflated SV model. It collapses TRANS into "+/+" and INV into "+/−", losing the translocation/duplication distinction entirely. plotsr's explicit enum is strictly better;
  if JBrowse adds typing, copy plotsr's, not ntSynt's.
  - Don't chase native N-way blocks as the primitive. ntSynt's shared-block_id-across-genomes model is elegant for static plots, but it presumes globally-consistent synteny blocks computed offline.
  JBrowse's pairwise-N−1 model is the right call for a browser because each level is independently fetchable/zoomable and degrades gracefully when one alignment is missing. Your existing memory note
  ([project_large_scale_synteny], [feedback_bed_format_combinations]) already reflects this stance — the pairwise constraint is a feature, not a limitation, for live rendering.

  JBrowse is clearly ahead on: viewport indexing (neither vendor tool can pan a 3Gbp genome), base-level CIGAR rendering, hp-math precision across whole genomes, GPU instancing, and live recoloring. The
  vendor tools can't zoom at all.

  5. Bottom line

  JBrowse's make-pif/PIF/PairwiseIndexedPAFAdapter stack is a genuinely strong infrastructure layer — better than anything in plotsr/ntSynt-viz for interactivity and scale. The gap is purely semantic: it
  models alignments, not structural-variant categories. The single highest-value move is a SyRI/BEDPE-typed-SV adapter feeding a colorBy: svType mode (cheaply enabled by the existing color pipeline),
  borrowing plotsr's explicit 6-type taxonomy. Phylogeny-aware row ordering is a strong secondary for multi-genome views.

  Want me to dig into any of these as a concrete implementation plan — e.g. wiring BedpeAdapter into the comparative view with plotsr-style SV typing, or prototyping the colorBy: svType path through
  syntenyColors.ts?

