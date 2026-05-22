import { assembleLocString, toLocale } from '@jbrowse/core/util'

import type { FeatPos } from '../model.ts'

export interface ClickCoord {
  clientX: number
  clientY: number
  feature: FeatPos
}

export function getTooltip(feat: FeatPos) {
  const l1 = feat.end - feat.start
  const l2 = feat.mate.end - feat.mate.start
  return [
    `Loc1: ${assembleLocString({ refName: feat.refName, start: feat.start, end: feat.end, assemblyName: feat.assemblyName })}`,
    `Loc2: ${assembleLocString({ refName: feat.mate.refName, start: feat.mate.start, end: feat.mate.end, assemblyName: feat.mate.assemblyName })}`,
    `Inverted: ${feat.strand === -1}`,
    `Query len: ${toLocale(l1)}`,
    `Target len: ${toLocale(l2)}`,
    feat.identity !== undefined
      ? `Identity: ${feat.identity.toPrecision(2)}`
      : '',
    feat.name ? `Name: ${feat.name}` : '',
  ]
    .filter(Boolean)
    .join('<br/>')
}
