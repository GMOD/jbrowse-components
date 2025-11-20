import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { stringifyGFF3 } from './gff3'

import type { Feature } from '@jbrowse/core/util/simpleFeature'

// Helper function to create a feature, ensuring a unique ID is set
// for the SimpleFeature instance while using data.id for GFF3 attributes.
function createFeature(data: Record<string, any>): SimpleFeature {
  if (!data.id) {
    throw new Error('Test feature data must have an id')
  }
  return new SimpleFeature({ id: `${data.id}-unique`, data })
}

// Helper function to check GFF3 output using snapshot testing.
function expectGff3Snapshot(features: Feature[]) {
  expect(stringifyGFF3({ features })).toMatchSnapshot()
}

describe('GFF3 export', () => {
  it('can export a simple feature', () => {
    const f = createFeature({
      id: 'test',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'gene',
      name: 'gene1',
      source: 'test',
    })
    expectGff3Snapshot([f])
  })

  it('can export a feature with score and strand', () => {
    const f = createFeature({
      id: 'test2',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'gene',
      score: 100,
      strand: -1,
    })
    expectGff3Snapshot([f])
  })

  it('can export a feature with a subfeature', () => {
    const f = createFeature({
      id: 'gene1',
      refName: 'chr1',
      start: 100,
      end: 900,
      type: 'gene',
      subfeatures: [
        {
          id: 'exon1',
          start: 100,
          end: 200,
          type: 'exon',
        },
        {
          id: 'exon2',
          start: 800,
          end: 900,
          type: 'exon',
        },
      ],
    })
    expectGff3Snapshot([f])
  })

  it('can export a feature with multiple levels of subfeatures', () => {
    const f = createFeature({
      id: 'gene1',
      refName: 'chr1',
      start: 100,
      end: 900,
      type: 'gene',
      subfeatures: [
        {
          id: 'mrna1',
          start: 100,
          end: 900,
          type: 'mRNA',
          subfeatures: [
            {
              id: 'exon1',
              start: 100,
              end: 200,
              type: 'exon',
            },
            {
              id: 'exon2',
              start: 800,
              end: 900,
              type: 'exon',
            },
          ],
        },
      ],
    })
    expectGff3Snapshot([f])
  })

  it('handles various attribute types', () => {
    const f = createFeature({
      id: 'test3',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'tf_binding_site',
      note: 'some note',
      alias: ['a', 'b'],
      custom: { foo: 'bar' },
      empty_array: [],
      undef: undefined,
      null_val: null,
    })
    expectGff3Snapshot([f])
  })
})
