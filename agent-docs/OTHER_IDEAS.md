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

**Height resize**  
Double-click resize handle, drag to resize, prevent shrinking, auto-shrink
toggle.

**Global scrollZoom**  
Per-view → global setting.

**Isoform expansion**  
Click collapsed isoform to expand all for that gene.

**Init/loading feedback**  
Distinguish initialized vs. loading state in LinearGenomeView.

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
