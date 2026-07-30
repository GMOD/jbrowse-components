import {
  isFeatureAdapter,
  isRefNameSource,
} from '../../data_adapters/BaseAdapter/util.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { StatusCallback } from '../../util/progress.ts'
import type { StopToken } from '../../util/stopToken.ts'

export default class CoreGetRefNames extends RpcMethodType<'CoreGetRefNames'> {
  name = 'CoreGetRefNames'

  async execute(
    args: {
      sessionId: string
      stopToken?: StopToken
      statusCallback?: StatusCallback
      adapterConfig: Record<string, unknown>
      assemblyName?: string
      sequenceAdapter?: Record<string, unknown>
    },
    rpcDriver: string,
  ) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const { sessionId, adapterConfig, sequenceAdapter } = deserializedArgs
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    // Gated on isRefNameSource rather than isFeatureAdapter: any adapter that
    // can name its own contigs needs them reconciled with the assembly's,
    // whether or not it serves features. PlinkLDTabixAdapter serves precomputed
    // LD pairs, so it failed a feature-adapter check and reported *zero*
    // refNames; that made the refName map empty, which made renaming a silent
    // no-op, which left every record dropped by a later exact-match refName
    // test. The symptom was a blank LD track with no error whenever the file's
    // contig names differed from the assembly's canonical ones (an Ensembl-named
    // .ld file against a UCSC-named hub, say).
    if (isFeatureAdapter(dataAdapter)) {
      dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
    }
    return isRefNameSource(dataAdapter)
      ? dataAdapter.getRefNames(deserializedArgs)
      : []
  }
}
