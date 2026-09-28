import { LINK_ELSEWHERE, LINK_NO_REGION } from '@jbrowse/render-core/marks'

import type { MarkRegionData, StoredLayer } from './markList.ts'

export interface OwnerRegion {
  refName: string
  start: number
  end: number
  assemblyName: string
}

/** A displayed region as a link's far foot is looked up in it. */
export interface MateRegion extends OwnerRegion {
  index: number
}

/**
 * Each link layer's `x2Region`: the region the far foot places through, its
 * refName read through the assembly's aliases. The block's own region when it
 * holds the foot, else any displayed region that does, else the block's own
 * region when the foot is on its contig past its edge, else none. Once per
 * fetch or region change, so a pan places through the shader's table alone.
 */
export function withMateRegions(
  data: MarkRegionData,
  regions: readonly MateRegion[],
  canonical: (assemblyName: string, refName: string) => string,
  ownIndex: number,
): MarkRegionData {
  const byRef = new Map<string, MateRegion[]>()
  for (const region of regions) {
    const list = byRef.get(region.refName)
    if (list) {
      list.push(region)
    } else {
      byRef.set(region.refName, [region])
    }
  }
  const assemblies = [...new Set(regions.map(r => r.assemblyName))]
  return {
    ...data,
    layers: data.layers.map(layer => {
      const { x2Ref, x2RefNames } = layer
      if (!x2Ref || !x2RefNames) {
        return layer
      }
      const candidates = x2RefNames.map(name => {
        const found: MateRegion[] = []
        for (const assemblyName of assemblies) {
          for (const region of byRef.get(canonical(assemblyName, name)) ?? []) {
            if (region.assemblyName === assemblyName) {
              found.push(region)
            }
          }
        }
        return found
      })
      const x2Region = new Uint32Array(layer.count)
      for (let i = 0; i < layer.count; i++) {
        const pos = layer.x2[i]!
        const onRef = candidates[x2Ref[i]!] ?? []
        const holds = (r: MateRegion) => pos >= r.start && pos < r.end
        const own = onRef.find(r => r.index === ownIndex)
        const region = own && holds(own) ? own : (onRef.find(holds) ?? own)
        x2Region[i] = region ? region.index : LINK_NO_REGION
      }
      return { ...layer, x2Region }
    }),
  }
}

type Canonical = (assemblyName: string, refName: string) => string

function footKey(ref: string, bp: number, ref2: string, bp2: number) {
  const a = `${ref}:${bp}`
  const b = `${ref2}:${bp2}`
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

// A curve is its two feet in its band: the same pair in two rows or two
// sections is two samples' curves, and both draw.
function linkKey(layer: StoredLayer, i: number, feet: string) {
  return `${layer.row?.[i] ?? 0}#${feet}`
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
    keys[i] = linkKey(
      layer,
      i,
      footKey(region.refName, layer.x[i]!, far[x2Ref[i]!]!, layer.x2[i]!),
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
 * regions — share their two feet, unordered, and their row, and all but one
 * are set to
 * {@link LINK_ELSEWHERE}: the first in the lowest region holding its own
 * foot, else in the lowest region. The feet read through the assembly's
 * aliases, so a pair whose ALT spells its own CHROM another way, which the
 * worker's mate step cannot fold, folds here inside one region as it does
 * across two. A region whose hidden set did not move keeps its payload, so a
 * fetch elsewhere uploads nothing here.
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
    const ownerOf = new Map<
      string,
      { rank: number; index: number; i: number }
    >()
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
            const had = ownerOf.get(key)
            if (had === undefined || rank < had.rank) {
              ownerOf.set(key, { rank, index, i })
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
            const owner = ownerOf.get(`${li}#${keys[i]}`)!
            if (owner.index !== index || owner.i !== i) {
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
