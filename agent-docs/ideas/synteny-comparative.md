---
name: synteny-comparative
description: SV-type classification, `syntenyGroupId`, all-vs-all PAF, PIF limits, block-level chaining, the `featureId` instance ceiling, polyploidy-aware many-to-many synteny, and the 2026-07 vendor-format survey.
---

# Synteny / comparative

**Linked dotplot + linear synteny.** Selections/zoom propagate between both views.

**Swap axes** (dotplot & linear synteny). Flip comparison perspective or reverse
query/reference.

**Better defaults for human vs mouse.** Tune color schemes and default display options
for common interspecies comparisons.

**Barycenter / layer-sweep chromosome diagonalization (upgrade over single-pass greedy
best-hit).** `diagonalizeRegions` (packages/core) assigns each query chromosome to its
single **best** reference (max aligned bases) and sorts by position within that one ref —
a single-pass greedy best-hit, the same tier as D-GENIES / RaGOO / mummerplot `--layout`.
`runDiagonalize` now cascades this top-down across a stacked N-way view (each level
diagonalizes against the row the level above just reordered — a one-sided Sugiyama
layer-sweep, top row pinned). Two research-backed upgrades remain, both aimed at fewer
ribbon crossings for polyploid / multi-mapping genomes (e.g. grape's ancestral
triplication in the grape/peach/cacao demo, where one grape chromosome maps to ~3 others):

- **Soft (barycenter) positioning instead of winner-take-all.** Place each query
  chromosome at the aligned-base-weighted mean of *all* its partners' positions on a
  global reference axis (cumulative ref-length offsets), rather than snapping to one best
  hit and discarding the other 2/3 of the mapping. D-GENIES's squared-length "gravity"
  weighting is a good noise-suppressor variant. Contained rewrite of `diagonalizeRegions`
  (per-query accumulation of a global weighted position + strand sum, sort by that
  scalar) — and *also* a simplification (drops the nested per-(query,ref) `PairStats` map).
- **Iterative up/down sweeps** (Sugiyama median heuristic — a 3-approximation, Eades &
  Wormald 1994) for the no-pinned-focus case, and/or an optional simulated-annealing
  polish on the true crossing count (AccuSyn) seeded from the barycenter layout.

Already landed (2026-07): the reversal decision no longer rides on the strand vote alone
(it falls back to the length-weighted ref-vs-query position covariance when the vote is
within 80/20), the global input sort is gone (accumulation is per pair, so only intra-pair
order can perturb a float sum), and the anchor/position tie-breaks are explicit refName
comparisons instead of side effects of that sort. Orderings on real fixtures were
unchanged; only ambiguous-vote reversals moved.

Why deferred, not done: it **changes documented tie-breaking semantics**, not just adds.
The `base-count tie` test in `diagonalize.test.ts` pins `[qY, qX, qZ]` (a tied qX snapped
to the alphabetically first of the tied refs); a barycenter places qX at the centroid of
both refs → `[qY, qZ, qX]`. The determinism invariant (result independent of input order) still holds, but the
specific expected order changes, and whether the new layout is *visually* cleaner needs
A/B validation across several real datasets (rebuild jbrowse-web + regenerate synteny
screenshots), not just this one demo — where the dominant messiness is the *transitive*
peach↔cacao band, which no reordering can fix. A deliberate, separately-scoped pass with
browser verification. Sources: Sugiyama-Tagawa-Toda 1981; Eades & Wormald 1994 (median
3-approx); D-GENIES `paf.py` gravity; AccuSyn (crossing-count SA); ChromSyn / GENESPACE
(focal-propagation barycenter). Orthogonal to the "phylogeny-aware row ordering" note
below (that orders *rows* by relatedness; this orders *chromosomes within a row*).

**CIGAR draw toggles via gpuProps.** Shader uniform bit flags to gate
`drawCIGAR`/`drawCIGARMatchesOnly`; worker always emits full geometry, flags control
visibility. Only worth it if users toggle frequently.

