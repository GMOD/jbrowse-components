import { isRegionsAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { tablesAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import type { ResolvedAssembly } from './assembly.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

/**
 * The end a whole contig reads to where nothing states its length: the most
 * an int32 holds, which each reader clamps to what its index addresses.
 */
export const WHOLE_CONTIG_END = 2 ** 31 - 1

interface Contig {
  refName: string
  length?: number
  hasData?: boolean | null
}

/**
 * Adapters whose contig names come from a tabix index, which lists only the
 * contigs holding records, or from the parsed records themselves.
 */
const NAMES_FROM_RECORDS = new Set([
  'BedAdapter',
  'BedTabixAdapter',
  'BedGraphAdapter',
  'BedGraphTabixAdapter',
  'BedpeAdapter',
  'Gff3Adapter',
  'Gff3TabixAdapter',
  'GtfAdapter',
  'GtfTabixAdapter',
  'FromConfigAdapter',
  'VcfAdapter',
  'VcfTabixAdapter',
])

async function contigsOf(
  pluginManager: PluginManager,
  adapterConfig: Record<string, unknown>,
  sequenceAdapter: Record<string, unknown> | undefined,
  assemblyName?: string,
): Promise<Contig[]> {
  const dataAdapter = await tablesAdapter(
    pluginManager,
    adapterConfig,
    sequenceAdapter,
  )
  if ('getContigs' in dataAdapter) {
    return (dataAdapter as { getContigs: () => Promise<Contig[]> }).getContigs()
  }
  const refNames: string[] =
    'getRefNames' in dataAdapter
      ? await (
          dataAdapter as {
            getRefNames: (opts: { assemblyName?: string }) => Promise<string[]>
          }
        ).getRefNames({ assemblyName })
      : []
  const listed = NAMES_FROM_RECORDS.has(String(adapterConfig.type))
  return refNames.map(refName => ({ refName, hasData: listed ? true : null }))
}

/**
 * The contig names a file has, on `assemblyName`'s side for a comparative
 * file. An adapter listing only contigs with records adds the sequence's,
 * since a sequence contig the file holds no record on is empty there, not
 * missing.
 */
export async function contigNamesOf(
  pluginManager: PluginManager,
  adapterConfig: Record<string, unknown>,
  sequenceAdapter: Record<string, unknown> | undefined,
  assemblyName?: string,
) {
  const names = (
    await contigsOf(pluginManager, adapterConfig, sequenceAdapter, assemblyName)
  ).map(c => c.refName)
  if (!sequenceAdapter || !NAMES_FROM_RECORDS.has(String(adapterConfig.type))) {
    return names
  }
  const sequence = await tablesAdapter(
    pluginManager,
    sequenceAdapter,
    undefined,
  )
  const regions = isRegionsAdapter(sequence)
    ? await sequence.getRegions({})
    : []
  return [...new Set([...names, ...regions.map(r => r.refName)])]
}

/**
 * Each contig a file lists, from 0 to its length: the assembly's where it
 * has the contig, else the file's own where it states one, else
 * `WHOLE_CONTIG_END`. `hasData` is whether the file holds records there,
 * null where its index cannot tell, and `canonical` the assembly's name for
 * the contig.
 */
export async function fileRegions(
  pluginManager: PluginManager,
  adapterConfig: Record<string, unknown>,
  assembly?: ResolvedAssembly,
) {
  const contigs = await contigsOf(
    pluginManager,
    adapterConfig,
    assembly?.sequenceAdapter,
  )
  const canonical = assembly?.canonical ?? ((name: string) => name)
  const assemblyLength = new Map(
    assembly?.regions.map(r => [canonical(r.refName), r.end]),
  )
  const length = contigs.map(
    c => assemblyLength.get(canonical(c.refName)) ?? c.length,
  )
  return {
    refName: contigs.map(c => c.refName),
    canonical: contigs.map(c => canonical(c.refName)),
    start: contigs.map(() => 0),
    end: length.map(l => l ?? WHOLE_CONTIG_END),
    lengthKnown: length.map(l => l !== undefined),
    hasData: contigs.map(c => c.hasData ?? null),
  }
}
