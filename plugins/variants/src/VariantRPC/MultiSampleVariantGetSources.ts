import { isFeatureAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { Source } from '../shared/types.ts'
import type { MultiSampleVariantGetSourcesArgs } from './types.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'

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
  getSourcesAndWarnings(): Promise<{ sources: Source[]; warnings: string[] }>
}

function hasSourcesAndWarnings(
  adapter: object,
): adapter is SourcesAndWarningsAdapter {
  return (
    typeof (adapter as Partial<SourcesAndWarningsAdapter>)
      .getSourcesAndWarnings === 'function'
  )
}

export class MultiSampleVariantGetSources extends RpcMethodTypeWithFiltersAndRenameRegions<'MultiSampleVariantGetSources'> {
  name = 'MultiSampleVariantGetSources' as const

  async execute(args: RpcExecuteArgs<'MultiSampleVariantGetSources'>) {
    const { regions, adapterConfig, sessionId } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )
    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error('Expected a feature data adapter')
    }
    if (hasSourcesAndWarnings(dataAdapter)) {
      return dataAdapter.getSourcesAndWarnings()
    }
    // The whole deserialized bag as opts, so the handles ride along. The
    // default `getSources` has no index to consult — it scans every feature in
    // every region to collect the source names — and this was calling it with
    // no opts at all, which on a large panel is a full scan that cannot be
    // cancelled and reports nothing.
    return {
      sources: await dataAdapter.getSources(regions ?? [], args),
      warnings: [],
    }
  }
}
