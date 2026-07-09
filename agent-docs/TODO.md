## Alignments / canvas

- Group by strand, `plugins/canvas`.
- Toggle off tooltips for `LinearMultiSampleVariantDisplay`.
- Add a "hide this feature" option to `LinearMultiSampleVariantDisplay` (and similar displays).
- Quick/copy consensus, a separate quantitative splice-junction track, and sample/library (SM/LB) grouping.

## Dotplot edge-zoom jump

Zoomed all the way out, then scrolling to zoom in near the edge of the plot
makes the plot "jump" so the cursor is no longer over the same region. At every
other zoom level the area under the cursor stays put; only reproduces from the
max-zoomed-out level, and is more noticeable near the plot edge.


## more accurate cgiab

look at wakhan, pycnv


## add extra large text svg mode for pub ready figures



## autofit height for lineargenomeview example-site demo


## dotplot / circular SVG export freshness guard

Dotplot and circular-view SVG export have no export-after-pan freshness gate: a
pan/zoom immediately followed by Export SVG can capture the pre-move data during
the debounce+refetch window (dotplot's own code comment admits it). The LGV
families all close this: per-region displays via `viewportWithinLoadedData`,
HiC/LD via `viewportMatchesLastDrawn` (the `dataLoaded` freshness axis), arc via
`loadedRegionSignature`, synteny via `refetching`. Dotplot/circular need the
equivalent (a `svgReady`-style gate comparing loaded-data key to the current
view) before their `renderSvg` resolves.

## review release process


