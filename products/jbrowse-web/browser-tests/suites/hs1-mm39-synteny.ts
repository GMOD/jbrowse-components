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
      waitTestId: 'synteny_canvas',
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
      waitTestId: 'synteny_canvas',
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
      waitTestId: 'synteny_canvas',
    }),
    viewSnapshotTest({
      name: 'renders synteny view for chr1 region (large dataset, viewport culling)',
      snapshot: 'hs1-mm39-synteny-chr1-large',
      config: hs1Mm39Config,
      timeout: 120000,
      // hs1:chr1:157-207M vs mm39:chr1:129-176M — the two windows have to be
      // syntenic to EACH OTHER or the panel renders empty and the test asserts
      // nothing. This pair was read off the chain file: at 100k minlen it is a
      // contiguous inverted run of seven blocks (mm39 descends as hs1 ascends),
      // the largest 23.9Mb. Human chr1 50-100M — what this used to point at —
      // is syntenic to mouse chr3/chr4, not mouse chr1, so it drew zero
      // ribbons. Still a 50Mb window over the full chain file, so it exercises
      // viewport culling without hairballing.
      view: {
        type: 'LinearSyntenyView',
        tracks: ['hs1ToMm39.over.chain.pif'],
        minAlignmentLength: 100000,
        views: [
          { loc: 'chr1:157,000,000..207,000,000', assembly: 'hs1' },
          { loc: 'chr1:129,000,000..176,000,000', assembly: 'mm39' },
        ],
      },
      waitTestId: 'synteny_canvas',
    }),
  ],
}

export default suite
