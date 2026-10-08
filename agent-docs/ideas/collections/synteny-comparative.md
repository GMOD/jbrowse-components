---
name: synteny-comparative
description: `syntenyGroupId`, PIF limits, the `featureId` instance ceiling, polyploidy-aware many-to-many synteny, the 2026-07 vendor-format survey, and why Canvas2D's one-number sub-pixel fade is only worth closing for the SVG export.
---

# Synteny / comparative

**Linked dotplot + linear synteny.** Selections/zoom propagate between both views.

**Swap axes in a live dotplot.** The import form swaps before launch and the
linear synteny view has Reverse row order, but an open dotplot cannot trade its
axes.

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

[ADR-034](../../architecture-decision-records/adr-034-dotplot-diagonalize-stays-single-axis.md)
rejected both-axis seriation; this stays single-axis and changes only how one axis is
ordered. Why deferred, not done: it **changes documented tie-breaking semantics**, not just adds.
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

One measured data point, the six-genome linkage-group stack (2026-10-03, a Python
re-layout counting ribbon crossings, plus a blind visual ranking): with the
significance-filtered tables, every ordering variant tried landed within ~10% of
main's 1.01M crossings — free-anchor sweeps 0.77M, orienting each chromosome by
covariance with *all* partners' displayed positions 0.90M. The blind ranking
preferred main's ordering by half a point. The filter itself took 2.88M to 1.01M.
Gating reversal on within-best-pair rank correlation was worse: it misses fused
chromosomes, whose arms go to different partners. The same run found
[ready/diagonalize-ignores-a-reversed-reference](../ready/diagonalize-ignores-a-reversed-reference.md).

**CIGAR draw toggles via gpuProps.** Shader uniform bit flags to gate
`drawCIGAR`/`drawCIGARMatchesOnly`; worker always emits full geometry, flags control
visibility. Only worth it if users toggle frequently.

**A location-marker tick can't be read, only seen.** A tick states "this query
coordinate maps to that target coordinate" and there is no way to get the two numbers:
markers are excluded from the pick index by construction — both their edges are single
points, so the `max(|sx2-sx1|, |sx4-sx3|) >= 1` filter that makes `buildPickIndex` cheap
drops them (`reference/SYNTENY_LOD.md`). A tooltip would need proximity-to-a-line
picking, i.e. a second index shape, for a job that is partly done already: the scalebar
labels the query end, and an exact correspondence takes the
`SyntenyResolveMatchingRegion` round trip. Worth it only if reading shear off the ticks
turns out to be something people try to do and can't.

**Phylogeny-aware row ordering** (an NJ tree from synteny distance, as
ntSynt-viz does) for views of more than three genomes: `diagonalize.ts` orders
chromosomes within a row by density but never orders rows by relatedness. The
multiway display's lane half of this is
[ordering-synteny-lanes-by-similarity](../waiting-on-a-call/ordering-synteny-lanes-by-similarity.md).

**Don't chase native N-way blocks as the primitive** — the pairwise N−1 model is
the right call for a browser (independently fetchable/zoomable, degrades gracefully
when one alignment is missing).

**`syntenyGroupId` for cross-row block identity (not N-way geometry).** Synteny features are
strictly pairwise today: one `mate` (`{start,end,refName,assemblyName}`) per feature, and no
shared block/anchor id anywhere in `comparative-adapters` or `synteny-core` (PAFAdapter's
`uniqueId` is just the row index). Add an optional adapter-provided `syntenyGroupId`
(block/anchor id) *alongside* `mate` — not replacing it — and you get the real multi-way value
without touching the pairwise geometry the linear layout needs anyway: consistent color per
block across every row it touches (`color: { field: 'group' }`, hash the id in `syntenyColors.ts`,
main-thread recolor with no RPC), hover-one-highlight-the-block across rows, and "present in
all N" filtering. MultiWaySyntenyDisplay, which groups on gene name with `syntenyId` as the
nameless fallback, would be its third consumer. MCScan `.anchors` and MAF already carry block structure to populate it; PAF
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
(already block-structured) for populating the field. See [block-level-synteny-from-external-tools](../ready/block-level-synteny-from-external-tools.md).


**PIF / tabix indexing weaknesses + improvements** (the all-vs-all adapter now
ships in two forms: in-memory `MultiGenomePAFAdapter` and tabix-indexed
`MultiGenomeIndexedPAFAdapter` over a stock `make-pif` `.pif.gz`, querying the
anchor's PanSN seqid on both `q`/`t` perspectives — see
`plugins/comparative-adapters/src/MultiGenomeIndexedPAFAdapter/`). PIF reuses proven
infra (`@gmod/tabix`, bgzip, HTTP range, CSI for >512 Mb) and the double-emit is
format-agnostic (all-vs-all needed zero `make-pif` changes), but has structural
limits worth recording:

