import { LINK_ELSEWHERE } from '@jbrowse/render-core/marks'

import type { MarkRegionData, StoredLayer } from './markList.ts'

export interface OwnerRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
}

type Canonical = (assemblyName: string, refName: string) => string

function footKey(ref: string, bp: number, ref2: string, bp2: number) {
  const a = `${ref}:${bp}`
  const b = `${ref2}:${bp2}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function linkKeys(
  layer: StoredLayer,
  region: OwnerRegion,
  canonical: Canonical,
) {
  const { x2Ref, x2RefNames, x2Region } = layer
  if (!x2Ref || !x2RefNames || !x2Region) {
    return undefined
  }
  const far = x2RefNames.map(name => canonical(region.assemblyName, name))
  const keys = new Array<string>(layer.count)
  for (let i = 0; i < layer.count; i++) {
    keys[i] = footKey(
      region.refName,
      layer.x[i]!,
      far[x2Ref[i]!]!,
      layer.x2[i]!,
    )
  }
  return keys
}

function sameIndices(a: readonly number[], b: readonly number[] | undefined) {
  return b?.length === a.length && a.every((v, i) => v === b[i])
}

/**
 * Each link drawn once over the loaded regions. The copies of one curve — a
 * pair whose two ends both have records, or one record fetched into two
 * regions — share their two feet, unordered, and all but one region's are
 * set to {@link LINK_ELSEWHERE}: the lowest region holding its own foot, else
 * the lowest region. A region whose hidden set did not move keeps its payload,
 * so a fetch elsewhere uploads nothing here.
 */
export function createLinkOwners() {
  const cache = new Map<
    number,
    { from: MarkRegionData; out: MarkRegionData; hidden: number[][] }
  >()
  let last:
    | {
        mated: ReadonlyMap<number, MarkRegionData>
        regions: readonly OwnerRegion[]
        out: ReadonlyMap<number, MarkRegionData>
      }
    | undefined
  return (
    mated: ReadonlyMap<number, MarkRegionData>,
    regions: readonly OwnerRegion[],
    canonical: Canonical,
  ): ReadonlyMap<number, MarkRegionData> => {
    if (last?.mated === mated && last.regions === regions) {
      return last.out
    }
    const n = regions.length
    const keysOf = new Map<number, (string[] | undefined)[]>()
    const rankOf = new Map<string, number>()
    for (const [index, data] of mated) {
      const region = regions[index]
      if (!region) {
        continue
      }
      const perLayer = data.layers.map((layer, li) => {
        const keys = linkKeys(layer, region, canonical)
        if (keys) {
          for (let i = 0; i < keys.length; i++) {
            const x = layer.x[i]!
            const holds = x >= region.start && x < region.end
            const rank = holds ? index : index + n
            const key = `${li}#${keys[i]}`
            const had = rankOf.get(key)
            if (had === undefined || rank < had) {
              rankOf.set(key, rank)
            }
          }
        }
        return keys
      })
      keysOf.set(index, perLayer)
    }
    const out = new Map<number, MarkRegionData>()
    for (const [index, data] of mated) {
      const perLayer = keysOf.get(index)
      if (!perLayer) {
        out.set(index, data)
        continue
      }
      const hidden = perLayer.map((keys, li) => {
        const list: number[] = []
        if (keys) {
          for (let i = 0; i < keys.length; i++) {
            const rank = rankOf.get(`${li}#${keys[i]}`)!
            if ((rank >= n ? rank - n : rank) !== index) {
              list.push(i)
            }
          }
        }
        return list
      })
      const prior = cache.get(index)
      if (
        prior?.from === data &&
        hidden.every((h, li) => sameIndices(h, prior.hidden[li]))
      ) {
        out.set(index, prior.out)
        continue
      }
      const owned = hidden.every(h => h.length === 0)
        ? data
        : {
            ...data,
            layers: data.layers.map((layer, li) => {
              const list = hidden[li]!
              if (list.length === 0 || !layer.x2Region) {
                return layer
              }
              const x2Region = layer.x2Region.slice()
              for (const i of list) {
                x2Region[i] = LINK_ELSEWHERE
              }
              return { ...layer, x2Region }
            }),
          }
      cache.set(index, { from: data, out: owned, hidden })
      out.set(index, owned)
    }
    for (const key of cache.keys()) {
      if (!mated.has(key)) {
        cache.delete(key)
      }
    }
    last = { mated, regions, out }
    return out
  }
}
