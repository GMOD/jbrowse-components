import { displayPainted } from '@jbrowse/browser-test-utils'

import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

// Its own config, as gwas.ts's windowed track has: a track added to the
// shared volvox catalog moves the workspaces goldens, which open the track
// selector on it.
const config = 'test_data/volvox/config_marks.json'
const displayTestId = 'mark-display'

// The chrome root rather than the canvas: the legend and the axis are the
// chrome's, and a canvas capture never sees them.
const withChrome = displayPainted(displayTestId)

const suite: TestSuite = {
  name: 'Mark Display',
  tests: [
    lgvSnapshotTest({
      name: 'bars from a BED score column, coloured by a categorical scale, with the key and axis',
      snapshot: 'mark-bars',
      loc: 'ctgA:1-20000',
      tracks: ['marks_bars'],
      config,
      snapshotSelector: withChrome,
    }),
    // The step line's flat quads and the linear line's max-blended capsules,
    // over the same scores.
    lgvSnapshotTest({
      name: 'a step line and a linear line through a BED score column',
      snapshot: 'mark-lines',
      loc: 'ctgA:1-20000',
      tracks: ['marks_line'],
      config,
      displayTestId,
    }),
    // A threshold over the plotted value colours each fragment by the value
    // under it, so a rise across the cut changes colour at the axis: the
    // step's flat quads and the linear line's capsules both read it.
    ...(
      [
        ['step', 'marks_line_posneg'],
        ['linear', 'marks_line_posneg_linear'],
      ] as const
    ).map(([variant, track]) =>
      lgvSnapshotTest({
        name: `a ${variant} line over a positive and negative BigWig, split at 0 by a threshold`,
        snapshot: `mark-line-threshold-${variant}`,
        loc: 'ctgA:1-50000',
        tracks: [track],
        config,
        displayTestId,
      }),
    ),
    // A span coloured by its value is a heatmap: the ramp resolves in the
    // shader off the value lane, a diverging range white at 0.
    lgvSnapshotTest({
      name: 'a heatmap over a positive and negative BigWig, white at 0',
      snapshot: 'mark-heatmap',
      loc: 'ctgA:1-50000',
      tracks: ['marks_heatmap'],
      config,
      snapshotSelector: withChrome,
    }),
    lgvSnapshotTest({
      name: 'points with a shape scale over a field',
      snapshot: 'mark-points-glyph',
      loc: 'ctgA:1-20000',
      tracks: ['marks_points'],
      config,
      displayTestId,
    }),
    lgvSnapshotTest({
      name: 'a stack over the BAM is a declared pileup',
      snapshot: 'mark-pileup',
      loc: 'ctgA:1-5000',
      tracks: ['marks_pileup'],
      config,
      displayTestId,
    }),
    // Two quantities over one BAM are two pictures, not two axes: the
    // coverage run draws zoomed out and the per-read MAPQ zoomed in, on the
    // display's one scale.
    lgvSnapshotTest({
      name: 'a coverage run stands in for the reads zoomed out',
      snapshot: 'mark-coverage-zoomed-out',
      loc: 'ctgA:1-50000',
      tracks: ['marks_two_axes'],
      config,
      snapshotSelector: withChrome,
    }),
    lgvSnapshotTest({
      name: 'the raw mark draws inside its zoom range',
      snapshot: 'mark-multiscale-raw',
      loc: 'ctgA:1-10000',
      tracks: ['marks_density'],
      config,
      displayTestId,
    }),
    lgvSnapshotTest({
      name: 'the zoom-following bin draws past the raw mark s range',
      snapshot: 'mark-multiscale-binned',
      loc: 'ctgA:1-50000',
      tracks: ['marks_density'],
      config,
      displayTestId,
    }),
    // The main-thread ramp: raw values on the colour lane, the LUT bound as a
    // texture, and the Canvas2D painter baking the same domain.
    lgvSnapshotTest({
      name: 'a quantitative ramp coloured by the value it plots',
      snapshot: 'mark-ramp',
      loc: 'ctgA:1-5000',
      tracks: ['marks_ramp'],
      config,
      snapshotSelector: withChrome,
    }),
    lgvSnapshotTest({
      name: 'spans over a VCF stack the variants by type',
      snapshot: 'mark-variants',
      loc: 'ctgA:1-50000',
      tracks: ['marks_variants'],
      config,
      snapshotSelector: withChrome,
    }),
    // A multi-BigWig's rows are its `source` field, so `facet: 'source'` on
    // a bar is the multi-row xyplot beside `bigwig-multibigwig-multirowxy`,
    // the shared axis ruling each band.
    lgvSnapshotTest({
      name: 'bars faceted by source over a MultiBigWig, one band per source',
      snapshot: 'mark-multi-rows',
      loc: 'ctgA:1-4000',
      tracks: ['marks_multi_rows'],
      config,
      snapshotSelector: withChrome,
    }),
    // The same files under `rows`, which labels each row where the facet
    // chipped it. The labels are portalled above the track, so the capture
    // waits on them rather than on the display's paint.
    lgvSnapshotTest({
      name: 'bars one row per source over a MultiBigWig, each row labelled',
      snapshot: 'mark-rows',
      loc: 'ctgA:1-4000',
      tracks: ['marks_rows'],
      config,
      snapshotSelector: withChrome,
      readySelector: '[data-testid="mark-row-labels"]',
    }),
    // One mark type per capture, so the gate sees each shader's row
    // placement on its own.
    ...(
      [
        ['bars', 'ctgA:1-400'],
        ['points', 'ctgA:490-690'],
        ['links', 'ctgA:790-1020'],
      ] as const
    ).map(([mark, loc]) =>
      lgvSnapshotTest({
        name: `${mark} reordered and focused through the row table`,
        snapshot: `mark-rows-arranged-${mark}`,
        loc,
        tracks: ['marks_rows_arranged'],
        config,
        displayTestId,
        readySelector: '[data-testid="mark-row-labels"]',
      }),
    ),
    // The chips are the chrome's overlay, so the display's paint does not gate
    // them — the capture waits on a chip.
    lgvSnapshotTest({
      name: 'a declared facet bands the pileup by mismatch count, each band under its chip',
      snapshot: 'mark-facet',
      loc: 'ctgA:1-5000',
      tracks: ['marks_facet'],
      config,
      snapshotSelector: withChrome,
      readySelector: `${withChrome} [data-testid="group-label-chip"]`,
    }),
    // A stack: coverage per strand cut at one set of stretches, each
    // strand's bars standing on the other's through the bar's `y2` lane,
    // which the shader reads as an attribute and the painter as a lane.
    lgvSnapshotTest({
      name: 'coverage per strand stacked, each strand standing on the one below',
      snapshot: 'mark-stack',
      loc: 'ctgA:1-5000',
      tracks: ['marks_stack'],
      config,
    }),
    // A MAF block is one feature with an `alignments` record per species; a
    // flatten with `key` fans it out into a row each (ADR-186), and a span
    // coloured by `chr` is the MAF display's colour-by-source-chromosome.
    // The adapter lists the species in tree order with the guide tree
    // beside them (ADR-189).
    lgvSnapshotTest({
      name: 'a MAF fanned out into a row per species in tree order, each span coloured by its source chromosome',
      snapshot: 'mark-maf-species-rows',
      loc: 'ctgA:1-2000',
      tracks: ['marks_maf'],
      config,
      snapshotSelector: withChrome,
      readySelector: '[data-testid="mark-row-labels"]',
    }),
    // A cells step behind the flatten replaces each species row with its
    // runs against the reference (ADR-187): the span colours the state, an
    // insertion paints as a sliver at its anchor, and the text prints each
    // mismatched or inserted base at base zoom.
    lgvSnapshotTest({
      name: 'a MAF fanned out into species rows of cells against the reference, mismatches and insertions lettered',
      snapshot: 'mark-maf-cells',
      loc: 'ctgA:801-1100',
      tracks: ['marks_maf_cells'],
      config,
      snapshotSelector: withChrome,
      readySelector: '[data-testid="mark-row-labels"]',
    }),
    // A pinned 20 px `rowHeight` over a 120 px track: the ten species rows
    // run past the plot's foot and the scrollbar reaches them.
    lgvSnapshotTest({
      name: 'MAF species rows pinned at 20 px overflow the plot and scroll',
      snapshot: 'mark-maf-rows-pinned',
      loc: 'ctgA:801-1100',
      tracks: ['marks_maf_cells_pinned'],
      config,
      snapshotSelector: withChrome,
      readySelector: '[data-testid="mark-row-labels"]',
    }),
  ],
}

export default suite
