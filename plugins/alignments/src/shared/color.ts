import { orientationTypes, pairMap } from '../util'

import type { ChainStats } from './types'
import type { Feature } from '@jbrowse/core/util'

/**
 * Numeric codes for pair types
 * Used to classify paired-end reads without relying on color string comparisons
 */
export const PairType = {
  /** Proper pair: correct orientation (LR) and normal insert size */
  PROPER_PAIR: 0,
  /** Long insert: same chromosome but insert size exceeds upper threshold */
  LONG_INSERT: 1,
  /** Short insert: same chromosome but insert size below lower threshold */
  SHORT_INSERT: 2,
  /** Inter-chromosome: mates on different chromosomes */
  INTER_CHROM: 3,
  /** Abnormal orientation: RR, RL, LL, etc. (not LR) */
  ABNORMAL_ORIENTATION: 4,
  /** Unmapped mate: mate is unmapped */
  UNMAPPED_MATE: 5,
} as const

export type PairTypeValue = (typeof PairType)[keyof typeof PairType]

export const fillColor = {
  color_fwd_strand_not_proper: '#ECC8C8',
  color_rev_strand_not_proper: '#BEBED8',
  color_fwd_strand: '#EC8B8B',
  color_rev_strand: '#8F8FD8',
  color_fwd_missing_mate: '#D11919',
  color_rev_missing_mate: '#1919D1',
  color_fwd_diff_chr: '#000',
  color_rev_diff_chr: '#969696',
  color_pair_lr: 'lightgrey',
  color_pair_rr: '#3a3a9d',
  color_pair_rl: 'teal',
  color_pair_ll: 'green',
  color_nostrand: '#c8c8c8',
  color_interchrom: 'purple',
  color_longinsert: 'red',
  color_shortinsert: 'pink',
  color_unmapped_mate: '#8B008B',
  color_unknown: 'grey',
  // Long-read split alignment orientation colors
  color_longread_rev_fwd: 'navy',
  color_longread_fwd_rev: 'green',
  color_longread_same: 'grey',
}

// manually calculated by running
// const color = require('color')
// Object.fromEntries(Object.entries(fillColor).map(([key,val])=>{
//   return [key, color(val).darken('0.3').hex()]
// }))
// this avoids (expensive) use of Color module at runtime
export const strokeColor = {
  color_fwd_strand_not_proper: '#CA6767',
  color_rev_strand_not_proper: '#7272AA',
  color_fwd_strand: '#DC2A2A',
  color_rev_strand: '#4141BA',
  color_fwd_missing_mate: '#921111',
  color_rev_missing_mate: '#111192',
  color_fwd_diff_chr: '#000000',
  color_rev_diff_chr: '#696969',
  color_pair_lr: '#8C8C8C',
  color_pair_rr: '#00002A',
  color_pair_rl: '#005A5A',
  color_pair_ll: '#005A00',
  color_nostrand: '#8C8C8C',
  color_interchrom: '#5A005A',
  color_longinsert: '#B30000',
  color_shortinsert: '#FF3A5C',
  color_unmapped_mate: '#5A005A',
  color_unknown: '#444',
  // Long-read split alignment orientation stroke colors
  color_longread_rev_fwd: '#00004D',
  color_longread_fwd_rev: '#005A00',
  color_longread_same: '#444',
}

const defaultColor = [
  fillColor.color_pair_lr,
  strokeColor.color_pair_lr,
] as const

/**
 * Get the pair type classification for a paired-end read
 * Used internally by color functions and externally for filtering logic
 *
 * @param type - Color scheme type (insertSizeAndOrientation, orientation, insertSize)
 * @param f - Feature with pair_orientation, tlen, flags, refName, and next_ref
 * @param stats - Optional statistics for insert size thresholds
 * @returns Numeric code representing the pair type
 */
export function getPairedType({
  type,
  f,
  stats,
}: {
  type: string
  f: {
    refName: string
    next_ref?: string
    pair_orientation?: string
    tlen?: number
    flags?: number
  }
  stats?: ChainStats
}): PairTypeValue {
  // Check for unmapped mate first (highest priority)
  if (f.flags !== undefined && f.flags & 8) {
    return PairType.UNMAPPED_MATE
  }

  // Check orientation first (if applicable)
  if (type === 'insertSizeAndOrientation' || type === 'orientation') {
    const orientationType = orientationTypes.fr
    const r = orientationType[f.pair_orientation || ''] as
      | keyof typeof pairMap
      | undefined
    // If orientation is not LR (proper), it's abnormal
    if (r && r !== 'LR') {
      return PairType.ABNORMAL_ORIENTATION
    }
  }

  // Check insert size (if applicable)
  if (type === 'insertSizeAndOrientation' || type === 'insertSize') {
    const sameRef = f.refName === f.next_ref
    const tlen = Math.abs(f.tlen || 0)

    if (!sameRef) {
      return PairType.INTER_CHROM
    }

    if (stats) {
      if (tlen > stats.upper) {
        return PairType.LONG_INSERT
      }
      if (tlen < stats.lower) {
        return PairType.SHORT_INSERT
      }
    }
  }

  // If all checks pass, it's a proper pair
  return PairType.PROPER_PAIR
}

