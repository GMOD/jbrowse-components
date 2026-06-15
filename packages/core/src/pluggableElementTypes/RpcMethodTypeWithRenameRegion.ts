import RpcMethodType from './RpcMethodType.ts'

import type { RenameRegionArgs } from './RpcMethodType.ts'

// Singular-region counterpart of RpcMethodTypeWithRenameRegions, for RPC methods
// whose wire contract carries one `region` (e.g. block-at-a-time wiggle
// rendering). Subclasses get region renaming for free.
export default abstract class RpcMethodTypeWithRenameRegion extends RpcMethodType {
  async serializeArguments<T extends RenameRegionArgs>(
    args: T,
    rpcDriverClassName: string,
  ) {
    // adapt the singular `region` to the plural renameRegions helper
    const { regions } = await this.renameRegions({
      ...args,
      regions: [args.region],
    })
    return super.serializeArguments(
      { ...args, region: regions[0]! },
      rpcDriverClassName,
    )
  }
}
