import { Feature, SimpleFeature } from '@jbrowse/core/util'
import { expect, test } from 'vitest'

import { processFeaturesToFasta } from './fastaUtils'

function makeMap(features: Feature[]) {
  return new Map(features.map(f => [f.id(), f]))
}
const mockFeature = new SimpleFeature({
  uniqueId: '123',
  refName: 'abc',
  start: 100,
  end: 110,
  seq: 'ACGTACGTAC',
  alignments: {
    assembly1: {
      chr: 'chr1',
      start: 100,
      seq: 'ACGTACGTAC',
      strand: 1,
    },
    assembly2: {
      chr: 'chr2',
      start: 200,
      seq: 'AC-TTCGTAC',
      strand: 1,
    },
  },
})
test('no showAllLetters', () => {
  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [{ id: 'assembly1' }, { id: 'assembly2' }],
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 105,
        assemblyName: 'assembly1',
      },
    ],
  })
  expect(result).toMatchSnapshot()
})

test('showAllLetters', () => {
  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [{ id: 'assembly1' }, { id: 'assembly2' }],
    showAllLetters: true,
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 105,
        assemblyName: 'assembly1',
      },
    ],
  })
  expect(result).toMatchSnapshot()
})

test('gap in assembly1', () => {
  const mockFeature = new SimpleFeature({
    uniqueId: '123',
    refName: 'abc',
    start: 100,
    end: 110,
    seq: 'AC-TACGTAC',
    alignments: {
      assembly1: {
        chr: 'chr1',
        start: 100,
        seq: 'AC-TACGTAC',
        strand: 1,
      },
      assembly2: {
        chr: 'chr2',
        start: 200,
        seq: 'ACGTTCGTAC',
        strand: 1,
      },
    },
  })

  const result = processFeaturesToFasta({
    features: makeMap([mockFeature]),
    samples: [{ id: 'assembly1' }, { id: 'assembly2' }],
    regions: [
      {
        refName: 'chr1',
        start: 100,
        end: 105,
        assemblyName: 'assembly1',
      },
    ],
  })
  expect(result).toMatchSnapshot()
})
