import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface GetGlobalValueForTagArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  tag: string
  stopToken?: StopToken
  rpcDriverName?: string
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    PileupGetGlobalValueForTag: {
      args: GetGlobalValueForTagArgs
      return: string[]
    }
  }
}

export default class PileupGetGlobalValueForTag extends RpcMethodTypeWithFiltersAndRenameRegions {
  name = 'PileupGetGlobalValueForTag'

  async execute(args: GetGlobalValueForTagArgs, _rpcDriver: string) {
    const { sessionId, adapterConfig, regions, tag, stopToken } = args

    const dataAdapter = await getFeatureAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

    const tagValues = new Set<string>()
    for (const region of regions) {
      const features =
        (await dataAdapter?.getFeaturesArray(region, { stopToken })) ?? []
      for (const feature of features) {
        // Mirror extractFeatureTagValue's source order (tags object, else the
        // bare field) so every value the render path can color by is discovered
        // here — otherwise a field-backed tag colors per read but never gets a
        // palette entry, leaving those reads on the no-tag fallback.
        const tags = feature.get('tags') as Record<string, unknown> | undefined
        const val = tags ? tags[tag] : feature.get(tag)
        if (val != null) {
          tagValues.add(`${val}`)
        }
      }
    }
    return [...tagValues]
  }
}
