import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { createStatusFanOut, updateStatus } from '@jbrowse/core/util'
import { checkAbortSignal } from '@jbrowse/core/util/aborting'
import { layerTables } from '@jbrowse/core/util/featureTransforms'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import {
  MAX_CATEGORICAL_VALUES,
  binSpan,
  categoryColumnWidth,
  columnMeans,
  columnSegments,
  coverSpan,
  markGaps,
} from '@jbrowse/tree-sidebar/binColumns'

import type { MarkRowMatrixArgs } from './rpcTypes.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcCallContext } from '@jbrowse/core/rpc/RpcRegistry'
import type {
  EncodedChannels,
  FacetSection,
} from '@jbrowse/core/util/markEncoding'

/** Where each split row's matrix row starts in the flat matrix, -1 for none asked. */
function rowOffsets(
  sections: readonly FacetSection[],
  matrixRowOf: ReadonlyMap<string, number>,
  stride: number,
) {
  const last = sections.at(-1)
  const offsets = new Int32Array(last ? last.firstRow + last.rowCount : 0)
  offsets.fill(-1)
  for (const { key, firstRow, rowCount } of sections) {
    const r = matrixRowOf.get(key)
    if (r !== undefined) {
      offsets.fill(r * stride, firstRow, firstRow + rowCount)
    }
  }
  return offsets
}

interface EncodedRegion {
  encoded: EncodedChannels
  sections: readonly FacetSection[]
}

// Each instance's number binned into its row's columns by `binSpan`, the
// rule the quantitative display clusters by; a value no number is skipped.
function valueMatrix(
  regions: MarkRowMatrixArgs['regions'],
  bpPerPx: number,
  rows: readonly string[],
  encodedRegions: readonly EncodedRegion[],
  lane: 'y' | 'colorValue',
) {
  const { segments, width } = columnSegments(regions, bpPerPx)
  const matrixRowOf = new Map(rows.map((name, r) => [name, r]))
  const sums = new Float64Array(rows.length * width)
  const counts = new Int32Array(rows.length * width)
  for (const [regionIndex, { encoded, sections }] of encodedRegions.entries()) {
    const { x, x2, row, count } = encoded
    const values = encoded[lane]
    const offsets = rowOffsets(sections, matrixRowOf, width)
    const segment = segments[regionIndex]!
    for (let i = 0; i < count; i++) {
      const offset = offsets[row![i]!] ?? -1
      const v = values![i]!
      if (offset !== -1 && !Number.isNaN(v)) {
        binSpan(sums, counts, offset, segment, x[i]!, x2[i]!, v)
      }
    }
  }
  return new Map(
    rows.map((name, r) => [
      name,
      columnMeans(sums, counts, r * width, new Float32Array(width)),
    ]),
  )
}

// Each instance's category one-hot over the columns it covers, the last
// covering winning, and a gap channel where none does; presence alone where
// the color paints no category or past `MAX_CATEGORICAL_VALUES` of them.
function categoryMatrix(
  regions: MarkRowMatrixArgs['regions'],
  bpPerPx: number,
  rows: readonly string[],
  encodedRegions: readonly EncodedRegion[],
) {
  const slotOf = new Map<string, number>()
  for (const { encoded } of encodedRegions) {
    const { scale } = encoded
    if (encoded.colorKey && scale && 'entries' in scale) {
      for (const { value } of scale.entries) {
        if (!slotOf.has(value)) {
          slotOf.set(value, slotOf.size)
        }
      }
    }
  }
  const categorical = slotOf.size > 0 && slotOf.size <= MAX_CATEGORICAL_VALUES
  const channels = categorical ? slotOf.size + 1 : 1
  const { segments, width } = columnSegments(
    regions,
    categoryColumnWidth(regions, bpPerPx, channels),
  )
  const stride = width * channels
  const matrixRowOf = new Map(rows.map((name, r) => [name, r]))
  const matrix = new Float32Array(rows.length * stride)
  for (const [regionIndex, { encoded, sections }] of encodedRegions.entries()) {
    const { x, x2, row, count, colorKey, scale } = encoded
    const slots =
      categorical && colorKey && scale && 'entries' in scale
        ? scale.entries.map(e => slotOf.get(e.value)!)
        : undefined
    const offsets = rowOffsets(sections, matrixRowOf, stride)
    const segment = segments[regionIndex]!
    for (let i = 0; i < count; i++) {
      const offset = offsets[row![i]!] ?? -1
      if (offset !== -1) {
        const slot = slots ? slots[colorKey![i]!]! : 0
        coverSpan(matrix, offset, channels, segment, x[i]!, x2[i]!, slot)
      }
    }
  }
  return new Map(
    rows.map((name, r) => {
      if (categorical) {
        markGaps(matrix, r * stride, width, channels)
      }
      return [name, matrix.slice(r * stride, (r + 1) * stride)]
    }),
  )
}

/**
 * The matrix over `rows`: each region fetched and split as the display
 * fetches it and the one mark encoded, each row's columns filled by what
 * `compare` says the rows compare on.
 */
export async function collectMarkRowMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: MarkRowMatrixArgs & RpcCallContext
}) {
  const {
    regions,
    rows,
    transform,
    facet,
    bpPerPx,
    layer,
    compare,
    regionOpts,
    signal,
    statusCallback,
  } = args
  const { jexl } = pluginManager
  const dataAdapter = await getFeatureAdapterOrThrow({ ...args, pluginManager })
  const slot = createStatusFanOut(statusCallback)
  const fetched = await updateStatus(
    'Downloading features',
    statusCallback,
    () =>
      Promise.all(
        regions.map((region, i) =>
          dataAdapter.getFeatureTable(region, {
            ...regionOpts?.[i],
            bpPerPx,
            statusCallback: slot(),
            signal,
          }),
        ),
      ),
  )
  const encodedRegions = fetched.map(table => {
    checkAbortSignal(signal)
    const { layers, sections } = layerTables(
      table,
      { transform, facet, layers: [{ transform: layer.transform }] },
      jexl,
    )
    const split = layers[0]!
    return {
      encoded: encodeFeatures(
        split.table,
        { ...layer.encoding, row: split.row },
        compare === 'presence' ? ['row'] : [compare, 'row'],
        { jexl },
      ),
      sections: sections ?? [],
    }
  })
  return compare === 'y' || compare === 'colorValue'
    ? valueMatrix(regions, bpPerPx, rows, encodedRegions, compare)
    : categoryMatrix(regions, bpPerPx, rows, encodedRegions)
}
