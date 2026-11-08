import RpcMethodTypeWithFiltersAndRenameRegions from '@jbrowse/core/pluggableElementTypes/RpcMethodTypeWithFiltersAndRenameRegions'

import { adapterSpelledFilter } from './adapterSpelledFilter.ts'

import type { RenameRegionsArgs } from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { RegionTooLargeResult } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

interface GetGlobalValueForTagArgs {
  adapterConfig: Record<string, unknown>
  regions: Region[]
  tag: string
  // The display's read filter, forwarded to the adapter exactly as the render
  // fetch does (`fetchFeaturesFromAdapter`). Without it this scan answers over a
  // read set the track never draws — and its one caller uses the answer to
  // decide whether a tag grouping would exceed `MAX_GROUPS`, so a value carried
  // only by filtered-out reads both padded "Found values" and could block Submit
  // on a grouping that would in fact have produced a handful of sections.
  filter?: FieldPredicate[]
  // The display's own gate budget (`resolvedByteLimit()`), so this scan is
  // refused wherever the render fetch would be. It downloads every read of every
  // visible block — the largest thing the group-by dialog does — so ungated it
  // was the one path that issued, over a wide view, exactly the fetch the track
  // beside it was already showing a "region too large" banner over.
  byteLimit?: number
}

declare module '@jbrowse/core/rpc/RpcRegistry' {
  interface RpcRegistry {
    PileupGetGlobalValueForTag: {
      args: GetGlobalValueForTagArgs
      return: string[] | RegionTooLargeResult
    }
  }
}

export default class PileupGetGlobalValueForTag extends RpcMethodTypeWithFiltersAndRenameRegions<'PileupGetGlobalValueForTag'> {
  name = 'PileupGetGlobalValueForTag' as const

  // the filter's mate references in the file's spelling, beside the regions
  protected override async renameRegions<T extends RenameRegionsArgs>(args: T) {
    return super.renameRegions(
      await adapterSpelledFilter(
        this.pluginManager.rootModel?.session?.assemblyManager,
        args,
      ),
    )
  }

  async execute(args: RpcExecuteArgs<'PileupGetGlobalValueForTag'>) {
    const { executeGetGlobalValueForTag } =
      await import('./executeGetGlobalValueForTag.ts')
    return executeGetGlobalValueForTag({
      pluginManager: this.pluginManager,
      args,
    })
  }
}
