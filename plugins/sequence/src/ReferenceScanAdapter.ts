import { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getSequenceSubAdapter } from '@jbrowse/core/data_adapters/getSequenceSubAdapter'
import { SimpleFeature, doesIntersect2 } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type {
  Feature,
  Region,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

export interface ScanWindow {
  /** the region asked for; a hit counts only where it overlaps this */
  query: Region
  /** plus-strand residues of the padded window */
  residues: string
  /** absolute coordinate `residues[0]` sits at */
  windowStart: number
  /** absolute coordinate one past the last fetched base */
  windowEnd: number
  /** reports one hit, subject to the window rules described on the class */
  emit: (feature: SimpleFeatureSerialized) => void
}

/**
 * The shared spine of the adapters that find features by scanning the reference
 * — sequence patterns, motif and restriction sites, CRISPR guides. A subclass
 * says how far past the query one of its hits can reach (`scanPadding`) and what
 * to make of the residues (`scan`); the window arithmetic lives here once.
 *
 * That arithmetic is the reason this is a base class rather than three similar
 * methods. Two hazards recur in every scan and each has been got wrong
 * independently in more than one of these adapters:
 *
 * - a hit whose full extent was never fetched is not trustworthy, because the
 *   sequence its placement depends on was not read
 * - a hit outside the query belongs to the neighbouring block, which pads its
 *   own fetch and reports it there
 *
 * `emit` applies both, so a subclass reports every hit it finds and never
 * repeats the bookkeeping.
 */
export abstract class ReferenceScanAdapter<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> extends BaseFeatureDataAdapter<CONF> {
  public async configure() {
    // path form because CONF is unresolved here, so the slot-name overload has
    // nothing to check the literal against. getSequenceSubAdapter takes
    // `unknown`, and an absent slot resolves from the assembly, which is the
    // wanted behaviour anyway.
    const configured: unknown = this.getConf(['sequenceAdapter'])
    return getSequenceSubAdapter(this, configured)
  }

  public async getRefNames() {
    const adapter = await this.configure()
    return adapter.getRefNames()
  }

  /** bp a hit's own extent can reach past the query on either side */
  protected abstract scanPadding(): number

  /** find hits in the fetched window and hand each one to `emit` */
  protected abstract scan(window: ScanWindow): void

  public getFeatures(query: Region, opts: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const sequenceAdapter = await this.configure()
      const pad = this.scanPadding()
      const windowStart = Math.max(0, query.start - pad)
      const residues =
        (await sequenceAdapter.getSequence(
          { ...query, start: windowStart, end: query.end + pad },
          opts,
        )) ?? ''
      // getSequence clamps to the contig end, so the window can come back
      // shorter than it was asked for; anchor on what actually arrived
      const windowEnd = windowStart + residues.length
      this.scan({
        query,
        residues,
        windowStart,
        windowEnd,
        emit: feature => {
          const { start, end } = feature
          if (
            start >= windowStart &&
            end <= windowEnd &&
            doesIntersect2(start, end, query.start, query.end)
          ) {
            observer.next(new SimpleFeature(feature))
          }
        },
      })
      observer.complete()
    })
  }
}
