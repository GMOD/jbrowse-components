import {
  BaseFeatureDataAdapter,
  cachedSetup,
  isFeatureAdapter,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  ObservableCreate,
  subscribeToObservable,
} from '@jbrowse/core/util/rxjs'

import { getSamplesFromAdapter } from './getSamples.ts'
import { MafFeatureSink } from './mafFeatureSink.ts'
import { MafTableSink } from './mafFeatureTable.ts'
import { MafStanzaReader } from './mafStanzaReader.ts'
import { toMafStatus } from './mafStatus.ts'
import { makeSourceResolver } from './parseAssemblyName.ts'

import type { MafSummaryRecord } from '../types.ts'
import type { MafAdapterConfigModel } from './mafAdapterConfigSchemaFields.ts'
import type { MafBlockSink } from './mafBlockSink.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type {
  RowSourceLister,
  RowSourceListing,
} from '@jbrowse/core/data_adapters/BaseAdapter/rowSources'
import type { Feature, Region } from '@jbrowse/core/util'

/**
 * What every MAF adapter is beyond its own file format: a sample set, a
 * zoom-out tier off the slots `mafAdapterConfigSchemaFields` gives all four,
 * and its blocks read into a packer.
 *
 * This class IS the contract the MAF RPCs load against — `loadMafSamplesAdapter`
 * checks `instanceof` — which is what makes the members below the whole of
 * it. They used to be described by a structural `MafSamplesAdapter` type that
 * any object with the right method names satisfied, so the way to lose the byte
 * gate was to write an adapter that simply did not declare `summaryAdapter`.
 */
export abstract class MafAdapterBase<
  CONF extends MafAdapterConfigModel = MafAdapterConfigModel,
>
  extends BaseFeatureDataAdapter<CONF>
  implements RowSourceLister
{
  summaryAdapter = cachedSetup({
    setup: () => loadSummaryAdapter(this),
  })

  getSamples = cachedSetup({
    setup: opts =>
      getSamplesFromAdapter(this.config, this.pluginManager, opts.signal),
  })

  /**
   * The ids every read resolves a source token against (`matchSampleId`): the
   * adapter's own sample set, or undefined where it discovers its species. An
   * empty set would match nothing, so it is never one.
   */
  async sampleIds(opts?: BaseOptions) {
    const { samples } = await this.getSamples(opts)
    return samples.length ? new Set(samples.map(s => s.name)) : undefined
  }

  /** A stanza reader resolving source tokens against {@link sampleIds}. */
  protected async stanzaReader(opts?: BaseOptions) {
    return new MafStanzaReader(makeSourceResolver(await this.sampleIds(opts)))
  }

  async listRowSources(opts?: BaseOptions): Promise<RowSourceListing> {
    const { samples, treeNewick, warnings } = await this.getSamples(opts)
    return {
      field: 'alignments',
      sources: samples.map(({ name, label, color }) => ({
        name,
        ...(label !== name ? { label } : {}),
        ...(color ? { color } : {}),
      })),
      ...(treeNewick === undefined ? {} : { tree: treeNewick }),
      ...(warnings.length ? { warnings } : {}),
    }
  }

  /** The region's blocks into `sink`: each adapter's one parse. */
  abstract readBlocks(
    query: Region,
    sink: MafBlockSink,
    opts?: BaseOptions,
  ): Promise<void>

  getFeatures(query: Region, opts?: BaseOptions) {
    return ObservableCreate<Feature>(async observer => {
      const sink = new MafFeatureSink(query.refName, feature => {
        observer.next(feature)
      })
      await this.readBlocks(query, sink, opts)
      sink.finish()
      observer.complete()
    }, opts?.signal)
  }

  override async getFeatureTable(query: Region, opts?: BaseOptions) {
    const sink = new MafTableSink(query.refName)
    await this.readBlocks(query, sink, opts)
    return sink.table()
  }

  /**
   * Per-species alignment-block rows for zoom-out rendering: one record per
   * (species, region) with a score and left/right context, and **no sequence**
   * — which is the entire point, since the sequence is what makes the full
   * alignment fetch unaffordable at genome scale.
   *
   * It reads named fields off whatever the `summaryAdapter` slot's adapter
   * yields rather than a format-specific record, which is what lets one
   * implementation serve both sources: UCSC's `bigMafSummary.bb` declares
   * `src`/`score`/`leftStatus`/`rightStatus` in its autoSql, and a summary BED
   * names the same columns in its `#` header line (`BedTabixAdapter` reads
   * column names from the header when `columnNames` is unset, and `featureData`
   * drops `chrom`/`chromStart`/`chromEnd` in favor of the tabix-supplied ones).
   *
   * Emits nothing when no `summaryAdapter` is configured — callers fall back to
   * the byte-estimate force-load gate.
   */
  getSummaryFeatures(query: Region, opts?: BaseOptions) {
    return ObservableCreate<MafSummaryRecord>(async observer => {
      const adapter = await this.summaryAdapter(opts)
      if (adapter) {
        await subscribeToObservable(adapter.getFeatures(query, opts), f => {
          const src = f.get('src')
          // `src` is what maps a row to its species — the display looks it up
          // in `rowIndexBySrc` and the summary RPC discovers the row set from
          // it — so a file without the column renders no bars at all rather
          // than wrong ones. Said once, here, instead of as an empty band with
          // no error.
          if (typeof src !== 'string') {
            throw new Error(
              `MAF summary: no \`src\` column at ${f.get('refName')}:${f.get('start')}. ` +
                'Expected a UCSC bigMafSummary.bb, or the BED `maf2bed --summary` ' +
                'writes (whose `#` header names the column) — check the ' +
                'summaryAdapter points at one of those.',
            )
          }
          observer.next({
            refName: f.get('refName'),
            start: f.get('start'),
            end: f.get('end'),
            src,
            // Absent shades the bar at the `MIN_ALPHA` floor, which still reads
            // as "this species aligns here". `!` gave `undefined`, and the
            // alpha math then produced `NaN` and an unpaintable color.
            score: f.get('score') ?? 0,
            leftStatus: toMafStatus(f.get('leftStatus')),
            rightStatus: toMafStatus(f.get('rightStatus')),
          })
        })
      }
      observer.complete()
    }, opts?.signal)
  }
}

/**
 * Resolve the `summaryAdapter` slot to a data adapter, or undefined when the
 * slot is unset. Whatever the slot names is what gets loaded — the summary
 * source is swappable, like CRAM's `getSequenceAdapter` — so a BigMaf track
 * points it at a `BigBedAdapter` over UCSC's `bigMafSummary.bb` while a tabix
 * or TAF track points it at a `BedTabixAdapter` over a summary BED.
 */
async function loadSummaryAdapter(self: BaseFeatureDataAdapter) {
  const config: Record<string, unknown> | undefined =
    self.getConf('summaryAdapter')
  let adapter: BaseFeatureDataAdapter | undefined
  if (config && self.getSubAdapter) {
    const { dataAdapter } = await self.getSubAdapter(config)
    if (!isFeatureAdapter(dataAdapter)) {
      throw new Error(
        `MAF summaryAdapter ${String(config.type)} does not serve features`,
      )
    }
    adapter = dataAdapter
  }
  return adapter
}
