---
name: browser-goldens-that-may-hide-regressions
description: Thirteen canvas2d browser tests that fail at 9e24a41973 and at main alike, whose new capture looks like a regression rather than a stale golden, so they were left unrefreshed on 2026-10-25 while 20 benign ones were reshot. Each needs its owner to say whether the new picture is intended before anyone runs -u on it. Four more are failing asserts, not pictures (cross-region arcs draw nothing across, a squeezed fit draws a label, SVG peptide text).
---

# Browser goldens that may hide regressions

- **In:** a `node browser-tests/runner.ts --backend=canvas2d` sweep of
  `products/jbrowse-web` at main (2de7afca18) and at 9e24a41973, before the
  multi-row swap. Both fail the same 37 tests to two decimals, so none comes
  from that swap.
- **Out:** for each test below, the intended picture: a fix, or a reshoot
  once its owner says the new one is right.

The 20 failures whose new picture was a plain improvement (legend titles,
axis domains, palettes, finer bins) were reshot with the multi-row goldens.

## Pictures that look wrong

Golden first, new capture second.

- `Alignments Track > BAM track screenshot` and `Alignments Color Schemes >
  color by mapping quality`: reads go from the default fill to bright yellow.
- `Alignments Track > volvox long reads with SV (linked reads)`: the red
  clipped reads turn grey, and an arc appears over the pair.
- `Long Reads and Inversions > inversion paired BAM coverage-only` and
  `inversion pbsim coverage-only`: a coverage-only track now draws reads
  under its coverage.
- `Additional Track Types > structural variant VCF track renders`: the
  breakend ALT labels (`G[ctgA:34200[`) are gone, and the feature labels
  change.
- `Variants Track > assembly aliases VCF track`: the variant labels
  (`T -> C`, ...) are gone.
- `Synteny Views > color by identity shows viridis ramp + dismissible
  legend`: the ribbons paint blue-grey and the key is a red-to-blue ramp,
  where the test names viridis.
- `BigWig Tracks > MultiBigWig grouped rows, density`: the rows lose their
  row colors (red Grain1 and Grain3).
- `Demo Inventory (Local) > SARS-CoV2 demo screenshot`: the gene layout and
  track height change (100 px to 280 px).
- `Miscellaneous Tracks > GFF3 track rendering`: the collapsed, labelled
  layout becomes expanded transcripts with no labels.
- `Workspaces > can add Linear genome view from menu`: the workspace tab bar
  is gone.
- `Breakpoint Split View > volvox inversion breakpoint split view`: 30%
  against a 10% gate; not yet looked at.

## Asserts that fail

- `Arcs and BEDPE Displays > interchromosomal arcs (both feet displayed)`:
  `drawnAcross` 0 where 9 is expected, at ctgA:19,000-21,000 ctgB:2,500-3,500.
- `Canvas Track Sizing > a squeezed fit drops the subfeature labels it
  shrank`: the fit draws `EDEN.1`.
- `SVG Export > exports SVG with gene track (peptide labels)` and `... across
  a refName alias`: the peptide text has no monospace font-family, and across
  the alias the sequence fetch misses `originalRefName`.
