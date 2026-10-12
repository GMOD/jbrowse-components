import {
  READ_DISCORDANT,
  READ_SPLIT,
  READ_SV_DELETION,
  saIsPlaced,
  svSignalTier,
  withSvTier,
} from './readCategoryBits.ts'

const placedSA = 'chr2,1000,+,50S100M,60,0;'
const ambiguousSA = 'chr2,1000,+,50S100M,0,0;chr9,5000,-,100M50S,0,3;'

test('an SA tag is placed when some piece has MAPQ above 0', () => {
  expect(saIsPlaced(placedSA)).toBe(true)
  expect(saIsPlaced(ambiguousSA)).toBe(false)
  expect(saIsPlaced(`${ambiguousSA}chr3,1,+,150M,1,0;`)).toBe(true)
  expect(saIsPlaced('')).toBe(true)
})

test.each([
  ['a split read with a placed piece', READ_SPLIT, 60, placedSA, undefined, 3],
  [
    'a split read whose pieces sit at MAPQ 0',
    READ_SPLIT,
    60,
    ambiguousSA,
    undefined,
    0,
  ],
  ['a split read at MAPQ 0 itself', READ_SPLIT, 0, placedSA, undefined, 0],
  [
    'a supplementary whose SA the source dropped',
    READ_SPLIT,
    60,
    '',
    undefined,
    3,
  ],
  ['an SV-size deletion', READ_SV_DELETION, 60, '', undefined, 2],
  ['an SV-size deletion at MAPQ 0', READ_SV_DELETION, 0, '', undefined, 0],
  [
    'a discordant read in a file without MQ',
    READ_DISCORDANT,
    60,
    '',
    undefined,
    1,
  ],
  ['a discordant read whose mate is placed', READ_DISCORDANT, 60, '', 37, 1],
  [
    'a discordant read whose mate sits at MAPQ 0',
    READ_DISCORDANT,
    60,
    '',
    0,
    0,
  ],
  [
    'a discordant read at MAPQ 255, "unavailable"',
    READ_DISCORDANT,
    255,
    '',
    undefined,
    1,
  ],
  [
    'an ambiguous split read that also carries an SV-size deletion',
    READ_SPLIT | READ_SV_DELETION,
    60,
    ambiguousSA,
    undefined,
    2,
  ],
])('%s', (_, bits, mapq, sa, mateMapq, tier) => {
  const stored = withSvTier(bits, mapq, sa, mateMapq)
  expect(svSignalTier(stored)).toBe(tier)
  expect(stored & 31).toBe(bits)
})
