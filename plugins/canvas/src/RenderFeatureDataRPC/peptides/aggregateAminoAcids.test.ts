import { aggregateAminos } from './aggregateAminoAcids.ts'

// g2p_mapper iterates reverse strand positions as f.end-1 down to f.start,
// so g2p[featureEnd] is always undefined and g2p[featureStart] is always set.
function makeReverseG2p(start: number, end: number) {
  const g2p: Record<number, number> = {}
  let counter = 0
  for (let pos = end - 1; pos >= start; pos--) {
    g2p[pos] = Math.floor(counter++ / 3)
  }
  return g2p
}

function makeForwardG2p(start: number, end: number) {
  const g2p: Record<number, number> = {}
  let counter = 0
  for (let pos = start; pos < end; pos++) {
    g2p[pos] = Math.floor(counter++ / 3)
  }
  return g2p
}

describe('aggregateAminos', () => {
  it('forward strand: codon genomic ranges are correct', () => {
    // CDS [100,106): pos 100-102 → aa0 (M), pos 103-105 → aa1 (K)
    const g2p = makeForwardG2p(100, 106)
    const result = aggregateAminos('MK', g2p, 100, 106, 1)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ aminoAcid: 'M', startBp: 100, endBp: 103 })
    expect(result[1]).toMatchObject({ aminoAcid: 'K', startBp: 103, endBp: 106 })
  })

  it('reverse strand: codon genomic ranges are correct', () => {
    // CDS [100,106), reverse strand.
    // g2p_mapper yields 105,104,103 → aa0 (M) and 102,101,100 → aa1 (K)
    const g2p = makeReverseG2p(100, 106)
    const result = aggregateAminos('MK', g2p, 100, 106, -1)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ aminoAcid: 'M', startBp: 103, endBp: 106 })
    expect(result[1]).toMatchObject({ aminoAcid: 'K', startBp: 100, endBp: 103 })
  })

  it('reverse strand: featureStart position is included in mapping', () => {
    const g2p = makeReverseG2p(100, 103)
    const result = aggregateAminos('M', g2p, 100, 103, -1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      aminoAcid: 'M',
      startBp: 100,
      endBp: 103,
      isStopOrNonTriplet: false,
    })
  })

  it('isStopOrNonTriplet is true for stop codons', () => {
    const g2p = makeForwardG2p(100, 103)
    const result = aggregateAminos('*', g2p, 100, 103, 1)
    expect(result[0]).toMatchObject({ isStopOrNonTriplet: true })
  })

  it('isStopOrNonTriplet is true for partial codons', () => {
    // 2-bp CDS — one codon with only 2 positions (split exon boundary)
    const g2p = makeForwardG2p(100, 102)
    const result = aggregateAminos('MK', g2p, 100, 102, 1)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ isStopOrNonTriplet: true })
  })
})
