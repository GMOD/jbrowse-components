import SimpleFeature from '../../../util/simpleFeature.ts'
import { stringifyBED } from './bed.ts'

function createFeature(data: Record<string, any>) {
  return new SimpleFeature({ id: `${data.id}-unique`, data })
}

function rows(str: string) {
  return str
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t'))
}

describe('BED export', () => {
  it('exports nothing for no features', () => {
    expect(stringifyBED({ features: [] })).toBe('')
  })

  it('writes strand as +/-/. rather than the numeric feature value', () => {
    const features = [1, -1, 0, undefined].map((strand, i) =>
      createFeature({
        id: `f${i}`,
        refName: 'chr1',
        start: 100,
        end: 200,
        strand,
      }),
    )
    expect(rows(stringifyBED({ features })).map(r => r[5])).toEqual([
      '+',
      '-',
      '.',
      '.',
    ])
  })

  it('keeps six columns filled for a bare feature', () => {
    const f = createFeature({
      id: 'f1',
      refName: 'chr1',
      start: 100,
      end: 200,
      name: 'gene1',
      score: 42,
      strand: 1,
    })
    expect(rows(stringifyBED({ features: [f] }))).toEqual([
      ['chr1', '100', '200', 'gene1', '42', '+'],
    ])
  })

  it('substitutes a placeholder name and a zero score', () => {
    const f = new SimpleFeature({
      id: 'f1',
      data: { refName: 'chr1', start: 0, end: 10 },
    })
    expect(rows(stringifyBED({ features: [f] }))[0]).toEqual([
      'chr1',
      '0',
      '10',
      '.',
      '0',
      '.',
    ])
  })

  it('replaces whitespace in a name, which would shift every later column', () => {
    const f = createFeature({
      id: 'f1',
      refName: 'chr1',
      start: 0,
      end: 10,
      name: 'my gene\t1',
    })
    expect(rows(stringifyBED({ features: [f] }))[0]).toHaveLength(6)
    expect(rows(stringifyBED({ features: [f] }))[0]![3]).toBe('my_gene_1')
  })

  it('writes exons as BED12 blocks and CDS as the thick range', () => {
    const f = createFeature({
      id: 'mRNA1',
      refName: 'chr1',
      start: 100,
      end: 900,
      type: 'mRNA',
      name: 'tx1',
      strand: -1,
      subfeatures: [
        { id: 'e1', start: 100, end: 200, type: 'exon' },
        { id: 'e2', start: 800, end: 900, type: 'exon' },
        { id: 'c1', start: 150, end: 200, type: 'CDS' },
        { id: 'c2', start: 800, end: 850, type: 'CDS' },
      ],
    })
    expect(rows(stringifyBED({ features: [f] }))).toEqual([
      [
        'chr1',
        '100',
        '900',
        'tx1',
        '0',
        '-',
        '150',
        '850',
        '0',
        '2',
        '100,100,',
        '0,700,',
      ],
    ])
  })

  it('emits one row per transcript of a gene', () => {
    const f = createFeature({
      id: 'gene1',
      refName: 'chr1',
      start: 100,
      end: 900,
      type: 'gene',
      name: 'gene1',
      subfeatures: [
        {
          id: 'mRNA1',
          start: 100,
          end: 500,
          type: 'mRNA',
          name: 'tx1',
          subfeatures: [{ id: 'e1', start: 100, end: 500, type: 'exon' }],
        },
        {
          id: 'mRNA2',
          start: 200,
          end: 900,
          type: 'mRNA',
          name: 'tx2',
          subfeatures: [
            { id: 'e2', start: 200, end: 300, type: 'exon' },
            { id: 'e3', start: 700, end: 900, type: 'exon' },
          ],
        },
      ],
    })
    const out = rows(stringifyBED({ features: [f] }))
    expect(out.map(r => [r[1], r[2], r[3], r[9]])).toEqual([
      ['100', '500', 'tx1', '1'],
      ['200', '900', 'tx2', '2'],
    ])
  })

  it('pads every row to the same width when any needs blocks', () => {
    const flat = createFeature({
      id: 'f1',
      refName: 'chr1',
      start: 0,
      end: 10,
      name: 'flat',
    })
    const spliced = createFeature({
      id: 'f2',
      refName: 'chr1',
      start: 100,
      end: 900,
      name: 'spliced',
      subfeatures: [
        { id: 'e1', start: 100, end: 200, type: 'exon' },
        { id: 'e2', start: 800, end: 900, type: 'exon' },
      ],
    })
    const widths = rows(stringifyBED({ features: [flat, spliced] })).map(
      r => r.length,
    )
    expect(widths).toEqual([12, 12])
  })

  it('falls back to CDS blocks when a transcript has no exons', () => {
    const f = createFeature({
      id: 'mRNA1',
      refName: 'chr1',
      start: 100,
      end: 400,
      type: 'mRNA',
      subfeatures: [
        { id: 'c1', start: 100, end: 200, type: 'CDS' },
        { id: 'c2', start: 300, end: 400, type: 'CDS' },
      ],
    })
    const [row] = rows(stringifyBED({ features: [f] }))
    expect(row?.slice(6)).toEqual([
      '100',
      '400',
      '0',
      '2',
      '100,100,',
      '0,200,',
    ])
  })
})
