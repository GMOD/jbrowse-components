import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  findDisplayPainted,
  navigateWithSessionSpec,
  waitForDataLoaded,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'
import { lgvSnapshotTest } from '../suiteHelpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

interface LiveModel {
  JBrowseSession: {
    views: {
      tracks: {
        displays: {
          setRenderingType: (type: string) => void
          setOrigin: (pivot: number) => void
        }[]
      }[]
    }[]
  }
}

// BAM coverage has real min/max spread at the whole contig, and a pivot inside
// its range splits both the whiskers band and the line.
function whiskersBandTest(rendering: 'line' | 'linecenter') {
  return {
    name: `whiskers band on a ${rendering} plot, split at the pivot`,
    fn: async (page: Page) => {
      await navigateWithSessionSpec(page, {
        views: [
          {
            type: 'LinearGenomeView',
            assembly: 'volvox',
            loc: 'ctgA:1-50000',
            tracks: ['p7FU-K6WqS_'],
          },
        ],
      })
      await findDisplayPainted(page, 'wiggle-display', 60000)
      await waitForDataLoaded(page)
      await page.evaluate(renderingType => {
        const { JBrowseSession } = window as unknown as LiveModel
        const display = JBrowseSession.views[0]!.tracks[0]!.displays[0]!
        display.setRenderingType(renderingType)
        display.setOrigin(20)
      }, rendering)
      await waitForDataLoaded(page)
      await dualSnapshot(
        page,
        `additional-whiskers-band-${rendering}`,
        `${displayPainted('wiggle-display')} canvas`,
      )
    },
  }
}

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
    whiskersBandTest('line'),
    whiskersBandTest('linecenter'),
    lgvSnapshotTest({
      name: 'variant effect annotation track renders',
      snapshot: 'additional-variant-colors',
      loc: 'ctgA:1-800',
      tracks: ['variant_colors'],
    }),
  ],
}

export default suite
