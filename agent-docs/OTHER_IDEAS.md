### Alignments — Curved Lines for Linked Reads

The "Link supplementary alignments" mode draws a single straight line between
reads. The breakpoint split view already has logic to draw curved lines that
encode read orientation. Consider a mode (e.g. "Link paired/supp reads with
curved lines") that reuses that curved-line orientation logic inside the normal
alignments track.

- Track Google Analytics events from users on a fine grained basis. better
- Ensure `types.refinement` from @jbrowse/mobx-state-tree (see
  ~/src/mobx-state-tree) v5.6.0 provides fallbacks when state tree fails to load
- Map all old "renderer" concepts to new display model settings
- Ensure all demo sessions load without error
- Diagonalization: yeast works, grape vs peach unclear
- Opening reference sequence track with `umd_plugin.js` gives
  `TypeError: Cannot assign to read only property 'metadata'` — need to handle
  frozen objects from extension points logging of species chosen on desktop for
  example
- Hot module reload breaks canvas features
- Dockview move to right side not working — non-webgl bug

### P4.6 UI/UX Ideas (Unscoped)

- Should not shrink size on linked read resize height
- Add ability where resize height does actual resize
- Resize on double-click resize handle
- Drag entire view to resize
- Click isoform to expand all
- Global scrollZoom setting rather than per view
- Rolling average line plot
- Zarr VCF support
- Add legend for alignments
- Distinguish initialized concepts in linear genome view

### P2.3 Synteny / Comparative Views

| Bug                                                   | Notes                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| Hs1 vs mm39 synteny — excessively slow, causes freeze | Improved (viewport culling added) — further LOD improvements needed |
| Zoom to full not working?                             | **UNCLEAR** — needs verification                                    |
| Don't colorize indels not working?                    | **UNCLEAR** — needs verification                                    |
| Split indels code                                     | Refactoring task                                                    |
| Linked dotplot and synteny view                       | Idea / future feature                                               |
| Swap axes dotplot                                     | Idea / future feature                                               |
| Swap axes linear synteny view                         | Idea / future feature                                               |

### Declarative "JBrowse Spec" Config Layer

The current config system is a serialization format for MST internal state —
users must think in terms of adapters, displays, and renderers rather than what
they want to see. Vega-Lite, ggplot2, and GenomeSpy use a data → encoding → mark
grammar that is far more discoverable.

The session-spec URL format (`assembly`, `loc`, `tracks[]`) is already 80% of
the way there. The idea is to extend it into a proper spec layer that compiles
down to the internal config:

```json
{
  "assembly": "hg38",
  "location": "chr1:1,000,000-2,000,000",
  "tracks": [
    {
      "data": "https://example.com/file.bam",
      "color": { "field": "strand", "type": "nominal" },
      "filter": { "mapq": ">= 20" },
      "height": 300
    },
    {
      "data": "https://example.com/coverage.bw",
      "mark": "area",
      "color": "steelblue"
    }
  ]
}
```

Key behaviors:
- Infer adapter type from URL/file extension (partially done already)
- Infer display/track type from data type + mark
- Map encoding channels (`color: {field: "strand"}`) to internal colorBy config
- Map `filter` to internal filterBy flags
- Fall through to raw config for anything the grammar doesn't cover

This is the Vega-Lite → Vega pattern: simple grammar compiles to full spec.
Plugin authors keep the full MST config power; end users get a clean API.

Separately, `readConfObject`/`getConf` are expensive (traverse MST nodes each
call) and are called in hot paths — caching resolved values would help
performance.

### R/ggplot2 Export System

**Status:** Very ambitious, branch exists with initial work.

**Goal:** Export any JBrowse session view as an R script that reproduces the
visualization using ggplot2/Bioconductor. This serves two purposes:

- **Publication-quality figures** — researchers currently screenshot JBrowse and
  paste into papers. An R export produces vector graphics with full control over
  fonts, sizing, and journal-specific styling (Nature, Cell, etc.)
- **Reproducibility** — the exported R script is a complete record of what data
  was shown and how. It can be checked into a repo alongside a paper's analysis
  code, re-run on updated data, or modified by reviewers

**How it could work:**

The JBrowse session already knows everything needed: data source URLs, genomic
region, track types, color schemes, filters, and layout. An export step would
translate each track type into its R equivalent:

- Alignments pileup → Gviz/ggbio `AlignmentsTrack` or custom `geom_rect` layout
- Wiggle/coverage → `geom_area` / `geom_line` with the same scale/color settings
- Features/genes → `geom_rect` + `geom_text` for labels, or ggbio's gene model
  geoms
- Variants → `geom_point` or custom VCF geoms
- Synteny → `geom_segment` / `geom_curve` between faceted panels
- Color-by schemes → mapped to ggplot2 `scale_color_*` / `scale_fill_*`
- JEXL callbacks → translated to R expressions where possible, or pre-evaluated
  and baked into the data frame

The exported script would use Bioconductor packages (Rsamtools, rtracklayer,
VariantAnnotation) to read the same data files, so the R code is self-contained
and re-runnable.

**Open questions:**
- How much of the layout engine (pileup stacking, synteny routing) needs to be
  reimplemented in R vs. pre-computed and exported as coordinates?
- Could a shared "JBrowse Spec" (see above) be the intermediate representation
  that both the browser and the R exporter consume?
- Integration with Quarto/RMarkdown — generate a notebook that mixes narrative
  text with JBrowse-exported figures

### Notebook Integration Refresh

The `jupyter-jbrowse` project started this but needs a refresh. The session-spec
format (see "JBrowse Spec" idea above) could be the basis for a cleaner API in
Jupyter / Observable / Quarto. A notebook cell like:

```python
jbrowse.view("hg38", "chr17:7,571,720-7,590,868", tracks=["clinvar", "gencode"])
```

would generate a session-spec URL and render an iframe or embedded React
component. The `@jbrowse/react-linear-genome-view` package already supports
embedding, but the config wiring is too complex for notebook use — the spec layer
would fix that.

### P4.4 Automatic Noisiness Scaling for Feature Frequency Thresholds

Compute a per-track noise estimate (e.g., mean insertion rate across sampled
positions) during coverage computation and use it to automatically scale the
`featureFrequencyThreshold` curve. Noisy long-read tracks (PacBio CLR) would get
stricter thresholds while clean short-read tracks stay unchanged. The data is
already available in `computePositionFrequencies`; main work is threading the
stat through the RPC boundary and choosing a good baseline expected noise rate.

### P4.5 Option to Disable Sub-Pixel Feature Fade

Add a per-track option to disable the sub-pixel alpha fade that hides
low-frequency features when zoomed out. High-quality reads (e.g., Illumina,
PacBio HiFi) have very few sequencing errors, so most mismatches and insertions
are real variants that users may want to see at all zoom levels regardless of
frequency. When enabled, features would render at full opacity whenever they are
present, bypassing both the zoom-based alpha and the frequency-based importance
scaling.
