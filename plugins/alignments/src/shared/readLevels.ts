import {
  READ_SPLICED,
  READ_SPLIT,
  svSignalTier,
} from '@jbrowse/alignments-core'

import { pairingOf } from './pairing.ts'
import { SV_SIGNAL_OF_TIER } from './readFieldLevels.ts'

import type { Pairing, ReadLevelScheme } from './readFieldLevels.ts'

export interface ReadLevelData {
  readCategoryBits: Uint8Array
  readFlags: Uint16Array
  readPairOrientations: Uint8Array
}

// A scheme's levels by a small code per read, code 0 the baseline as `''`,
// so a bake is a table lookup and the present levels a bitmask.
interface LevelCodes {
  levels: readonly string[]
  codeOf: (data: ReadLevelData, i: number) => number
}

const PAIRING_CODE: Record<Pairing, number> = {
  concordant: 0,
  discordant: 1,
  unpaired: 2,
  nonPrimary: 3,
}

const LEVEL_CODES: Record<ReadLevelScheme, LevelCodes> = {
  split: {
    levels: ['', 'split'],
    codeOf: (data, i) => (data.readCategoryBits[i]! & READ_SPLIT ? 1 : 0),
  },
  spliced: {
    levels: ['', 'spliced'],
    codeOf: (data, i) => (data.readCategoryBits[i]! & READ_SPLICED ? 1 : 0),
  },
  pairing: {
    levels: ['', 'discordant', 'unpaired', 'nonPrimary'],
    codeOf: (data, i) =>
      PAIRING_CODE[
        pairingOf(data.readFlags[i]!, data.readPairOrientations[i]!)
      ],
  },
  svSignal: {
    levels: SV_SIGNAL_OF_TIER.map((level, tier) => (tier === 0 ? '' : level)),
    codeOf: (data, i) => svSignalTier(data.readCategoryBits[i]!),
  },
}

/**
 * One packed color per read, through each level's packed color once; `0`
 * for the baseline, which takes the plain fill.
 */
export function bakeReadLevels(
  scheme: ReadLevelScheme,
  data: ReadLevelData,
  packedOf: (level: string) => number,
) {
  const { levels, codeOf } = LEVEL_CODES[scheme]
  const table = levels.map(level => (level === '' ? 0 : packedOf(level)))
  const n = data.readFlags.length
  const out = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = table[codeOf(data, i)]!
  }
  return out
}

/** Adds the levels some read in `data` takes to `into`, the baseline as `''`. */
export function addPresentReadLevels(
  scheme: ReadLevelScheme,
  data: ReadLevelData,
  into: Set<string>,
) {
  const { levels, codeOf } = LEVEL_CODES[scheme]
  const all = (1 << levels.length) - 1
  let seen = 0
  const n = data.readFlags.length
  for (let i = 0; i < n && seen !== all; i++) {
    seen |= 1 << codeOf(data, i)
  }
  levels.forEach((level, code) => {
    if (seen & (1 << code)) {
      into.add(level)
    }
  })
}
