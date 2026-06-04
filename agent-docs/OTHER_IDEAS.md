# Ideas and Future Directions

## ConfigurationLayer (fanciful — moved from configuration/README.md)

Hypothetical construct that acts as a "layer over" another configuration schema.
Same slots, same types, but every slot's default value is whatever the parent
schema's current value happens to be. Use case: cascading config for subtracks
where a child overrides a handful of slots and inherits the rest dynamically.
Never built; current `baseConfiguration` extension covers most of the practical
need (inherits the *schema*, not the live values).

## Specification Layer

**Declarative JBrowse Spec** (exploratory)
Current config is internal MST serialization. Extend `session-spec` to simpler
data → encoding → mark grammar (Vega-Lite style). Infer adapter/display types,
map encoding → colorBy/filterBy, fall back to raw config for advanced features.
Benefit: end users write clean schemas; plugin authors keep MST power. Also:
`readConfObject`/`getConf` are hot-path MST traversals—caching would help.

**R/ggplot2 Export** (exploratory, branch exists)
Export session as R script using ggplot2/Bioconductor for publication figures
and reproducibility. Maps alignments→geom_rect, coverage→geom_area,
variants→geom_point, synteny→geom_segment with Gviz/ggbio where applicable.

**Jupyter/Quarto Integration**
Embed JBrowse in notebooks via simple API (`jbrowse.view()`). Spec layer would
simplify wiring; currently `@jbrowse/react-linear-genome-view` exists but config
is too complex.

---

## Alignments

**Curved read links**
Reuse breakpoint logic for "Link with curved lines" mode (better orientation
encoding than straight connectors).

**Long-range inter-region arcs**
UI toggle to draw arcs between distant regions. Missing in 1kg demo — may be a
bug or an unimplemented feature; needs reproduction.

**Auto-scale noise**
Compute per-track noise estimate (mean insertion rate); auto-scale
`featureFrequencyThreshold` (noisy → strict, clean → lenient).

**Quality-aware feature fade**
Toggle to disable sub-pixel fade for high-quality reads (Illumina/HiFi): most
mismatches are real variants, not sequencing errors.

**Legend**
Visual guide: strand colors, paired/unpaired styles, SNP colors.

---

## Synteny / Comparative

**Linked dotplot + linear synteny**
Selections/zoom propagate between both views.

**Swap axes** (dotplot & linear synteny)
Flip comparison perspective or reverse query/reference.

**Better defaults for human vs mouse**
Tune color schemes and default display options for common interspecies comparisons.

**CIGAR draw toggles via gpuProps**
Add shader uniform bit flags to gate `drawCIGAR` / `drawCIGARMatchesOnly` / `drawLocationMarkers`; worker always emits full geometry, flags control visibility. Only worth it if users toggle these frequently.

**Dotplot short-segment rendering (point sprites)**
Short alignments (sub-pixel `len < lineWidth`) currently render as thin
slivers because the degenerate fallback expands the quad only vertically.
A square-cap displacement along the tangent was tried and reverted (odd
polygons on normal segments). Better options: (a) emit `gl_PointSize`
sprites for sub-threshold segments in a separate draw call;
(b) round caps via SDF in the fragment shader, passing along-tangent
distance as a varying and discarding outside `lineWidth/2` at each end.

---

## Data Formats

**Multi-feature files**
Multiple types per row (e.g., chromatin BED with repeat types).

**Zarr VCF**
Variant rendering from Zarr (more efficient than tabix for large cohorts).

**Rolling average**
Smoothing option for wiggle/coverage (compute rolling mean, render as line).

---

## UI/UX

**CSS Custom Highlight API for search text.**
`HighlightText` in `FacetedSelector` (and similar components in jbrowse-desktop)
manually split strings and wrap matches in `<mark>` tags. The
[CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/Highlight)
highlights `Range` objects without touching the DOM — no extra elements, no
re-render on query change. jbrowse-desktop already uses this pattern. Main
complication in the faceted selector: virtual rows mount/unmount on scroll, so
highlight ranges must be re-registered in a scroll-aware effect.
Firefox ≥117, Chrome ≥105, Safari ≥17.2.

