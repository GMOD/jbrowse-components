import { updateStatus } from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'

import { getLDMatrix } from '../VariantRPC/getLDMatrix.ts'
import { getLDMatrixFromPlink } from '../VariantRPC/getLDMatrixFromPlink.ts'
import { buildGenomicCellBuffers, computeBoundaries } from './ldLayout.ts'
import { applyDisplayOrder, getDisplayOrder } from './reversedRegions.ts'
import { isPrecomputedLDAdapter } from './types.ts'

import type { LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'
import type { LDDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

// `RpcExecuteArgs`, not `RenderLDDataArgs & { statusCallback? }`: re-adding one
// handle by hand is how a worker-side type ends up carrying a different set from
// the one the driver delivers.
type ExecuteArgs = RpcExecuteArgs<'RenderLDData'>

// Nothing to lay out — no SNPs passed the filters, or there is no region to lay
// them out in. `filterStats` rides along regardless: an empty triangle is
// exactly when the status bar's "0 / 812 variants shown (812 MAF)" is the only
// thing on screen explaining it.
//
// `genomicMode` is the requested mode rather than a flat `false`, because the
// display branches its *chrome* on it and not only its matrix:
// `effectiveUseGenomicPositions` picks the label zone over the connector zone
// and, through `effectiveLineZoneHeight`, decides how much room sits above the
// canvas. Reporting `false` here made a filter that emptied the result also
// move the whole triangle down by `lineZoneHeight` (100px by default) and
// shrink it — a layout jump on the one frame whose only content is the status
// bar explaining the emptiness, and it un-jumped when the filter came back
// down. There is no matrix either way; the honest answer for the chrome is the
// mode the display is in.
function emptyResult(
  { metric, method, hasDprime, filterStats }: LDMatrixResult,
  signedLD: boolean,
  genomicMode: boolean,
) {
  return rpcResultWithArrayBuffers<LDDataResult>({
    ldValues: new Float32Array(0),
    boundaries: new Float32Array(0),
    numCells: 0,
    uniformW: 0,
    genomicMode,
    metric,
    hasDprime,
    method,
    signedLD,
    snps: [],
    filterStats,
  })
}

export async function executeRenderLDData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: ExecuteArgs
}) {
  const {
    sessionId,
    adapterConfig,
    regions,
    bpPerPx,
    ldMetric,
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    hweFilterThreshold,
    callRateFilter,
    jexlFilters,
    signedLD,
    useGenomicPositions,
    statusCallback,
  } = args

  const isPrecomputed = isPrecomputedLDAdapter(adapterConfig.type)
  // What the values in hand will actually be, not what was asked for: the
  // pre-computed path reads magnitudes out of a file and has no genotypes to
  // recover a sign from, so it cannot honor the request. Answering honestly here
  // is what keeps the ramp, the legend and the tooltip (all of which read this
  // back off the result) describing the same numbers.
  const signedResult = signedLD && !isPrecomputed
  const ldData = await (isPrecomputed
    ? updateStatus('Downloading LD data', statusCallback, () =>
        getLDMatrixFromPlink({
          pluginManager,
          args: {
            regions,
            sessionId,
            adapterConfig,
            ldMetric,
          },
        }),
      )
    : getLDMatrix({
        pluginManager,
        args: {
          regions,
          sessionId,
          adapterConfig,
          bpPerPx,
          ldMetric,
          minorAlleleFrequencyFilter,
          lengthCutoffFilter,
          hweFilterThreshold,
          callRateFilter,
          jexlFilters,
          signedLD,
          stopToken: args.stopToken,
          statusCallback,
        },
      }))

  // Resolved before the empty check so both exits report the same thing.
  // Genomic-positions mode maps each SNP onto a single continuous bp axis
  // (offset from the region's left screen edge), which is only meaningful for
  // one contiguous region. With multiple regions (e.g. a split/multi-region
  // view) SNPs from later regions would collapse onto the first region's
  // coordinates, so fall back to uniform cells there.
  const genomicMode = useGenomicPositions && regions.length === 1

  const region = regions[0]
  if (ldData.snps.length === 0 || !region) {
    return emptyResult(ldData, signedResult, genomicMode)
  }

  // LD values themselves are orientation-free; only the axis is. A reversed
  // displayed region is folded in once here, on the layout side of the worker,
  // so every consumer of `snps`/`boundaries` (both renderers, hitTest,
  // connector lines, labels, SVG export) stays forward-only.
  const displayOrder = getDisplayOrder(ldData.snps, regions)
  const { snps, ldValues } = displayOrder
    ? applyDisplayOrder(ldData, displayOrder)
    : ldData
  const n = snps.length

  const totalWidthBp = regions.reduce((sum, r) => sum + r.end - r.start, 0)
  const width = totalWidthBp / bpPerPx
  const uniformW = width / (n * Math.SQRT2)
  const numCells = (n * (n - 1)) / 2

  const boundaries = computeBoundaries({
    snps,
    region,
    bpPerPx,
    uniformW,
    genomicMode,
  })
  const cellBuffers = genomicMode
    ? buildGenomicCellBuffers(boundaries)
    : undefined

  // The buffers move rather than clone: `ldValues` alone is n(n-1)/2 floats,
  // which a structure clone copies on every pan. All four are allocated in this
  // call (see the registry entry), so nothing worker-side is left detached.
  return rpcResultWithArrayBuffers<LDDataResult>({
    ldValues,
    boundaries,
    numCells,
    uniformW,
    genomicMode,
    metric: ldData.metric,
    hasDprime: ldData.hasDprime,
    method: ldData.method,
    signedLD: signedResult,
    snps,
    filterStats: ldData.filterStats,
    ...cellBuffers,
  })
}