`drawLocationMarkers` was the third name here and is **done** — by a different
mechanism, and the difference is the whole reason it went first. Markers need nothing
from the adapter, so "always emit" cost only the tick instances (`MIN_MARKER_FEATURE_PX`
bounds those: a whole-genome hairball emits none) and the toggle became a zero alpha on
the color lane in `computeSyntenyColors` — no new uniform, and it reuses the
`patchInstanceColors` path colorBy already had. The two CIGAR flags cannot follow that
route: they gate the CIGAR *parse* in `executeSyntenyFeaturesAndPositions`, so the fetch
genuinely brings back different bytes, and "always emit" means always parsing
multi-megabyte CIGARs. A uniform flag is the right shape for them; a color-lane trick is
not.

**Dotplot short-segment rendering (point sprites).** Short alignments (sub-pixel
`len < lineWidth`) render as thin slivers because the degenerate fallback expands the
quad only vertically. A square-cap displacement along the tangent was tried and
reverted (odd polygons on normal segments). Better: (a) emit `gl_PointSize` sprites for
sub-threshold segments in a separate draw call; (b) round caps via SDF in the fragment
shader (pass along-tangent distance as a varying, discard outside `lineWidth/2`).

**A location-marker tick can't be read, only seen.** A tick states "this query
coordinate maps to that target coordinate" and there is no way to get the two numbers:
markers are excluded from the pick index by construction — both their edges are single
points, so the `max(|sx2-sx1|, |sx4-sx3|) >= 1` filter that makes `buildPickIndex` cheap
drops them (`reference/SYNTENY_PICKING.md`). A tooltip would need proximity-to-a-line
picking, i.e. a second index shape, for a job that is partly done already: the scalebar
labels the query end, and an exact correspondence takes the
`SyntenyResolveMatchingRegion` round trip. Worth it only if reading shear off the ticks
turns out to be something people try to do and can't.

**Connect to gene glyphs for MCScan-type results?** And add "synteny rects" to show
e.g. non-ribbon-based synteny (non-displayed-region translocations).

**Explicit SV-type classification — the biggest semantic gap.** JBrowse's synteny is
alignment-centric (strand is the only typing); plotsr's
`['SYN','INV','TRANS','INVTR','DUP','INVDP']` enum with fixed colors + z-ordering is
genuinely more expressive — a user can't tell an inversion from a translocation from a
duplication except by reading geometry. PIF already passes through arbitrary PAF tags
and `syntenyColors.ts` recolors on the main thread with no RPC, so a `colorBy: svType`
mode is cheap **if the upstream classification exists**. The missing piece is the data,
not the rendering: wire `BedpeAdapter` (already in the bed plugin) / a SyRI adapter into
the comparative view as a typed-SV source (ntSynt-viz's `convert_syri_to_ntsynt_blocks.py`
shows the conversion is trivial). Highest-leverage, lowest-risk addition. Copy plotsr's
explicit 6-type taxonomy, **not** ntSynt's strand-conflated model (which loses the
trans/dup distinction). Secondary: **phylogeny-aware row ordering** (NJ tree from synteny
distance, like ntSynt-viz) for >3-genome views — `diagonalize.ts` reorders chromosomes by
density but not rows by relatedness. Don't chase native N-way blocks as the primitive —
the pairwise N−1 model is the right call for a browser (independently fetchable/zoomable,
degrades gracefully when one alignment is missing).

**`syntenyGroupId` for cross-row block identity (not N-way geometry).** Synteny features are
strictly pairwise today: one `mate` (`{start,end,refName,assemblyName}`) per feature, and no
shared block/anchor id anywhere in `comparative-adapters` or `synteny-core` (PAFAdapter's
`uniqueId` is just the row index). Add an optional adapter-provided `syntenyGroupId`
(block/anchor id) *alongside* `mate` — not replacing it — and you get the real multi-way value
without touching the pairwise geometry the linear layout needs anyway: consistent color per
block across every row it touches (`colorBy: group`, hash the id in `syntenyColors.ts`,
main-thread recolor with no RPC), hover-one-highlight-the-block across rows, and "present in
all N" filtering. MCScan `.anchors` and MAF already carry block structure to populate it; PAF
(independent lines) leaves it undefined. This is the cheap 80% and is consistent with "don't
make N-way blocks the primitive" above — it's an identity *overlay*, not a new render unit.

