import { ComparativeAdapterBase } from './ComparativeAdapterBase.ts'
import { getAssemblyNamesFromConf } from './util.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * What a two-genome adapter answers off `assemblyNames` alone.
 *
 * The array is ordered [query, target] (see {@link getAssemblyNamesFromConf}),
 * so side 0 is the file's query columns (PAF `qname`, BLAST `qseqid`, PIF `q`)
 * and side 1 its target columns — which is why PAFAdapter and
 * BlastTabularAdapter index their pair of per-refName maps with the side
 * directly, and why `flip` (the query perspective) is side 0.
 *
 * The four pairwise adapters each spelled this out: an `indexOf`, a
 * `-1`-means-warn branch, and `assemblyNames[flip ? 1 : 0]` for the mate. They
 * did not spell it out the same way — BlastTabularAdapter re-derived `flip` by
 * comparing names where its own getRefNames used the index, and only
 * PairwiseIndexedPAFAdapter threw on a missing assembly name where the rest
 * answer `[]`.
 */
export abstract class PairwiseAdapterBase<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> extends ComparativeAdapterBase<CONF> {
  getAssemblyNames(): string[] {
    return getAssemblyNamesFromConf(this)
  }

  /**
   * Which side of the file an assembly is anchored on; -1 = not ours. Anything
   * past the second name reads as the target side, which is what the positional
   * `indexOf` has always done.
   */
  protected sideFor(assemblyName: string | undefined): 0 | 1 | -1 {
    const idx =
      assemblyName === undefined
        ? -1
        : this.getAssemblyNames().indexOf(assemblyName)
    return idx === -1 ? -1 : idx === 0 ? 0 : 1
  }

  /** The assembly on the other side, which is what a mate is labelled with. */
  protected mateAssemblyName(side: 0 | 1) {
    return this.getAssemblyNames()[side === 0 ? 1 : 0]!
  }
}
