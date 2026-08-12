import { transcriptPosition } from './transcriptPosition.ts'

import type { TranscriptCoords } from '../RenderFeatureDataRPC/rpcTypes.ts'

// The coordinate alone, which is what most of these assert: the exon numbering
// riding alongside it gets its own describe below.
const hgvsAt = (coords: TranscriptCoords, bpPos: number) =>
  transcriptPosition(coords, bpPos)?.hgvs

// Three 100bp exons at 0-100, 200-300, 400-500 with coding 50..450, on the +
// strand. So c.1 is genomic 50, exon 1 contributes c.1..c.50, exon 2 c.51..c.150
// (genomic 200..299), exon 3 c.151..c.200 then the 3' UTR from genomic 450.
const FORWARD: TranscriptCoords = {
  exons: [0, 100, 200, 300, 400, 500],
  strand: 1,
  coding: [50, 450],
}

// The same transcript on the - strand: exons listed high-to-low, and the start
// codon is at the high end of the coding extent (genomic 449).
const REVERSE: TranscriptCoords = {
  exons: [400, 500, 200, 300, 0, 100],
  strand: -1,
  coding: [50, 450],
}

describe('transcriptPosition on a + strand transcript', () => {
  it('numbers coding bases from the start codon', () => {
    expect(hgvsAt(FORWARD, 50)).toBe('c.1')
    expect(hgvsAt(FORWARD, 99)).toBe('c.50')
    // exon 2 picks up where exon 1 left off -- the intron is not counted
    expect(hgvsAt(FORWARD, 200)).toBe('c.51')
    expect(hgvsAt(FORWARD, 449)).toBe('c.200')
  })

  it('numbers the 5-prime UTR backwards from the start codon', () => {
    expect(hgvsAt(FORWARD, 49)).toBe('c.-1')
    expect(hgvsAt(FORWARD, 0)).toBe('c.-50')
  })

  it('marks bases past the stop codon with a star', () => {
    expect(hgvsAt(FORWARD, 450)).toBe('c.*1')
    expect(hgvsAt(FORWARD, 499)).toBe('c.*50')
  })

  // The canonical splice-site notation: +1/+2 are the donor dinucleotide, -2/-1
  // the acceptor.
  it('offsets intronic bases from the nearer exon', () => {
    expect(hgvsAt(FORWARD, 100)).toBe('c.50+1')
    expect(hgvsAt(FORWARD, 101)).toBe('c.50+2')
    expect(hgvsAt(FORWARD, 199)).toBe('c.51-1')
    expect(hgvsAt(FORWARD, 198)).toBe('c.51-2')
  })

  it('offsets intronic bases in the UTRs too', () => {
    const utrIntron: TranscriptCoords = {
      exons: [0, 100, 200, 300],
      strand: 1,
      coding: [250, 300],
    }
    // The 5' UTR runs from transcribed index 0 to 149 (c.-150 … c.-1). Genomic
    // 100 is the first intron base, measured from the last base of exon 1 —
    // index 99, i.e. c.-51.
    expect(hgvsAt(utrIntron, 100)).toBe('c.-51+1')
  })

  it('reports nothing outside the transcript', () => {
    expect(hgvsAt(FORWARD, 600)).toBeUndefined()
  })
})

describe('transcriptPosition on a - strand transcript', () => {
  it('counts from the high-coordinate end', () => {
    expect(hgvsAt(REVERSE, 449)).toBe('c.1')
    expect(hgvsAt(REVERSE, 400)).toBe('c.50')
    expect(hgvsAt(REVERSE, 299)).toBe('c.51')
    expect(hgvsAt(REVERSE, 50)).toBe('c.200')
  })

  it('puts the 5-prime UTR above the coding extent', () => {
    expect(hgvsAt(REVERSE, 450)).toBe('c.-1')
    expect(hgvsAt(REVERSE, 499)).toBe('c.-50')
  })

  it('marks bases past the stop codon with a star', () => {
    expect(hgvsAt(REVERSE, 49)).toBe('c.*1')
    expect(hgvsAt(REVERSE, 0)).toBe('c.*50')
  })

  // Genomic 399 is the base just below exon 1, i.e. the FIRST intron base in
  // transcription order -- so it is +1, not -1.
  it('offsets introns in transcription order, not genomic order', () => {
    expect(hgvsAt(REVERSE, 399)).toBe('c.50+1')
    expect(hgvsAt(REVERSE, 300)).toBe('c.51-1')
  })
})

describe('transcriptPosition on a non-coding transcript', () => {
  const lncRNA: TranscriptCoords = {
    exons: [0, 100, 200, 300],
    strand: 1,
  }

  it('numbers n. from the first transcribed base', () => {
    expect(hgvsAt(lncRNA, 0)).toBe('n.1')
    expect(hgvsAt(lncRNA, 99)).toBe('n.100')
    expect(hgvsAt(lncRNA, 200)).toBe('n.101')
    expect(hgvsAt(lncRNA, 100)).toBe('n.100+1')
  })

  // A coding extent starting inside an intron cannot be numbered from the A of a
  // start codon that is not transcribed. `n.` is NOT the answer: the transcript
  // codes, and saying `n.151` claims otherwise in the syntax a clinical variant
  // is written in. Only malformed annotation reaches this; the exon numbering
  // beside it is measured independently and still stands.
  it('names no coordinate when a coding transcript cannot be numbered', () => {
    const broken: TranscriptCoords = {
      exons: [0, 100, 200, 300],
      strand: 1,
      coding: [150, 300],
    }
    expect(hgvsAt(broken, 250)).toBeUndefined()
    expect(transcriptPosition(broken, 250)).toMatchObject({
      exonNumber: 2,
      exonCount: 2,
    })
  })
})

describe('transcriptPosition exon numbering', () => {
  it('reports the exon and its total', () => {
    expect(transcriptPosition(FORWARD, 250)).toMatchObject({
      exonNumber: 2,
      exonCount: 3,
      offset: 0,
    })
    expect(transcriptPosition(REVERSE, 250)).toMatchObject({
      exonNumber: 2,
      exonCount: 3,
      offset: 0,
    })
  })

  // A 5bp intron at 100..104: bases 1,2,3 measure forward and 4,5 back, so the
  // middle base is assigned to the 5' exon.
  it('assigns the middle base of an odd intron to the 5-prime exon', () => {
    const tight: TranscriptCoords = {
      exons: [0, 100, 105, 200],
      strand: 1,
      coding: [0, 200],
    }
    expect(hgvsAt(tight, 100)).toBe('c.100+1')
    expect(hgvsAt(tight, 102)).toBe('c.100+3')
    expect(hgvsAt(tight, 103)).toBe('c.101-2')
    expect(hgvsAt(tight, 104)).toBe('c.101-1')
  })
})
