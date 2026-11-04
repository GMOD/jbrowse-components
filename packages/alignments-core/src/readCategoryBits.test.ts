import {
  READ_DISCORDANT,
  READ_SPLIT,
  READ_SV_DELETION,
  svSignalTier,
  withSvTier,
} from './readCategoryBits.ts'

test.each([
  ['a split read whose placed pieces join', READ_SPLIT, 60, true, undefined, 3],
  [
    'a split read whose pieces make no junction between placed ones',
    READ_SPLIT,
    60,
    false,
    undefined,
    0,
  ],
  ['a split read at MAPQ 0 itself', READ_SPLIT, 0, true, undefined, 0],
  ['an SV-size deletion', READ_SV_DELETION, 60, false, undefined, 2],
  ['an SV-size deletion at MAPQ 0', READ_SV_DELETION, 0, false, undefined, 0],
  [
    'a discordant read in a file without MQ',
    READ_DISCORDANT,
    60,
    false,
    undefined,
    1,
  ],
  ['a discordant read whose mate is placed', READ_DISCORDANT, 60, false, 37, 1],
  [
    'a discordant read whose mate sits at MAPQ 0',
    READ_DISCORDANT,
    60,
    false,
    0,
    0,
  ],
  [
    'a discordant read at MAPQ 255, "unavailable"',
    READ_DISCORDANT,
    255,
    false,
    undefined,
    1,
  ],
  [
    'a split read with no junction that also carries an SV-size deletion',
    READ_SPLIT | READ_SV_DELETION,
    60,
    false,
    undefined,
    2,
  ],
])('%s', (_, bits, mapq, junction, mateMapq, tier) => {
  const stored = withSvTier(bits, mapq, junction, mateMapq)
  expect(svSignalTier(stored)).toBe(tier)
  expect(stored & 31).toBe(bits)
})
