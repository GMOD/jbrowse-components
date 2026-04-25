# Ideas and Future Directions

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

---

## Data Formats

**Multi-feature files**
Multiple types per row (e.g., chromatin BED with repeat types).

**Zarr VCF**
Variant rendering from Zarr (more efficient than tabix for large cohorts).

**Rolling average**
Smoothing option for wiggle/coverage (compute rolling mean, render as line).

---

## Graph view

- Self-loops render too large
- Allows too far zoom out
- Header buttons/options should match other view headers visually
- Test on large GFA files



**Sequence search / BLAST**
Search graph by sequence (similar to Bandage's BLAST integration).

**Interactive force-directed layout**
Apply d3-force or similar physics layout to the graph view.

**Customizable layout**
Let users choose layout algorithm (e.g. d3-force) at runtime.

**Interactive mouseover connection between LinearGenomeView and graph**
Highlight corresponding positions in both views on hover.

---

## UI/UX

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


**Alignments menu reorganization** Collapse rarely-used options (max height,
toggles) into submenu.

**Breakpoint connectors** Smooth out awkward blue/green curves (currently
arbitrary Y increase/loop).


**Migrate to pnpm 11** (when released) Remove `"pnpm"` from `package.json`,
update `pnpm-workspace.yaml`, replace `pnpm install --frozen-lockfile` with
`pnpm ci` in CI, bump `pnpm/action-setup` version to 11.



**Compute shaders to Slang.** `plugins/variants/src/VariantRPC/{ldComputeShader,
ldPhasedComputeShader}.ts` are hand-written WGSL (WebGPU-only). Migrate to
Slang with `//! targets: wgsl`. Not urgent — they work.



## Backlog / stretch

- SVPlaudit-style game but with JBrowse
- Static renderings via `jbrowse-img`; command-line tool for batch variant rendering

## SyRI coloring

- Assess whether interspecies alignments work with syri assumptions
- Investigate how popular papers in nature, science, etc make pangenome and synteny diagrams



## SyRi adapter


**SyRI adapter (browser).** Add a `SyriOutAdapter` that reads raw `syri.out`
files directly in the browser (or a bgzipped + tabix-indexed version). The
CLI already has `make-pif/parsers/syri-parser.ts` with the correct column
mapping (`refChr refStart refEnd - - qryChr qryStart qryEnd ID parent type`).
A browser adapter would emit `syriType` directly from column 10, bypassing the
`computeSyriTypes` inference entirely and giving exact classifications including
`INVTR` (inverted translocation) which the inference currently maps to TRANS.
Acceptance: load `test/data/synteny-demo/plotsr/syri.out` and confirm SYN /
INV / TRANS / DUP / INVTR / INVDP are all colored correctly.

**SyRI `computeSyriTypes` cross-validation.** Add a test that parses a real
`syri.out` file, extracts the SYNAL/INVAL/TRANSAL/DUPAL alignment rows, feeds
them into `computeSyriTypes` as PAF-like records, and checks that the inferred
types match the types declared in the file. Surfaces any remaining inference
divergence.

**SyRI `INVTR` / `INVDP` types.** `computeSyriTypes` and `SyriType` currently
do not model inverted translocation (`INVTR`) or inverted duplication (`INVDP`).
These are real SyRI output types (plotsr folds `INVTR` → `TRANS` and `INVDP` →
`DUP`). Consider adding them as first-class types with distinct colors, or
explicitly document the fold in the code.
