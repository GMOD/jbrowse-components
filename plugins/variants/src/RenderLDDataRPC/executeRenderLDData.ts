import { updateStatus } from '@jbrowse/core/util'
import { rpcResultWithArrayBuffers } from '@jbrowse/core/util/librpc'

import { getLDMatrixFromPlink } from './getLDMatrixFromPlink.ts'
import { computeBoundaries } from './ldLayout.ts'

import type { LDDataResult } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

export async function executeRenderLDData({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'RenderLDData'>
}) {
  const { regions, originBp, spanBp, layout, statusCallback } = args

  // `args` whole, never a re-listed subset, so no field the model sends can be
  // dropped on the way to the matrix builder.
  const { snps, ldValues, band, appliedField, hasR2, hasDprime } =
    await updateStatus('Downloading LD data', statusCallback, () =>
      getLDMatrixFromPlink({ pluginManager, args }),
    )

  // Genomic positions need one contiguous bp axis, so several regions fall back
  // to uniform columns. An empty result still reports the requested mode,
  // because the display sizes the band above the triangle by it.
  const genomicMode = layout === 'genomic' && regions.length === 1
  const n = snps.length
  const uniformW = n === 0 ? 0 : spanBp / (n * Math.SQRT2)
  const boundaries = computeBoundaries({
    snps,
    region: regions[0]!,
    uniformW,
    genomicMode,
  })

  // The buffers move rather than clone: `ldValues` alone can be tens of MB.
  return rpcResultWithArrayBuffers<LDDataResult>({
    ldValues,
    boundaries,
    numCells: ldValues.length,
    band,
    uniformW,
    originBp,
    appliedLayout: genomicMode ? 'genomic' : 'columns',
    appliedField,
    hasR2,
    hasDprime,
    snps,
  })
}
