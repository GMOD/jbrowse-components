import { getConf } from '../../../configuration/index.ts'
import { getEnv, getSession } from '../../../util/index.ts'
import { getRpcSessionId } from '../../../util/tracks.ts'

import type { Region } from '../../../util/index.ts'
import type { StatusCallback } from '../../../util/progress.ts'
import type { StopToken } from '../../../util/stopToken.ts'
import type { FileTypeExporter } from '../saveTrackFileTypes/types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

function roundRegions(regions: Region[]) {
  return regions.map(r => ({
    ...r,
    start: Math.floor(r.start),
    end: Math.ceil(r.end),
  }))
}

export async function fetchTrackData(
  model: IAnyStateTreeNode,
  visibleRegions: Region[],
  type: string,
  options: Record<string, FileTypeExporter>,
  // this reads every feature in the visible region, which on a deep track is the
  // same work the display itself does — worth cancelling when the dialog closes,
  // and worth naming while it runs
  opts: { stopToken?: StopToken; statusCallback?: StatusCallback } = {},
): Promise<{ str: string; usedAdapterExport: boolean }> {
  const { pluginManager } = getEnv(model)
  const adapterConfig = getConf(model, ['adapter'])
  const adapterType = pluginManager.getAdapterType(adapterConfig.type)
  const supportsExport = adapterType.adapterCapabilities.includes('exportData')
  const session = getSession(model)
  const sessionId = getRpcSessionId(model)
  const regions = roundRegions(visibleRegions)

  if (supportsExport) {
    const str = await session.rpcManager.call(sessionId, 'CoreGetExportData', {
      adapterConfig,
      regions,
      formatType: type,
      ...opts,
    })
    return { str, usedAdapterExport: true }
  } else {
    const features = await session.rpcManager.call(
      sessionId,
      'CoreGetFeatures',
      {
        adapterConfig,
        regions,
        ...opts,
      },
    )
    const str = await options[type]!.callback({
      features,
      session,
      assemblyName: regions[0]!.assemblyName,
    })
    return { str, usedAdapterExport: false }
  }
}
