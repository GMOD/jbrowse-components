import { getFeatureAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { extractFeatureTagValue } from '../shared/extractFeatureTagValue.ts'

import type { FilterBy } from '../shared/types.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

interface GetGlobalValueForTagArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  tag: string
  // The display's read filter, forwarded to the adapter exactly as the render
  // fetch does (`fetchFeaturesFromAdapter`). Without it this scan answers over a
  // read set the track never draws — and its one caller uses the answer to
  // decide whether a tag grouping would exceed `MAX_GROUPS`, so a value carried
  // only by filtered-out reads both padded "Found values" and could block Submit
  // on a grouping that would in fact have produced a handful of sections.
  filterBy?: FilterBy
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

  async execute(args: RpcExecuteArgs<'PileupGetGlobalValueForTag'>) {
    const {
      sessionId,
      adapterConfig,
      regions,
      tag,
      filterBy,
      stopToken,
      statusCallback,
    } = args

    const dataAdapter = await getFeatureAdapter({
      pluginManager: this.pluginManager,
      sessionId,
      adapterConfig,
    })

    // Spread like `fetchFeaturesFromAdapter`'s: `filterBy` is an alignments
    // concept the BAM/CRAM adapters read off the options bag, not a BaseOptions
    // field.
    const fetchOpts: BaseOptions & { filterBy?: FilterBy } = {
      stopToken,
      statusCallback,
      filterBy,
    }
    const tagValues = new Set<string>()
    for (const region of regions) {
      // statusCallback as well as the token: this reads every feature of every
      // visible region to enumerate a tag's values, which is the longest thing
      // the group-by-tag dialog does and had nowhere to report it.
      const features =
        (await dataAdapter?.getFeaturesArray(region, fetchOpts)) ?? []
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
