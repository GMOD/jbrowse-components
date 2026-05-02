import {
  coarseRowsToGfa,
  parseCoarseLine,
} from '../coarseSubgraphReader.ts'

test('parseCoarseLine_header_returns_null', () => {
  expect(parseCoarseLine('#schema=graph-coarse/v1')).toBeNull()
  expect(parseCoarseLine('#engine=tile')).toBeNull()
})

test('parseCoarseLine_parses_tile_row', () => {
  const row = parseCoarseLine('ctgA\t0\t10677\t0\ttile\t0-112')
  expect(row).toEqual({ refStart: 0, refEnd: 10677, superOrd: 0 })
})

test('parseCoarseLine_parses_second_tile', () => {
  const row = parseCoarseLine('ctgA\t10677\t20691\t113\ttile\t113-231')
  expect(row).toEqual({ refStart: 10677, refEnd: 20691, superOrd: 113 })
})

test('coarseRowsToGfa_header_always_present', () => {
  expect(coarseRowsToGfa([])).toBe('H\tVN:Z:1.1')
})

test('coarseRowsToGfa_emits_slines', () => {
  const rows = [
    { refStart: 0, refEnd: 10000, superOrd: 0 },
    { refStart: 10000, refEnd: 20000, superOrd: 100 },
  ]
  const gfa = coarseRowsToGfa(rows)
  const lines = gfa.split('\n')
  expect(lines[0]).toBe('H\tVN:Z:1.1')
  expect(lines[1]).toBe('S\t0\t*\tLN:i:10000')
  expect(lines[2]).toBe('S\t100\t*\tLN:i:10000')
})

test('coarseRowsToGfa_lni_is_ref_span', () => {
  const rows = [{ refStart: 5000, refEnd: 7500, superOrd: 42 }]
  const gfa = coarseRowsToGfa(rows)
  expect(gfa).toContain('LN:i:2500')
})
