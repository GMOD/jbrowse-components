import { coarseRowsToGfa, parseCoarseLine } from '../coarseSubgraphReader.ts'

test('parseCoarseLine_header_returns_null', () => {
  expect(parseCoarseLine('#schema=graph-coarse/v1')).toBeNull()
  expect(parseCoarseLine('#engine=tile')).toBeNull()
})

test('parseCoarseLine_parses_tile_row', () => {
  const row = parseCoarseLine('ctgA\t0\t10677\t0\ttile\t0-112')
  expect(row).toEqual({
    refStart: 0,
    refEnd: 10677,
    superOrd: 0,
    type: 'tile',
    hapCount: 0,
  })
})

test('parseCoarseLine_parses_second_tile', () => {
  const row = parseCoarseLine('ctgA\t10677\t20691\t113\ttile\t113-231')
  expect(row).toEqual({
    refStart: 10677,
    refEnd: 20691,
    superOrd: 113,
    type: 'tile',
    hapCount: 0,
  })
})

test('parseCoarseLine_parses_v2_snarl_row', () => {
  const row = parseCoarseLine(
    'grch38#0#chr20\t48000\t48010\t42\tsnarl\t12\t42,205',
  )
  expect(row).toEqual({
    refStart: 48000,
    refEnd: 48010,
    superOrd: 42,
    type: 'snarl',
    hapCount: 12,
  })
})

test('parseCoarseLine_parses_v2_chain_row', () => {
  const row = parseCoarseLine(
    'CHM13#1#chr20\t49000\t99000\t42\tchain\t0\t42-203',
  )
  expect(row).toEqual({
    refStart: 49000,
    refEnd: 99000,
    superOrd: 42,
    type: 'chain',
    hapCount: 0,
  })
})

test('parseCoarseLine_too_few_cols_returns_null', () => {
  expect(parseCoarseLine('ctgA\t0\t10677\t0\ttile')).toBeNull()
})

test('coarseRowsToGfa_header_always_present', () => {
  expect(coarseRowsToGfa([])).toBe('H\tVN:Z:1.1')
})

test('coarseRowsToGfa_emits_slines_with_type', () => {
  const rows = [
    { refStart: 0, refEnd: 10000, superOrd: 0, type: 'chain', hapCount: 0 },
    {
      refStart: 10000,
      refEnd: 20000,
      superOrd: 100,
      type: 'snarl',
      hapCount: 5,
    },
  ]
  const gfa = coarseRowsToGfa(rows)
  const lines = gfa.split('\n')
  expect(lines[0]).toBe('H\tVN:Z:1.1')
  expect(lines[1]).toBe('S\t0\t*\tLN:i:10000\ttp:Z:chain')
  expect(lines[2]).toBe('S\t100\t*\tLN:i:10000\ttp:Z:snarl\thc:i:5')
})

test('coarseRowsToGfa_lni_is_ref_span', () => {
  const rows = [
    { refStart: 5000, refEnd: 7500, superOrd: 42, type: 'snarl', hapCount: 3 },
  ]
  const gfa = coarseRowsToGfa(rows)
  expect(gfa).toContain('LN:i:2500')
})

test('coarseRowsToGfa_hap_count_tag_only_when_nonzero', () => {
  const chain = coarseRowsToGfa([
    { refStart: 0, refEnd: 1000, superOrd: 1, type: 'chain', hapCount: 0 },
  ])
  expect(chain).not.toContain('hc:i:')
  const snarl = coarseRowsToGfa([
    { refStart: 0, refEnd: 1000, superOrd: 1, type: 'snarl', hapCount: 12 },
  ])
  expect(snarl).toContain('hc:i:12')
})