What the id does **not** do on its own: draw a literal ribbon that skips a row (a block present
in A and C but rearranged out of B). Grouping links the identity, and the transitive A→B→C case
is already visible through the middle row, so this only matters when you have a genuine A–C
alignment record with no B intermediary. A real non-adjacent edge then needs two more pieces:
(a) the renderer connecting same-group segments by row order rather than via a fixed adjacent
`mate`, and (b) a level/connection that can reference two non-adjacent view indices.
Encouragingly the geometry is already generic over an arbitrary view *pair* —
`buildSyntenyGeometry`/`executeSyntenyFeaturesAndPositions` take two `SyntenyViewSnap`s
(`bpPerPx0/1`, `viewOff0/1`); adjacency is purely a wiring convention (`views[level]` /
`views[level+1]` in `LinearSyntenyDisplay/afterAttach.ts` and the `connectedViews` getter). So
non-adjacent ribbons are a level-model + z-ordering change, not a geometry rewrite — but a
separate, larger step. The id is the prerequisite, not the whole feature. Start with MCScan
(already block-structured) for populating the field. See "All-vs-all PAF → any-vs-any
multi-way synteny" and "Block-level synteny data" below.

**All-vs-all PAF → any-vs-any multi-way synteny** (tracks GMOD/jbrowse-components PR
#4985 "All-vs-all PAF adapter"; planning only, no code). Goal: a single all-vs-all PAF
(e.g. `minimap2 all.fa all.fa`, PanSN-prefixed refNames from fastix/PGGB) drives an N-row
LinearSyntenyView where any pair of assemblies compares, without hand-configuring A-vs-B
and B-vs-C tracks separately. Tractable because the multi-way machinery already exists (N
views, N-1 levels, per-level displays sharing one adapterConfig, distinct `displayKey` per
display) and two facts let one all-vs-all track serve every level: RPC associates a
feature with top/bottom view purely by **refName**
(`executeSyntenyFeaturesAndPositions.ts:188` checks `v1RefNames`/`v2RefNames` membership,
not assemblyName), and `getSyntenyTracks.ts:18` returns a track for an adjacent-pair query
whenever its `assemblyNames` is a **superset** of the pair. PR #4985's stub is still
fundamentally 2-way (fixed `[query, target]` pair, mate hardcoded to
`assemblyNames[+flip]`, strips only a hardcoded haplotype prefix) — true any-vs-any needs
the mate's assembly parsed from the mate endpoint's own PanSN prefix.

The one real design decision is the refName model: PanSN names (`HG002#1#chr1`) are
globally unique, bare names (`chr1`) collide across assemblies, and since the RPC filters
on refName, the adapter's `getRefNames` defines the namespace. Resolution: make prefix
stripping a config slot (`stripAssemblyPrefix`/`prefixSeparator`, default = strip on `#`)
and add an RPC assemblyName guard unconditionally
(`feature.assemblyName === topAssembly && mate.assemblyName === bottomAssembly`) as a
no-op safety net for existing pairwise adapters — bare-refName users get correct results
with zero extra config, PanSN users flip one flag.

Phasing: **1** — `AllVsAllPAFAdapter` evolving PR #4985: full N-list `assemblyNames`
(or auto-derived from distinct PanSN prefixes during `setup()`), a `parsePanSN(name, sep)`
helper replacing the hardcoded flip logic, per-assembly `getRefNames`, and fixing
`getWeightedMeans` keying (`PAFAdapter/util.ts:68` uses raw `qname-tname`) to parsed
assembly+refName. **2** — RPC guard: derive top/bottom assembly from view snaps in
`executeSyntenyFeaturesAndPositions` and add the two-clause check (~5 lines,
backward-compatible). **3** — MVP via the existing N-row import form, picking the one
all-vs-all track per pair (already qualifies via the superset match) — no new UI. **4**
(deferred) — a specialized import form: one all-vs-all track/file → auto-detect
assemblies → order/select rows → auto-wire all levels, skipping the N-1 manual pickers.
Later optimization: thread the target assembly into `getFeatures` so the adapter
pre-filters, instead of the RPC discarding A→C rows while drawing A↔B.

Open items: confirm the PanSN separator/haplotype convention holds across real files;
decide `assemblyNames` explicit-config vs. auto-detected-from-file (auto is nicer but
unknown until `setup()`, which the import form must await). This work is also the trigger
for the `featureId`-as-Float32 16.7M-instance cap noted below — dense all-vs-all
whole-genome PAF is the likeliest path to hit it, so fold the `uint` fix in here rather
than doing it speculatively.

**PIF / tabix indexing weaknesses + improvements** (the all-vs-all adapter now
ships in two forms: in-memory `AllVsAllPAFAdapter` and tabix-indexed
`AllVsAllIndexedPAFAdapter` over a stock `make-pif` `.pif.gz`, querying the
anchor's PanSN seqid on both `q`/`t` perspectives — see
`plugins/comparative-adapters/src/AllVsAllIndexedPAFAdapter/`). PIF reuses proven
infra (`@gmod/tabix`, bgzip, HTTP range, CSI for >512 Mb) and the double-emit is
format-agnostic (all-vs-all needed zero `make-pif` changes), but has structural
limits worth recording:

- **No intra-record slicing (highest impact).** tabix returns whole lines, so a
  single collinear block spanning tens of Mb carries a multi-MB CIGAR on one
  fine-tier row; zooming into a 10 kb window *inside* it still fetches+parses the
  entire CIGAR because the row's `[start,end]` overlaps. The RPC clips oversized
  blocks (`executeSyntenyFeaturesAndPositions.ts`) but only *after* fetch+parse.
  `make-pif` already splits the **coarse** tier at large gaps
  (`splitCigarOnLargeGaps`, `pif-generator.ts`) yet leaves **fine** rows whole.
  Fix (mostly a `make-pif` + adapter change, no new format): extend gap-splitting
  to the fine tier, or store CIGAR in an offset-addressed sidecar so a windowed
  query fetches only the needed slice. This is exactly what IMPG's CIGAR-delta +
  range projection avoids.
- **Transitive closure is round-trip-bound.** A live JS `query_transitive_dfs`
  (see the PanSN+IMPG note below) over PIF is N *sequential, dependent* tabix
  range queries, each a potential HTTP round-trip into bgzip blocks — vs IMPG's
  in-memory coitree walk with no I/O per hop. Prefer **precomputing closures
  offline** with the real IMPG CLI into placement/BED tables served behind the
  same locator, rather than a live DFS, until proven otherwise.
- **2×–4× storage blowup.** Each alignment is stored twice (`q`+`t` rows), each
  with a full CIGAR, and the `q`-row CIGAR is a D↔I-swapped *copy* that won't
  dedupe under compression; the coarse tier adds more. CIGAR dominates a PAF, so
  disk/transfer roughly doubles vs IMPG storing it once. Deduping the mirrored
  CIGAR (store once, reference the sibling) is hard in a line-oriented format —
  likely only worth it if moving off plain tabix.
- **Monolithic, non-incremental.** Adding one genome re-sorts+re-indexes the
  whole file; IMPG supports per-file indices for incremental rebuilds across
  100+ files. A per-file index mode is the fix for a growing cohort.
- **Minor.** tabix binning is tuned for many small features, not a few huge
  blocks; the all-vs-all path issues 2 queries per anchor seqid (anchor can be
  either PAF side); PIF drops the in-memory adapter's cross-record weighted-mean
  identity (per-alignment `de:f:` only); the coarse↔fine LOD switch is a hard
  cliff (coarse has no CIGAR, so mismatches pop). All acceptable for ribbons, not
  a per-base view.

ROI order: fine-tier row splitting / CIGAR sidecar first (attacks the whole-row
fetch), then offline transitive precompute, then per-file incremental index. Only
evaluate a purpose-built binary alignment index (or IMPG's `1ALN`/coitree
formats) if these prove insufficient.

**Cue-style read-pair + depth matrix.** [PopicLab/cue](https://github.com/PopicLab/cue)
builds an image showing read pairs, read depth, and L/R–R/L pairs as a matrix — could
this be shown as a triangular heatmap (like `plugins/hic`) or in dotplot?

### Synteny featureId instance ceiling (documented, deferred — see BP_PRECISION.md §"Genome-size limits")

One ceiling left in the synteny GPU path, and it is not a coordinate one. It
does not affect wheat (16 Gbp) or any common genome, and is left unfixed as
YAGNI until a real dataset hits it.

There used to be a second, coordinate ceiling here — the ~68.7 Gbp cap from the
4096-aligned hi/lo Float32 corner split. **It no longer exists.** ADR-067
replaced hi/lo with a single window-relative Float32 against a fetch-time base,
which cancels the genome-scale magnitude outright, so 100+ Gbp assemblies
(*Tmesipteris oblanceolata* ~160 Gbp, *Paris japonica* ~148 Gbp, some lungfish
~130 Gbp) render correctly with no cap to widen. If you find a writeup
proposing the 2¹²→2¹⁴ bucket widening in `writeHiLo` / `HP_LOW_MASK`, it is
stale — none of those symbols survive. See `agent-docs/reference/HISTORICAL.md`.

The **per-reference uint32 cap** (4.29 Gbp per chromosome, on the local
`starts/ends/mateStarts/mateEnds` arrays) is untouched by that and is still the
one hard assumption; see `agent-docs/reference/BP_PRECISION.md` §"Genome-size limits".

**`featureId` as Float32 → 16.7M-instance cap.** `instanceInterleave.ts` writes
the per-instance `featureId` through the Float32 view, and the shader compares
it to `float` `hoveredFeatureId`/`clickedFeatureId` uniforms
(`GpuSyntenyRenderer.ts`). Past 2²⁴ features in one synteny RPC response,
adjacent indices collide in Float32 and hover/click highlights the wrong
feature (visual identity only — coords/colors stay correct; `color` already
goes through the `u32` view). This one is **genome-size-independent** and the
likeliest to surface first, via dense all-vs-all whole-genome PAF (see
"All-vs-all PAF → any-vs-any multi-way synteny" above). Fix: flip the
`featureId` attribute + both uniforms from `float` to `uint` and regen the
`.iface` (the interleave buffer already has a `u32` view). Fold into the
all-vs-all PAF work rather than doing it speculatively.

### Vendor-format leaf adapters + coloring conventions (2026-07 vendor survey)

Surveyed `~/src/vendor/{ntSynt-viz,plotsr,SVbyEye,SafFire,jupiterplot}` against the
current stack. The overriding conclusion is that **the render/model/color surface is
already comprehensive** — `SyntenyColorBy` covers `default·strand·query·target·
reference·identity·meanQueryIdentity·mappingQuality`, plus `opacityByIdentity`,
`fadeThinAlignments`, N-way stacked views, `colorBy:'reference'` chromosome-painting,
and `AllVsAllPAFAdapter`. So the remaining wins are **leaf parsers that map a popular
file onto the EXISTING SyntenyTrack render path**, never new render/color surface. Each
below reuses the renderer unchanged (the `MCScanBlocksAdapter` / `AllVsAllPAFAdapter`
template: "one file backs N-1 pairwise tracks, no renderer change").

- **ntSynt long-format blocks adapter (best leaf; local demo data ready).** ntSynt emits
  a long-format multi-genome table (`block_id · genome · chrom · start · end · strand ·
  n_minimizers · indel_flag`); one `block_id` groups one row per genome. For a pair
  `[a,b]` the adapter keeps rows whose genome is `a` or `b`, groups by `block_id`, and
  emits a feature+mate for blocks containing both — the *long-format twin* of
  `MCScanBlocksAdapter`, and simpler (no BED-join; coords are inline). `adapterHint`-only
  (`.tsv` is generic). Demo data already sits in `~/src/vendor/ntSynt-viz/tests/`
  (great-apes 6-way `great-apes.ntSynt.synteny_blocks.tsv` + per-genome `.fai`s + a
  Newick for row ordering). Popular T2T/pangenome-era tool (Birol lab). This is NOT
  "native N-way blocks as the primitive" (rejected above) — it emits pairwise features
  like every other adapter.

- **SyRI adapter (deliberately deferred — the fiddly one, not the simple one).** plotsr
  consumes SyRI output as **one file per adjacent pair** (pairwise, no join — structurally
  the *simplest* shape, thinner than the PAF adapter), so it maps cleanly onto the existing
  N-way stacked view. Two frictions: (1) SyRI files are commonly `*syri.out`, and `.out` is
  already claimed by `MashMapAdapter` in the guesser — so it must be `adapterHint`-only;
  (2) its only value over "just convert to PAF" is preserving SV type (SYN/INV/TRANS/DUP),
  and surfacing that is where cross-cutting surface lives. Cheap path if built: parse type
  into a **feature attribute** (tooltip only) and rely on existing `colorBy:'strand'` for
  inversions — inversions already read via strand, which is ~80% of plotsr's visual value
  with zero new `colorBy` arm. Only add `colorBy:'svType'` (touches ~4 exhaustive switches +
  legend + SVG + Canvas2D + dotplot) if the trans/dup distinction proves it earns the tax.
  Cross-ref "Explicit SV-type classification" above — same conclusion, now with the guesser
  collision + rubric spelled out.

- **nucmer `.coords` (show-coords tabular) leaf adapter.** SVbyEye/SafFire ingest nucmer via
  `show-coords`-style tabular output (`[S1][E1]|[S2][E2]|[LEN1][LEN2]|[%IDY]|tags`). JBrowse
  has `DeltaAdapter` (`.delta`) but not the tabular `.coords` form. Small leaf if a real user
  arrives with `.coords`; low priority (they can run `.delta` today).

- **Coloring conventions to consider (constants-only, near-zero surface).** Every vendor tool
  uses **forward=blue / inversion=orange**; our `strand` scheme is pos=red/neg=blue
  (`colorUtils.ts`). Aligning the palette is a constants-only change but a *default* change —
  verify against existing screenshots before touching. Also: SVbyEye/SafFire discretize
  identity into breaks (`c(90,95,99,99.5,…)`) where our `opacityByIdentity` is a continuous
  fade — a discrete-bin mode is a possible legend-friendlier variant, but continuous is
  arguably better and this would add a knob, so likely YAGNI.

### Synteny shader dedup (done 2026-07) + what's deliberately NOT unified

The two fill fragments (`syntenyFill{Straight,Curve}.slang`) duplicated the edge-lerp +
per-edge slope-foreshortening + `pf0/pf1` block; only `s`/`sd`/`dydt` differ. Extracted one
`fillEdges(corners, s, sd, dydt) -> FillEdges` into `syntenyTypes.slang` (straight passes
`s=t, sd=1, dydt=h`; curve passes `s=sBlend(t), sd=sBlendDeriv(t), dydt=h·yCurveDeriv(t)`),
plus a shared `edgeNormal(tangent)` for the two edge passes. This centralizes the drift-prone
slope formula (the hard-won boundary-fuzz fix in `perpCoverage`) in one place; slangc keeps
it a real function, `.iface` byte layouts unchanged, 142 plugin tests green.

**Do NOT unify further.** The *vertex* stages stay separate on purpose: straight is one quad
(6 verts), curve tessellates 8 segments × 6 with Newton-inverted `t` + bezier-bulge padding —
genuinely different geometry, and the file split is what keeps `isCurve` branches out of the
hot path (see the header comment in `syntenyTypes.slang`). Merging them would reintroduce the
branch the split exists to avoid.

### Polyploidy-aware many-to-many synteny

Whole-genome synteny between species with an ancestral WGD / paleopolyploidy (grape's
paleohexaploidy is the resident demo — `grape_peach_synteny`) is intrinsically 1:many: each
peach region maps to ~3 grape blocks, so ribbons cross no matter how you reorder, and
single-axis `diagonalizeRegions` cannot flatten it. Reviewers repeatedly read the crossings
as a diagonalization *failure*; they're real biology. A concrete demo now exists — the
`grape_triplication` dotplot (in the `multiway_synteny` tutorial) isolates peach Pp01 →
grape chr5/chr1/chr18 (the three gamma-triplication paralogs) so the 1:3 fan reads cleanly.
Idea (still open): detect the fan (a query region
with M target hits above a length/identity floor) and make the multi-mapping read as signal,
not noise — e.g. a shared hue per source-block family, an explicit "paralog fan" affordance,
or a summary "×3" annotation on the region. Complements the barycenter/layer-sweep note above
(which cuts *transitive* crossings but can't remove genuine many-to-many ones), and would let
a caption/legend say "crossings here are the grape triplication" instead of looking broken.

### Block-level synteny data: importing / generating from external tools

Status: **partially implemented.** A coarse LOD *tier* (Route B's tiering
architecture) now ships; true cross-row block **chaining** (Route B's algorithm)
does not. Read "Implemented so far" before extending.

#### Implemented so far

- **Coarse LOD tier in `make-pif`** (`products/jbrowse-cli/src/commands/make-pif/`).
  `make-pif` emits the uppercase `T`/`Q` coarse tier **by default** (`--no-coarse`
  to opt out, `--coarse <bp>` to tune the split gap). A coarse row strips the
  CIGAR and, wherever a single fine row has an insertion/deletion `>=` the split
  gap (`DEFAULT_COARSE_SPLIT_GAP = 10kb`), splits that row into pieces so each
  coarse bbox stays tight (`splitCigarOnLargeGaps` in `cigar-utils.ts`).
- **`lodMode` (`auto | fine | coarse`)** plumbed model → RFC → RPC → adapter
  (`BaseOptions.lodMode`; `LinearSyntenyView`/`DotplotView` models; consumed in
  `PairwiseIndexedPAFAdapter.pickPifPrefix`). `auto` switches to coarse at
  `bpPerPx >= coarseBpPerPxThreshold` when a coarse tier exists; a manual
  `coarse` override falls back to fine when no coarse tier is present.
- **Coarse-row identity** reuses the `de:f:` convention. minimap2's `de:f:` is
  *gap-compressed* divergence (indel runs counted once), so the row's own tag —
  when present — is written verbatim onto every coarse piece of that row,
  including split pieces. This keeps split and un-split rows coloring identically
  and continuous with the fine tier across the LOD switch. Only a row carrying
  no tag falls back to a computed value, and that fallback is itself
  gap-compressed (`gapCompressedDivergence` in `cigar-utils.ts`), never the
  per-base `1 - numMatches/blockLen` proxy, which roughly doubles divergence by
  counting every indel base.

**Important:** this is a per-row *strip + split* pass, the opposite of the
block *merge* below. It coarsens each alignment individually; it does **not**
collapse runs of separate collinear alignments into blocks. The hairball's
structural cause (many separate small alignments) is untouched — only per-ribbon
CIGAR detail is dropped at overview. Route B's chaining is still the open work.

#### The problem this addresses

Whole-genome synteny overviews render as a *hairball*: thousands of raw
minimap2 local alignments, each drawn as a ribbon, crisscrossing. We've
attenuated the **visual** symptom in the renderer (per-ribbon width-proportional
fade in the GPU fill shader + Canvas2D; sub-pixel decision keyed on
*perpendicular* width so steep diagonals stroke a clean 1px centerline), but the
structural cause is the *input*: we draw raw alignments, while the tools that
produce elegant plots (plotsr, ntSynt-viz, circos) draw **detected synteny
blocks** — a handful of large, classified regions collapsed by an upstream
analysis step before those tools ever drew a pixel. The renderer fade softens
the hairball for free but cannot truly declutter an all-to-all tangle of many
*separate* small alignments; that needs blocks. The two compose.

#### Tool landscape (get this right before picking a route)

| Tool | What it is | Input | Cross-species? | Notes |
| --- | --- | --- | --- | --- |
| **plotsr** | plotter only | SyRI output | no | block detection is SyRI's, not plotsr's |
| **SyRI** | block + rearrangement caller | whole-genome aln (minimap2/MUMmer SAM/BAM/PAF/delta) | **no** — same-species/strain | assumes near-complete, chromosome-level, ~1:1 collinear alignment; finds longest syntenic path then classifies residue. Degrades on fragmented/divergent/many-to-many. |
| **ntSynt** | multi-genome synteny blocks | **FASTA genomes** (minimizer graphs, ntHash/ntJoin lineage) | **yes** — designed for it | robust to divergence + rearrangement. Does **not** consume a PAF — it replaces minimap2. Snakemake/C++/Python pipeline. Output = block TSV. ntSynt-viz draws ribbons from it. |
| **MCScan / MCScanX / DAGchainer** | gene-anchor collinearity | anchor pairs (homology/BLAST) | yes (anchor-based) | we already have an MCScan adapter (block-level). Plant/WGD heritage. |
| **(generic) PAF collinear chaining** | chain/merge alignments into blocks | minimap2 PAF | yes | the stage every tool above runs internally; implementable directly. |

Key correction to the intuition that "we could import from SyRI/plotsr": **SyRI
is same-species** — don't anchor cross-species work on it. **ntSynt is the
cross-species reference**, but its input is FASTA, not PAF, so it's a *replace
minimap2* path, not an *import-our-PAF* path.

#### Three routes to block-level pif

- **Route A — adopt a tool's block output (preprocessing).** Run ntSynt
  (cross-species) or MCScan as an external step; write a small block-import
  adapter reading its block TSV → pif. Highest-quality blocks, no algorithm to
  maintain; but external pipeline (not in-browser), ntSynt is a heavy
  Snakemake/C++/Python dependency, another format to parse.
- **Route B — own PAF collinear chaining (recommended first step).** The
  operation we literally want — "collapse a minimap2 PAF into block-level pif" —
  is collinear chaining, the internal stage of every tool above: sort by target;
  chain alignments whose query/target coords advance monotonically on a
  consistent strand within gap tolerances; emit one block per chain; break on
  strand flip / large gap / target jump. DAGchainer-style DP or greedy
  diagonal-merge. Organism-agnostic, **no new dependency**, consumes the PAF we
  already produce, slots in as `make-pif --blocks` (or `--merge`). We own the
  algorithm; pure-PAF chaining won't match ntSynt on the hardest divergent cases
  (acceptable — use Route A there).
- **Route C — reimplement ntSynt's minimizer-graph algorithm. Don't.**
  Substantial, and re-derives a maintained tool. Shell out (Route A) if that
  specific quality is needed.

#### Architecture: blocks are a zoom *tier*, not a replacement

Block data should **not** replace raw alignments — it's a coarser LOD tier:
whole-genome / coarse `coarseBpPerPx` serves **block** pif; zoomed in serves
**raw** minimap2 pif (full CIGAR detail). This is our existing multi-tier format
pattern, and the legitimate home for the adapter-level `lodMode` already plumbed
RFC→RPC. `lodMode` selects the tier; it is **distinct** from the renderer fade
(deliberately kept `lodMode`-independent). Blocks kill the structural hairball at
overview; perpendicular fade keeps whatever raw alignments still render at
intermediate zooms honest.

#### Recommendation & open questions

Route B first — a `make-pif --blocks` collinear-chaining pass emitting a
block-level pif tier (no dependency, uses current data, fits `lodMode` tiering;
A/B against raw alignments on grape/peach and hs1/mm39). ntSynt as the quality
reference (and a Route-A importer later) for hard cross-species cases. Skip
SyRI/plotsr for cross-species (a SyRI importer could still be a nice
same-species/strain feature — separate, narrower). Open: chaining parameters
(max gap, diagonal tolerance, min block length) exposed vs pixel/data-derived;
where chaining runs (`make-pif` CLI precompute vs live worker pass — CLI matches
the multi-tier-on-disk model); block-pif schema (reuse `de:f:` identity? carry a
member count / syntenic-vs-inverted classification for coloring?); classify
rearrangements like SyRI or emit collinear blocks + strand only; and multi-genome
(>2) blocks (ntSynt's strength) vs today's pairwise pif container.
