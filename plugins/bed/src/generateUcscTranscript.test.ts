import {
  generateUcscTranscript,
  isUcscTranscript,
} from './generateUcscTranscript'

describe('isUcscTranscript', () => {
  it('returns true when thickStart, blockCount, and non-zero strand are present', () => {
    expect(isUcscTranscript({ thickStart: 100, blockCount: 3, strand: 1 })).toBe(
      true,
    )
    expect(
      isUcscTranscript({ thickStart: 100, blockCount: 3, strand: -1 }),
    ).toBe(true)
  })

  it('returns false when strand is 0', () => {
    expect(isUcscTranscript({ thickStart: 100, blockCount: 3, strand: 0 })).toBe(
      false,
    )
  })

  it('returns false when thickStart is missing', () => {
    expect(isUcscTranscript({ blockCount: 3, strand: 1 })).toBeFalsy()
  })

  it('returns false when blockCount is missing', () => {
    expect(isUcscTranscript({ thickStart: 100, strand: 1 })).toBeFalsy()
  })
})

describe('generateUcscTranscript', () => {
  it('generates correct subfeatures for positive strand transcript', () => {
    const result = generateUcscTranscript({
      uniqueId: 'test1',
      start: 1000,
      end: 2000,
      refName: 'chr1',
      type: 'mRNA',
      strand: 1,
      thickStart: 1100,
      thickEnd: 1900,
      blockCount: 3,
      blockSizes: [200, 300, 200],
      chromStarts: [0, 400, 800],
      subfeatures: [
        { type: 'block', start: 1000, end: 1200, refName: 'chr1' },
        { type: 'block', start: 1400, end: 1700, refName: 'chr1' },
        { type: 'block', start: 1800, end: 2000, refName: 'chr1' },
      ],
    })

    expect(result.type).toBe('mRNA')
    expect(result.strand).toBe(1)
    // Phases are calculated from cumulative CDS widths
    // CDS1: 1100-1200 (100bp), phase=0, cumulative=100
    // CDS2: 1400-1700 (300bp), phase=(3-100%3)%3=2, cumulative=400
    // CDS3: 1800-1900 (100bp), phase=(3-400%3)%3=2
    expect(result.subfeatures).toEqual([
      { type: 'five_prime_UTR', start: 1000, end: 1100, refName: 'chr1' },
      { type: 'CDS', phase: 0, start: 1100, end: 1200, refName: 'chr1' },
      { type: 'CDS', phase: 2, start: 1400, end: 1700, refName: 'chr1' },
      { type: 'CDS', phase: 2, start: 1800, end: 1900, refName: 'chr1' },
      { type: 'three_prime_UTR', start: 1900, end: 2000, refName: 'chr1' },
    ])
  })

  it('generates correct subfeatures for negative strand transcript', () => {
    const result = generateUcscTranscript({
      uniqueId: 'test2',
      start: 1000,
      end: 2000,
      refName: 'chr1',
      type: 'mRNA',
      strand: -1,
      thickStart: 1100,
      thickEnd: 1900,
      blockCount: 3,
      blockSizes: [200, 300, 200],
      chromStarts: [0, 400, 800],
      subfeatures: [
        { type: 'block', start: 1000, end: 1200, refName: 'chr1' },
        { type: 'block', start: 1400, end: 1700, refName: 'chr1' },
        { type: 'block', start: 1800, end: 2000, refName: 'chr1' },
      ],
    })

    expect(result.strand).toBe(-1)
    // For negative strand, 5' is at high coords, 3' is at low coords
    // Phases calculated in transcriptional order (high to low for minus)
    // CDS3: 1800-1900 (100bp), phase=0, cumulative=100
    // CDS2: 1400-1700 (300bp), phase=(3-100%3)%3=2, cumulative=400
    // CDS1: 1100-1200 (100bp), phase=(3-400%3)%3=2
    expect(result.subfeatures).toEqual([
      { type: 'three_prime_UTR', start: 1000, end: 1100, refName: 'chr1' },
      { type: 'CDS', phase: 2, start: 1100, end: 1200, refName: 'chr1' },
      { type: 'CDS', phase: 2, start: 1400, end: 1700, refName: 'chr1' },
      { type: 'CDS', phase: 0, start: 1800, end: 1900, refName: 'chr1' },
      { type: 'five_prime_UTR', start: 1900, end: 2000, refName: 'chr1' },
    ])
  })

  it('handles non-coding transcript (cdsStartStat and cdsEndStat are none)', () => {
    const result = generateUcscTranscript({
      uniqueId: 'test3',
      start: 1000,
      end: 2000,
      refName: 'chr1',
      type: 'transcript',
      strand: 1,
      thickStart: 1000,
      thickEnd: 1000,
      blockCount: 2,
      blockSizes: [200, 200],
      chromStarts: [0, 800],
      cdsStartStat: 'none',
      cdsEndStat: 'none',
      subfeatures: [
        { type: 'block', start: 1000, end: 1200, refName: 'chr1' },
        { type: 'block', start: 1800, end: 2000, refName: 'chr1' },
      ],
    })

    expect(result.type).toBe('transcript')
    expect(result.subfeatures).toEqual([
      { type: 'exon', start: 1000, end: 1200, refName: 'chr1' },
      { type: 'exon', start: 1800, end: 2000, refName: 'chr1' },
    ])
  })

  it('handles block entirely within UTR regions', () => {
    const result = generateUcscTranscript({
      uniqueId: 'test4',
      start: 1000,
      end: 3000,
      refName: 'chr1',
      type: 'mRNA',
      strand: 1,
      thickStart: 1500,
      thickEnd: 2500,
      blockCount: 4,
      blockSizes: [100, 100, 100, 100],
      chromStarts: [0, 600, 1200, 1900],
      subfeatures: [
        { type: 'block', start: 1000, end: 1100, refName: 'chr1' }, // entirely 5' UTR
        { type: 'block', start: 1600, end: 1700, refName: 'chr1' }, // entirely CDS
        { type: 'block', start: 2200, end: 2300, refName: 'chr1' }, // entirely CDS
        { type: 'block', start: 2900, end: 3000, refName: 'chr1' }, // entirely 3' UTR
      ],
    })

    // CDS1: 100bp, phase=0, cumulative=100
    // CDS2: 100bp, phase=(3-100%3)%3=2
    expect(result.subfeatures).toEqual([
      { type: 'five_prime_UTR', start: 1000, end: 1100, refName: 'chr1' },
      { type: 'CDS', phase: 0, start: 1600, end: 1700, refName: 'chr1' },
      { type: 'CDS', phase: 2, start: 2200, end: 2300, refName: 'chr1' },
      { type: 'three_prime_UTR', start: 2900, end: 3000, refName: 'chr1' },
    ])
  })

  it('excludes internal BED fields from output', () => {
    const result = generateUcscTranscript({
      uniqueId: 'test5',
      start: 1000,
      end: 1500,
      refName: 'chr1',
      type: 'mRNA',
      strand: 1,
      thickStart: 1000,
      thickEnd: 1500,
      blockCount: 1,
      blockSizes: [500],
      chromStarts: [0],
      chrom: 'chr1',
      chromStart: 1000,
      chromEnd: 1500,
      blockStarts: [0],
      name: 'gene1',
      subfeatures: [{ type: 'block', start: 1000, end: 1500, refName: 'chr1' }],
    })

    // These internal fields should not appear in output
    expect(result).not.toHaveProperty('chrom')
    expect(result).not.toHaveProperty('chromStart')
    expect(result).not.toHaveProperty('chromEnd')
    expect(result).not.toHaveProperty('chromStarts')
    expect(result).not.toHaveProperty('blockStarts')
    expect(result).not.toHaveProperty('blockSizes')
    expect(result).not.toHaveProperty('blockCount')

    // But other fields should be preserved
    expect(result.name).toBe('gene1')
    expect(result.uniqueId).toBe('test5')
  })

  it('sorts blocks by start position', () => {
    const result = generateUcscTranscript({
      uniqueId: 'test6',
      start: 1000,
      end: 2000,
      refName: 'chr1',
      type: 'mRNA',
      strand: 1,
      thickStart: 1000,
      thickEnd: 2000,
      blockCount: 3,
      blockSizes: [100, 100, 100],
      chromStarts: [0, 400, 800],
      // Blocks provided out of order
      subfeatures: [
        { type: 'block', start: 1800, end: 1900, refName: 'chr1' },
        { type: 'block', start: 1000, end: 1100, refName: 'chr1' },
        { type: 'block', start: 1400, end: 1500, refName: 'chr1' },
      ],
    })

    // Should be sorted by start position
    expect(result.subfeatures[0]!.start).toBe(1000)
    expect(result.subfeatures[1]!.start).toBe(1400)
    expect(result.subfeatures[2]!.start).toBe(1800)
  })

  describe('calculated phase', () => {
    it('calculates phase from cumulative CDS widths for positive strand', () => {
      // 3 CDS of varying sizes to test phase calculation
      const result = generateUcscTranscript({
        uniqueId: 'calc1',
        start: 0,
        end: 1000,
        refName: 'chr1',
        type: 'mRNA',
        strand: 1,
        thickStart: 0,
        thickEnd: 1000,
        blockCount: 3,
        blockSizes: [100, 50, 80],
        chromStarts: [0, 200, 400],
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' }, // 100bp
          { type: 'block', start: 200, end: 250, refName: 'chr1' }, // 50bp
          { type: 'block', start: 400, end: 480, refName: 'chr1' }, // 80bp
        ],
      })

      // CDS1: 100bp, phase=0 (first CDS), cumulative=100
      // CDS2: 50bp, phase=(3-100%3)%3=(3-1)%3=2, cumulative=150
      // CDS3: 80bp, phase=(3-150%3)%3=(3-0)%3=0
      expect(result.subfeatures).toEqual([
        { type: 'CDS', phase: 0, start: 0, end: 100, refName: 'chr1' },
        { type: 'CDS', phase: 2, start: 200, end: 250, refName: 'chr1' },
        { type: 'CDS', phase: 0, start: 400, end: 480, refName: 'chr1' },
      ])
    })

    it('calculates phase from cumulative CDS widths for negative strand', () => {
      // For negative strand, phase calculation starts from highest coordinate CDS
      const result = generateUcscTranscript({
        uniqueId: 'calc2',
        start: 0,
        end: 1000,
        refName: 'chr1',
        type: 'mRNA',
        strand: -1,
        thickStart: 0,
        thickEnd: 1000,
        blockCount: 3,
        blockSizes: [100, 50, 80],
        chromStarts: [0, 200, 400],
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' }, // 100bp
          { type: 'block', start: 200, end: 250, refName: 'chr1' }, // 50bp
          { type: 'block', start: 400, end: 480, refName: 'chr1' }, // 80bp
        ],
      })

      // Transcriptional order for minus strand: 400-480, 200-250, 0-100
      // CDS3 (400-480): 80bp, phase=0 (first in transcription), cumulative=80
      // CDS2 (200-250): 50bp, phase=(3-80%3)%3=(3-2)%3=1, cumulative=130
      // CDS1 (0-100): 100bp, phase=(3-130%3)%3=(3-1)%3=2
      expect(result.subfeatures).toEqual([
        { type: 'CDS', phase: 2, start: 0, end: 100, refName: 'chr1' },
        { type: 'CDS', phase: 1, start: 200, end: 250, refName: 'chr1' },
        { type: 'CDS', phase: 0, start: 400, end: 480, refName: 'chr1' },
      ])
    })

    it('calculates phase correctly when CDS is split by thickStart/thickEnd', () => {
      const result = generateUcscTranscript({
        uniqueId: 'calc3',
        start: 0,
        end: 500,
        refName: 'chr1',
        type: 'mRNA',
        strand: 1,
        thickStart: 50,
        thickEnd: 450,
        blockCount: 3,
        blockSizes: [100, 100, 100],
        chromStarts: [0, 200, 400],
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' }, // UTR 0-50, CDS 50-100
          { type: 'block', start: 200, end: 300, refName: 'chr1' }, // all CDS
          { type: 'block', start: 400, end: 500, refName: 'chr1' }, // CDS 400-450, UTR 450-500
        ],
      })

      // CDS regions after thickStart/thickEnd clipping:
      // CDS1: 50-100 (50bp), phase=0, cumulative=50
      // CDS2: 200-300 (100bp), phase=(3-50%3)%3=(3-2)%3=1, cumulative=150
      // CDS3: 400-450 (50bp), phase=(3-150%3)%3=(3-0)%3=0
      expect(result.subfeatures).toEqual([
        { type: 'five_prime_UTR', start: 0, end: 50, refName: 'chr1' },
        { type: 'CDS', phase: 0, start: 50, end: 100, refName: 'chr1' },
        { type: 'CDS', phase: 1, start: 200, end: 300, refName: 'chr1' },
        { type: 'CDS', phase: 0, start: 400, end: 450, refName: 'chr1' },
        { type: 'three_prime_UTR', start: 450, end: 500, refName: 'chr1' },
      ])
    })
  })
})
