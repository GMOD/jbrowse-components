import { SimpleFeature } from '@jbrowse/core/util'

import { stringifyBedGraph } from '../saveTrackFormats/bedGraph.ts'
import { exportedWiggleFeatures } from './exportedFeatures.ts'

const NONE: ReadonlySet<string> = new Set()

const features = [
  new SimpleFeature({
    uniqueId: 'a',
    refName: 'ctgA',
    start: 0,
    end: 10,
    score: 1,
    coverage: 30,
  }),
  new SimpleFeature({
    uniqueId: 'b',
    refName: 'ctgA',
    start: 10,
    end: 20,
    coverage: 12,
  }),
  new SimpleFeature({
    uniqueId: 'c',
    refName: 'ctgA',
    start: 20,
    end: 30,
    score: 5,
  }),
]

test('a plot of another field exports that field as the score', () => {
  expect(
    stringifyBedGraph({
      features: exportedWiggleFeatures({
        features,
        hidden: NONE,
        yField: 'coverage',
      }),
    }),
  ).toBe('ctgA\t0\t10\t30\nctgA\t10\t20\t12')
})

test('each exported feature keeps its id and its other fields', () => {
  const [first] = exportedWiggleFeatures({
    features,
    hidden: NONE,
    yField: 'coverage',
  })
  expect(first?.id()).toBe('a')
  expect(first?.get('coverage')).toBe(30)
  expect(first?.get('score')).toBe(30)
})

test.each(['score', 'minScore', 'maxScore'])(
  'a plot of %s exports the features as fetched',
  yField => {
    expect(exportedWiggleFeatures({ features, hidden: NONE, yField })).toBe(
      features,
    )
  },
)
