import { SequenceFeatureDetailsF } from './model.ts'

afterEach(() => {
  localStorage.clear()
})

describe('hasExonOrCDS', () => {
  test('feature with CDS only is true (no exon subfeatures)', () => {
    const model = SequenceFeatureDetailsF().create()
    model.setFeature({
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mRNA',
      subfeatures: [
        { refName: 'chr1', start: 0, end: 100, type: 'CDS' },
      ],
    })
    expect(model.hasCDS).toBe(true)
    expect(model.hasExon).toBe(false)
    expect(model.hasExonOrCDS).toBe(true)
  })

  test('feature with exon only is true', () => {
    const model = SequenceFeatureDetailsF().create()
    model.setFeature({
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mRNA',
      subfeatures: [
        { refName: 'chr1', start: 0, end: 100, type: 'exon' },
      ],
    })
    expect(model.hasExon).toBe(true)
    expect(model.hasExonOrCDS).toBe(true)
  })

  test('feature with neither is false', () => {
    const model = SequenceFeatureDetailsF().create()
    model.setFeature({
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'region',
      subfeatures: [],
    })
    expect(model.hasExonOrCDS).toBe(false)
  })

  test('mature_protein_region_of_cds counts as CDS', () => {
    const model = SequenceFeatureDetailsF().create()
    model.setFeature({
      uniqueId: 'a',
      refName: 'chr1',
      start: 0,
      end: 100,
      type: 'mature_protein_region_of_cds',
    })
    expect(model.hasCDS).toBe(true)
    expect(model.hasExonOrCDS).toBe(true)
  })
})
