import { isFeatureAdapter } from '../../data_adapters/BaseAdapter/index.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodTypeWithRenameRegions from '../../pluggableElementTypes/RpcMethodTypeWithRenameRegions.ts'
import { largestRegionBytes } from '../byteBudget.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetRegionByteEstimate extends RpcMethodTypeWithRenameRegions<'CoreGetRegionByteEstimate'> {
  name = 'CoreGetRegionByteEstimate' as const

  async execute(args: RpcExecuteArgs<'CoreGetRegionByteEstimate'>) {
    const { adapterConfig, sessionId, regions, scope } = args
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
    if (!isFeatureAdapter(dataAdapter)) {
      return undefined
    }

    // `wholeRequest` is the adapter call as it stands: `getRegionByteSize`
    // gathers every region's index chunks, merges them and sums, so two regions
    // sharing a BGZF block are charged for it once.
    if (scope === 'wholeRequest') {
      return dataAdapter.getRegionByteSize(regions, args)
    }

    // `largestRegion` asks the same adapter the same question once per region
    // and keeps the biggest answer. It costs what the merged call costs —
    // `getRegionByteSize` already resolves chunks per region internally and only
    // the reduction is shared, measured at 0.9-1.0x over 24 and 70 regions
    // (agent-docs/measurements/byte-estimate-scope.json). Reducing here rather
    // than returning the whole array keeps the wire a single number; the
    // reduction itself is `largestRegionBytes`, which canvas applies to its own
    // per-region fetches so the two paths share the rule rather than restate
    // it.
    return largestRegionBytes(
      await Promise.all(
        regions.map(region => dataAdapter.getRegionByteSize([region], args)),
      ),
    )
  }
}
