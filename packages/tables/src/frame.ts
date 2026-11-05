import { isRegionsAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { tablesAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'

import type { ResolvedAssembly } from './assembly.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'

interface Contig {
  refName: string
  start: number
  end: number
}

/**
 * The contigs the read's assembly lists, else its sequence adapter's, with
 * the name that compares two spellings of one: none where the read names
 * neither.
 */
async function contigsOf(
  pluginManager: PluginManager,
  sequenceAdapter: Record<string, unknown> | undefined,
  assembly: ResolvedAssembly | undefined,
): Promise<{ contigs: Contig[]; canonical: (name: string) => string }> {
  return assembly
    ? { contigs: assembly.regions, canonical: assembly.canonical }
    : {
        contigs: sequenceAdapter
          ? await tablesAdapter(pluginManager, sequenceAdapter, undefined).then(
              a => (isRegionsAdapter(a) ? a.getRegions({}) : []),
            )
          : [],
        canonical: name => name,
      }
}

/**
 * The whole contig `locus` lies on; where its length is unknown, as far past
 * the locus as the locus is wide, more than the view's margin reaches.
 */
async function contigHolding<R extends TablesRegion>(
  pluginManager: PluginManager,
  locus: R,
  sequenceAdapter: Record<string, unknown> | undefined,
  assembly: ResolvedAssembly | undefined,
) {
  const { contigs, canonical } = await contigsOf(
    pluginManager,
    sequenceAdapter,
    assembly,
  )
  const name = canonical(locus.originalRefName ?? locus.refName)
  const contig = contigs.find(c => canonical(c.refName) === name)
  return {
    ...locus,
    start: Math.min(contig?.start ?? 0, locus.start),
    end: Math.max(contig?.end ?? 2 * locus.end - locus.start, locus.end),
  }
}

/**
 * The regions the browser displays for a read of `regions`. One region is a
 * locus, shown as a window into its whole contig, from the assembly's or the
 * sequence's length, or a locus's width past it where neither states one.
 * Several are the displayed regions themselves, as the browser shows several
 * loci.
 */
export async function displayedRegionsOf<R extends TablesRegion>(
  pluginManager: PluginManager,
  {
    regions,
    sequenceAdapter,
  }: {
    regions: R[]
    sequenceAdapter?: Record<string, unknown>
  },
  assembly: ResolvedAssembly | undefined,
) {
  const [locus, ...rest] = regions
  return locus && rest.length === 0
    ? [await contigHolding(pluginManager, locus, sequenceAdapter, assembly)]
    : regions
}
