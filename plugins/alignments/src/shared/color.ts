import { orientationTypes } from '../util'
import { ChainStats } from './fetchChains'

const fillColor: { [key: string]: string } = {
  LR: '#c8c8c8',
  RR: 'navy',
  RL: 'teal',
  LL: 'green',
  large: 'red',
  small: '#f0f',
  interchrom: 'purple',
  unknown: 'grey',
}

// manually calculated by running
// Object.fromEntries(Object.entries(fillColor).map(([key,val])=>{
//   return [key, color(val).darken('0.3').hex()]
// }))
const strokeColor: { [key: string]: string } = {
  LR: '#8C8C8C',
  RR: '#00005A',
  RL: '#005A5A',
  LL: '#005A00',
  large: '#B30000',
  small: '#B300B2',
  interchrom: '#5A005A',
  unknown: '#5A5A5A',
}

export function getInsertSizeColor(
  f1: { refName: string; tlen?: number },
  f2: { refName: string },
  stats?: ChainStats,
) {
  const sameRef = f1.refName === f2.refName
  const tlen = Math.abs(f1.tlen || 0)
  if (sameRef && tlen > (stats?.upper || 0)) {
    return [fillColor.large, strokeColor.large] as const
  } else if (sameRef && tlen < (stats?.lower || 0)) {
    return [fillColor.small, strokeColor.small] as const
  } else if (!sameRef) {
    return [fillColor.interchrom, strokeColor.interchrom] as const
  }
  return undefined
}

export function getInsertSizeAndOrientationColor(
  f1: { refName: string; pair_orientation?: string; tlen?: number },
  f2: { refName: string },
  stats?: ChainStats,
) {
  return getInsertSizeColor(f1, f2, stats) || getOrientationColor(f1)
}

export function getOrientationColor(f: { pair_orientation?: string }) {
  const type = orientationTypes.fr
  const type2 = type[f.pair_orientation || '']
  return [
    fillColor[type2] || fillColor.unknown,
    strokeColor[type2] || strokeColor.unknown,
  ] as const
}
