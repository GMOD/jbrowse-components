import { syriColors } from '../../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

function getStrandColor(feat: MultiPairFeature) {
  return feat.strand === -1 ? '#6899e0' : '#c8c8c8'
}

function getSyriColor(feat: MultiPairFeature) {
  return syriColors[feat.syriType ?? 'SYN']
}

function getIdentityColor(feat: MultiPairFeature) {
  if (feat.identity < 0) {
    return '#999'
  }
  const t = feat.identity
  if (t >= 0.95) {
    const f = (t - 0.95) / 0.05
    return `rgb(${Math.round(255 * (1 - f))},${Math.round(200 + 55 * f)},50)`
  }
  if (t >= 0.8) {
    const f = (t - 0.8) / 0.15
    return `rgb(255,${Math.round(200 * f)},0)`
  }
  return 'rgb(200,0,0)'
}

export function getFeatureColor(feat: MultiPairFeature, colorBy: string) {
  switch (colorBy) {
    case 'syri':
      return getSyriColor(feat)
    case 'identity':
      return getIdentityColor(feat)
    default:
      return getStrandColor(feat)
  }
}

export const legendItems: Record<string, { label: string; color: string }[]> = {
  strand: [
    { label: 'Forward (+)', color: '#c8c8c8' },
    { label: 'Reverse (inversion)', color: '#6899e0' },
  ],
  syri: Object.entries(syriColors).map(([label, color]) => ({
    label,
    color,
  })),
  identity: [
    { label: '>99%', color: 'rgb(0,255,50)' },
    { label: '95%', color: 'rgb(255,200,0)' },
    { label: '80%', color: 'rgb(255,0,0)' },
    { label: '<80%', color: 'rgb(200,0,0)' },
  ],
}
