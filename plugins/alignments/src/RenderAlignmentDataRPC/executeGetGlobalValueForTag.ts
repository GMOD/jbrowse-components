import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { measureRegionBytes } from '@jbrowse/core/rpc/byteBudget'

import { extractFeatureTagValue } from '../shared/extractFeatureTagValue.ts'
import { filterChainFeatures } from './filterChainFeatures.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

export async function executeGetGlobalValueForTag({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RpcExecuteArgs<'PileupGetGlobalValueForTag'>
}) {
  const {
    regions,
    tag,
    filter,
    pinnedInsertSizeBand,
    byteLimit,
    signal,
    statusCallback,
  } = args

  const dataAdapter = await getFeatureAdapterOrThrow({
    ...args,
    pluginManager,
  })

  // The same first await the render fetch takes, judged by the largest region
  // because the budget is per region. Refused off the index alone, before a
  // read is downloaded.
  const { tooLarge } = await measureRegionBytes({
    dataAdapter,
    regions,
    byteLimit,
    signal,
    statusCallback,
  })
  if (tooLarge) {
    return tooLarge
  }

  // Spread like `fetchFeaturesFromAdapter`'s: `filter` is an alignments
  // concept the BAM/CRAM adapters read off the options bag, not a BaseOptions
  // field.
  const fetchOpts: BaseOptions & { filter?: FieldPredicate[] } = {
    signal,
    statusCallback,
    filter,
  }
  const tagValues = new Set<string>()
  for (const region of regions) {
    // statusCallback as well as the signal: this reads every feature of every
    // visible region to enumerate a tag's values, the longest thing the
    // group-by-tag dialog does.
    // The adapter applies the flag and tag filters, and `filterChainFeatures`
    // the rest as the render fetch does: `mapq`, then `name` and `spliced`
    // per record and `svSignal`, `split` and `alone` per chain.
    const features = filterChainFeatures(
      await dataAdapter.getFeaturesArray(region, fetchOpts),
      filter,
      pinnedInsertSizeBand,
    )
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
