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

    // Gated on isRefNameSource rather than isFeatureAdapter: any adapter that
    // can name its own contigs needs them reconciled with the assembly's,
    // whether or not it serves features. PlinkLDTabixAdapter serves precomputed
    // LD pairs, so it failed a feature-adapter check and reported *zero*
    // refNames; that made the refName map empty, which made renaming a silent
    // no-op, which left every record dropped by a later exact-match refName
    // test. The symptom was a blank LD track with no error whenever the file's
    // contig names differed from the assembly's canonical ones (an Ensembl-named
    // .ld file against a UCSC-named hub, say).
    // Primes BEFORE it asks, and the order is load-bearing. A
    // ReferenceScanAdapter (motif, CRISPR guide, sequence search) has no file of
    // its own, so it answers `getRefNames` by asking the reference — and the
    // only thing that has told it where the reference is, is this line. Swap the
    // two and every scan track throws "No sequence adapter available" on the
    // first refName map it needs, before anything is on screen to hint at why.
    //
    // This is also the one call that still passes `sequenceAdapter` explicitly:
    // it is what `renameRegionsIfNeeded` CALLS, so it cannot be fed by the
    // derivation that serves everything else. `loadRefNameMap` supplies it.
    if (isFeatureAdapter(dataAdapter)) {
      dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
    }
    return isRefNameSource(dataAdapter) ? dataAdapter.getRefNames(args) : []
  }
}
