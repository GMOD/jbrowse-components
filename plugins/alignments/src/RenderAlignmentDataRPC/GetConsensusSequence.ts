import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { adapterSpelledFilter } from './adapterSpelledFilter.ts'

import type { InsertSizeBand } from '../shared/insertSizeStats.ts'
import type { ConsensusVariant } from '@jbrowse/alignments-core'
import type { RenameRegionsArgs } from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Region } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

interface GetConsensusSequenceArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  filter?: FieldPredicate[]
  pinnedInsertSizeBand?: InsertSizeBand
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

  // the filter's mate references in the file's spelling, beside the regions
  protected override async renameRegions<T extends RenameRegionsArgs>(args: T) {
    return super.renameRegions(
      await adapterSpelledFilter(
        this.pluginManager.rootModel?.session?.assemblyManager,
        args,
      ),
    )
  }

  async execute(args: RpcExecuteArgs<'GetConsensusSequence'>) {
    const { executeGetConsensusSequence } =
      await import('./executeGetConsensusSequence.ts')
    return executeGetConsensusSequence({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
