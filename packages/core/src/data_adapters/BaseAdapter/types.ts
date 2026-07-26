import type { StatusCallback } from '../../util/progress.ts'
import type { StopToken } from '../../util/stopToken.ts'
import type { Region } from '../../util/types/index.ts'

export interface BaseOptions {
  stopToken?: StopToken
  bpPerPx?: number
  sessionId?: string
  trackInstanceId?: string
  // unused in-tree but kept so BaseOptions is structurally assignable to the
  // `Options { signal? }` interfaces in @gmod/tabix, @gmod/bbi-js, etc. that
  // adapters forward opts to
  signal?: AbortSignal
  // The single out-of-band status transport. A plain string is an indeterminate
  // phase label; a StatusWithProgress object adds a determinate fraction
  // (`current`/`total` are units-agnostic — bytes for a download, blocks for an
  // unzip, features for a scan). Adapters wrap the raw byte counts from the
  // index reader (@gmod/tabix, @gmod/bam, @gmod/cram) into this object form.
  statusCallback?: StatusCallback
  headers?: Record<string, string>
  statsEstimationMode?: boolean
  // Used by synteny/comparative adapters in getRefNames to pick which side of
  // the pairing to return refnames for. Single-assembly adapters ignore it.
  assemblyName?: string
  // The assembly on the *other* side of a synteny band, set by the synteny
  // render RPC from the target view. Lets a multi-genome adapter (e.g.
  // AllVsAllPAFAdapter) whose config lists all N assemblies isolate the exact
  // pair a band draws — `assemblyName` alone can't, since one file backs every
  // pair. Pairwise adapters (which already know their pair) ignore it.
  targetAssemblyName?: string
  // Which level-of-detail tier to read, for adapters that expose more than one
  // (e.g. PIF's per-row CIGAR fine tier vs its no-CIGAR coarse tier). Absent, the
  // fine tier is served; adapters without tiering ignore it entirely.
  //
  // This is a *resolved* tier, never the user's 'auto' setting: resolving auto
  // needs a zoom, and it happens on the main thread in a display getter that
  // feeds the fetch cache key (`resolveLodTier` in @jbrowse/synteny-core).
  // Resolving it here instead hides a fetch input from that key, which is how a
  // zoom across the threshold came to leave a view holding the wrong tier.
  lodMode?: 'fine' | 'coarse'
}

export interface BaseOptionsWithRegions extends BaseOptions {
  regions?: Region[]
}

export type SearchType = 'full' | 'prefix' | 'exact'

export interface BaseTextSearchArgs {
  queryString: string
  searchType?: SearchType
  stopToken?: StopToken
}
