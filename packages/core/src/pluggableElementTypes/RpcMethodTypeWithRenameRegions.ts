import RpcMethodType from './RpcMethodType.ts'

import type { RpcExecuteReturn } from '../rpc/RpcRegistry.ts'
import type { RenameRegionsArgs } from './RpcMethodType.ts'

// Base for RPC methods whose serialize step just maps region refNames into the
// data adapter's naming scheme. Subclasses get region renaming for free;
// override serializeArguments only to add extra transforms, calling super to
// keep the renaming.
export default abstract class RpcMethodTypeWithRenameRegions<
  MethodName extends string = string,
  WireReturn = RpcExecuteReturn<MethodName>,
> extends RpcMethodType<MethodName, WireReturn> {
  async serializeArguments<T extends RenameRegionsArgs>(
    args: T,
    rpcDriverClassName: string,
  ) {
    return super.serializeArguments(
      await this.renameRegions(args),
      rpcDriverClassName,
    )
  }
}
