import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'GWAS Tracks',
  tests: [
    lgvSnapshotTest({
      name: 'Manhattan plot renders',
      snapshot: 'gwas-manhattan',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_gwas'],
      displayTestId: 'manhattan-display',
    }),
    // The extent-bar branch on the GPU, which no browser capture reached until
    // 2026-09-08. The scores random-walk ON PURPOSE: the bar band is 4 px
    // against ~25.9 px per -log10 unit, so neighbours only share a pixel row —
    // the abutting edge this exists to draw — when |Δscore| < ~0.154. Regenerate
    // the fixture with i.i.d. noise and 36 of 39 boundaries stop testing
    // anything. It does NOT check bar WIDTH: these edges are antialiased, which
    // is what blinds the gate (CROSS_BACKEND_GATE.md §"What the gate cannot
    // see").
    lgvSnapshotTest({
      name: 'Manhattan extent bars render on both backends',
      snapshot: 'gwas-manhattan-bars',
      loc: 'ctgA:1-8000',
      tracks: ['volvox_gwas_windows'],
      displayTestId: 'manhattan-display',
      // Its own config: a track added to the shared volvox catalog moves the
      // workspaces goldens, which open the track selector on it.
      config: 'test_data/volvox/config_gwas_windows.json',
    }),
  ],
}

export default suite
