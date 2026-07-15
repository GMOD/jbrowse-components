import { formatMultiLevelFeat, stringifyGFF3 } from './gff3.ts'
import SimpleFeature from '../../../util/simpleFeature.ts'

import type { Feature } from '../../../util/simpleFeature.ts'

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

  it('URL encodes special characters in attribute values', () => {
    const f = createFeature({
      id: 'test4',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'gene',
      note: 'contains;semicolon=equals,comma&ampersand%percent',
      description: 'has\ttab\nnewline\rcarriage',
    })
    const result = stringifyGFF3({ features: [f] })
    // Check that special characters are encoded
    expect(result).toContain('%3B') // semicolon
    expect(result).toContain('%3D') // equals
    expect(result).toContain('%2C') // comma
    expect(result).toContain('%26') // ampersand
    expect(result).toContain('%25') // percent
    expect(result).toContain('%09') // tab
    expect(result).toContain('%0A') // newline
    expect(result).toContain('%0D') // carriage return
    expect(result).toMatchSnapshot()
  })

  it('outputs ID before Parent in attributes', () => {
    const f = createFeature({
      id: 'child1',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'exon',
    })
    const result = formatMultiLevelFeat({ feature: f, parentId: 'parent1' })
    // ID should come before Parent
    const idIndex = result.indexOf('ID=child1')
    const parentIndex = result.indexOf('Parent=parent1')
    expect(idIndex).toBeLessThan(parentIndex)
    expect(result).toContain('ID=child1;Parent=parent1')
  })

  it('returns just header for empty features array', () => {
    const result = stringifyGFF3({ features: [] })
    expect(result).toBe('##gff-version 3\n')
  })

  it('handles phase attribute correctly', () => {
    const f = createFeature({
      id: 'cds1',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'CDS',
      phase: 0,
    })
    const result = stringifyGFF3({ features: [f] })
    // Phase of 0 should be output, not replaced with '.'
    expect(result).toContain('\t0\t')
  })

  it('handles score of 0 correctly', () => {
    const f = createFeature({
      id: 'feat1',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'match',
      score: 0,
    })
    const result = stringifyGFF3({ features: [f] })
    // Score of 0 should be output, not replaced with '.'
    const fields = result.split('\n', 2)[1]!.split('\t')
    expect(fields[5]).toBe('0')
  })

  it('handles both note and description without collision', () => {
    const f = createFeature({
      id: 'test_collision',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'gene',
      note: 'this is the note',
      description: 'this is the description',
    })
    const result = stringifyGFF3({ features: [f] })
    // description becomes Note, note becomes note2 to avoid collision
    expect(result).toContain('Note=this is the description')
    expect(result).toContain('note2=this is the note')
    expect(result).not.toMatch(/Note=.*Note=/)
  })

  it('filters out null and undefined attribute values', () => {
    const f = createFeature({
      id: 'test5',
      refName: 'chr1',
      start: 100,
      end: 200,
      type: 'gene',
      valid_attr: 'valid',
      null_attr: null,
      undefined_attr: undefined,
    })
    const result = stringifyGFF3({ features: [f] })
    expect(result).toContain('valid_attr=valid')
    expect(result).not.toContain('null_attr')
    expect(result).not.toContain('undefined_attr')
  })

  it('manufactures an ID for a parent lacking one so children can reference it', () => {
    // mimics non-GFF3 sources like BigBed aggregated genes: the parent has a
    // uniqueId but no `id` attribute in its data
    const f = new SimpleFeature({
      id: 'synth-parent',
      data: {
        refName: 'chr1',
        start: 100,
        end: 900,
        type: 'gene',
        name: 'gene1',
        subfeatures: [
          {
            id: 'exon1',
            start: 100,
            end: 200,
            type: 'exon',
          },
        ],
      },
    })
    const result = stringifyGFF3({ features: [f] })
    // parent gets ID from its uniqueId, child references the same value
    expect(result).toContain('ID=synth-parent')
    expect(result).toContain('Parent=synth-parent')
  })

  it('does not manufacture an ID for a childless feature lacking one', () => {
    const f = new SimpleFeature({
      id: 'leaf-unique',
      data: {
        refName: 'chr1',
        start: 100,
        end: 200,
        type: 'gene',
        name: 'gene1',
      },
    })
    const result = stringifyGFF3({ features: [f] })
    expect(result).not.toContain('ID=')
    expect(result).toContain('Name=gene1')
  })

  it('computes missing CDS phase from cumulative length (+ strand)', () => {
    const f = createFeature({
      id: 'mrna1',
      refName: 'chr1',
      start: 0,
      end: 300,
      type: 'mRNA',
      strand: 1,
      subfeatures: [
        // 100bp CDS → phase 0
        { id: 'cds1', start: 0, end: 100, type: 'CDS' },
        // cumulative 100, (3 - 100%3)%3 = 2
        { id: 'cds2', start: 200, end: 280, type: 'CDS' },
      ],
    })
    const result = stringifyGFF3({ features: [f] })
    const cdsLines = result.split('\n').filter(l => l.includes('\tCDS\t'))
    expect(cdsLines[0]).toContain('\t0\tID=cds1')
    expect(cdsLines[1]).toContain('\t2\tID=cds2')
  })

  it('computes missing CDS phase in translation order (- strand)', () => {
    const f = createFeature({
      id: 'mrna1',
      refName: 'chr1',
      start: 0,
      end: 300,
      type: 'mRNA',
      strand: -1,
      subfeatures: [
        // on - strand the 3'-most (rightmost) CDS translates first → phase 0
        { id: 'cds1', start: 0, end: 80, type: 'CDS' },
        { id: 'cds2', start: 200, end: 300, type: 'CDS' },
      ],
    })
    const result = stringifyGFF3({ features: [f] })
    const byId = (id: string) =>
      result.split('\n').find(l => l.includes(`ID=${id}`))!
    // cds2 (100bp) translates first → phase 0; cds1 → (3 - 100%3)%3 = 2
    expect(byId('cds2')).toContain('\t0\tID=cds2')
    expect(byId('cds1')).toContain('\t2\tID=cds1')
  })

  it('does not override a CDS phase that is already present', () => {
    const f = createFeature({
      id: 'mrna1',
      refName: 'chr1',
      start: 0,
      end: 300,
      type: 'mRNA',
      strand: 1,
      subfeatures: [
        { id: 'cds1', start: 0, end: 100, type: 'CDS', phase: 1 },
        { id: 'cds2', start: 200, end: 280, type: 'CDS' },
      ],
    })
    const result = stringifyGFF3({ features: [f] })
    const byId = (id: string) =>
      result.split('\n').find(l => l.includes(`ID=${id}`))!
    // present phase preserved, missing one still filled
    expect(byId('cds1')).toContain('\t1\tID=cds1')
    expect(byId('cds2')).toContain('\t2\tID=cds2')
  })

  it('handles deeply nested subfeatures', () => {
    const f = createFeature({
      id: 'gene1',
      refName: 'chr1',
      start: 0,
      end: 10000,
      type: 'gene',
      subfeatures: [
        {
          id: 'mrna1',
          start: 0,
          end: 10000,
          type: 'mRNA',
          subfeatures: [
            {
              id: 'exon1',
              start: 0,
              end: 500,
              type: 'exon',
            },
            {
              id: 'cds1',
              start: 100,
              end: 400,
              type: 'CDS',
              phase: 0,
            },
            {
              id: 'exon2',
              start: 9500,
              end: 10000,
              type: 'exon',
            },
            {
              id: 'cds2',
              start: 9500,
              end: 9800,
              type: 'CDS',
              phase: 2,
            },
          ],
        },
      ],
    })
    expectGff3Snapshot([f])
  })
})

describe('formatMultiLevelFeat', () => {
  it('formats a simple feature correctly', () => {
    const f = new SimpleFeature({
      id: 'test-unique',
      data: {
        id: 'test_feat',
        refName: 'chr1',
        type: 'gene',
        start: 100,
        end: 200,
        strand: 1,
        source: 'test',
      },
    })
    const result = formatMultiLevelFeat({ feature: f })
    expect(result).toContain(
      'chr1\ttest\tgene\t101\t200\t.\t+\t.\tID=test_feat',
    )
  })

  it('inherits refName from parent for subfeatures', () => {
    const f = new SimpleFeature({
      id: 'test-unique',
      data: {
        id: 'exon1',
        type: 'exon',
        start: 100,
        end: 200,
      },
    })
    const result = formatMultiLevelFeat({
      feature: f,
      parentId: 'parent1',
      parentRef: 'chr5',
    })
    expect(result).toContain('chr5\t')
    expect(result).toContain('Parent=parent1')
  })
})
