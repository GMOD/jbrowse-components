import {
  OVERFLOW_GROUP_KEY,
  capGroupKeys,
  compareGroupKeys,
  overflowLabel,
} from '@jbrowse/core/util/groupKeys'
import { hitIndexOf } from '@jbrowse/core/util/markEncoding'

import { drawnScales } from './drawnScales.ts'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'

/** A section as drawn: its chip, and the band of rows under it. */
export interface FacetBand {
  key: string
  label: string
  firstRow: number
  rowCount: number
}

export interface FacetLayout {
  sections: FacetBand[]
  rowCount: number
  /** Where each drawn key's rows start, a merged key's inside the overflow band. */
  firstRowOf: ReadonlyMap<string, number>
  /**
   * One row per value, which `rows` draws: every row a region packed a key
   * into lands on the key's one row, and row labels name them, not chips.
   */
  rows: boolean
}

/**
 * The sections a region split on `field`, or none for a region fetched
 * before the split or split on another field, whose instances stay hidden
 * until its refetch lands and whose values enter no layout, key space or row
 * list.
 */
export function sectionsOn(region: MarkRegionData, field: string) {
  const asked = region.request?.facet?.field
  return asked === undefined || asked === field ? region.facet : undefined
}

/**
 * The sections over every loaded region: each key as tall as the deepest
 * region packed it, the cap over the keys of all of them, the domain's order,
 * and the hidden ones gone. The keys merged into the overflow section keep
 * their own bands inside it, one after another, so their rows never overlap.
 */
export function facetLayout(
  regions: Iterable<MarkRegionData>,
  field: CategoricalField,
  hidden: ReadonlySet<string>,
): FacetLayout {
  const heights = new Map<string, number>()
  for (const region of regions) {
    for (const { key, rowCount } of sectionsOn(region, field.field) ?? []) {
      heights.set(key, Math.max(heights.get(key) ?? 0, rowCount))
    }
  }
  const { sectionOf, mergedCount } = capGroupKeys(heights.keys())
  const members = new Map<string, string[]>()
  for (const key of [...heights.keys()].sort(compareGroupKeys)) {
    const section = sectionOf(key)
    const keys = members.get(section)
    if (keys) {
      keys.push(key)
    } else {
      members.set(section, [key])
    }
  }
  const sections: FacetBand[] = []
  const firstRowOf = new Map<string, number>()
  let next = 0
  for (const key of [...members.keys()].sort(field.compare)) {
    if (hidden.has(key)) {
      continue
    }
    const firstRow = next
    for (const member of members.get(key)!) {
      firstRowOf.set(member, next)
      next += heights.get(member)!
    }
    sections.push({
      key,
      label:
        key === OVERFLOW_GROUP_KEY
          ? overflowLabel(mergedCount)
          : field.sectionLabel(key),
      firstRow,
      rowCount: next - firstRow,
    })
  }
  return { sections, rowCount: next, firstRowOf, rows: false }
}

/**
 * One row per value, in the order `rows` lists them: a value `rows` leaves
 * out is hidden the way a hidden section is.
 */
export function rowsLayout(
  rows: readonly { name: string }[],
  field: CategoricalField,
): FacetLayout {
  return {
    sections: rows.map((row, i) => ({
      key: row.name,
      label: field.sectionLabel(row.name),
      firstRow: i,
      rowCount: 1,
    })),
    rowCount: rows.length,
    firstRowOf: new Map(rows.map((row, i) => [row.name, i])),
    rows: true,
  }
}

const HIDDEN = 0xffffffff

function rowRemap(region: MarkRegionData, layout: FacetLayout) {
  const table = region.facet ?? []
  const total = table.reduce((n, s) => Math.max(n, s.firstRow + s.rowCount), 0)
  const remap = new Uint32Array(total).fill(HIDDEN)
  for (const { key, firstRow, rowCount } of table) {
    const to = layout.firstRowOf.get(key)
    if (to !== undefined) {
      for (let i = 0; i < rowCount; i++) {
        remap[firstRow + i] = to + i
      }
    }
  }
  return remap
}

function gather<T extends Uint32Array | Uint8Array>(
  lane: T,
  kept: Uint32Array,
) {
  const out = new (lane.constructor as new (n: number) => T)(kept.length)
  for (let k = 0; k < kept.length; k++) {
    out[k] = lane[kept[k]!]!
  }
  return out
}

// A ramp's raw values by their bits, so a no-value marker survives the copy.
function gatherFloats(lane: Float32Array, kept: Uint32Array) {
  const bits = gather(
    new Uint32Array(lane.buffer, lane.byteOffset, lane.length),
    kept,
  )
  return new Float32Array(bits.buffer, bits.byteOffset, bits.length)
}

// The layer as drawn: its rows on the layout, and a hidden section's
// instances gone from every lane and from the hit index, each lane gathered
// through the one list of instances kept.
function facetLayer(layer: StoredLayer, remap: Uint32Array): StoredLayer {
  const { row } = layer
  if (!row) {
    return layer
  }
  const moved = new Uint32Array(row.length)
  let shown = 0
  for (let i = 0; i < row.length; i++) {
    const r = remap[row[i]!] ?? HIDDEN
    moved[i] = r
    if (r !== HIDDEN) {
      shown++
    }
  }
  if (shown === row.length) {
    return { ...layer, row: moved }
  }
  const kept = new Uint32Array(shown)
  for (let i = 0, k = 0; i < moved.length; i++) {
    if (moved[i] !== HIDDEN) {
      kept[k++] = i
    }
  }
  const x = gather(layer.x, kept)
  const x2 = gather(layer.x2, kept)
  const y = layer.y && gatherFloats(layer.y, kept)
  const { featureIndex, text, color } = layer
  return drawnScales({
    ...layer,
    count: shown,
    x,
    x2,
    y,
    row: gather(moved, kept),
    featureIndex: featureIndex ? gather(featureIndex, kept) : kept,
    color: typeof color === 'object' ? gather(color, kept) : color,
    colorValue: layer.colorValue && gatherFloats(layer.colorValue, kept),
    glyph: layer.glyph && gather(layer.glyph, kept),
    text: text && Array.from(kept, i => text[i]!),
    size: layer.size && gatherFloats(layer.size, kept),
    x2Ref: layer.x2Ref && gather(layer.x2Ref, kept),
    x2Region: layer.x2Region && gather(layer.x2Region, kept),
    flatbush: layer.flatbush && shown > 0 ? hitIndexOf(x, x2, y) : undefined,
    flatbushData: undefined,
  })
}

/**
 * A region's layers on the one layout, so the chips and the bands they name
 * agree whichever region an instance came from and whatever the reader has
 * hidden. A region no facet split, the density sidecar's, keeps its rows.
 */
export function facetRegion(
  region: MarkRegionData,
  layout: FacetLayout,
): MarkRegionData {
  if (!region.facet) {
    return region
  }
  const remap = rowRemap(region, layout)
  return { ...region, layers: region.layers.map(l => facetLayer(l, remap)) }
}