/**
 * Get color for a paired-end read based on insert size only
 * Uses getPairedType() internally to determine classification
 */
export function getPairedInsertSizeColor(
  f: { refName: string; next_ref?: string; tlen?: number; flags?: number },
  stats?: ChainStats,
) {
  const pairType = getPairedType({
    type: 'insertSize',
    f,
    stats,
  })

  switch (pairType) {
    case PairType.UNMAPPED_MATE:
      return [
        fillColor.color_unmapped_mate,
        strokeColor.color_unmapped_mate,
      ] as const
    case PairType.LONG_INSERT:
      return [fillColor.color_longinsert, strokeColor.color_longinsert] as const
    case PairType.SHORT_INSERT:
      return [
        fillColor.color_shortinsert,
        strokeColor.color_shortinsert,
      ] as const
    case PairType.INTER_CHROM:
      return [fillColor.color_interchrom, strokeColor.color_interchrom] as const
    case PairType.PROPER_PAIR:
      return undefined
    default:
      return undefined
  }
}

/**
 * Get color for a paired-end read based on orientation only
 * Returns undefined for proper pairs (LR orientation)
 */
export function getPairedOrientationColorOrDefault(f: {
  pair_orientation?: string
  flags?: number
}) {
  // Check for unmapped mate first
  if (f.flags !== undefined && f.flags & 8) {
    return [
      fillColor.color_unmapped_mate,
      strokeColor.color_unmapped_mate,
    ] as const
  }

  const type = orientationTypes.fr
  const r = type[f.pair_orientation || ''] as keyof typeof pairMap
  const type2 = pairMap[r] as keyof typeof fillColor
  return r === 'LR'
    ? undefined
    : ([fillColor[type2], strokeColor[type2]] as const)
}

/**
 * Get color for a paired-end read based on orientation only
 * Returns default color for proper pairs
 */
export function getPairedOrientationColor(f: {
  pair_orientation?: string
  flags?: number
}) {
  return getPairedOrientationColorOrDefault(f) || defaultColor
}

/**
 * Get color for a paired-end read based on both insert size and orientation
 * Prioritizes orientation coloring over insert size coloring
 * Uses getPairedType() internally to determine classification
 */
export function getPairedInsertSizeAndOrientationColor(
  f: {
    refName: string
    next_ref?: string
    pair_orientation?: string
    tlen?: number
    flags?: number
  },
  stats?: ChainStats,
) {
  return (
    getPairedOrientationColorOrDefault(f) ||
    getPairedInsertSizeColor(f, stats) ||
    defaultColor
  )
}

export function getSingletonColor(
  f: { tlen?: number; pair_orientation?: string; flags?: number },
  stats?: ChainStats,
) {
  // Check insert size
  const tlen = Math.abs(f.tlen || 0)
  // If TLEN is abnormally large, color it dark red
  if (stats && tlen > stats.upper) {
    return [
      fillColor.color_fwd_missing_mate,
      strokeColor.color_fwd_missing_mate,
    ] as const
  }
  // Otherwise use properly paired coloring for normal-looking singletons
  return defaultColor // [fillColor.color_pair_lr, strokeColor.color_pair_lr] as const
}

export function getPairedColor({
  type,
  v0,
  stats,
}: {
  type: string
  v0: Feature
  stats?: ChainStats
}) {
  // Extract properties from Feature objects
  const f0 = {
    refName: v0.get('refName'),
    next_ref: v0.get('next_ref'),
    pair_orientation: v0.get('pair_orientation'),
    tlen: v0.get('template_length'),
    flags: v0.get('flags'),
  }

  if (type === 'insertSizeAndOrientation') {
    return getPairedInsertSizeAndOrientationColor(f0, stats)
  }
  if (type === 'orientation') {
    return getPairedOrientationColor(f0)
  }
  if (type === 'insertSize') {
    return getPairedInsertSizeColor(f0, stats)
  }
  return undefined
}
