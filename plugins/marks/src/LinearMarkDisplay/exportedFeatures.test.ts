import createJexlInstance from '@jbrowse/core/util/jexl'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { exportedMarkFeatures } from './exportedFeatures.ts'

import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()

function feat(name: string, score: number, type: string) {
  return new SimpleFeature({
    uniqueId: name,
    refName: 'ctgA',
    start: 0,
    end: 10,
    name,
    score,
    type,
  })
}

const features = [
  feat('kept', 9, 'gene'),
  feat('lowScore', 1, 'gene'),
  feat('hiddenSection', 9, 'repeat'),
  feat('noType', 9, ''),
]

const names = (list: Feature[]) => list.map(f => f.get('name'))

test('the filter steps the worker runs decide what is exported', () => {
  expect(
    names(
      exportedMarkFeatures({
        features,
        filterSteps: [
          { type: 'filter', predicates: [{ field: 'score', gte: 5 }] },
          { type: 'filter', expr: "jexl:get(feature,'name') != 'noType'" },
        ],
        facetField: undefined,
        hidden: new Set(),
        jexl,
      }),
    ),
  ).toEqual(['kept', 'hiddenSection'])
})

// a missing value is the '' section, as facetLayers keys it
test('a feature in a hidden section is left out, keyed as facetLayers keys it', () => {
  expect(
    names(
      exportedMarkFeatures({
        features,
        filterSteps: [],
        facetField: 'type',
        hidden: new Set(['repeat', '']),
        jexl,
      }),
    ),
  ).toEqual(['kept', 'lowScore'])
})
