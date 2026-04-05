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

### P4.2 R/ggplot2 Export System

**Status:** Very ambitious, branch exists with initial work.

- Design system to export session to R code generating ggplot images
- Generic WebGL + ggplot2 system (very speculative)
- Needs significant planning before implementation

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
