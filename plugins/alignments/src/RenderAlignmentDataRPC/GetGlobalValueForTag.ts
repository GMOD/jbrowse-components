import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { extractFeatureTagValue } from '../shared/extractFeatureTagValue.ts'

import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

interface GetGlobalValueForTagArgs {
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  tag: string
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    PileupGetGlobalValueForTag: {
      args: GetGlobalValueForTagArgs
      return: string[]
    }
  }
}

export default class PileupGetGlobalValueForTag extends RpcMethodTypeWithFiltersAndRenameRegions<'PileupGetGlobalValueForTag'> {
  name = 'PileupGetGlobalValueForTag' as const

  async execute(
    args: RpcExecuteArgs<'PileupGetGlobalValueForTag'>,
    rpcDriverClassName: string,
  ) {
    const {
      sessionId,
      adapterConfig,
      regions,
      tag,
      stopToken,
      statusCallback,
    } = await this.deserializeArguments(args, rpcDriverClassName)

    const dataAdapter = await getFeatureAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

    const tagValues = new Set<string>()
    for (const region of regions) {
      // statusCallback as well as the token: this reads every feature of every
      // visible region to enumerate a tag's values, which is the longest thing
      // the "Color by tag" dialog does and had nowhere to report it.
      const features =
        (await dataAdapter?.getFeaturesArray(region, {
          stopToken,
          statusCallback,
        })) ?? []
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
