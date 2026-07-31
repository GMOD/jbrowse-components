import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { extractFeatureTagValue } from '../shared/extractFeatureTagValue.ts'

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
        // The same extractor the render path keys on, so a field-backed tag (no
        // `tags` object) is discovered here too — re-spelling its source order
        // let a tag color per read while never getting a palette entry, leaving
        // those reads on the no-tag fallback. '' is that extractor's
        // absent/no-value sentinel, which grouping files under "<tag>: none" and
        // coloring paints with the no-value neutral — neither is a discovered
        // value.
        const val = extractFeatureTagValue(feature, tag)
        if (val !== '') {
          tagValues.add(val)
        }
      }
    }
    return [...tagValues]
  }
}
