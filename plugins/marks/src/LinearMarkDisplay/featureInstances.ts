import { NO_OWNER } from '@jbrowse/core/util/markEncoding'

import type { MarkRegionData } from './markList.ts'

export interface FeatureInstance {
  markIndex: number
  index: number
}

const byOwner = new WeakMap<MarkRegionData, Map<number, FeatureInstance[]>>()

function ownerIndex(region: MarkRegionData) {
  let index = byOwner.get(region)
  if (!index) {
    index = new Map()
    for (const [markIndex, layer] of region.layers.entries()) {
      const owners = layer.owner ?? []
      for (let i = 0; i < owners.length; i++) {
        const owner = owners[i]!
        if (owner !== NO_OWNER) {
          const list = index.get(owner)
          if (list) {
            list.push({ markIndex, index: i })
          } else {
            index.set(owner, [{ markIndex, index: i }])
          }
        }
      }
    }
    byOwner.set(region, index)
  }
  return index
}

/**
 * Every instance the region's marks drew of the fetched feature `owner`
 * names: a spliced feature's span and each of its blocks.
 */
export function instancesOfFeature(region: MarkRegionData, owner: number) {
  return ownerIndex(region).get(owner) ?? []
}

/** The bp those instances cover, from the lowest end to the highest. */
export function featureSpan(region: MarkRegionData, owner: number) {
  let start = Infinity
  let end = -Infinity
  for (const { markIndex, index } of instancesOfFeature(region, owner)) {
    const layer = region.layers[markIndex]!
    const a = layer.x[index]!
    const b = layer.x2[index]!
    start = Math.min(start, a, b)
    end = Math.max(end, a, b)
  }
  return { start, end }
}
