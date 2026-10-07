import { hitIndexOf } from '@jbrowse/core/util/markEncoding'

import { drawnScales } from './drawnScales.ts'

import type { MarkRegionData, StoredLayer } from './markList.ts'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'
import type { FacetSection } from '@jbrowse/core/util/markEncoding'

/** A section as drawn: its chip, and the band of rows under it. */
export interface FacetBand {
  key: string
  label: string
  firstRow: number
  rowCount: number
}

export interface FacetLayout {
  /** The field whose values the sections are. */
  field: string
  sections: FacetBand[]
  rowCount: number
  /** Each drawn key's band. */
  bandOf: ReadonlyMap<string, FacetBand>
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

const drawnRowsCache = new WeakMap<
  MarkRegionData,
  { sections: readonly FacetSection[]; drawn: string; rows: number[] }
>()

// The rows each section holds under the layers drawn at this zoom: one past
// the deepest any of them stands in, and 1 where none reaches. The worker packs
// every layer, a mark outside its zoom range included, so a section's own
// `rowCount` is the deepest of them all.
function drawnSectionRows(
  region: MarkRegionData,
  sections: readonly FacetSection[],
  drawn: readonly boolean[],
) {
  const signature = drawn.join(',')
  const held = drawnRowsCache.get(region)
  if (held?.sections === sections && held.drawn === signature) {
    return held.rows
  }
  const total = sections.reduce(
    (n, s) => Math.max(n, s.firstRow + s.rowCount),
    0,
  )
  const sectionOfRow = new Uint32Array(total)
  sections.forEach(({ firstRow, rowCount }, s) => {
    sectionOfRow.fill(s, firstRow, firstRow + rowCount)
  })
  const rows = sections.map(() => 1)
  region.layers.forEach(({ row, count }, i) => {
    if (drawn[i] && row) {
      for (let k = 0; k < count; k++) {
        const r = row[k]!
        if (r < total) {
          const s = sectionOfRow[r]!
          const depth = r - sections[s]!.firstRow + 1
          if (depth > rows[s]!) {
            rows[s] = depth
          }
        }
      }
    }
  })
  drawnRowsCache.set(region, { sections, drawn: signature, rows })
  return rows
}

/**
 * The sections over every loaded region: each key as tall as the deepest
 * region packed it under the layers `drawn` at this zoom, in the domain's
 * order, less the hidden ones.
 */
export function facetLayout(
  regions: Iterable<MarkRegionData>,
  field: CategoricalField,
  hidden: ReadonlySet<string>,
  drawn: readonly boolean[],
): FacetLayout {
  const heights = new Map<string, number>()
  for (const region of regions) {
    const sections = sectionsOn(region, field.field) ?? []
    const rows = drawnSectionRows(region, sections, drawn)
    sections.forEach(({ key }, s) => {
      heights.set(key, Math.max(heights.get(key) ?? 0, rows[s]!))
    })
  }
  const sections: FacetBand[] = []
  let next = 0
  for (const key of [...heights.keys()].sort(field.compare)) {
    if (hidden.has(key)) {
      continue
    }
    const rowCount = heights.get(key)!
    sections.push({
      key,
      label: field.sectionLabel(key),
      firstRow: next,
      rowCount,
    })
    next += rowCount
  }
  return {
    field: field.field,
    sections,
    rowCount: next,
    bandOf: new Map(sections.map(band => [band.key, band])),
    rows: false,
  }
}

/**
 * One row per value, in the order `rows` lists them: a value `rows` leaves
 * out is hidden the way a hidden section is.
 */
export function rowsLayout(
  rows: readonly { name: string }[],
  field: CategoricalField,
): FacetLayout {
  const sections = rows.map((row, i) => ({
    key: row.name,
    label: field.sectionLabel(row.name),
    firstRow: i,
    rowCount: 1,
  }))
  return {
    field: field.field,
    sections,
    rowCount: rows.length,
    bandOf: new Map(sections.map(band => [band.key, band])),
    rows: true,
  }
}

const HIDDEN = 0xffffffff

// Each of the region's rows on the layout: a section's rows onto its band, and
// hidden past the band's depth, where only a layer outside its zoom range
// stands.
function rowRemap(table: readonly FacetSection[], layout: FacetLayout) {
  const total = table.reduce((n, s) => Math.max(n, s.firstRow + s.rowCount), 0)
  const remap = new Uint32Array(total).fill(HIDDEN)
  for (const { key, firstRow, rowCount } of table) {
    const band = layout.bandOf.get(key)
    if (band) {
      for (let i = 0; i < Math.min(rowCount, band.rowCount); i++) {
        remap[firstRow + i] = band.firstRow + i
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

// The layer with only the instances `kept` lists, every lane gathered
// through that one list, and its extents and hit index over what is left.
function keptLayer(
  layer: StoredLayer,
  kept: Uint32Array,
  row: Uint32Array | undefined,
): StoredLayer {
  const x = gather(layer.x, kept)
  const x2 = gather(layer.x2, kept)
  const y = layer.y && gatherFloats(layer.y, kept)
  const { featureIndex, text, color } = layer
  return drawnScales({
    ...layer,
    count: kept.length,
    x,
    x2,
    y,
    row,
    featureIndex: featureIndex ? gather(featureIndex, kept) : kept,
    color: typeof color === 'object' ? gather(color, kept) : color,
    colorValue: layer.colorValue && gatherFloats(layer.colorValue, kept),
    glyph: layer.glyph && gather(layer.glyph, kept),
    text: text && Array.from(kept, i => text[i]!),
    size: layer.size && gatherFloats(layer.size, kept),
    x2Ref: layer.x2Ref && gather(layer.x2Ref, kept),
    feet: layer.feet && gather(layer.feet, kept),
    x2Region: layer.x2Region && gather(layer.x2Region, kept),
    flatbush:
      layer.flatbush && kept.length > 0 ? hitIndexOf(x, x2, y) : undefined,
    flatbushData: undefined,
  })
}

// The layer as drawn: its rows on the layout, and a hidden section's
// instances gone.
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
  return keptLayer(layer, kept, gather(moved, kept))
}

/**
 * A region's layers on the one layout, so the chips and the bands they name
 * agree whichever region an instance came from and whatever the reader has
 * hidden. The density sidecar's region, which answers no request, keeps its
 * rows. A region fetched before the split or split on another field draws
 * nothing until its refetch lands, as under `rows`: its rows hold the old
 * field's sections, which a matching key would place in the new layout at
 * the old depth.
 */
export function facetRegion(
  region: MarkRegionData,
  layout: FacetLayout,
): MarkRegionData {
  const sections = sectionsOn(region, layout.field)
  if (sections) {
    const remap = rowRemap(sections, layout)
    return { ...region, layers: region.layers.map(l => facetLayer(l, remap)) }
  }
  return region.request ? hiddenRegion(region) : region
}

/** The region with every instance gone from every layer. */
export function hiddenRegion(region: MarkRegionData): MarkRegionData {
  return {
    ...region,
    layers: region.layers.map(l =>
      keptLayer(l, new Uint32Array(0), l.row && new Uint32Array(0)),
    ),
  }
}

/**
 * A region as drawn while neither a facet nor `rows` splits the features: one
 * fetched under a split still holds that split's section rows, so it draws
 * nothing until its refetch lands.
 */
export function unsplitRegion(region: MarkRegionData): MarkRegionData {
  return region.request?.facet ? hiddenRegion(region) : region
}
