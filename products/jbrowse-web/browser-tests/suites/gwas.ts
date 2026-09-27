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
      displayTestId: 'mark-display',
    }),
    // A rule per window on the GPU. The scores random-walk ON PURPOSE: a rule
    // is 4 px against ~25.9 px per -log10 unit, so neighbours only share a
    // pixel row — the abutting edge this exists to draw — when
    // |Δscore| < ~0.154. It does NOT check rule WIDTH: these edges are
    // antialiased, which blinds the gate (CROSS_BACKEND_GATE.md §"What the gate
    // cannot see").
    lgvSnapshotTest({
      name: 'Manhattan window rules render on both backends',
      snapshot: 'gwas-manhattan-bars',
      loc: 'ctgA:1-8000',
      tracks: ['volvox_gwas_windows'],
      displayTestId: 'mark-display',
      // Its own config: a track added to the shared volvox catalog moves the
      // workspaces goldens, which open the track selector on it.
      config: 'test_data/volvox/config_gwas_windows.json',
    }),
  ],
}

export default suite
