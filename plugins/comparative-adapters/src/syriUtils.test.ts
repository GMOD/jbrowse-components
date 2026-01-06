import {
  buildChromosomeMapping,
  computeSyriTypes,
} from './syriUtils.ts'

describe('syriUtils', () => {
  describe('buildChromosomeMapping', () => {
    test('maps query to target with highest coverage', () => {
      const records = [
        { qname: 'chr1', qstart: 0, qend: 100000, tname: 'chrA', tstart: 0, tend: 100000, strand: 1 },
        { qname: 'chr1', qstart: 100000, qend: 200000, tname: 'chrA', tstart: 100000, tend: 200000, strand: 1 },
        { qname: 'chr1', qstart: 200000, qend: 250000, tname: 'chrB', tstart: 0, tend: 50000, strand: 1 },
      ]

      const mapping = buildChromosomeMapping(records)

      // chr1 has 200kb to chrA vs 50kb to chrB, so chrA is primary
      expect(mapping.get('chr1')).toBe('chrA')
    })

    test('handles multiple query chromosomes', () => {
      const records = [
        { qname: 'chr1', qstart: 0, qend: 100000, tname: 'chrA', tstart: 0, tend: 100000, strand: 1 },
        { qname: 'chr2', qstart: 0, qend: 100000, tname: 'chrB', tstart: 0, tend: 100000, strand: 1 },
        { qname: 'chr3', qstart: 0, qend: 50000, tname: 'chrA', tstart: 200000, tend: 250000, strand: 1 },
        { qname: 'chr3', qstart: 50000, qend: 150000, tname: 'chrC', tstart: 0, tend: 100000, strand: 1 },
      ]

      const mapping = buildChromosomeMapping(records)

      expect(mapping.get('chr1')).toBe('chrA')
      expect(mapping.get('chr2')).toBe('chrB')
      expect(mapping.get('chr3')).toBe('chrC') // 100kb to chrC vs 50kb to chrA
    })

    test('returns empty map for empty input', () => {
      const mapping = buildChromosomeMapping([])
      expect(mapping.size).toBe(0)
    })
  })

  describe('computeSyriTypes', () => {
    test('classifies SYN correctly', () => {
      const records = [
        { qname: 'chr1', qstart: 0, qend: 100000, tname: 'chrA', tstart: 0, tend: 100000, strand: 1 },
      ]

      const types = computeSyriTypes(records)
      expect(types[0]).toBe('SYN')
    })

    test('classifies INV correctly', () => {
      const records = [
        { qname: 'chr1', qstart: 0, qend: 100000, tname: 'chrA', tstart: 100000, tend: 0, strand: -1 },
      ]

      const types = computeSyriTypes(records)
      expect(types[0]).toBe('INV')
    })

    test('classifies TRANS correctly', () => {
      const records = [
        // Primary mapping to chrA
        { qname: 'chr1', qstart: 0, qend: 100000, tname: 'chrA', tstart: 0, tend: 100000, strand: 1 },
        { qname: 'chr1', qstart: 100000, qend: 200000, tname: 'chrA', tstart: 100000, tend: 200000, strand: 1 },
        // Translocation to chrB
        { qname: 'chr1', qstart: 200000, qend: 250000, tname: 'chrB', tstart: 0, tend: 50000, strand: 1 },
      ]

      const types = computeSyriTypes(records)
      expect(types[0]).toBe('SYN')
      expect(types[1]).toBe('SYN')
      expect(types[2]).toBe('TRANS')
    })

    test('classifies DUP for non-collinear mappings', () => {
      const records = [
        // Query positions close together, but target positions jump significantly
        { qname: 'chr1', qstart: 0, qend: 100000, tname: 'chrA', tstart: 0, tend: 100000, strand: 1 },
        { qname: 'chr1', qstart: 110000, qend: 200000, tname: 'chrA', tstart: 500000, tend: 590000, strand: 1 },
      ]

      const types = computeSyriTypes(records)
      expect(types[0]).toBe('DUP')
      expect(types[1]).toBe('DUP')
    })

    test('does not classify as DUP when gaps are proportional', () => {
      const records = [
        { qname: 'chr1', qstart: 0, qend: 100000, tname: 'chrA', tstart: 0, tend: 100000, strand: 1 },
        { qname: 'chr1', qstart: 150000, qend: 250000, tname: 'chrA', tstart: 150000, tend: 250000, strand: 1 },
      ]

      const types = computeSyriTypes(records)
      expect(types[0]).toBe('SYN')
      expect(types[1]).toBe('SYN')
    })

    test('handles complex mixed scenario', () => {
      const records = [
        // chr1 -> chrA (SYN)
        { qname: 'chr1', qstart: 0, qend: 100000, tname: 'chrA', tstart: 0, tend: 100000, strand: 1 },
        // chr1 -> chrA (INV)
        { qname: 'chr1', qstart: 100000, qend: 200000, tname: 'chrA', tstart: 200000, tend: 100000, strand: -1 },
        // chr1 -> chrB (TRANS - chr1 primarily maps to chrA)
        { qname: 'chr1', qstart: 200000, qend: 220000, tname: 'chrB', tstart: 0, tend: 20000, strand: 1 },
        // chr2 -> chrB (SYN)
        { qname: 'chr2', qstart: 0, qend: 100000, tname: 'chrB', tstart: 0, tend: 100000, strand: 1 },
      ]

      const types = computeSyriTypes(records)
      expect(types[0]).toBe('SYN')
      expect(types[1]).toBe('INV')
      expect(types[2]).toBe('TRANS')
      expect(types[3]).toBe('SYN')
    })

    test('returns empty array for empty input', () => {
      const types = computeSyriTypes([])
      expect(types).toEqual([])
    })
  })
})
