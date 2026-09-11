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
      name: 'points with a glyph scale over a field',
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
    lgvSnapshotTest({
      name: 'a coverage run on its own right-hand axis under the reads',
      snapshot: 'mark-two-axes',
      loc: 'ctgA:1-5000',
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
  ],
}

export default suite
