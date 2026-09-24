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
  ],
}

export default suite