**Height resize**
Double-click resize handle, drag to resize, prevent shrinking, auto-shrink
toggle.

**Canvas offscreen buffer**
Add margin rendering to avoid feature re-juggling on small pans/zooms (like
`plugins/sequence`).

**Super-compact mode for dense canvas layouts**
A mode that packs features even tighter for very dense gene annotations.

**Side labels for genes**
Display gene name labels in the left/right margin instead of inline.

**Global scrollZoom**
Per-view → global setting.

**Isoform expansion**
Click collapsed isoform to expand all for that gene.

**Init/loading feedback**
Distinguish initialized vs. loading state in LinearGenomeView.

---

## Hi-C

**User-adjustable color threshold**
Add a draggable slider on the HiC color legend (like Juicebox's color scale
widget) so users can set the saturation threshold manually. The 95th-percentile
auto-scale is a good default but some datasets benefit from manual tuning.
Store as a `colorThresholdMultiplier` override in the display model.

**Normalization availability check**
Before calling hic-straw with a normalization (e.g. KR), check whether a
normalization vector exists for the current resolution/chromosome. If not,
warn the user and fall back to NONE — mirroring Juicebox's behavior in
`contactMatrixView.js:checkColorScale`. hic-straw doesn't expose
`hasNormalizationVector` directly; could detect by catching empty results
or by inspecting the masterIndex keys.

**A/B compartment ratio mode**
Juicebox supports A÷B log-ratio display (diverging red/blue color scale) when
a control/background map is loaded. Would require a second `hicLocation` in the
adapter config and `RatioColorScale` logic (log-scale positive=red,
negative=blue).

**Inter-chromosomal UI**
`getHeader` already computes `hasInterChromosomalData` from the masterIndex but
it is never surfaced. When true, show a chromosome-pair selector (chr1 × chr2)
so users can navigate to specific inter-chromosomal contact blocks without
needing to set up a multi-region view manually.

---

## Known Issues

| Issue                             | Status               |
| --------------------------------- | -------------------- |
| Hot reload breaks canvas features | Investigate          |
| Dockview right-side move          | Non-WebGL bug        |
| Frozen objects (umd_plugin.js)    | Handle read-only     |
| Zoom to full (synteny)            | Verify               |
| Indel colorize toggle             | Verify               |
| Synteny diagonalization (grape)   | Verify (works yeast) |



## Config & Sessions

**Global config overrides** Admin-level defaults (e.g., show paired arcs by
default) across all tracks.

**Hash password in share links** Password only needed at startup (read then
deleted). Store in URL hash, clear on first navigation.

**LGVSyntenyDisplay "Query name" coloring** Re-implement removed
color-by-query-name (hash to color).



**Breakpoint connectors** Smooth out awkward blue/green curves (currently
arbitrary Y increase/loop).

**BSV overlay: fix model-derived track Y positions.** `getTrackYOffset` in
the LGV model computes track tops by summing `headerHeight + scalebarHeight +
Σ(track.height + RESIZE_HANDLE_HEIGHT)`, but this diverges from the actual
CSS layout for some reason (likely a gap, border, or constant mismatch). The
current workaround is a `getBoundingClientRect` rAF loop in
`useDomTrackYOffsets` (~60fps re-renders). Finding the discrepancy —
`console.log(view.getTrackYOffset(id), trackRef.getBoundingClientRect().top -
svgRef.getBoundingClientRect().top)` on a loaded view — would let us delete
all the DOM measurement code and rely on MobX reactivity alone.



**Migrate not just regular shaders, but compute shaders to Slang also.** `plugins/variants/src/VariantRPC/{ldComputeShader,
ldPhasedComputeShader}.ts` are hand-written WGSL (WebGPU-only). Migrate to
Slang with `//! targets: wgsl`. Not urgent — they work.





## Methylation plotting

