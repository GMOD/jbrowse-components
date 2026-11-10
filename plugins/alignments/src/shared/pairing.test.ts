import { discordantBit } from '@jbrowse/alignments-core'

import { pairingOf } from './pairing.ts'

const FLAG_BITS = [0x1, 0x2, 0x8, 0x10, 0x20, 0x100, 0x800]
const ORIENTATION_NUMS = [0, 1, 2, 3, 4]

const FLAG_COMBINATIONS = Array.from(
  { length: 1 << FLAG_BITS.length },
  (_, i) =>
    FLAG_BITS.reduce(
      (flags, bit, b) => (i & (1 << b) ? flags | bit : flags),
      0,
    ),
)

const CASES = FLAG_COMBINATIONS.flatMap(flags =>
  ORIENTATION_NUMS.map(orientation => ({ flags, orientation })),
)

test('Pair status files a read as discordant exactly when SV evidence counts it a discordant pair', () => {
  const disagreements = CASES.filter(
    ({ flags, orientation }) =>
      (pairingOf(flags, orientation) === 'discordant') !==
      (discordantBit(flags, orientation) !== 0),
  )
  expect(disagreements).toEqual([])
})
