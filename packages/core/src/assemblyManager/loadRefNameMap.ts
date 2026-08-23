import { adapterConfigCacheKey } from '../data_adapters/dataAdapterCache.ts'
import { updateStatus } from '../util/progress.ts'
import { getSequenceAdapterConfig } from './getSequenceAdapterConfig.ts'
import { checkRefName } from './refNameMaps.ts'
import { detectRefNameMismatch } from './refNameMismatch.ts'

import type { BaseOptions } from '../data_adapters/BaseAdapter/index.ts'
import type { Assembly } from './assembly.ts'
import type { RefNameAliases } from './refNameMaps.ts'

// the subset of the assembly model that loadRefNameMap reads; using a Pick
// (rather than the full Assembly) lets `self` satisfy it from inside the
// getRefNameMapForAdapter view, which doesn't yet see its own sibling methods
export type RefNameMapAssembly = Pick<
  Assembly,
  | 'name'
  | 'load'
  | 'error'
  | 'regions'
  | 'refNames'
  | 'refNameAliases'
  | 'rpcManager'
  | 'configuration'
  | 'getCanonicalRefName'
  | 'setRefNameMismatch'
>

export async function loadRefNameMap(
  assembly: RefNameMapAssembly,
  adapterConfig: unknown,
  options: BaseOptions,
): Promise<RefNameAliases> {
  const { sessionId } = options
  if (!sessionId) {
    throw new Error('sessionId is required for loadRefNameMap')
  }
  // load() is idempotent and resolves only after regions + refNameAliases are
  // set, so awaiting it is a direct, promise-based alternative to a reactive
  // `when` on those volatiles. It rejects on failure, so no error check follows
  await assembly.load()

  // pass the assembly's sequence adapter config (as a snapshot, since MST
  // objects can't be assigned elsewhere) so BAM/CRAM adapters can cache it for
  // later use when fetching features
  const sequenceAdapter = getSequenceAdapterConfig(assembly)

  // Labelled, because this is the multi-second stall before any RPC's own
  // status appears: `renameRegionsIfNeeded` runs inside `serializeArguments`,
  // so every fetch waits here first, and the byte-granularity progress below
  // arrives with no phase name on it. Without the label a whole-file in-memory
  // load reads as a bare percentage climbing under no heading. The wording is
  // deliberately generic: refname resolution is an implementation detail a
  // user has no use for, and this is just the front of the load to them.
  const refNames = await updateStatus('Loading', options.statusCallback, () =>
    assembly.rpcManager.call(sessionId, 'CoreGetRefNames', {
      adapterConfig: adapterConfig as Record<string, unknown>,
      assemblyName: assembly.name,
      sequenceAdapter,
      // stopToken intentionally not passed, fixes issues like #2221.
      // alternative fix #2540 was proposed but non-working currently
      stopToken: undefined,
      // Forwarded rather than dropped (unlike stopToken above), because the
      // adapter's index download happens here during refname mapping
      // (getRefNames -> setup) and this is the only place its "Downloading
      // index" progress can surface. For an in-memory adapter it is not an
      // index but the whole file — GWAS LD coloring resolves a second map
      // against its PLINK `.ld` sub-adapter, and that adapter parses all of it
      // to answer `getRefNames`.
      //
      // This was latent for a while, and what revived it is one line elsewhere
      // that is easy to undo by tidying: `BaseRpcDriver.call` strips
      // `statusCallback` off the *result* of `serializeArguments` rather than
      // off the args going in. Strip it going in and the rename pass — which
      // runs inside serialization — is handed undefined for every RPC there is,
      // which is what it was.
      statusCallback: options.statusCallback,
    }),
  )

  const { refNameAliases } = assembly
  if (!refNameAliases) {
    throw new Error(`error loading assembly ${assembly.name}'s refNameAliases`)
  }

  const result: RefNameAliases = {}
  for (const name of refNames) {
    checkRefName(name)
    // `?? name` keeps a name the assembly does not know, so the map is total.
    // For ONE unknown name that is right — the region it would have renamed
    // simply never comes up. For ALL of them it is an identity map that matches
    // no region, and the track then draws nothing and says nothing, which is
    // what the check below is for.
    result[assembly.getCanonicalRefName(name) ?? name] = name
  }

  // This function is the only place both name sets are in scope at once, so it
  // is the only place the disagreement is visible. Recorded rather than thrown:
  // a track whose file genuinely has no features in view looks identical from
  // here, and failing on a guess would take a working track away from someone.
  // The record is keyed by adapter cache key and the map load is memoized under
  // the same key, so this runs once per (assembly, adapter config) — a track
  // reads it back through `BaseTrackModel.refNameMismatch`.
  const mismatch = detectRefNameMismatch({
    assemblyName: assembly.name,
    adapterRefNames: refNames,
    assemblyRefNames: assembly.refNames ?? [],
    getCanonicalRefName: name => assembly.getCanonicalRefName(name),
  })
  if (mismatch) {
    assembly.setRefNameMismatch(
      adapterConfigCacheKey(adapterConfig as Record<string, unknown>),
      mismatch,
    )
  }
  return result
}
