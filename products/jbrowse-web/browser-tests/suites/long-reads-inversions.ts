import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const pileup = 'pileup-display-done'

const suite: TestSuite = {
  name: 'Long Reads and Inversions',
  tests: [
    lgvSnapshotTest({
      name: 'long reads BAM rendering',
      snapshot: 'long-reads-bam',
      loc: 'ctgA:1-10000',
      tracks: ['volvox-long-reads-bam'],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'long reads CRAM rendering',
      snapshot: 'long-reads-cram',
      loc: 'ctgA:1-10000',
      tracks: ['volvox-long-reads-cram'],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'simple inversion BAM rendering',
      snapshot: 'inversion-simple-bam',
      loc: 'ctgA:1-50000',
      tracks: ['volvox-simple-inv.bam'],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'simple inversion CRAM rendering',
      snapshot: 'inversion-simple-cram',
      loc: 'ctgA:1-50000',
      tracks: ['volvox-simple-inv.cram'],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'inversion with indels rendering',
      snapshot: 'inversion-indels',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_inv_indels'],
    }),
    lgvSnapshotTest({
      name: 'inversion pbsim simulation rendering',
      snapshot: 'inversion-pbsim',
      loc: 'ctgA:1-50000',
      tracks: ['volvox-inv-pbsim'],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'inversion pbsim with linked reads and arcs',
      snapshot: 'inversion-pbsim-linked',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox-inv-pbsim',
          displaySnapshot: {
            showBezierConnections: true,
            readConnections: 'arc',
          },
        },
      ],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'simple inversion BAM with linked reads and arcs',
      snapshot: 'inversion-simple-bam-linked',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox-simple-inv.bam',
          displaySnapshot: {
            showBezierConnections: true,
            readConnections: 'arc',
          },
        },
      ],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'inversion paired BAM coverage-only',
      snapshot: 'inversion-paired-coverage',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox-simple-inv-paired.bam',
          displaySnapshot: {
            height: 45,
            showCoverage: true,
            coverageHeight: 45,
          },
        },
      ],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'inversion pbsim coverage-only',
      snapshot: 'inversion-pbsim-coverage',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox-inv-pbsim',
          displaySnapshot: {
            height: 45,
            showCoverage: true,
            coverageHeight: 45,
          },
        },
      ],
      doneTestId: pileup,
    }),
    lgvSnapshotTest({
      name: 'simple inversion paired BAM read cloud',
      snapshot: 'inversion-paired-cloud',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox-simple-inv-paired.bam',
          displaySnapshot: {
            readConnections: 'cloud',
            colorBy: { type: 'pairOrientation' },
          },
        },
      ],
      doneTestId: pileup,
    }),
  ],
}

export default suite
