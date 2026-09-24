import { fetchHub } from '@jbrowse/core/util/fetchHub'
import { isSequenceUri, makeAssembly } from '@jbrowse/core/util/makeAssembly'

import { searchIndexKey, withHostOverrides } from './controllerTracks.ts'

import type { HubConfig } from '@jbrowse/core/util/fetchHub'

export type AssemblyConfig = Record<string, unknown>

export interface TextSearchAdapterConfig {
  type: string
  [key: string]: unknown
}
type SearchAdapters = TextSearchAdapterConfig[] | undefined

export interface HubTrackConfig {
  trackId: string
  [key: string]: unknown
}

// A hub's config arrives off the network, so its search adapters are untyped
// there. Keep the ones naming an adapter type, rather than casting the lot: an
// entry without one cannot be constructed anyway.
function searchAdaptersOf(hub: HubConfig): SearchAdapters {
  const found = (hub.aggregateTextSearchAdapters ?? []).filter(
    (a): a is TextSearchAdapterConfig => typeof a.type === 'string',
  )
  return found.length ? found : undefined
}

function tracksOf(hub: HubConfig): HubTrackConfig[] | undefined {
  const found = (hub.tracks ?? []).filter(
    (t): t is HubTrackConfig => typeof t.trackId === 'string',
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
  /**
   * the hub's track catalog, which its search index names its hits against, so
   * a host keeping the index keeps these too
   */
  tracks?: HubTrackConfig[]
}

export interface ResolvedAssemblies<
  Track extends object = HubTrackConfig,
  Index extends object = TextSearchAdapterConfig,
> {
  assemblies: AssemblyConfig[]
  /** the hubs' search adapters, then the host's own */
  aggregateTextSearchAdapters?: (TextSearchAdapterConfig | Index)[]
  /** the hubs' track catalogs, then the host's own tracks */
  tracks?: (HubTrackConfig | Track)[]
}

/** What a host already has, to merge with what its hubs bring. */
export interface HostCatalog<Track extends object, Index extends object> {
  tracks?: readonly Track[]
  aggregateTextSearchAdapters?: readonly Index[]
}

function fromHubConfig(hub: HubConfig): ResolvedAssembly {
  const assembly = hub.assemblies?.[0]
  if (!assembly) {
    throw new Error('hub config has no assemblies')
  }
  return {
    assembly,
    aggregateTextSearchAdapters: searchAdaptersOf(hub),
    tracks: tracksOf(hub),
  }
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
 * A hub brings a track catalog and a search index that names hits by those
 * tracks' ids, so both come back beside the assemblies. Pass the host's own
 * `tracks` and `aggregateTextSearchAdapters` as `host` and they come back merged
 * in, the host's winning an id, which makes spreading the result into
 * `createApp`'s options correct:
 *
 * ```ts
 * createApp(el, { ...options, ...(await resolveAssemblies(names, options)) })
 * ```
 *
 * A key neither the hubs nor the host supplied is left out rather than set to
 * `undefined`, so a spread never clears one.
 *
 * Exported because the resolution is async and `createApp` is not: an engine
 * that resolved its own genomes would have to hand back a controller whose
 * `viewState` is undefined until the fetches land. A host builds its options
 * asynchronously already (runtime plugins), so this belongs in that step.
 */
export async function resolveAssemblies<
  Track extends object = HubTrackConfig,
  Index extends object = TextSearchAdapterConfig,
>(
  inputs: AssemblyInput[],
  host: HostCatalog<Track, Index> = {},
): Promise<ResolvedAssemblies<Track, Index>> {
  const resolved = await Promise.all(inputs.map(resolveAssembly))
  const tracks = withHostOverrides<HubTrackConfig | Track>(
    resolved.flatMap(r => r.tracks ?? []),
    host.tracks,
    'trackId',
  )
  const adapters = withHostOverrides<TextSearchAdapterConfig | Index>(
    resolved.flatMap(r => r.aggregateTextSearchAdapters ?? []),
    host.aggregateTextSearchAdapters,
    searchIndexKey,
  )
  return {
    assemblies: resolved.map(r => r.assembly),
    ...(tracks.length ? { tracks } : {}),
    ...(adapters.length ? { aggregateTextSearchAdapters: adapters } : {}),
  }
}
