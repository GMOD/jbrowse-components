import { fetchHub } from '@jbrowse/core/util/fetchHub'
import { isSequenceUri, makeAssembly } from '@jbrowse/core/util/makeAssembly'

import type { HubConfig } from '@jbrowse/core/util/fetchHub'

export type AssemblyConfig = Record<string, unknown>

export interface TextSearchAdapterConfig {
  textSearchAdapterId: string
  [key: string]: unknown
}
type SearchAdapters = TextSearchAdapterConfig[] | undefined

// A hub's config arrives off the network, so its search adapters are untyped
// there. Keep the ones that carry the id everything downstream references,
// rather than casting the lot: an entry without one cannot be referred to by a
// config anyway, so dropping it loses nothing and keeps this cast-free.
function searchAdaptersOf(hub: HubConfig): SearchAdapters {
  const found = (hub.aggregateTextSearchAdapters ?? []).filter(
    (a): a is TextSearchAdapterConfig =>
      typeof a.textSearchAdapterId === 'string',
  )
  return found.length ? found : undefined
}

/**
 * The shapes an assembly can take, discriminated at resolve time: a sequence
 * file URL (`'.../hg38.fa.gz'`, `.2bit`, ...) built into an assembly via
 * `makeAssembly`; a hub name (`'hg38'`, `'GCF_...'`) fetched from jbrowse.org;
 * a full hub config (as `fetchHub` returns); or a bare assembly config (e.g.
 * from `makeAssembly`) — the latter two both being plain config objects.
 */
export type AssemblyInput = string | AssemblyConfig

export interface ResolvedAssembly {
  assembly: AssemblyConfig
  /** whatever search adapters the hub this came from carried */
  aggregateTextSearchAdapters?: SearchAdapters
}

export interface ResolvedAssemblies {
  assemblies: AssemblyConfig[]
  /** whatever search adapters the resolved hubs carried, merged */
  aggregateTextSearchAdapters?: SearchAdapters
}

function fromHubConfig(hub: HubConfig): ResolvedAssembly {
  const assembly = hub.assemblies?.[0]
  if (!assembly) {
    throw new Error('hub config has no assemblies')
  }
  return { assembly, aggregateTextSearchAdapters: searchAdaptersOf(hub) }
}

/** One assembly in any of the four accepted shapes. */
export async function resolveAssembly(
  input: AssemblyInput,
): Promise<ResolvedAssembly> {
  if (typeof input === 'string') {
    return isSequenceUri(input)
      ? { assembly: makeAssembly({ fastaUri: input }) }
      : fromHubConfig(await fetchHub(input))
  } else if ('assemblies' in input) {
    return fromHubConfig(input)
  } else {
    return { assembly: input }
  }
}

/**
 * Resolve a whole list of assembly inputs, so a multi-assembly product takes
 * the same vocabulary the single-view one does — `['hg38', 'mm39']` as readily
 * as two hand-written configs.
 *
 * Exported because the resolution is async and `createApp` is not: an engine
 * that resolved its own genomes would have to hand back a controller whose
 * `viewState` is undefined until the fetches land, which is most of what makes
 * the single-view controller four times the size. A host builds its options
 * asynchronously already (runtime plugins), so this belongs in that step.
 *
 * Without it every host reimplements it — jbrowse-anywidget carried a
 * line-for-line Python translation of core's hubUrl/fetchHub/addRelativeUris,
 * GenArk regex and all, purely because the multi-view product could not take a
 * hub name.
 */
export async function resolveAssemblies(
  inputs: AssemblyInput[],
): Promise<ResolvedAssemblies> {
  const resolved = await Promise.all(inputs.map(resolveAssembly))
  const adapters = resolved.flatMap(r => r.aggregateTextSearchAdapters ?? [])
  return {
    assemblies: resolved.map(r => r.assembly),
    aggregateTextSearchAdapters: adapters.length ? adapters : undefined,
  }
}
