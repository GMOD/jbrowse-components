import RpcMethodTypeWithRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithRenameRegions'
import { unwrapRpcResult } from '@jbrowse/core/util/librpc'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'

import { adapterSpelledFilter } from './adapterSpelledFilter.ts'

import type { RenderAlignmentDataArgs } from './types.ts'
import type { RenameRegionsArgs } from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { Feature } from '@jbrowse/core/util'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util/simpleFeature'

/**
 * A read the coverage counts, with the lane the facet keys it into and
 * whether the filter draws it.
 */
export interface ExportRead<F = Feature> {
  feature: F
  lane: string
  drawn: boolean
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    PileupGetExportReads: {
      args: Pick<
        RenderAlignmentDataArgs,
        | 'adapterConfig'
        | 'regions'
        | 'filter'
        | 'facet'
        | 'pinnedInsertSizeBand'
      >
      return: ExportRead[]
      // deserializeReturn rebuilds each feature into a SimpleFeature
      wire: ExportRead<SimpleFeatureSerialized>[]
    }
  }
}

/**
 * Every read the coverage counts in each region, as the render fetches,
 * samples, lanes and filters them, for Save track data to pick from by
 * format and by the lanes the user hid.
 */
export default class PileupGetExportReads extends RpcMethodTypeWithRenameRegions<'PileupGetExportReads'> {
  name = 'PileupGetExportReads' as const

  // the filter's mate references in the file's spelling, beside the regions
  protected override async renameRegions<T extends RenameRegionsArgs>(args: T) {
    return super.renameRegions(
      await adapterSpelledFilter(
        this.pluginManager.rootModel?.session?.assemblyManager,
        args,
      ),
    )
  }

  async deserializeReturn(
    reads: ExportRead<SimpleFeatureSerialized>[],
    _args: unknown,
  ) {
    return unwrapRpcResult(reads).map(read => ({
      ...read,
      feature: new SimpleFeature(read.feature),
    }))
  }

  async execute(args: RpcExecuteArgs<'PileupGetExportReads'>) {
    const { executeGetExportReads } = await import('./executeGetExportReads.ts')
    return executeGetExportReads({ pluginManager: this.pluginManager, args })
  }
}
