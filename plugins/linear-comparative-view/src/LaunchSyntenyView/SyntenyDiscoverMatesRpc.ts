import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'

import type { MateDiscoveryResult } from './pickMatesForRegion.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'

export interface SyntenyDiscoverMatesArgs {
  adapterConfig: Record<string, unknown>
  // the one region of interest, plural because refName renaming applies to
  // `regions` and only to `regions`
  regions: Region[]
  // the track's declared assemblyNames, which decide which mates can become a
  // panel at all; read from the config on the main thread, where the config is
  trackAssemblyNames: string[]
  anchorAssembly: string
}

// No `wire:` and no `deserializeReturn`. The return is plain numbers and names
// both ways — the alignments behind them, and above all their CIGARs, stay in
// the worker (see executeDiscoverMates) — so there is nothing to rebuild on
// arrival and the base class's envelope-peel is the whole of it.
declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    SyntenyDiscoverMates: {
      args: SyntenyDiscoverMatesArgs
      return: MateDiscoveryResult
    }
  }
}

export class SyntenyDiscoverMates extends RpcMethodTypeWithRenameRegions<'SyntenyDiscoverMates'> {
  name = 'SyntenyDiscoverMates' as const

  async execute(args: RpcExecuteArgs<'SyntenyDiscoverMates'>) {
    const { executeDiscoverMates } = await import('./executeDiscoverMates.ts')
    return executeDiscoverMates({
      ...args,
      pluginManager: this.pluginManager,
    })
  }
}
