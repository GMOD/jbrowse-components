import { parseCigar } from './index'

test('handles empty string', () => {
  expect(parseCigar('')).toEqual([])
})

test('handles simple CIGAR strings', () => {
  expect(parseCigar('10M')).toEqual(['10', 'M'])
  expect(parseCigar('5M2I3M')).toEqual(['5', 'M', '2', 'I', '3', 'M'])
  expect(parseCigar('100M')).toEqual(['100', 'M'])
})

test('handles complex CIGAR strings', () => {
  expect(parseCigar('5M2D6M')).toEqual(['5', 'M', '2', 'D', '6', 'M'])
  expect(parseCigar('56M1D45M')).toEqual(['56', 'M', '1', 'D', '45', 'M'])
  expect(parseCigar('89M1I11M')).toEqual(['89', 'M', '1', 'I', '11', 'M'])
})

test('handles CIGAR strings with clipping', () => {
  expect(parseCigar('10S10M10S')).toEqual(['10', 'S', '10', 'M', '10', 'S'])
  expect(parseCigar('200H10M200H')).toEqual(['200', 'H', '10', 'M', '200', 'H'])
})

test('handles CIGAR strings with skips', () => {
  expect(parseCigar('6M200N6M')).toEqual(['6', 'M', '200', 'N', '6', 'M'])
  expect(parseCigar('3M200N3M200N3M')).toEqual([
    '3',
    'M',
    '200',
    'N',
    '3',
    'M',
    '200',
    'N',
    '3',
    'M',
  ])
})

test('handles all CIGAR operations', () => {
  expect(parseCigar('10M5I2D3S4H1N2P3X4=')).toEqual([
    '10',
    'M',
    '5',
    'I',
    '2',
    'D',
    '3',
    'S',
    '4',
    'H',
    '1',
    'N',
    '2',
    'P',
    '3',
    'X',
    '4',
    '=',
  ])
})
