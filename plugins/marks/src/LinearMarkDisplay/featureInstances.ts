import { NO_ROOT } from '@jbrowse/core/util/markEncoding'

import type { MarkRegionData } from './markList.ts'

export interface FeatureInstance {
  markIndex: number
  index: number
}

const byRoot = new WeakMap<MarkRegionData, Map<number, FeatureInstance[]>>()

function rootIndex(region: MarkRegionData) {
  let index = byRoot.get(region)
  if (!index) {
    index = new Map()
    for (const [markIndex, layer] of region.layers.entries()) {
      const roots = layer.root ?? []
      for (let i = 0; i < roots.length; i++) {
        const root = roots[i]!
        if (root !== NO_ROOT) {
          const list = index.get(root)
          if (list) {
            list.push({ markIndex, index: i })
          } else {
            index.set(root, [{ markIndex, index: i }])
          }
        }
      }
    }
    byRoot.set(region, index)
  }
  return index
}

/**
 * Every instance the region's marks drew of the fetched feature `root`
 * names: a spliced feature's span and each of its blocks.
 */
export function instancesOfFeature(region: MarkRegionData, root: number) {
  return rootIndex(region).get(root) ?? []
}

/** The bp those instances cover, from the lowest end to the highest. */
export function featureSpan(region: MarkRegionData, root: number) {
  let start = Infinity
  let end = -Infinity
  for (const { markIndex, index } of instancesOfFeature(region, root)) {
    const layer = region.layers[markIndex]!
    const a = layer.x[index]!
    const b = layer.x2[index]!
    start = Math.min(start, a, b)
    end = Math.max(end, a, b)
  }
  return { start, end }
}
