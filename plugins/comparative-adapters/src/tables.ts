import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { tablesAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { adapterAssemblyNames } from '@jbrowse/synteny-core'

import { PairwiseAdapterBase } from './PairwiseAdapterBase.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

export { registerComparativeAdapters } from './registerComparativeAdapters.ts'

export interface ContigTablesArgs {
  adapterConfig: Record<string, unknown>
}

async function sideContigs(
  dataAdapter: AnyDataAdapter,
  side: 0 | 1,
  assemblyName: string,
) {
  const lengths =
    dataAdapter instanceof PairwiseAdapterBase
      ? await dataAdapter.getContigLengths(side)
      : undefined
  const refName = lengths
    ? [...lengths.keys()]
    : dataAdapter instanceof BaseFeatureDataAdapter
      ? await dataAdapter.getRefNames({ assemblyName })
      : []
  return {
    assemblyName,
    refName,
    length: refName.map(name => {
      const length = lengths?.get(name)
      return length !== undefined && Number.isFinite(length) ? length : null
    }),
  }
}

/**
 * #api
 * Each side of a pairwise file as tables: `query` and `target`, each its
 * assembly name and its contigs in the order the file first names them, with
 * the length the file states (`null` for a file such as an MCScan anchors
 * file, which lists genes and no contigs). A host lays
 * a whole-genome axis out of them, as the dotplot import does from an
 * assembly.
 */
export async function contigTables(
  pluginManager: PluginManager,
  { adapterConfig }: ContigTablesArgs,
) {
  const names = adapterAssemblyNames(adapterConfig)
  const dataAdapter = await tablesAdapter(
    pluginManager,
    adapterConfig,
    undefined,
  )
  return {
    query: await sideContigs(dataAdapter, 0, names[0] ?? ''),
    target: await sideContigs(dataAdapter, 1, names[1] ?? names[0] ?? ''),
  }
}

export type ContigTables = Awaited<ReturnType<typeof contigTables>>
