import { orientationTypes } from '../util'
import { ReducedFeature, ChainStats } from './fetchChains'

const alignmentColoring: { [key: string]: string } = {
  color_pair_lr: '#c8c8c8',
  color_pair_rr: 'navy',
  color_pair_rl: 'teal',
  color_pair_ll: 'green',
}

export function getInsertSizeColor(
  f1: ReducedFeature,
  f2: ReducedFeature,
  stats?: ChainStats,
) {
  const sameRef = f1.refName === f2.refName
  const tlen = Math.abs(f1.tlen)
  if (sameRef && tlen > (stats?.upper || 0)) {
    return 'red'
  } else if (sameRef && tlen < (stats?.lower || 0)) {
    return '#f0f'
  } else if (!sameRef) {
    return 'purple'
  }
  return ''
}

export function getInsertSizeAndOrientationColor(
  f1: ReducedFeature,
  f2: ReducedFeature,
  stats?: ChainStats,
) {
  return getInsertSizeColor(f1, f2, stats) || getOrientationColor(f1)
}

export function getOrientationColor(f: ReducedFeature) {
  const type = orientationTypes['fr']
  const orientation = type[f.pair_orientation]
  const map = {
    LR: 'color_pair_lr',
    RR: 'color_pair_rr',
    RL: 'color_pair_rl',
    LL: 'color_pair_ll',
  }
  const val = map[orientation as keyof typeof map]
  return alignmentColoring[val] || 'grey'
}
