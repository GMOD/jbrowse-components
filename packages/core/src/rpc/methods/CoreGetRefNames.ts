import {
  isFeatureAdapter,
  isRefNameSource,
} from '../../data_adapters/BaseAdapter/util.ts'
import { getAdapter } from '../../data_adapters/dataAdapterCache.ts'
import RpcMethodType from '../../pluggableElementTypes/RpcMethodType.ts'

import type { RpcExecuteArgs } from '../RpcRegistry.ts'

export default class CoreGetRefNames extends RpcMethodType<'CoreGetRefNames'> {
  name = 'CoreGetRefNames' as const

  async execute(args: RpcExecuteArgs<'CoreGetRefNames'>) {
    const { sessionId, adapterConfig, sequenceAdapter } = args
    const { dataAdapter } = await getAdapter(
      this.pluginManager,
      sessionId,
      adapterConfig,
    )

    // Primes BEFORE it asks: a ReferenceScanAdapter answers `getRefNames` by
    // asking the reference, and this line is what tells it where that is.
    // Pinned by sequenceAdapterPriming.test.ts, because reversing the two left
    // 3,015 tests green.
    //
    // The one call that still passes `sequenceAdapter` by hand — it is what
    // `renameRegionsIfNeeded` CALLS, so the derivation cannot reach it.
    if (isFeatureAdapter(dataAdapter)) {
      dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
    }

    // Gated on isRefNameSource rather than isFeatureAdapter: any adapter that
    // can name its own contigs needs them reconciled with the assembly's,
    // whether or not it serves features. PlinkLDTabixAdapter serves precomputed
    // LD pairs, so it failed a feature-adapter check and reported *zero*
    // refNames; that made the refName map empty, which made renaming a silent
    // no-op, which left every record dropped by a later exact-match refName
    // test. The symptom was a blank LD track with no error whenever the file's
    // contig names differed from the assembly's canonical ones (an Ensembl-named
    // .ld file against a UCSC-named hub, say).
    return isRefNameSource(dataAdapter) ? dataAdapter.getRefNames(args) : []
  }
}
