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
 * The base of the adapters that find features by scanning the reference:
 * sequence search, motif sites, CRISPR guides. A subclass gives `scanPadding`
 * (how far a hit reaches past the query) and `scan`, and reports every hit it
 * finds; `emit` drops one whose extent was not fetched, or that lies outside
 * the query, where the neighbouring block reports it.
 *
 * A subclass's registration declares `READS_REFERENCE` itself: the capability
 * lives on the adapter type, so it is not inherited, and a scan registered
 * without it answers every genome from the first one's sequence.
 *
 * A genome-wide mode was declined: on hg38 it downloads the 835 MB .2bit and
 * finds only exact matches, while BLAT (GMOD/jbrowse-plugin-blat) answers "where is this
 * sequence" server-side and tolerates mismatches and introns.
 */
export abstract class ReferenceScanAdapter<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> extends BaseFeatureDataAdapter<CONF> {
  public async configure() {
    // path form, since CONF is unresolved here; an absent slot resolves from
    // the assembly
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

  /**
   * One byte per residue fetched, so a zoomed-out scan meets the display's
   * region-too-large gate. Without it a rare pattern never trips the density
   * gate, and the probe and then the full fetch scan the whole chromosome.
   */
  public async getRegionByteSize(regions: Region[]) {
    const pad = 2 * this.scanPadding()
    return regions.reduce((bytes, r) => bytes + r.end - r.start + pad, 0)
  }

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
      // getSequence clamps to the contig end, so anchor on what arrived
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
