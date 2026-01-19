import {
  calculateScore,
  calculateIdentity,
  calculateQueryCoverage,
} from './blatQuery.ts'

import type { BlatResult } from './blatQuery.ts'

describe('blatQuery utilities', () => {
  describe('calculateScore', () => {
    it('should calculate score correctly', () => {
      const result: BlatResult = {
        matches: 100,
        misMatches: 5,
        repMatches: 0,
        nCount: 0,
        qNumInsert: 2,
        qBaseInsert: 10,
        tNumInsert: 1,
        tBaseInsert: 5,
        strand: '+',
        qName: 'query',
        qSize: 110,
        qStart: 0,
        qEnd: 110,
        tName: 'chr1',
        tSize: 1000000,
        tStart: 1000,
        tEnd: 1110,
        blockCount: 1,
        blockSizes: [110],
        qStarts: [0],
        tStarts: [1000],
      }
      expect(calculateScore(result)).toBe(92)
    })

    it('should handle zero values', () => {
      const result: BlatResult = {
        matches: 50,
        misMatches: 0,
        repMatches: 0,
        nCount: 0,
        qNumInsert: 0,
        qBaseInsert: 0,
        tNumInsert: 0,
        tBaseInsert: 0,
        strand: '+',
        qName: 'query',
        qSize: 50,
        qStart: 0,
        qEnd: 50,
        tName: 'chr1',
        tSize: 1000000,
        tStart: 1000,
        tEnd: 1050,
        blockCount: 1,
        blockSizes: [50],
        qStarts: [0],
        tStarts: [1000],
      }
      expect(calculateScore(result)).toBe(50)
    })
  })

  describe('calculateIdentity', () => {
    it('should calculate identity correctly', () => {
      const result: BlatResult = {
        matches: 90,
        misMatches: 10,
        repMatches: 0,
        nCount: 0,
        qNumInsert: 0,
        qBaseInsert: 0,
        tNumInsert: 0,
        tBaseInsert: 0,
        strand: '+',
        qName: 'query',
        qSize: 100,
        qStart: 0,
        qEnd: 100,
        tName: 'chr1',
        tSize: 1000000,
        tStart: 1000,
        tEnd: 1100,
        blockCount: 1,
        blockSizes: [100],
        qStarts: [0],
        tStarts: [1000],
      }
      expect(calculateIdentity(result)).toBe(90)
    })

    it('should include repMatches in identity', () => {
      const result: BlatResult = {
        matches: 80,
        misMatches: 10,
        repMatches: 10,
        nCount: 0,
        qNumInsert: 0,
        qBaseInsert: 0,
        tNumInsert: 0,
        tBaseInsert: 0,
        strand: '+',
        qName: 'query',
        qSize: 100,
        qStart: 0,
        qEnd: 100,
        tName: 'chr1',
        tSize: 1000000,
        tStart: 1000,
        tEnd: 1100,
        blockCount: 1,
        blockSizes: [100],
        qStarts: [0],
        tStarts: [1000],
      }
      expect(calculateIdentity(result)).toBe(90)
    })

    it('should return 0 for zero aligned bases', () => {
      const result: BlatResult = {
        matches: 0,
        misMatches: 0,
        repMatches: 0,
        nCount: 0,
        qNumInsert: 0,
        qBaseInsert: 0,
        tNumInsert: 0,
        tBaseInsert: 0,
        strand: '+',
        qName: 'query',
        qSize: 100,
        qStart: 0,
        qEnd: 0,
        tName: 'chr1',
        tSize: 1000000,
        tStart: 1000,
        tEnd: 1000,
        blockCount: 0,
        blockSizes: [],
        qStarts: [],
        tStarts: [],
      }
      expect(calculateIdentity(result)).toBe(0)
    })
  })

  describe('calculateQueryCoverage', () => {
    it('should calculate coverage correctly', () => {
      const result: BlatResult = {
        matches: 50,
        misMatches: 0,
        repMatches: 0,
        nCount: 0,
        qNumInsert: 0,
        qBaseInsert: 0,
        tNumInsert: 0,
        tBaseInsert: 0,
        strand: '+',
        qName: 'query',
        qSize: 100,
        qStart: 25,
        qEnd: 75,
        tName: 'chr1',
        tSize: 1000000,
        tStart: 1000,
        tEnd: 1050,
        blockCount: 1,
        blockSizes: [50],
        qStarts: [25],
        tStarts: [1000],
      }
      expect(calculateQueryCoverage(result)).toBe(50)
    })

    it('should return 100% for full coverage', () => {
      const result: BlatResult = {
        matches: 100,
        misMatches: 0,
        repMatches: 0,
        nCount: 0,
        qNumInsert: 0,
        qBaseInsert: 0,
        tNumInsert: 0,
        tBaseInsert: 0,
        strand: '+',
        qName: 'query',
        qSize: 100,
        qStart: 0,
        qEnd: 100,
        tName: 'chr1',
        tSize: 1000000,
        tStart: 1000,
        tEnd: 1100,
        blockCount: 1,
        blockSizes: [100],
        qStarts: [0],
        tStarts: [1000],
      }
      expect(calculateQueryCoverage(result)).toBe(100)
    })

    it('should return 0 for zero query size', () => {
      const result: BlatResult = {
        matches: 0,
        misMatches: 0,
        repMatches: 0,
        nCount: 0,
        qNumInsert: 0,
        qBaseInsert: 0,
        tNumInsert: 0,
        tBaseInsert: 0,
        strand: '+',
        qName: 'query',
        qSize: 0,
        qStart: 0,
        qEnd: 0,
        tName: 'chr1',
        tSize: 1000000,
        tStart: 1000,
        tEnd: 1000,
        blockCount: 0,
        blockSizes: [],
        qStarts: [],
        tStarts: [],
      }
      expect(calculateQueryCoverage(result)).toBe(0)
    })
  })
})