- Modifications track: methylation line/matrix view (see
  [#5510](https://github.com/GMOD/jbrowse-components/issues/5510)).
  The key value of methylartist locus is distinguishing haplotypes — per-HP
  aggregate lines reveal allele-specific methylation (ASM). Options ranked by
  ROI:

  **Option A — HP-stratified aggregate lines (recommended starting point).**
  One line per haplotype in the coverage area. At each CpG, y = methylation
  proportion among reads with that HP tag (HP:i:1, HP:i:2, unphased). Two
  lines when HP tags present, one when absent. Implementation:
  - Add `haplotype: number | undefined` to `ModificationEntry`; read HP tag
    in `extractModifications` in `processFeatureAlignments.ts`
  - Extend `computeModificationCoverage` to stratify by haplotype; output
    per-haplotype position/height/color arrays
  - Add `drawModCovLine` to `rendererUtils.ts` (Canvas2D) + a new
    `PASS_MOD_COV_LINE` GPU pass (can reuse modCoverage vertex geometry,
    rendered as a strip not quads)
  - Show unphased as a third dim/dashed line or omit when both HP lines present
  - Future option: kernel-smoothed lines (aggregate over a bandwidth of nearby
    CpGs rather than exact per-site values)

  **Option B — Simple aggregate line, no haplotype (lower effort, less
  useful).** Single line per mod type, no HP stratification. Good fallback for
  non-phased data or bisulfite-seq. The worker already produces
  `modCovPositions`/`modCovHeights`; only a `drawModCovLine` renderer and GPU
  shader are needed. Can be done first as a fallback (shown when no HP tags
  detected), then upgraded to Option A. Estimated ~2h.

  **Option C — Per-read matrix with haplotype sort.** The top panel of
  methylartist: rows = reads, columns = CpG sites, color = per-read methylation
  probability, reads sorted HP1-above-HP2 then by methylation fingerprint. This
  is essentially the existing per-read modification squares plus a new sort
  mode. May already be achievable today by combining `colorBy: modifications` +
  `sortBy: HP tag` — worth verifying before building anything. If the UX is
  already sufficient, Option C needs only documentation.

  **Recommended sequence:** B first (~2h), then A (~1d). C last or never.


## Changing 'show/hide labels' results in rpc refetch


**Canvas label relayout without refetch (blocked).** `showLabels` /
`showDescriptions` flow through `rpcProps()` so changing them refetches, but
worker output doesn't depend on label placement (main thread re-derives
via cached `rpcDataMap` view). Blocked by `ConfigOverrideMixin` reactivity
below — destructuring label fields out of `rpcProps()` doesn't help because
mobx subscribes to the whole frozen object. *Partial mitigation via ADR-006:* refetch still fires spuriously, but
`rawRpcDataMap` is no longer cleared during it, so labels don't visually
disappear.


## Check LDzip https://github.com/23andMe/LDZip


- **Alignments typed-array refactor.** Worker return shape is flat parallel arrays. Refactor into sub-objects by group: mods, sashimi, coverage (just an idea....the flat array is simple but just long).

## Synteny view

- Connect to gene glyps for mcscan type results?
- add 'synteny rects' in the area to show for example where there is non-ribbon based synteny e.g. non-displayed-region translocations?


 In https://github.com/PopicLab/cue there is a workflow which creates a image showing read pairs
  and read depth  and rl/lr read pairs using a matrix, I am curious if this type of data could be
  shown in our application either as a triangular heatmap similar to plugins/hic or even in dotplot


## sort by modifiactions
## sort by modifiaction

sophisticated abort system

- search advanced panel
- might need pagefind inverted index

## alignments

 In plugins/alignments we have a system that renders reads with different 'color by' options. but this often does not affect the coverage bar. however, i have had a 'vision' for awhile that actually summarizing the color by of the reads could make interesting coverage visualizations. for example, summarizing per-base quality in coverage, or per-base haplotype tag proportion, or per-base read discordancy, or other things like this. do you think this is worth doing? you can cross reference tools like https://github.com/brentp/bigly/ which also show read discordance measures alongside coverage

This is a great design question. Let me look at how coverage and color-by currently work in the codebase so my opinion is grounded in what you actually have, rather than hand-waving.

  Listed 1 directory, ran 2 shell commands

Interesting — there's already snpCoverage and modCoverage. Let me look at how those work, since they're precedents for exactly the kind of thing you're describing.

  Searched for 2 patterns, read 1 file, ran 2 shell commands

The architecture already has snpCoverage (SNP proportions per base) and modCoverage (modification proportions per base). So you've already proven the core pattern. Let me see how these get wired to the color-by setting and the coverage region build.

  Searched for 1 pattern, read 2 files, ran 1 shell command

Yes — I think this is worth doing, and the strongest evidence is that you've already built two-thirds of the machinery for it. Let me lay out why, and where I'd push back.

You already have the pattern

The coverage track isn't a flat depth bar — it's already a decomposition engine:

- snpCoverage — partitions each column's depth by base (the classic colored coverage)
- modCoverage — partitions by modification/methylation proportion (computeModificationCoverage)
- interbaseCoverage — insertions/clips as indicators

runCoveragePipeline.ts is literally a list of "compute layer → pack → draw" steps, and modCoverage gives you a complete template: compute.ts + packGpu.ts + drawCanvas.ts + a .slang shader. So your "vision" isn't a new subsystem — it's new decomposition modes on an existing scaffold. That dramatically changes the cost/benefit: the expensive part (worker plumbing, GPU packing, stacked-segment draw) is solved.

And the input data is mostly already extracted in the worker for the color-by features that exist: MAPQ, pair orientation/discordancy (pair-orientation color-by), tags (color-by-tag), per-base quality (features/perBaseQuality).  already fetch.

Where I'd be selective (not every c summary)
                                                                                                Ranked by scientific value, since dl of these:
                                                                                                - MAPQ decomposition / MAPQ0 fractiest-value one. A column that's 60%MAPQ0 instantly flags repetitive/CNV/segdup regions. This is exactly bigly's spirit.            - Discordancy (improper pairs, splibigly's core feature. Stratifyingdepth into concordant vs. discordant surfaces SV breakpoints far better than per-read coloring, where the signal is diluted across
- Haplotype (HP tag) proportion — genuinely novel and high-value. Allelic balance at a glance,  loss-of-heterozygosity, allele-spec this well.
                                                                                                The design fork worth getting right
                                                                                                There are two distinct idioms and y
                                                                                                - Stacked partition (like snp/modCoso you partition the bar. Works forHP tag, MAPQ bucket, strand, concordant/discordant. ✔                                           - Continuous signal overlay: mean b, fraction-clipped. These aren'tpartitions of depth — they're a line/heatstrip riding on top. Forcing "per-base quality" into a stacked bar produces a misleading v
                                                                                                So I'd resist the temptation to maker-base quality and insert-size arebetter as a thin signal lane (mean ± a band), not depth decomposition.
On the "color-by drives coverage" coupling
It's an elegant, discoverable principle — whatever you color reads by, coverage summarizes the saxis. But I'd decouple the storage  that defaults to follow color-bywhere a mapping exists) rather than hard-binding them, because several color-by modes (insert-sigradient, per-base lettering) have analog. Auto-follow when it maps,fall back to plain depth otherwise.
Caveats that could make it not worth it
- Mode sprawl / maintenance: each mode is a compute+pack+draw+shader quadruple (modCoverage alrecarries a hand-written .slang). Thrative ones.
- Interpretation burden: coverage that means different things per mode can confuse. Needs a clealegend/axis label that changes with
- Per ADR-016 it belongs in the worker — mode changes infrequently and the per-base pass is     cheap/linear, so this is rpcProps, rf concern.
                                                                                                Bottom line: worth doing, and cheapoverage already proved the path. I'd start with one mode — MAPQ/discordancy decomposition — as the proof point (highest value, data  already in the worker, directly comnuous metrics as a separatesignal-lane idiom, and make coverage-summary-mode a setting that defaults to following color-by rather than being welded to it.

Want me to sketch the concrete plumon mode against the currentpipeline, or prototype it?
