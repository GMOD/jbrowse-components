import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'

const suite: TestSuite = {
  name: 'Additional Track Types',
  tests: [
    lgvSnapshotTest({
      name: 'BED genes track renders',
      snapshot: 'additional-bed-genes',
      loc: 'ctgA:907..15319',
      tracks: ['bed_genes'],
    }),
    lgvSnapshotTest({
      name: 'BigBed genes track renders',
      snapshot: 'additional-bigbed-genes',
      loc: 'ctgA:907..15319',
      tracks: ['bigbed_genes'],
    }),
    lgvSnapshotTest({
      name: 'density wiggle track renders',
      snapshot: 'additional-density-wiggle',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_microarray_density'],
    }),
    lgvSnapshotTest({
      name: 'line wiggle track renders',
      snapshot: 'additional-line-wiggle',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_microarray_line'],
    }),
    lgvSnapshotTest({
      name: 'colored wiggle track renders',
      snapshot: 'additional-color-wiggle',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_microarray_color'],
    }),
    lgvSnapshotTest({
      name: 'multi-sample VCF variant track renders',
      snapshot: 'additional-multisample-vcf',
      loc: 'ctgA:1-50000',
      tracks: [
        {
          trackId: 'volvox_test_vcf',
          displaySnapshot: { type: 'LinearMultiSampleVariantDisplay' },
        },
      ],
    }),
    lgvSnapshotTest({
      name: 'structural variant VCF track renders',
      snapshot: 'additional-sv-vcf',
      loc: 'ctgA:1-50000',
      tracks: ['volvox_sv_test'],
    }),
    lgvSnapshotTest({
      name: 'fractional positive/negative wiggle track renders',
      snapshot: 'additional-fractional-posneg',
      loc: 'ctgA:1-50000',
      tracks: ['wiggle_track_fractional_posneg'],
    }),
    lgvSnapshotTest({
      name: 'variant effect annotation track renders',
      snapshot: 'additional-variant-colors',
      loc: 'ctgA:1-800',
      tracks: ['variant_colors'],
    }),
  ],
}

export default suite
