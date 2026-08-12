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
