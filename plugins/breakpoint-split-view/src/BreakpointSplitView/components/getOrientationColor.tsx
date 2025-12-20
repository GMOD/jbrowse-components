import { alpha } from '@mui/material'
// orientation definitions from igv.js, see also
// https://software.broadinstitute.org/software/igv/interpreting_pair_orientations
export const orientationTypes = {
  fr: {
    F1R2: 'LR',
    F2R1: 'LR',

    F1F2: 'LL',
    F2F1: 'LL',

    R1R2: 'RR',
    R2R1: 'RR',

    R1F2: 'RL',
    R2F1: 'RL',
  } as Record<string, string>,

  rf: {
    R1F2: 'LR',
    R2F1: 'LR',

    R1R2: 'LL',
    R2R1: 'LL',

    F1F2: 'RR',
    F2F1: 'RR',

    F1R2: 'RL',
    F2R1: 'RL',
  } as Record<string, string>,

  ff: {
    F2F1: 'LR',
    R1R2: 'LR',

    F2R1: 'LL',
    R1F2: 'LL',

    R2F1: 'RR',
    F1R2: 'RR',

    R2R1: 'RL',
    F1F2: 'RL',
  } as Record<string, string>,
}

export const pairMap = {
  LR: 'color_pair_lr',
  LL: 'color_pair_ll',
  RR: 'color_pair_rr',
  RL: 'color_pair_rl',
} as const

// manually calculated by running
// const color = require('color')
// Object.fromEntries(Object.entries(fillColor).map(([key,val])=>{
//   return [key, color(val).darken('0.3').hex()]
// }))
// this avoids (expensive) use of Color module at runtime
export const strokeColor = {
  color_fwd_strand_not_proper: alpha('#CA6767', 0.8),
  color_rev_strand_not_proper: alpha('#7272AA', 0.8),
  color_fwd_strand: alpha('#DC2A2A', 0.8),
  color_rev_strand: alpha('#4141BA', 0.8),
  color_fwd_missing_mate: alpha('#921111', 0.8),
  color_rev_missing_mate: alpha('#111192', 0.8),
  color_fwd_diff_chr: alpha('#000000', 0.8),
  color_rev_diff_chr: alpha('#696969', 0.8),
  color_pair_lr: alpha('#8C8C8C', 0.8),
  color_pair_rr: alpha('#00005A', 0.8),
  color_pair_rl: alpha('#005A5A', 0.8),
  color_pair_ll: alpha('#005A00', 0.8),
  color_nostrand: alpha('#8C8C8C', 0.8),
  color_interchrom: alpha('#5A005A', 0.8),
  color_longinsert: alpha('#B30000', 0.8),
  color_shortinsert: alpha('#FF3A5C', 0.8),
  color_unknown: alpha('#555', 0.8),
}

const defaultColor = strokeColor.color_unknown

export function getPairedOrientationColorOrDefault(f: {
  pair_orientation?: string
}) {
  const type = orientationTypes.fr
  const r = type[f.pair_orientation || ''] as keyof typeof pairMap
  const type2 = pairMap[r] as keyof typeof strokeColor
  return r === 'LR' ? undefined : strokeColor[type2]
}

export function getLongReadOrientationColorOrDefault(s1: number, s2: number) {
  if (s1 === -1 && s2 === 1) {
    return strokeColor.color_pair_rr
  } else if (s1 === 1 && s2 === -1) {
    return strokeColor.color_pair_ll
  } else {
    return strokeColor.color_unknown
  }
}

export function getLongReadOrientationAbnormal(s1: number, s2: number) {
  if (s1 === -1 && s2 === 1) {
    return true
  } else if (s1 === 1 && s2 === -1) {
    return true
  } else {
    return false
  }
}

export function isAbnormalOrientation(f: { pair_orientation?: string }) {
  const type = orientationTypes.fr
  const r = type[f.pair_orientation || ''] as keyof typeof pairMap
  return r !== 'LR'
}

export function getPairedOrientationColor(f: { pair_orientation?: string }) {
  return getPairedOrientationColorOrDefault(f) || defaultColor
}
