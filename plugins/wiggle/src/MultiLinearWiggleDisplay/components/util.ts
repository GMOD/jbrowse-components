import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  measureText,
} from '@jbrowse/core/util'
import type { WiggleDisplayModel } from '../model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

export function moveUp(arr: { name: string }[], sel: string[], by = 1) {
  const idxs = sel
    .map(l => arr.findIndex(v => v.name === l))
    .sort((a, b) => a - b)
  let lastIdx = 0
  for (const old of idxs) {
    const idx = Math.max(lastIdx, old - by)
    if (idx >= lastIdx) {
      arr.splice(idx, 0, arr.splice(old, 1)[0]!)
    }
    lastIdx = lastIdx + 1
  }

  return arr
}

export function moveDown(arr: { name: string }[], sel: string[], by = 1) {
  const idxs = sel
    .map(l => arr.findIndex(v => v.name === l))
    .sort((a, b) => b - a)
  let lastIdx = arr.length - 1
  for (const old of idxs) {
    const idx = Math.min(lastIdx, old + by)
    if (idx <= lastIdx) {
      arr.splice(idx, 0, arr.splice(old, 1)[0]!)
    }
    lastIdx = lastIdx - 1
  }

  return arr
}

const trackLabelFontSize = 12.8

export function getOffset(model: WiggleDisplayModel) {
  const { prefersOffset } = model
  const { trackLabels } = getContainingView(model) as LinearGenomeViewModel
  const track = getContainingTrack(model)
  const trackName = getConf(track, 'name')
  return trackLabels === 'overlapping' && !prefersOffset
    ? measureText(trackName, trackLabelFontSize) + 100
    : 10
}
