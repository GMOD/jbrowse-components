import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetRegionByteEstimate extends RpcMethodTypeWithRenameRegions<'CoreGetRegionByteEstimate'> {
  name = 'CoreGetRegionByteEstimate' as const

  async execute(
    args: RpcExecuteArgs<'CoreGetRegionByteEstimate'>,
    rpcDriver: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { adapterConfig, sessionId, regions } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    // "Unmeasurable", not an error. `undefined` is already the answer for an
    // adapter that serves features but quotes no index estimate — BigWig, HiC,
    // sequence — and the gate reads it as "no byte axis" rather than as a
    // failure (see BaseFeatureDataAdapter.getRegionByteSize, and
    // REGION_TOO_LARGE.md §"Self-summarizing adapters need no exemption"). An
    // adapter that serves no features at all is the same answer arrived at
    // sooner, so it takes the same path.
    //
    // Throwing here made "can this be measured" a question every gated display
    // had to answer for itself, ahead of asking: a display pointed at such an
    // adapter errored outright instead of simply not gating, and the only fix
    // was a per-display opt-out of the whole gate — which then also disabled it
    // for that display's measurable adapters. LD carried exactly that opt-out.
    return isFeatureAdapter(dataAdapter)
      ? dataAdapter.getRegionByteSize(regions, deserializedArgs)
      : undefined
  }
}
