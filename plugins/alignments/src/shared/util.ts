import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

export const defaultFilterFlags = {
  flagInclude: 0,
  flagExclude: 1540,
}

// A feature's SAM bitwise flags, defaulting to 0 for features that carry none
// (e.g. PAF/synteny). The cast is centralized here so the ~half-dozen flag reads
// across the worker and feature extractors don't each re-spell it.
export function getFlags(feature: Feature) {
  return (feature.get('flags') as number | undefined) ?? 0
}

// Get `key`'s entry, lazily creating + inserting it on first miss. The shared
// shape of every "accumulate into a Map of arrays / nested Maps" pass. (The TC39
// `Map.prototype.getOrInsertComputed` upsert proposal would fold this into one
// lookup, but it isn't in shipping runtimes yet and the second lookup is noise
// next to the per-read work — swap it in here once it lands, if ever.)
export function getOrCreate<K, V>(map: Map<K, V>, key: K, make: () => V): V {
  let value = map.get(key)
  if (value === undefined) {
    value = make()
    map.set(key, value)
  }
  return value
}

export function cacheGetter<T>(ctor: { prototype: T }, prop: keyof T): void {
  const desc = Object.getOwnPropertyDescriptor(ctor.prototype, prop)!
  const getter = desc.get!
  Object.defineProperty(ctor.prototype, prop, {
    get() {
      const ret = getter.call(this)
      Object.defineProperty(this, prop, { value: ret })
      return ret
    },
  })
}

export function filterReadFlag(
  flags: number,
  flagInclude: number,
  flagExclude: number,
) {
  return (flags & flagInclude) !== flagInclude || (flags & flagExclude) !== 0
}

export function filterTagValue(readVal: unknown, filterVal?: string) {
  return filterVal === '*'
    ? readVal === undefined
    : `${readVal}` !== `${filterVal}`
}

interface SamHeaderLine {
  tag: string
  data: { tag: string; value: string }[]
}

export interface ParsedSamHeader {
  idToName: string[]
  nameToId: Record<string, number>
  readGroups: string[]
}

export function parseSamHeader(samHeader: SamHeaderLine[]): ParsedSamHeader {
  const idToName: string[] = []
  const nameToId: Record<string, number> = {}
  const readGroups: string[] = []
  let refId = 0
  let rgId = 0

  for (const line of samHeader) {
    if (line.tag === 'SQ') {
      const sn = line.data.find(d => d.tag === 'SN')
      if (sn) {
        nameToId[sn.value] = refId
        idToName[refId] = sn.value
      }
      refId++
    } else if (line.tag === 'RG') {
      const id = line.data.find(d => d.tag === 'ID')
      if (id) {
        readGroups[rgId] = id.value
      }
      rgId++
    }
  }

  return { idToName, nameToId, readGroups }
}

function getColorBaseMap(theme: Theme) {
  const { skip, deletion, insertion, hardclip, softclip, bases } = theme.palette
  return {
    A: bases.A.main,
    C: bases.C.main,
    G: bases.G.main,
    T: bases.T.main,
    deletion,
    insertion,
    hardclip,
    softclip,
    skip,
  }
}

export function getContrastBaseMap(theme: Theme) {
  return Object.fromEntries(
    Object.entries(getColorBaseMap(theme)).map(([key, value]) => [
      key,
      theme.palette.getContrastText(value),
    ]),
  )
}

// Returns contrast colors for mismatch/softclip/per-base letters. The rects
// under these letters are always drawn in the base palette (baseColors.ts),
// independent of colorBy.type — only showModifications mutes them to a uniform
// grey. So contrast text is meaningful in every color mode except when
// modifications collapse the rects to grey, where black reads best and the
// empty map makes drawAlignmentLabels fall back to it.
export function getMismatchContrastMap(
  showModifications: boolean,
  theme: Theme,
): Record<string, string> {
  return showModifications ? {} : getContrastBaseMap(theme)
}

function isTypedArray(
  val: unknown,
): val is
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array {
  return ArrayBuffer.isView(val) && !(val instanceof DataView)
}

/**
 * Convert TypedArrays in tags object to plain number arrays.
 * This is needed because MobX State Tree cannot freeze TypedArray views.
 */
export function convertTagsToPlainArrays(
  tags: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(tags)) {
    result[key] = isTypedArray(value) ? [...value] : value
  }
  return result
}
