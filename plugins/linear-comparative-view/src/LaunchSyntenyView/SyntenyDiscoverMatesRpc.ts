import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import type { MateDiscoveryResult } from './pickMatesForRegion.ts'
import type { Region, StatusCallback } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface SyntenyDiscoverMatesArgs {
  adapterConfig: Record<string, unknown>
  // the one region of interest, plural because refName renaming applies to
  // `regions` and only to `regions`
  regions: Region[]
  // the track's declared assemblyNames, which decide which mates can become a
  // panel at all; read from the config on the main thread, where the config is
  trackAssemblyNames: string[]
  anchorAssembly: string
  sessionId: string
  stopToken?: StopToken
  statusCallback?: StatusCallback
}

/** What crosses the wire: one alignment per mate assembly, narrowed. */
export interface SyntenyDiscoverMatesReturn {
  mates: { assemblyName: string; feature: SimpleFeatureSerialized }[]
  unconfigured: string[]
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    SyntenyDiscoverMates: {
      args: SyntenyDiscoverMatesArgs
      // what the caller sees, after deserializeReturn rebuilds the features
      return: MateDiscoveryResult
    }
  }
}

// Unparameterized, like CoreGetFeatures: the worker returns serialized features
// and deserializeReturn below is what turns them into the registry's declared
// return.
export class SyntenyDiscoverMates extends RpcMethodTypeWithRenameRegions {
  name = 'SyntenyDiscoverMates'

  async deserializeReturn(
    ret: SyntenyDiscoverMatesReturn,
    args: unknown,
    rpcDriver: string,
  ): Promise<MateDiscoveryResult> {
    // the base unwraps the rpcResult envelope, and types that as unknown
    const { mates, unconfigured } = (await super.deserializeReturn(
      ret,
      args,
      rpcDriver,
    )) as SyntenyDiscoverMatesReturn
    return {
      mates: mates.map(({ assemblyName, feature }) => ({
        assemblyName,
        feature: new SimpleFeature(feature),
      })),
      unconfigured,
    }
  }

  async execute(args: SyntenyDiscoverMatesArgs, rpcDriverClassName: string) {
    const deserializedArgs = await this.deserializeArguments(
      args,
      rpcDriverClassName,
    )
    const { executeDiscoverMates } = await import('./executeDiscoverMates.ts')
    return executeDiscoverMates({
      ...deserializedArgs,
      pluginManager: this.pluginManager,
    })
  }
}
