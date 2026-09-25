import { categoricalField } from '@jbrowse/core/util/categoricalField'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import {
  MAX_LEGEND_ENTRIES,
  derivedColorScale,
} from '@jbrowse/core/util/legendCandidates'

import { configuredLegendEntries } from '../../shared/configuredLegend.ts'
import { resolveLocalRowIndices } from './featurePainting.ts'

import type { MultiRowRegionData } from './multiRowRenderingBackendTypes.ts'
import type { CategoricalField } from '@jbrowse/core/util/categoricalField'

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
export function resolveConfiguredLegend(entries: unknown): LegendEntry[] {
  const seenLabels = new Set<string>()
  const seenColors = new Set<number>()
  const result: LegendEntry[] = []
  for (const e of configuredLegendEntries(entries)) {
    const color = cssColorToABGR(e.color)
    if (!seenLabels.has(e.label) && !seenColors.has(color)) {
      seenLabels.add(e.label)
      seenColors.add(color)
      result.push({ label: e.label, values: [e.label], color })
    }
  }
  return result
}

/**
 * The categorical color key for a per-feature-colored painting, derived as
 * every color channel's is (`derivedColorScale`): a row per color naming each
 * feature name painted in it, in `domain`'s order. A row with a per-row color
 * override paints every block that one color, so it contributes nothing here —
 * the legend describes the `color` axis, not the row axis.
 */
export function buildColorLegend(
  regions: Iterable<MultiRowRegionData>,
  rowIndexByValue: ReadonlyMap<string, number>,
  rowColorsByIndex: readonly (number | undefined)[],
  domain: readonly string[] = [],
): LegendEntry[] {
  // The default configuration: an unset `color` over features with no itemRgb
  // gives every row a palette color.
  if (everyRowOverridden(rowColorsByIndex)) {
    return []
  }
  const [key] = derivedColorScale(
    regions,
    data => {
      const rowForLocal = resolveLocalRowIndices(
        data.partitionValues,
        rowIndexByValue,
      )
      return {
        candidates: data.legendCandidates,
        rowPaintsCandidateColor: partitionIndex => {
          const row = rowForLocal[partitionIndex]
          return row !== undefined && rowColorsByIndex[row] === undefined
        },
      }
    },
    {
      id: 'features',
      field: categoricalField(FEATURE_NAME, { domain }),
      maxItems: MAX_LEGEND_ENTRIES,
    },
  )
  return (key?.entries ?? []).map(
    ({ label, value, values = [value], color }) => ({
      label,
      values,
      color: cssColorToABGR(color!),
    }),
  )
}

// No region need be read when every row paints its own colour.
function everyRowOverridden(rowColorsByIndex: readonly (number | undefined)[]) {
  return (
    rowColorsByIndex.length > 0 && rowColorsByIndex.every(c => c !== undefined)
  )
}

/**
 * The key the colour field's scale derives from the values the worker found,
 * each painted through `field`, as every derived key runs it: one row per
 * colour naming every value painted in it, in the field's order, and every bin
 * of a threshold once anything painted. A row painting its own colour paints
 * none of these, so its values stay out.
 */
export function buildFieldColorLegend(
  regions: Iterable<MultiRowRegionData>,
  field: CategoricalField,
  rowIndexByValue: ReadonlyMap<string, number>,
  rowColorsByIndex: readonly (number | undefined)[],
): LegendEntry[] {
  if (everyRowOverridden(rowColorsByIndex)) {
    return []
  }
  const [scale] = derivedColorScale(
    regions,
    data => {
      const { colorValues } = data
      const rowForLocal = resolveLocalRowIndices(
        data.partitionValues,
        rowIndexByValue,
      )
      return {
        candidates:
          colorValues?.field === field.field
            ? colorValues.painted.map(({ rowIndex, valueIndex }) => {
                const value = field.key(colorValues.values[valueIndex])
                return {
                  rowIndex,
                  value,
                  color: cssColorToABGR(field.color(value)),
                }
              })
            : [],
        rowPaintsCandidateColor: partitionIndex => {
          const row = rowForLocal[partitionIndex]
          return row !== undefined && rowColorsByIndex[row] === undefined
        },
      }
    },
    { id: 'features', field, maxItems: MAX_LEGEND_ENTRIES },
  )
  return scale?.kind === 'categorical'
    ? scale.entries.map(e => ({
        label: e.label,
        values: e.values ?? [e.value],
        color: cssColorToABGR(e.color ?? ''),
      }))
    : []
}
