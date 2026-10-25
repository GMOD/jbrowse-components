import {
  collectLegendCandidates,
  featureRun,
} from '../MultiRowGetFeaturesRPC/packMultiRowFeatures.ts'

import type { MultiRowRegionData } from './rendering/multiRowRenderingBackendTypes.ts'

/**
 * The part of a loaded region the window shows: its features overlapping
 * `spans`, every part of a feature kept while the feature overlaps, their rows renumbered over the values they carry and their color
 * key candidates found again. A fetch reaches half a window past each side, so
 * rows and a key read off the whole region list what is off screen.
 * `colorValues.values` stays whole, so a value keeps its index and its dealt
 * color.
 */
export function windowedRegion(
  data: MultiRowRegionData,
  spans: readonly { start: number; end: number }[],
): MultiRowRegionData {
  const kept: number[] = []
  for (let i = 0; i < data.featureIds.length;) {
    const [first, last] = featureRun(data.featureIds, i)
    const start = data.featureStarts[first]!
    const end = data.featureEnds[last]!
    if (spans.some(s => start < s.end && end > s.start)) {
      for (let k = first; k <= last; k++) {
        kept.push(k)
      }
    }
    i = last + 1
  }
  if (kept.length === data.featureIds.length) {
    return data
  }
  const rowValues: string[] = []
  const rowOf = new Map<number, number>()
  const featureRowValueIndex = Uint32Array.from(kept, i => {
    const old = data.featureRowValueIndex[i]!
    let row = rowOf.get(old)
    if (row === undefined) {
      row = rowValues.length
      rowValues.push(data.rowValues[old]!)
      rowOf.set(old, row)
    }
    return row
  })
  const pick = <T extends Uint32Array>(lane: T) =>
    lane.length > 0 ? Uint32Array.from(kept, i => lane[i]!) : lane
  const rectColorValues = pick(data.rectColorValues)
  const featureNames = kept.map(i => data.featureNames[i]!)
  const featureColors = pick(data.featureColors)
  const { colorValues } = data
  const painted = new Map<string, { rowIndex: number; valueIndex: number }>()
  if (colorValues) {
    for (let k = 0; k < kept.length; k++) {
      const rowIndex = featureRowValueIndex[k]!
      const valueIndex = rectColorValues[k]! - 1
      painted.set(`${rowIndex}:${valueIndex}`, { rowIndex, valueIndex })
    }
  }
  return {
    ...data,
    featureStarts: pick(data.featureStarts),
    featureEnds: pick(data.featureEnds),
    featureColors,
    rectColorValues,
    colorValues: colorValues && {
      ...colorValues,
      painted: [...painted.values()],
    },
    rowValues,
    featureRowValueIndex,
    featureNames,
    featureIds: kept.map(i => data.featureIds[i]!),
    legendCandidates: collectLegendCandidates({
      featureNames,
      featureColors,
      featureRowValueIndex,
    }),
  }
}
