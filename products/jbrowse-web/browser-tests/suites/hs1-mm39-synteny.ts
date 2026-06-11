import { viewSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const hs1Mm39Config = 'test_data/hs1_vs_mm39/config.json'

const suite: TestSuite = {
  name: 'Hs1 vs mm39 Synteny',
  requiresRemote: true,
  tests: [
    viewSnapshotTest({
      name: 'clean whole-genome ribbon hs1 vs mm39 (500k minlen, diagonalized)',
      snapshot: 'hs1-mm39-synteny-clean-ribbon',
      config: hs1Mm39Config,
      timeout: 120000,
      // Reproduces the look of data/hs1ToMm39/ribbon-500k.png (the offline
      // reference renderer): 500k minlen drops short-alignment hairball noise,
      // autoDiagonalize reorders mm39 chroms so syntenic blocks form clean
      // diagonals, drawCurves + low alpha give legible bezier ribbons colored
      // per query chromosome. Proves the runtime GPU path matches the
      // reference offline plot.
      view: {
        type: 'LinearSyntenyView',
        tracks: ['hs1ToMm39.over.chain.pif'],
        minAlignmentLength: 500000,
        drawCurves: true,
        autoDiagonalize: true,
        colorBy: 'query',
        alpha: 0.4,
        levelHeights: [350],
        views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
      },
      waitTestId: 'synteny_canvas_done',
    }),
    viewSnapshotTest({
      name: 'whole-genome overview hs1 vs mm39 (100k minlen)',
      snapshot: 'hs1-mm39-synteny-wholegenome',
      config: hs1Mm39Config,
      timeout: 120000,
      // whole-genome human vs mouse — omitting loc shows all chromosomes;
      // 100k minlen keeps the syntenic ribbons legible instead of a hairball
      view: {
        type: 'LinearSyntenyView',
        tracks: ['hs1ToMm39.over.chain.pif'],
        minAlignmentLength: 100000,
        views: [{ assembly: 'hs1' }, { assembly: 'mm39' }],
      },
      waitTestId: 'synteny_canvas_done',
    }),
    viewSnapshotTest({
      name: 'renders synteny view for chr7 vs chr6 (indexed PAF, 100k minlen)',
      snapshot: 'hs1-mm39-synteny-chr7',
      config: hs1Mm39Config,
      timeout: 120000,
      // full chr7 vs chr6 with 100k minlen shows clear diagonal syntenic bands
      view: {
        type: 'LinearSyntenyView',
        tracks: ['hs1ToMm39.over.chain.pif'],
        minAlignmentLength: 100000,
        views: [
          { loc: 'chr7', assembly: 'hs1' },
          { loc: 'chr6', assembly: 'mm39' },
        ],
      },
      waitTestId: 'synteny_canvas_done',
    }),
    viewSnapshotTest({
      name: 'renders synteny view for chr1 region (large dataset, viewport culling)',
      snapshot: 'hs1-mm39-synteny-chr1-large',
      config: hs1Mm39Config,
      timeout: 120000,
      // hs1:chr1:50-100M vs mm39:chr1:30-180M with 100k minlen keeps ribbons
      // visible; shows viewport culling without hairballing
      view: {
        type: 'LinearSyntenyView',
        tracks: ['hs1ToMm39.over.chain.pif'],
        minAlignmentLength: 100000,
        views: [
          { loc: 'chr1:50,000,000..100,000,000', assembly: 'hs1' },
          { loc: 'chr1:30,000,000..180,000,000', assembly: 'mm39' },
        ],
      },
      waitTestId: 'synteny_canvas_done',
    }),
  ],
}

export default suite
