import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { createStatusFanOut } from '@jbrowse/core/util'
import { from } from 'rxjs'
import { map, mergeMap, toArray } from 'rxjs/operators'

import { clipFeatureToRegion } from './clipFeatureToRegion.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import type { ComparativeOptions } from '@jbrowse/synteny-core'

/**
 * What every adapter in this plugin answers the same way.
 *
 * `hasDataForRefName` is true unconditionally because deciding it properly is a
 * `getFeatures` — and it has to be true, or BaseFeatureDataAdapter filters the
 * track out and `getFeatures` is never called at all. Eight adapters carried
 * that method and its three-line explanation verbatim.
 *
 * Only the answers that do not depend on config live here. Anything reading a
 * slot stays in the concrete adapter, for the reason `getAssemblyNamesFromConf`
 * documents: a base generic over the config cannot prove a slot name to
 * `getConf`, so hoisting a read costs the typing that makes it worth having.
 */
export abstract class ComparativeAdapterBase<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> extends BaseFeatureDataAdapter<CONF> {
  public static capabilities = ['getFeatures', 'getRefNames']

  /**
   * Whether a record's two intervals are the aligned extents of one alignment,
   * which `clipToRegion` may cut at a region edge on both axes, or two genes,
   * whose extents are the genes and stay whole however the region falls.
   */
  protected readonly recordsAreAlignments: boolean = true

  async hasDataForRefName() {
    return true
  }

  /**
   * `clipToRegion` and `splitAtGapBp` are honoured here and nowhere below:
   * `getFeatures` never sees them, so an adapter composed of others (the star)
   * clips its children's records once, after its own re-keying, rather than
   * once per child and once for itself.
   *
   * Emission is in REGION order, not arrival order, which is what the base
   * class's `merge` gives and what `MultiGenomeIndexedPAFAdapter` sorts its own
   * concurrent reads to avoid. The lane sort downstream
   * (`rowAssembliesOf`) weighs lanes with integers and tie-breaks on first
   * appearance in this list, and the weights tie exactly — at the HPRC CFH
   * window four haplotypes tie at 300,000 anchor bp and four at 215,316 — so
   * whichever region's fetch landed first decided the stack. Each region still
   * subscribes at once; only the emission waits.
   */
  getFeaturesInMultipleRegions(
    regions: Region[],
    opts: ComparativeOptions = {},
  ) {
    const { clipToRegion, splitAtGapBp, ...rest } = opts
    const clip = clipToRegion && this.recordsAreAlignments
    const slot = createStatusFanOut(rest.statusCallback)
    return from(regions).pipe(
      mergeMap((region, index) =>
        this.getFeatures(region, { ...rest, statusCallback: slot() }).pipe(
          mergeMap((feature): Feature[] =>
            clip
              ? clipFeatureToRegion(feature, region, splitAtGapBp)
              : [feature],
          ),
          toArray(),
          map(features => ({ index, features })),
        ),
      ),
      toArray(),
      mergeMap(chunks =>
        chunks
          .sort((a, b) => a.index - b.index)
          .flatMap(chunk => chunk.features),
      ),
    )
  }
}
