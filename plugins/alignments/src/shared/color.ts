import { orientationTypes, pairMap } from '../util'
import type { ChainStats } from './fetchChains'

export const fillColor = {
  color_fwd_strand_not_proper: '#ECC8C8',
  color_rev_strand_not_proper: '#BEBED8',
  color_fwd_strand: '#EC8B8B',
  color_rev_strand: '#8F8FD8',
  color_fwd_missing_mate: '#D11919',
  color_rev_missing_mate: '#1919D1',
  color_fwd_diff_chr: '#000',
  color_rev_diff_chr: '#969696',
  color_pair_lr: '#c8c8c8',
  color_pair_rr: 'navy',
  color_pair_rl: 'teal',
  color_pair_ll: 'green',
  color_nostrand: '#c8c8c8',
  color_interchrom: 'purple',
  color_longinsert: 'red',
  color_shortinsert: 'pink',
  color_unknown: 'grey',
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
  color_pair_rr: '#00005A',
  color_pair_rl: '#005A5A',
  color_pair_ll: '#005A00',
  color_nostrand: '#8C8C8C',
  color_interchrom: '#5A005A',
  color_longinsert: '#B30000',
  color_shortinsert: '#FF3A5C',
  color_unknown: 'grey',
}

export function getPairedInsertSizeColor(
  f1: { refName: string; tlen?: number },
  f2: { refName: string },
  stats?: ChainStats,
) {
  const sameRef = f1.refName === f2.refName
  const tlen = Math.abs(f1.tlen || 0)
  if (sameRef && tlen > (stats?.upper || 0)) {
    return [fillColor.color_longinsert, strokeColor.color_longinsert] as const
  } else if (sameRef && tlen < (stats?.lower || 0)) {
    return [fillColor.color_shortinsert, strokeColor.color_shortinsert] as const
  } else if (!sameRef) {
    return [fillColor.color_interchrom, strokeColor.color_interchrom] as const
  } else {
    return undefined
  }
}

const defaultColor = [fillColor.color_unknown, fillColor.color_unknown] as const

// return color scheme with both insert size and orientation coloring,
// prioritzing orientation coloring
export function getPairedInsertSizeAndOrientationColor(
  f1: { refName: string; pair_orientation?: string; tlen?: number },
  f2: { refName: string },
  stats?: ChainStats,
) {
  return (
    getPairedOrientationColorOrDefault(f1) ||
    getPairedInsertSizeColor(f1, f2, stats) ||
    defaultColor
  )
}

export function getPairedOrientationColorOrDefault(f: {
  pair_orientation?: string
}) {
  const type = orientationTypes.fr
  const r = type[f.pair_orientation || ''] as keyof typeof pairMap
  const type2 = pairMap[r] as keyof typeof fillColor
  return r === 'LR'
    ? undefined
    : ([fillColor[type2], strokeColor[type2]] as const)
}

export function getPairedOrientationColor(f: { pair_orientation?: string }) {
  return getPairedOrientationColorOrDefault(f) || defaultColor
}
