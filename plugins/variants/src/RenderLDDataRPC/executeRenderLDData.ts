import { updateStatus } from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'

import { getLDMatrixFromPlink } from '../VariantRPC/getLDMatrixFromPlink.ts'
import { bandCellCount } from '../VariantRPC/ldBand.ts'
import { buildGenomicCellBuffers, computeBoundaries } from './ldLayout.ts'
import { applyDisplayOrder, getDisplayOrder } from './reversedRegions.ts'

import type { LDMatrixResult } from '../VariantRPC/ldTypes.ts'
import type { LDDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

// `RpcExecuteArgs`, not `RenderLDDataArgs & { statusCallback? }`: re-adding one
// handle by hand is how a worker-side type ends up carrying a different set from
// the one the driver delivers.
type ExecuteArgs = RpcExecuteArgs<'RenderLDData'>

// Nothing to lay out — the file named no pairs here, or there is no region to
// lay them out in.
//
// `genomicMode` is the requested mode rather than a flat `false`, because the
// display branches its *chrome* on it and not only its matrix:
// `effectiveUseGenomicPositions` picks the label zone over the connector zone
// and, through `effectiveLineZoneHeight`, decides how much room sits above the
// canvas. Reporting `false` here moved the whole triangle down by
// `lineZoneHeight` (100px by default) on the one frame with no content in it.
// There is no matrix either way; the honest answer for the chrome is the mode
// the display is in.
function emptyResult(
  { metric, hasR2, hasDprime }: LDMatrixResult,
  genomicMode: boolean,
  originBp: number,
) {
  return rpcResultWithArrayBuffers<LDDataResult>({
    ldValues: new Float32Array(0),
    boundaries: new Float32Array(0),
    numCells: 0,
    band: 0,
    uniformW: 0,
    originBp,
    genomicMode,
    metric,
    hasR2,
    hasDprime,
    snps: [],
  })
}

export async function executeRenderLDData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: ExecuteArgs
}) {
  const { regions, originBp, useGenomicPositions, statusCallback } = args

  // `args` whole, never a re-listed subset: the matrix builder takes a
  // structural superset of the payload, and re-spelling the fields is how
  // `maxVariantSeparation` came to be declared, sent, and then dropped on the
  // floor here while every layer around it looked wired.
  const ldData = await updateStatus('Downloading LD data', statusCallback, () =>
    getLDMatrixFromPlink({ pluginManager, args }),
  )

  // Resolved before the empty check so both exits report the same thing.
  // Genomic-positions mode maps each SNP onto a single continuous bp axis
  // (offset from the region's left screen edge), which is only meaningful for
  // one contiguous region. With multiple regions (e.g. a split/multi-region
  // view) SNPs from later regions would collapse onto the first region's
  // coordinates, so fall back to uniform cells there.
  const genomicMode = useGenomicPositions && regions.length === 1

  const region = regions[0]
  if (ldData.snps.length === 0 || !region) {
    return emptyResult(ldData, genomicMode, originBp)
  }

  // LD values themselves are orientation-free; only the axis is. A reversed
  // displayed region is folded in once here, on the layout side of the worker,
  // so every consumer of `snps`/`boundaries` (both renderers, hitTest,
  // connector lines, labels, SVG export) stays forward-only.
  const displayOrder = getDisplayOrder(ldData.snps, regions)
  const { snps, ldValues } = displayOrder
    ? applyDisplayOrder(ldData, displayOrder, ldData.band)
    : ldData
  const n = snps.length

  const totalWidthBp = regions.reduce((sum, r) => sum + r.end - r.start, 0)
  const uniformW = totalWidthBp / (n * Math.SQRT2)
  const band = ldData.band
  const numCells = bandCellCount(n, band)

  const boundaries = computeBoundaries({
    snps,
    region,
    uniformW,
    genomicMode,
  })
  const cellBuffers = genomicMode
    ? buildGenomicCellBuffers(boundaries, band)
    : undefined

  // The buffers move rather than clone: `ldValues` alone is n(n-1)/2 floats,
  // which a structure clone copies on every pan. All four are allocated in this
  // call (see the registry entry), so nothing worker-side is left detached.
  return rpcResultWithArrayBuffers<LDDataResult>({
    ldValues,
    boundaries,
    numCells,
    band,
    uniformW,
    originBp,
    genomicMode,
    metric: ldData.metric,
    hasR2: ldData.hasR2,
    hasDprime: ldData.hasDprime,
    snps,
    ...cellBuffers,
  })
}
