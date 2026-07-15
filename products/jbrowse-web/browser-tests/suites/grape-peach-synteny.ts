import { viewSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const grapePeachConfig = 'test_data/grape_peach_synteny/config.json'

const suite: TestSuite = {
  name: 'Grape vs Peach Synteny',
  requiresRemote: true,
  tests: [
    viewSnapshotTest({
      name: 'clean whole-genome ribbon grape vs peach (2k minlen, diagonalized)',
      snapshot: 'grape-peach-synteny-clean-ribbon',
      config: grapePeachConfig,
      timeout: 120000,
      // Whole-genome companion to the hs1/mm39 clean-ribbon test, on a smaller
      // plant dataset. Grape-peach alignments are small (<12kb) so minlen
      // stays at 2k (vs 500k for human/mouse) to keep enough ribbons visible;
      // autoDiagonalize + drawCurves + low alpha still produce a clean
      // diagonalized ribbon overview.
      view: {
        type: 'LinearSyntenyView',
        tracks: ['peach_grape_minimap2'],
        minAlignmentLength: 2000,
        drawCurves: true,
        autoDiagonalize: true,
        colorBy: 'query',
        alpha: 0.4,
        levelHeights: [350],
        views: [{ assembly: 'grape' }, { assembly: 'peach' }],
      },
      waitTestId: 'synteny_canvas_done',
    }),
    viewSnapshotTest({
      name: 'renders synteny view for grape chr18 vs peach Pp01 (minimap2 PAF)',
      snapshot: 'grape-peach-synteny-overview',
      config: grapePeachConfig,
      timeout: 120000,
      // chr18 (grape) vs Pp01 (peach) has strong synteny — a clear diagonal
      // ribbon at minlen=2k without hairballing. Grape-peach alignments are
      // generally small (<12kb) so minlen must stay low.
      view: {
        type: 'LinearSyntenyView',
        tracks: ['peach_grape_minimap2'],
        minAlignmentLength: 2000,
        views: [
          { loc: 'chr18', assembly: 'grape' },
          { loc: 'Pp01', assembly: 'peach' },
        ],
      },
      waitTestId: 'synteny_canvas_done',
    }),
  ],
}

export default suite
