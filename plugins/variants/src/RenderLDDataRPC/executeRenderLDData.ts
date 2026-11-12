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
  bytes,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'RenderLDData'>
  bytes?: number
}) {
  const { regions, axisBlocks, originBp, spanBp, layout, statusCallback } = args

  // `args` whole, never a re-listed subset, so no field the model sends can be
  // dropped on the way to the matrix builder.
  const { snps, ldValues, band, appliedField, hasR2, hasDprime } =
    await updateStatus('Downloading LD data', statusCallback, () =>
      getLDMatrixFromPlink({ pluginManager, args }),
    )

  const n = snps.length
  const uniformW = n === 0 ? 0 : spanBp / (n * Math.SQRT2)
  const boundaries = computeBoundaries({
    snps,
    regions,
    axisBlocks,
    uniformW,
    genomicMode: layout === 'genomic',
  })

  // The buffers move rather than clone: `ldValues` alone can be tens of MB.
  return rpcResultWithArrayBuffers<LDDataResult>({
    ldValues,
    boundaries,
    bytes,
    band,
    uniformW,
    originBp,
    appliedLayout: layout,
    appliedField,
    hasR2,
    hasDprime,
    snps,
  })
}
