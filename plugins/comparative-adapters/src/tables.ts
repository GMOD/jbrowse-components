import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { adapterAssemblyNames } from '@jbrowse/synteny-core'

import BlastTabularAdapterF from './BlastTabularAdapter/index.ts'
import ChainAdapterF from './ChainAdapter/index.ts'
import DeltaAdapterF from './DeltaAdapter/index.ts'
import MCScanAnchorsAdapterF from './MCScanAnchorsAdapter/index.ts'
import MCScanBlocksAdapterF from './MCScanBlocksAdapter/index.ts'
import MCScanSimpleAnchorsAdapterF from './MCScanSimpleAnchorsAdapter/index.ts'
import MashMapAdapterF from './MashMapAdapter/index.ts'
import MultiGenomeIndexedPAFAdapterF from './MultiGenomeIndexedPAFAdapter/index.ts'
import MultiGenomePAFAdapterF from './MultiGenomePAFAdapter/index.ts'
import MultiPairwiseSyntenyAdapterF from './MultiPairwiseSyntenyAdapter/index.ts'
import PAFAdapterF from './PAFAdapter/index.ts'
import { PairwiseAdapterBase } from './PairwiseAdapterBase.ts'
import PairwiseIndexedPAFAdapterF from './PairwiseIndexedPAFAdapter/index.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * Registers every comparative adapter, and none of the plugin's UI, for a host
 * that reads synteny tables through `@jbrowse/tables`.
 */
export function registerComparativeAdapters(pluginManager: PluginManager) {
  MultiGenomePAFAdapterF(pluginManager)
  MultiGenomeIndexedPAFAdapterF(pluginManager)
  PAFAdapterF(pluginManager)
  PairwiseIndexedPAFAdapterF(pluginManager)
  MultiPairwiseSyntenyAdapterF(pluginManager)
  DeltaAdapterF(pluginManager)
  ChainAdapterF(pluginManager)
  MCScanAnchorsAdapterF(pluginManager)
  MCScanBlocksAdapterF(pluginManager)
  MCScanSimpleAnchorsAdapterF(pluginManager)
  MashMapAdapterF(pluginManager)
  BlastTabularAdapterF(pluginManager)
}

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
 * the length the file states (`null` where the adapter cannot tell, such as
 * an MCScan anchors file, which lists genes rather than contigs). A host lays
 * a whole-genome axis out of them, as the dotplot import does from an
 * assembly.
 */
export async function contigTables(
  pluginManager: PluginManager,
  { adapterConfig }: ContigTablesArgs,
) {
  const names = adapterAssemblyNames(adapterConfig)
  const { dataAdapter } = await getAdapter(
    pluginManager,
    'tables',
    adapterConfig,
  )
  return {
    query: await sideContigs(dataAdapter, 0, names[0] ?? ''),
    target: await sideContigs(dataAdapter, 1, names[1] ?? names[0] ?? ''),
  }
}

export type ContigTables = Awaited<ReturnType<typeof contigTables>>
