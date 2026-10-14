import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  MAX_LEGEND_ENTRIES,
  derivedColorScale,
} from '@jbrowse/core/util/legendCandidates'

import { fieldColorCandidates } from '../../shared/fieldColorCandidates.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'

// Whether a region-local row's blocks wear their own colors: the row is drawn
// and no row color paints over them.
function rowPaintsOwnColors(
  rowIndexByValue: ReadonlyMap<string, number>,
  rowColorsByIndex: readonly (number | undefined)[],
) {
  return (
    data: Pick<MultiRowRegionData, 'rowValues'>,
    rowValueIndex: number,
  ) => {
    const row = rowIndexByValue.get(data.rowValues[rowValueIndex]!)
    return row !== undefined && rowColorsByIndex[row] === undefined
  }
}

const FEATURE_NAME = 'name'

// A key row: a color and every name painted in it, which `label` joins. A
// category is hidden by name, so a name joining the color later does not
// unhide it.
export interface LegendEntry {
  label: string
  values: string[]
  color: number
}

export function entryHidden(entry: LegendEntry, hidden: ReadonlySet<string>) {
  return entry.values.some(v => hidden.has(v))
}

// Deduped on both halves: a repeated label collides as the React key, and a
// repeated color as the toggle key, so two labels sharing one color would give
// a row whose checkbox blanks its neighbour's features.
export function resolveIdentityLegend(
  entries: readonly { value: string; label: string; color: string }[],
): LegendEntry[] {
  const seenLabels = new Set<string>()
  const seenColors = new Set<number>()
  const result: LegendEntry[] = []
  for (const e of entries) {
    const color = cssColorToABGR(e.color)
    if (!seenLabels.has(e.label) && !seenColors.has(color)) {
      seenLabels.add(e.label)
      seenColors.add(color)
      result.push({ label: e.label, values: [e.value], color })
    }
  }
  return result
}

/**
 * The categorical color key for a per-feature-colored painting, derived as
 * every color channel's is (`derivedColorScale`): a row per color naming each
 * value painted in it. Under a color `field` the values are the ones the
 * worker found, each painted through the field's scale in the field's order,
 * and every bin of a threshold once anything painted; otherwise they are
 * feature names in `domain`'s order. A row with a per-row color override
 * paints every block that one color, so it contributes nothing here — the
 * legend describes the `color` axis, not the row axis.
 */
export function buildColorLegend(
  regions: Iterable<MultiRowRegionData>,
  {
    field,
    domain = [],
    rowIndexByValue,
    rowColorsByIndex,
  }: {
    field?: CategoricalField
    domain?: readonly string[]
    rowIndexByValue: ReadonlyMap<string, number>
    rowColorsByIndex: readonly (number | undefined)[]
  },
): LegendEntry[] {
  // The default configuration: an unset `color` over features with no itemRgb
  // gives every row a palette color, and no region need be read.
  if (
    rowColorsByIndex.length > 0 &&
    rowColorsByIndex.every(c => c !== undefined)
  ) {
    return []
  }
  const rowPaints = rowPaintsOwnColors(rowIndexByValue, rowColorsByIndex)
  const [scale] = derivedColorScale(
    regions,
    field
      ? fieldColorCandidates<MultiRowRegionData>(field, rowPaints)
      : data => ({
          candidates: data.legendCandidates,
          rowPaintsCandidateColor: rowValueIndex =>
            rowPaints(data, rowValueIndex),
        }),
    {
      id: 'features',
      field: field ?? categoricalField(FEATURE_NAME, { domain }),
      maxItems: MAX_LEGEND_ENTRIES,
    },
  )
  return (scale?.entries ?? []).map(e => ({
    label: e.label,
    values: e.values ?? [e.value],
    color: cssColorToABGR(e.color ?? ''),
  }))
}
