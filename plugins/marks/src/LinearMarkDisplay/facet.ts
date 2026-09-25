import {
  OVERFLOW_GROUP_KEY,
  capGroupKeys,
  compareGroupKeys,
  overflowLabel,
} from '@jbrowse/core/util/groupKeys'
import {
  MISCONFIGURED_ABGR,
  NO_VALUE_ABGR,
  hitIndexOf,
  rampOverExtent,
} from '@jbrowse/core/util/markEncoding'
import { SHAPE_CODES } from '@jbrowse/core/util/shapeNames'
import { keepRampValues, rampValueMissing } from '@jbrowse/render-core/marks'

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
  for (const { facet } of regions) {
    for (const { key, rowCount } of facet ?? []) {
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
        remap[firstRow + i] = layout.rows ? to : to + i
      }
    }
  }
  return remap
}

// The key and the extents over the instances a layer draws, so a hidden
// section leaves the legend and the axis the way it leaves the plot.
function drawnScales(layer: StoredLayer): StoredLayer {
  const { y, color, colorValue, glyph, scale, shapeScale } = layer
  const colors = new Set(color)
  const glyphs = new Set(glyph)
  let yMin = Infinity
  let yMax = -Infinity
  let vMin = Infinity
  let vMax = -Infinity
  let missing = false
  let notNumber = false
  for (let i = 0; i < layer.count; i++) {
    if (y) {
      yMin = Math.min(yMin, y[i]!)
      yMax = Math.max(yMax, y[i]!)
    }
    if (colorValue) {
      const v = colorValue[i]!
      if (Number.isFinite(v)) {
        vMin = Math.min(vMin, v)
        vMax = Math.max(vMax, v)
      } else if (Number.isNaN(v)) {
        if (rampValueMissing(colorValue, i)) {
          missing = true
        } else {
          notNumber = true
        }
      }
    }
  }
  const valued = Number.isFinite(layer.yMin)
  return {
    ...layer,
    yMin: valued ? yMin : layer.yMin,
    yMax: valued ? yMax : layer.yMax,
    scale:
      scale?.kind === 'categorical' && color
        ? { ...scale, entries: scale.entries.filter(e => colors.has(e.color)) }
        : scale?.kind === 'threshold' && color
          ? {
              ...scale,
              missing: scale.missing && colors.has(NO_VALUE_ABGR),
              notNumber: scale.notNumber && colors.has(MISCONFIGURED_ABGR),
            }
          : scale?.kind === 'ramp' && colorValue
            ? {
                ...(scale.pinned[0] && scale.pinned[1]
                  ? { ...scale, extent: [vMin, vMax] as [number, number] }
                  : rampOverExtent(scale, [vMin, vMax])),
                missing,
                notNumber,
              }
            : scale,
    shapeScale: shapeScale && {
      ...shapeScale,
      entries: shapeScale.entries.filter(e => glyphs.has(SHAPE_CODES[e.shape])),
    },
  }
}

// The layer as drawn: its rows on the layout, and a hidden section's
// instances gone from every lane and from the hit index.
function facetLayer(layer: StoredLayer, remap: Uint32Array): StoredLayer {
  const { row } = layer
  if (!row) {
    return layer
  }
  const moved = row.map(r => remap[r] ?? HIDDEN)
  if (!moved.includes(HIDDEN)) {
    return { ...layer, row: moved }
  }
  const shown = (_: unknown, i: number) => moved[i] !== HIDDEN
  const x = layer.x.filter(shown)
  const x2 = layer.x2.filter(shown)
  const y = layer.y?.filter(shown)
  return drawnScales({
    ...layer,
    count: x.length,
    x,
    x2,
    y,
    row: moved.filter(r => r !== HIDDEN),
    featureIndex: layer.featureIndex.filter(shown),
    color: layer.color?.filter(shown),
    colorValue: layer.colorValue && keepRampValues(layer.colorValue, shown),
    glyph: layer.glyph?.filter(shown),
    text: layer.text?.filter(shown),
    flatbush: layer.flatbush && x.length > 0 ? hitIndexOf(x, x2, y) : undefined,
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
