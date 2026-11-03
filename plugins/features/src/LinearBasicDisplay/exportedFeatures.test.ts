import { setConf } from '@jbrowse/core/configuration'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { createTestEnvironment } from './testEnv.ts'

import type { Feature } from '@jbrowse/core/util'

// what CoreGetFeatures hands Save track data, which never saw the worker's
// admission
const fetched = [
  ['geneA', 'gene'],
  ['geneB', 'gene'],
  ['repeatC', 'repeat_region'],
  ['source', 'region', 'Src'],
].map(
  ([id, type, gbkey]) =>
    new SimpleFeature({
      uniqueId: id!,
      refName: 'ctgA',
      start: 100,
      end: 200,
      type,
      gbkey,
    }),
)

const ids = (features: Feature[]) => features.map(f => f.id())

test('an unfiltered display exports all but the NCBI source record it never draws', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(ids(display.exportedFeatures(fetched))).toEqual([
    'geneA',
    'geneB',
    'repeatC',
  ])
})

test('the hidden features stay out of the file', () => {
  const { display } = createTestEnvironment().createDisplay({
    hiddenFeatureIds: ['geneB'],
  })
  expect(ids(display.exportedFeatures(fetched))).toEqual(['geneA', 'repeatC'])
})

test('an applied show-only list exports only its features', () => {
  const { display } = createTestEnvironment().createDisplay({
    soloFeatureIds: ['repeatC'],
    soloApplied: true,
  })
  expect(ids(display.exportedFeatures(fetched))).toEqual(['repeatC'])
})

test("the display's filter applies as the worker's admission applies it", () => {
  const { display } = createTestEnvironment().createDisplay()
  setConf(display.configuration, 'filter', [{ field: 'type', equal: 'gene' }])
  expect(ids(display.exportedFeatures(fetched))).toEqual(['geneA', 'geneB'])
})
