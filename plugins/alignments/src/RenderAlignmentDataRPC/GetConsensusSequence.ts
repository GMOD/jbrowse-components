import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import type { ConsensusVariant } from '@jbrowse/alignments-core'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

interface GetConsensusSequenceArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  filter?: FieldPredicate[]
  minDepth?: number
  callFract?: number
  hetFract?: number
  includeInsertions?: boolean
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    GetConsensusSequence: {
      args: GetConsensusSequenceArgs
      // The caller already knows which region it asked about, and after
      // renameRegions the refName here is the adapter's, not the one it asked
      // with — so only the computed answer comes back.
      return: {
        consensus: string
        variants: ConsensusVariant[]
      }
    }
  }
}

export default class GetConsensusSequence extends RpcMethodTypeWithFiltersAndRenameRegions<'GetConsensusSequence'> {
  name = 'GetConsensusSequence' as const

  async execute(args: RpcExecuteArgs<'GetConsensusSequence'>) {
    const { executeGetConsensusSequence } =
      await import('./executeGetConsensusSequence.ts')
    return executeGetConsensusSequence({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
