import { comparativeTooltipLines } from './comparativeTooltipLines.ts'

const SIDES = [
  { label: 'x', loc: '{hg38}chr1:101..200', length: 100 },
  { label: 'y', loc: '{mm10}chr5:301..450', length: 150 },
] as const

function lines(overrides = {}) {
  return comparativeTooltipLines({
    sides: [...SIDES],
    inverted: false,
    attributes: {},
    ...overrides,
  })
}

// The order is the contract: both views render these as one text node, so the
// only thing that says "locations first, then the channels, then the name" is
// this list.
test('locations, inverted, lengths, then the channels', () => {
  expect(lines({ attributes: { identity: 0.9876 } })).toEqual([
    'x: {hg38}chr1:101..200',
    'y: {mm10}chr5:301..450',
    'Inverted: false',
    'x len: 100',
    'y len: 150',
    'Identity: 0.988',
  ])
})

// A dotplot's sides are its axes and a stacked view's are its rows, so the
// length label can't always be derived from the side's own name.
test('a side may name its length itself', () => {
  const named = comparativeTooltipLines({
    sides: [
      { ...SIDES[0], label: 'Loc1', lengthLabel: 'Query len' },
      { ...SIDES[1], label: 'Loc2', lengthLabel: 'Target len' },
    ],
    inverted: true,
    attributes: {},
  })
  expect(named).toEqual([
    'Loc1: {hg38}chr1:101..200',
    'Loc2: {mm10}chr5:301..450',
    'Inverted: true',
    'Query len: 100',
    'Target len: 150',
  ])
})

// Both optional lines, and the name last — a PAF carries neither, and an
// alignment file that carries a name puts it after the numbers.
test('the CIGAR operator and the name are dropped when absent', () => {
  expect(lines()).toHaveLength(5)
  const both = lines({ cigarOp: { op: 'D', length: 1200 }, name: 'BRCA1' })
  expect(both.slice(5)).toEqual(['CIGAR operator: 1,200D', 'Name: BRCA1'])
  // an empty name is the worker's "no name", not a name
  expect(lines({ name: '' })).toHaveLength(5)
})
