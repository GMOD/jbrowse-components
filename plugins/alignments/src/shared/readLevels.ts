import {
  READ_SPLICED,
  READ_SPLIT,
  svSignalTier,
} from '@jbrowse/alignments-core'

import { pairingOf } from './pairing.ts'
import { BASELINE_LEVEL, SV_SIGNAL_OF_TIER } from './readFieldLevels.ts'

import type { ReadLevelScheme } from './readFieldLevels.ts'

export interface ReadLevelData {
  readCategoryBits: Uint8Array
  readFlags: Uint16Array
  readPairOrientations: Uint8Array
}

type LevelReader = (data: ReadLevelData, i: number) => string

const READERS: Record<ReadLevelScheme, LevelReader> = {
  split: (data, i) => (data.readCategoryBits[i]! & READ_SPLIT ? 'split' : ''),
  spliced: (data, i) =>
    data.readCategoryBits[i]! & READ_SPLICED ? 'spliced' : '',
  pairing: (data, i) => {
    const pairing = pairingOf(data.readFlags[i]!, data.readPairOrientations[i]!)
    return pairing === BASELINE_LEVEL.pairing ? '' : pairing
  },
  svSignal: (data, i) => {
    const tier = svSignalTier(data.readCategoryBits[i]!)
    return tier === 0 ? '' : SV_SIGNAL_OF_TIER[tier]!
  },
}

/**
 * Each read's level of `scheme`, `''` for its baseline level, which takes
 * the plain fill.
 */
export function readLevelValues(
  scheme: ReadLevelScheme,
  data: ReadLevelData,
): string[] {
  const read = READERS[scheme]
  const n = data.readFlags.length
  const out = new Array<string>(n)
  for (let i = 0; i < n; i++) {
    out[i] = read(data, i)
  }
  return out
}
