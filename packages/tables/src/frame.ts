import { isRegionsAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { tablesAdapter } from '@jbrowse/core/data_adapters/getFeatureAdapter'
import { contigTables } from '@jbrowse/plugin-comparative-adapters/tables'

import { fileContigsOf } from './fileRegions.ts'

import type { ResolvedAssembly } from './assembly.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'

interface Span {
  start: number
  end: number
}

/**
 * The contig `locus` lies on as the read's assembly lists it, else its
 * sequence adapter: undefined where neither names it.
 */
export async function referenceContig(
  pluginManager: PluginManager,
  locus: TablesRegion,
  sequenceAdapter: Record<string, unknown> | undefined,
  assembly: ResolvedAssembly | undefined,
): Promise<Span | undefined> {
  const contigs = assembly
    ? assembly.regions
    : sequenceAdapter
      ? await tablesAdapter(pluginManager, sequenceAdapter, undefined).then(a =>
          isRegionsAdapter(a) ? a.getRegions({}) : [],
        )
      : []
  const canonical = assembly?.canonical ?? ((name: string) => name)
  const name = canonical(locus.originalRefName ?? locus.refName)
  return contigs.find(c => canonical(c.refName) === name)
}

/**
 * The contig `locus` lies on as the file states its length (a BAM or CRAM
 * header, a BigWig or BigBed chrom table, a VCF's `##contig` lines):
 * undefined where it states none.
 */
async function fileContig(
  pluginManager: PluginManager,
  locus: TablesRegion,
  adapterConfig: Record<string, unknown>,
  sequenceAdapter: Record<string, unknown> | undefined,
): Promise<Span | undefined> {
  const length = (
    await fileContigsOf(pluginManager, adapterConfig, sequenceAdapter)
  ).find(c => c.refName === locus.refName)?.length
  return length === undefined ? undefined : { start: 0, end: length }
}

/**
 * The contig `refName` on one side of a comparative file, from the length the
 * file states (a PAF's qlen and tlen, a chain's headers): the side naming
 * `assemblyName`, else `side`, the query 0 and the target 1. Undefined where
 * the file states none.
 */
export async function comparativeFileContig(
  pluginManager: PluginManager,
  {
    adapterConfig,
    side,
    assemblyName,
    refName,
  }: {
    adapterConfig: Record<string, unknown>
    side: 0 | 1
    assemblyName?: string
    refName: string
  },
): Promise<Span | undefined> {
  const { query, target } = await contigTables(pluginManager, { adapterConfig })
  const named = [query, target].find(s => s.assemblyName === assemblyName)
  const contigs = named ?? (side === 0 ? query : target)
  const length = contigs.length[contigs.refName.indexOf(refName)]
  return length === undefined || length === null
    ? undefined
    : { start: 0, end: length }
}

/**
 * The regions the browser displays for `regions`. One region is a locus,
 * shown as a window into `contig`, its whole contig, or where its length is
 * unknown, as far past the locus as the locus is wide, more than the view's
 * margin reaches. Several are the displayed regions themselves, as the
 * browser shows several loci.
 */
export function framedIn<R extends TablesRegion>(
  regions: R[],
  contig: Span | undefined,
) {
  const [locus, ...rest] = regions
  return locus && rest.length === 0
    ? [
        {
          ...locus,
          start: Math.min(contig?.start ?? 0, locus.start),
          end: Math.max(contig?.end ?? 2 * locus.end - locus.start, locus.end),
        },
      ]
    : regions
}

/**
 * {@link framedIn} for a region read: the contig's length from the read's
 * assembly, else its sequence adapter, else the file's own header.
 */
export async function displayedRegionsOf<R extends TablesRegion>(
  pluginManager: PluginManager,
  {
    regions,
    adapterConfig,
    sequenceAdapter,
  }: {
    regions: R[]
    adapterConfig: Record<string, unknown>
    sequenceAdapter?: Record<string, unknown>
  },
  assembly: ResolvedAssembly | undefined,
) {
  const [locus] = regions
  const contig =
    locus && regions.length === 1
      ? ((await referenceContig(
          pluginManager,
          locus,
          sequenceAdapter,
          assembly,
        )) ??
        (await fileContig(
          pluginManager,
          locus,
          adapterConfig,
          sequenceAdapter,
        )))
      : undefined
  return framedIn(regions, contig)
}
