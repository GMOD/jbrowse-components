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

// The layer with no instances: each lane an empty view of its own, and its
// keys and extents over none.
function emptyLayer(layer: StoredLayer): StoredLayer {
  const { color } = layer
  return drawnScales({
    ...layer,
    count: 0,
    x: layer.x.subarray(0, 0),
    x2: layer.x2.subarray(0, 0),
    y: layer.y?.subarray(0, 0),
    row: layer.row?.subarray(0, 0),
    featureIndex: layer.featureIndex?.subarray(0, 0),
    color: typeof color === 'object' ? color.subarray(0, 0) : color,
    colorValue: layer.colorValue?.subarray(0, 0),
    colorKey: layer.colorKey?.subarray(0, 0),
    glyph: layer.glyph?.subarray(0, 0),
    text: layer.text && [],
    size: layer.size?.subarray(0, 0),
    x2Ref: layer.x2Ref?.subarray(0, 0),
    feet: layer.feet?.subarray(0, 0),
    x2Region: layer.x2Region?.subarray(0, 0),
    series: layer.series?.subarray(0, 0),
    flatbush: undefined,
    flatbushData: undefined,
  })
}

/** The region with every instance gone from every layer. */
export function hiddenRegion(region: MarkRegionData): MarkRegionData {
  return {
    ...region,
    layers: region.layers.map(emptyLayer),
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
