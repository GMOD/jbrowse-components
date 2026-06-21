import { aminoAcidsBySegment } from './aggregateAminoAcids.ts'

describe('aminoAcidsBySegment', () => {
  it('forward strand: codon genomic ranges are correct', () => {
    // CDS [100,106): 100-102 → aa0 (M), 103-105 → aa1 (K)
    const result = aminoAcidsBySegment([{ start: 100, end: 106 }], 'MK', 1)
    const pieces = result.get('100-106')!
    expect(pieces).toHaveLength(2)
    expect(pieces[0]).toMatchObject({
      aminoAcid: 'M',
      startBp: 100,
      endBp: 103,
      isStopOrNonTriplet: false,
    })
    expect(pieces[1]).toMatchObject({
      aminoAcid: 'K',
      startBp: 103,
      endBp: 106,
    })
  })

  it('reverse strand: codon genomic ranges are correct', () => {
    // CDS [100,106), reverse: codon0 is the highest-coordinate triplet
    const result = aminoAcidsBySegment([{ start: 100, end: 106 }], 'MK', -1)
    const pieces = result.get('100-106')!
    expect(pieces).toHaveLength(2)
    expect(pieces[0]).toMatchObject({
      aminoAcid: 'M',
      startBp: 103,
      endBp: 106,
    })
    expect(pieces[1]).toMatchObject({
      aminoAcid: 'K',
      startBp: 100,
      endBp: 103,
    })
  })

  it('partial codon (segment shorter than a triplet) is flagged', () => {
    const result = aminoAcidsBySegment([{ start: 100, end: 102 }], 'M', 1)
    const pieces = result.get('100-102')!
    expect(pieces).toHaveLength(1)
    expect(pieces[0]).toMatchObject({
      aminoAcid: 'M',
      startBp: 100,
      endBp: 102,
      isStopOrNonTriplet: true,
    })
  })

  it('stop codons are flagged', () => {
    const result = aminoAcidsBySegment([{ start: 100, end: 103 }], '*', 1)
    expect(result.get('100-103')![0]).toMatchObject({
      isStopOrNonTriplet: true,
    })
  })

  it('splits a codon that straddles an exon boundary into partial pieces', () => {
    // seg1 [100,102) holds the first 2 bases of codon0; codon0 finishes in
    // seg2 [200,205), so codon0 appears as a partial piece in both segments
    const result = aminoAcidsBySegment(
      [
        { start: 100, end: 102 },
        { start: 200, end: 205 },
      ],
      'MK',
      1,
    )
    const seg1 = result.get('100-102')!
    const seg2 = result.get('200-205')!
    expect(seg1).toHaveLength(1)
    expect(seg1[0]).toMatchObject({
      proteinIndex: 0,
      startBp: 100,
      endBp: 102,
      isStopOrNonTriplet: true,
    })
    // seg2 continues codon0 (1 base), then codon1 (full), then codon2 (partial)
    expect(seg2[0]).toMatchObject({
      proteinIndex: 0,
      startBp: 200,
      endBp: 201,
      isStopOrNonTriplet: true,
    })
    expect(seg2[1]).toMatchObject({
      proteinIndex: 1,
      startBp: 201,
      endBp: 204,
      isStopOrNonTriplet: false,
    })
  })

  it('reverse strand: splits a codon straddling an exon boundary', () => {
    // transcription order (reverse = descending genomic start): seg 200-205
    // transcribed first. codon0 (M) = [202,205); codon1 (K) takes the last 2
    // bases of seg1 ([200,202)) and the first base of seg2 ([101,102)); codon2
    // (L) = [100,101). protein index stays continuous across the boundary and
    // the higher-coordinate segment carries the lower index.
    const result = aminoAcidsBySegment(
      [
        { start: 200, end: 205 },
        { start: 100, end: 102 },
      ],
      'MKL',
      -1,
    )
    const seg1 = result.get('200-205')!
    const seg2 = result.get('100-102')!
    expect(seg1).toHaveLength(2)
    expect(seg1[0]).toMatchObject({
      aminoAcid: 'M',
      proteinIndex: 0,
      startBp: 202,
      endBp: 205,
      isStopOrNonTriplet: false,
    })
    expect(seg1[1]).toMatchObject({
      aminoAcid: 'K',
      proteinIndex: 1,
      startBp: 200,
      endBp: 202,
      isStopOrNonTriplet: true,
    })
    expect(seg2).toHaveLength(2)
    expect(seg2[0]).toMatchObject({
      aminoAcid: 'K',
      proteinIndex: 1,
      startBp: 101,
      endBp: 102,
      isStopOrNonTriplet: true,
    })
    expect(seg2[1]).toMatchObject({
      aminoAcid: 'L',
      proteinIndex: 2,
      startBp: 100,
      endBp: 101,
      isStopOrNonTriplet: true,
    })
  })

  it('flags residues set by a transl_except override', () => {
    const result = aminoAcidsBySegment(
      [{ start: 100, end: 106 }],
      'MK',
      1,
      new Set([1]),
    )
    const pieces = result.get('100-106')!
    expect(pieces[0]).toMatchObject({ proteinIndex: 0, isTranslExcept: false })
    expect(pieces[1]).toMatchObject({ proteinIndex: 1, isTranslExcept: true })
  })

  it('defaults isTranslExcept to false with no override set', () => {
    const result = aminoAcidsBySegment([{ start: 100, end: 106 }], 'MK', 1)
    expect(result.get('100-106')!.every(a => !a.isTranslExcept)).toBe(true)
  })

  it('phase>0 reserves protein index 0 for the leading partial codon', () => {
    // phase 1: 1 leading base is the tail of an upstream codon → index 0 = '&'
    const result = aminoAcidsBySegment(
      [{ start: 100, end: 107, phase: 1 }],
      '&MK',
      1,
    )
    const pieces = result.get('100-107')!
    expect(pieces[0]).toMatchObject({
      aminoAcid: '&',
      proteinIndex: 0,
      startBp: 100,
      endBp: 101,
      isStopOrNonTriplet: true,
    })
    expect(pieces[1]).toMatchObject({
      aminoAcid: 'M',
      proteinIndex: 1,
      startBp: 101,
      endBp: 104,
    })
  })
})
