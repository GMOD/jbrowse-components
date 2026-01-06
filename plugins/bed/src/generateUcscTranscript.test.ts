import {
  generateUcscTranscript,
  isUcscTranscript,
} from './generateUcscTranscript'

describe('isUcscTranscript', () => {
  it('returns true when thickStart, blockCount, and non-zero strand are present', () => {
    expect(
      isUcscTranscript({ thickStart: 100, blockCount: 3, strand: 1 }),
    ).toBe(true)
    expect(
      isUcscTranscript({ thickStart: 100, blockCount: 3, strand: -1 }),
    ).toBe(true)
  })

  it('returns false when strand is 0', () => {
    expect(
      isUcscTranscript({ thickStart: 100, blockCount: 3, strand: 0 }),
    ).toBe(false)
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

  describe('exonFrames conversion', () => {
    it('matches GFF phase output for positive strand multi-exon gene', () => {
      // Real-world test case: exonFrames should produce same phases as GFF
      // exonFrames: [0, 1, 2, 2, 2, 0, 2, 1, 0, 0]
      // Expected phases: [0, 2, 1, 1, 1, 0, 1, 2, 0, 0]
      const result = generateUcscTranscript({
        uniqueId: 'real1',
        start: 0,
        end: 10000,
        refName: 'chr1',
        type: 'mRNA',
        strand: 1,
        thickStart: 0,
        thickEnd: 10000,
        blockCount: 10,
        blockSizes: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
        chromStarts: [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000],
        exonFrames: [0, 1, 2, 2, 2, 0, 2, 1, 0, 0],
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' },
          { type: 'block', start: 1000, end: 1100, refName: 'chr1' },
          { type: 'block', start: 2000, end: 2100, refName: 'chr1' },
          { type: 'block', start: 3000, end: 3100, refName: 'chr1' },
          { type: 'block', start: 4000, end: 4100, refName: 'chr1' },
          { type: 'block', start: 5000, end: 5100, refName: 'chr1' },
          { type: 'block', start: 6000, end: 6100, refName: 'chr1' },
          { type: 'block', start: 7000, end: 7100, refName: 'chr1' },
          { type: 'block', start: 8000, end: 8100, refName: 'chr1' },
          { type: 'block', start: 9000, end: 9100, refName: 'chr1' },
        ],
      })

      const phases = result.subfeatures.map(s => s.phase)
      // Frame to phase: 0→0, 1→2, 2→1
      expect(phases).toEqual([0, 2, 1, 1, 1, 0, 1, 2, 0, 0])
    })

    it('matches GFF phase output for negative strand multi-exon gene', () => {
      // Real-world test case from user: negative strand gene
      // BigBed exonFrames in genomic order should produce correct phases
      // exonFrames: [1, 2, 0, 0, 0] (in genomic order, low to high coords)
      // Expected phases: [2, 1, 0, 0, 0] (matching GFF)
      const result = generateUcscTranscript({
        uniqueId: 'real2',
        start: 0,
        end: 5000,
        refName: 'chr1',
        type: 'mRNA',
        strand: -1,
        thickStart: 0,
        thickEnd: 5000,
        blockCount: 5,
        blockSizes: [100, 100, 100, 100, 100],
        chromStarts: [0, 1000, 2000, 3000, 4000],
        exonFrames: [1, 2, 0, 0, 0], // genomic order from @gmod/bed
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' },
          { type: 'block', start: 1000, end: 1100, refName: 'chr1' },
          { type: 'block', start: 2000, end: 2100, refName: 'chr1' },
          { type: 'block', start: 3000, end: 3100, refName: 'chr1' },
          { type: 'block', start: 4000, end: 4100, refName: 'chr1' },
        ],
      })

      const phases = result.subfeatures.map(s => s.phase)
      // Frame to phase: 1→2, 2→1, 0→0, 0→0, 0→0
      expect(phases).toEqual([2, 1, 0, 0, 0])
    })

    it('prefers exonFrames over calculated phases when available', () => {
      // exonFrames should take precedence over calculation
      const result = generateUcscTranscript({
        uniqueId: 'pref1',
        start: 0,
        end: 300,
        refName: 'chr1',
        type: 'mRNA',
        strand: 1,
        thickStart: 0,
        thickEnd: 300,
        blockCount: 3,
        blockSizes: [100, 100, 100],
        chromStarts: [0, 100, 200],
        exonFrames: [0, 0, 0], // All frame 0, but calculated would give different values
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' },
          { type: 'block', start: 100, end: 200, refName: 'chr1' },
          { type: 'block', start: 200, end: 300, refName: 'chr1' },
        ],
      })

      // If calculated: 0, (3-100%3)%3=2, (3-200%3)%3=1
      // But exonFrames all 0 → all phase 0
      const phases = result.subfeatures.map(s => s.phase)
      expect(phases).toEqual([0, 0, 0])
    })
    it('converts exonFrames to phase using (3 - frame) % 3 formula', () => {
      // exonFrames uses UCSC frame convention, need to convert to GFF phase
      // Frame 0 → phase 0, Frame 1 → phase 2, Frame 2 → phase 1
      const result = generateUcscTranscript({
        uniqueId: 'exon1',
        start: 0,
        end: 300,
        refName: 'chr1',
        type: 'mRNA',
        strand: 1,
        thickStart: 0,
        thickEnd: 300,
        blockCount: 3,
        blockSizes: [100, 100, 100],
        chromStarts: [0, 100, 200],
        exonFrames: [0, 1, 2], // UCSC frames
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' },
          { type: 'block', start: 100, end: 200, refName: 'chr1' },
          { type: 'block', start: 200, end: 300, refName: 'chr1' },
        ],
      })

      // Frame 0 → phase 0, Frame 1 → phase 2, Frame 2 → phase 1
      expect(result.subfeatures).toEqual([
        { type: 'CDS', phase: 0, start: 0, end: 100, refName: 'chr1' },
        { type: 'CDS', phase: 2, start: 100, end: 200, refName: 'chr1' },
        { type: 'CDS', phase: 1, start: 200, end: 300, refName: 'chr1' },
      ])
    })

    it('handles _exonFrames (underscore prefix from BigBed)', () => {
      const result = generateUcscTranscript({
        uniqueId: 'exon2',
        start: 0,
        end: 200,
        refName: 'chr1',
        type: 'mRNA',
        strand: 1,
        thickStart: 0,
        thickEnd: 200,
        blockCount: 2,
        blockSizes: [100, 100],
        chromStarts: [0, 100],
        _exonFrames: [0, 2], // underscore prefix
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' },
          { type: 'block', start: 100, end: 200, refName: 'chr1' },
        ],
      })

      // Frame 0 → phase 0, Frame 2 → phase 1
      expect(result.subfeatures).toEqual([
        { type: 'CDS', phase: 0, start: 0, end: 100, refName: 'chr1' },
        { type: 'CDS', phase: 1, start: 100, end: 200, refName: 'chr1' },
      ])
    })

    it('uses exonFrames directly for negative strand (already in genomic order)', () => {
      const result = generateUcscTranscript({
        uniqueId: 'exon3',
        start: 0,
        end: 300,
        refName: 'chr1',
        type: 'mRNA',
        strand: -1,
        thickStart: 0,
        thickEnd: 300,
        blockCount: 3,
        blockSizes: [100, 100, 100],
        chromStarts: [0, 100, 200],
        exonFrames: [1, 2, 0], // already in genomic order from @gmod/bed parser
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' },
          { type: 'block', start: 100, end: 200, refName: 'chr1' },
          { type: 'block', start: 200, end: 300, refName: 'chr1' },
        ],
      })

      // Frame 1 → phase 2, Frame 2 → phase 1, Frame 0 → phase 0
      expect(result.subfeatures).toEqual([
        { type: 'CDS', phase: 2, start: 0, end: 100, refName: 'chr1' },
        { type: 'CDS', phase: 1, start: 100, end: 200, refName: 'chr1' },
        { type: 'CDS', phase: 0, start: 200, end: 300, refName: 'chr1' },
      ])
    })

    it('treats exonFrames -1 as phase 0 (UTR marker)', () => {
      const result = generateUcscTranscript({
        uniqueId: 'exon4',
        start: 0,
        end: 300,
        refName: 'chr1',
        type: 'mRNA',
        strand: 1,
        thickStart: 100,
        thickEnd: 200,
        blockCount: 3,
        blockSizes: [100, 100, 100],
        chromStarts: [0, 100, 200],
        exonFrames: [-1, 0, -1], // -1 for UTR blocks
        subfeatures: [
          { type: 'block', start: 0, end: 100, refName: 'chr1' },
          { type: 'block', start: 100, end: 200, refName: 'chr1' },
          { type: 'block', start: 200, end: 300, refName: 'chr1' },
        ],
      })

      expect(result.subfeatures).toEqual([
        { type: 'five_prime_UTR', start: 0, end: 100, refName: 'chr1' },
        { type: 'CDS', phase: 0, start: 100, end: 200, refName: 'chr1' },
        { type: 'three_prime_UTR', start: 200, end: 300, refName: 'chr1' },
      ])
    })
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
