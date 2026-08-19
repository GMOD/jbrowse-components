import RpcMethodType from './RpcMethodType.ts'

import type { RenameRegionArgs } from './RpcMethodType.ts'

// Singular-region counterpart of RpcMethodTypeWithRenameRegions, for RPC methods
// whose wire contract carries one `region` (e.g. block-at-a-time wiggle
// rendering). Subclasses get region renaming for free.
export default abstract class RpcMethodTypeWithRenameRegion<
  MethodName extends string = string,
> extends RpcMethodType<MethodName> {
  async serializeArguments<T extends RenameRegionArgs>(args: T) {
    // adapt the singular `region` to the plural renameRegions helper.
    // `rest`, not `args` — spreading the ORIGINAL back over the result drops
    // everything renaming adds beside the regions, silently. That is how
    // `sequenceAdapter` would reach a worker undefined on exactly the
    // single-region methods while the plural ones got it.
    const { regions, ...rest } = await this.renameRegions({
      ...args,
      regions: [args.region],
    })
    return super.serializeArguments({ ...rest, region: regions[0]! })
  }
}