- **No intra-record slicing (highest impact).** tabix returns whole lines, so a
  single collinear block spanning tens of Mb carries a multi-MB CIGAR on one
  fine-tier row; zooming into a 10 kb window *inside* it still fetches+parses the
  entire CIGAR because the row's `[start,end]` overlaps. The RPC clips oversized
  blocks (`executeSyntenyFeaturesAndPositions.ts`) but only *after* fetch+parse.
  `make-pif` already folds the **coarse** tier's CIGAR to a few ops
  (`coarsenCigar`, the `cr:Z:` tag) yet leaves **fine** rows whole. Fix (mostly a
  `make-pif` + adapter change, no new format): split fine rows at large gaps, or
  store CIGAR in an offset-addressed sidecar so a windowed query fetches only the
  needed slice. This is exactly what IMPG's CIGAR-delta +
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
stale — none of those symbols survive.

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
likeliest to surface first, via dense all-vs-all whole-genome PAF. Fix: flip the
`featureId` attribute + both uniforms from `float` to `uint` and regen the
`.iface` (the interleave buffer already has a `u32` view). Do it when a real
all-vs-all file reaches the cap rather than speculatively.

### Vendor-format leaf adapters + coloring conventions (2026-07 vendor survey)

Surveyed `~/src/vendor/{ntSynt-viz,plotsr,SVbyEye,SafFire,jupiterplot}` against the
current stack. The overriding conclusion is that **the render/model/color surface is
already comprehensive** — the `color` object (ADR-139) covers `default·strand·query·target·
reference·identity·mappingQuality·dnds`, plus `opacityByIdentity`,
`fadeThinAlignments`, N-way stacked views, `color: { field: 'reference' }` chromosome-painting,
and `MultiGenomePAFAdapter`. So the remaining wins are **leaf parsers that map a popular
file onto the EXISTING SyntenyTrack render path**, never new render/color surface. Each
below reuses the renderer unchanged (the `MCScanBlocksAdapter` / `MultiGenomePAFAdapter`
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

### Polyploidy-aware many-to-many synteny

Whole-genome synteny between species with an ancestral WGD / paleopolyploidy (grape's
paleohexaploidy is the resident demo — `grape_peach_synteny`) is intrinsically 1:many: each
peach region maps to ~3 grape blocks, so ribbons cross no matter how you reorder, and
single-axis `diagonalizeRegions` cannot flatten it. Reviewers repeatedly read the crossings
as a diagonalization *failure*; they're real biology. Idea (still open): detect the fan (a query region
with M target hits above a length/identity floor) and make the multi-mapping read as signal,
not noise — e.g. a shared hue per source-block family, an explicit "paralog fan" affordance,
or a summary "×3" annotation on the region. Complements the barycenter/layer-sweep note above
(which cuts *transitive* crossings but can't remove genuine many-to-many ones), and would let
a caption/legend say "crossings here are the grape triplication" instead of looking broken.

### Canvas2D fades a curved sub-pixel ribbon by one number

Moved out of [TODO.md](../../TODO.md) on 2026-08-22. Most of what that entry was
opened on turned out to be a different bug, which is now fixed; what is left is
0.31pp of drift behind a trade the entry itself argues against taking.

A sub-pixel ribbon is drawn as a ~1px band whose alpha carries how much of a
pixel it really covers. The GPU measures that width per fragment from the local
perpendicular; Canvas2D measures it once per ribbon off the centerline chord
(`ribbonPerpWidth`). Identical in straight mode. On a bezier the tangent is
vertical at both ends and twice the chord slope at the middle, so a rearranged
block is at its *widest* perpendicular exactly where it meets the frame — and one
number per ribbon cannot say that. The GPU is the accurate side.

**Scoped to the ALPHA, since `ribbonMaxPerpWidth` split off.** The same one
number used to decide fill-vs-centerline-stroke, and through that pickability,
which put a curved ribbon several px wide at both ends on the stroke branch as a
1px hairline that could not be clicked. That is fixed: the branch asks the widest
the ribbon ever gets, which on a bezier is an end and is foreshortened by
nothing. What remains here is the fade applied once the branch has settled on a
stroke — ribbons genuinely under a pixel everywhere.

Re-measured with `probe-synteny-backend-drift.ts`, one build either side of that
one line, everything else held:

| hs1/mm39 | curved | straight |
| --- | --- | --- |
| diagonalized, before | 1.59% | 0.58% |
| diagonalized, after | **0.57%** | 0.58% |
| not diagonalized, after | **0.78%** | 0.47% |
| grape/peach, after | 0.01% | 0.01% |

So the curve-mode excess was about 1.0pp of branch error and about 0.3pp of
fade, not 1.0pp of fade — the numbers this was opened on (1.54% / 0.53%, and
1.72% / 0.44% steeper) were reading both at once. What is left is the 0.31pp gap
in the steepest arm; the diagonalized view no longer distinguishes the two modes
at all.

**Why it is parked.** Closing it means replacing one `ctx.stroke()` of the
centerline with N segments at N alphas, in `drawSyntenyTrack`'s per-instance
loop — the loop `StyleCache` exists for, because `rgba()` string construction
alone cost >100ms at 500k instances. Paying N× the stroke calls there to sharpen
the *fallback* backend is the wrong trade.

**The one case that would justify it is the SVG export**, which goes through the
same `strokeCenterline` — a figure is looked at closely in a way a fallback
render is not, and after culling a figure has few visible ribbons, so N is small
there. So if this is ever picked up: **decide it on the SVG export, not the
canvas**, and let the interactive loop keep its single stroke.
