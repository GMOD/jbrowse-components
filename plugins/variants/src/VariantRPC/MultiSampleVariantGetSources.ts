import { getFeatureAdapterOrThrow } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { Source } from '../shared/types.ts'
import type { MultiSampleVariantGetSourcesArgs } from './types.ts'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    MultiSampleVariantGetSources: {
      args: MultiSampleVariantGetSourcesArgs
      return: { sources: Source[]; warnings: string[] }
    }
  }
}

// The VCF adapters answer with the samples-metadata warnings attached — a
// `samplesTsv` naming only some of the VCF's samples is worth telling the user
// about, and the worker's console is not where anyone sees it. Any other feature
// adapter has only the base-class `getSources`, and nothing to warn about.
interface SourcesAndWarningsAdapter {
  getSourcesAndWarnings(
    opts: BaseOptions,
  ): Promise<{ sources: Source[]; warnings: string[] }>
}

function hasSourcesAndWarnings(
  adapter: object,
): adapter is SourcesAndWarningsAdapter {
  return (
    typeof (adapter as Partial<SourcesAndWarningsAdapter>)
      .getSourcesAndWarnings === 'function'
  )
}

/**
 * An adapter's samples, with the samples-metadata warnings where its
 * `getSourcesAndWarnings` gives them. The base-class `getSources` has no index
 * to consult, so `opts` carries the handles its full scan reports through.
 */
export async function sourcesAndWarnings(
  adapter: BaseFeatureDataAdapter,
  regions: Region[],
  opts: BaseOptions,
) {
  return hasSourcesAndWarnings(adapter)
    ? adapter.getSourcesAndWarnings(opts)
    : { sources: await adapter.getSources(regions, opts), warnings: [] }
}

export class MultiSampleVariantGetSources extends RpcMethodTypeWithFiltersAndRenameRegions<'MultiSampleVariantGetSources'> {
  name = 'MultiSampleVariantGetSources' as const

  async execute(args: RpcExecuteArgs<'MultiSampleVariantGetSources'>) {
    const dataAdapter = await getFeatureAdapterOrThrow({
      ...args,
      pluginManager: this.pluginManager,
    })
    return sourcesAndWarnings(dataAdapter, args.regions ?? [], args)
  }
}
