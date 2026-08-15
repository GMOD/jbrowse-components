import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import type { MateDiscoveryResult } from './pickMatesForRegion.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

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

/** What crosses the wire: one panel's alignments per mate assembly, narrowed. */
export interface SyntenyDiscoverMatesReturn {
  mates: { assemblyName: string; features: SimpleFeatureSerialized[] }[]
  unconfigured: string[]
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    SyntenyDiscoverMates: {
      args: SyntenyDiscoverMatesArgs
      // what the caller sees, after deserializeReturn rebuilds the features
      return: MateDiscoveryResult
      wire: SyntenyDiscoverMatesReturn
    }
  }
}

export class SyntenyDiscoverMates extends RpcMethodTypeWithRenameRegions<'SyntenyDiscoverMates'> {
  name = 'SyntenyDiscoverMates' as const

  async deserializeReturn(ret: SyntenyDiscoverMatesReturn, _args: unknown) {
    const { mates, unconfigured } = unwrapRpcResult(ret)
    return {
      mates: mates.map(({ assemblyName, features }) => ({
        assemblyName,
        features: features.map(feature => new SimpleFeature(feature)),
      })),
      unconfigured,
    }
  }

  async execute(args: RpcExecuteArgs<'SyntenyDiscoverMates'>) {
    const { executeDiscoverMates } = await import('./executeDiscoverMates.ts')
    return executeDiscoverMates({
      ...args,
      pluginManager: this.pluginManager,
    })
  }
}
