import { getSequenceAdapterConfig } from './getSequenceAdapterConfig.ts'
import { checkRefName } from './refNameMaps.ts'

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
  | 'refNameAliases'
  | 'rpcManager'
  | 'configuration'
  | 'getCanonicalRefName'
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

  const refNames = await assembly.rpcManager.call(
    sessionId,
    'CoreGetRefNames',
    {
      adapterConfig: adapterConfig as Record<string, unknown>,
      assemblyName: assembly.name,
      sequenceAdapter,
      // stopToken intentionally not passed, fixes issues like #2221.
      // alternative fix #2540 was proposed but non-working currently
      stopToken: undefined,
      // Forwarded rather than dropped (unlike stopToken above), because the
      // adapter's index download happens here during refname mapping
      // (getRefNames -> setup) and this is the only place its "Downloading
      // index" progress could surface.
      //
      // **Latent: no production caller supplies one, so it is always undefined
      // and that progress never surfaces.** Don't read the forwarding as
      // evidence the status works — if you are here because an index download
      // reports nothing, this is why. `renameRegionsForAdapter` and
      // circular-view's chord display build their opts literally
      // (`{ sessionId }`, `{ stopToken, sessionId }`); `renameRegionsIfNeeded`
      // forwards the RPC args, and `BaseRpcDriver.call` destructures
      // `statusCallback` off *before* calling `serializeArguments`, since
      // everything reaching the worker has to be structured-cloneable.
      //
      // Making it real is not the one-liner it looks like, and the blocker is
      // the memoization, not the plumbing. Passing the whole args in and
      // stripping the callback off the *result* would leave the wire payload
      // identical and light this up for every RPC — but
      // `getRefNameMapForAdapter` caches one promise per adapter-config key, so
      // the first caller donates its callback to everyone who later awaits that
      // entry, including callers whose display is already being torn down.
      // Publish per-waiter, or guard at the display end, before wiring it.
      statusCallback: options.statusCallback,
    },
    { timeout: 1000000 },
  )

  const { refNameAliases } = assembly
  if (!refNameAliases) {
    throw new Error(`error loading assembly ${assembly.name}'s refNameAliases`)
  }

  const result: RefNameAliases = {}
  for (const name of refNames) {
    checkRefName(name)
    result[assembly.getCanonicalRefName(name) ?? name] = name
  }
  return result
}
