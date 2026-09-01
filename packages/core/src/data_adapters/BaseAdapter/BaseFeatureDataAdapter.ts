import { firstValueFrom, merge } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { createStatusFanOut } from '../../util/progress.ts'
import { blankStats, scoresToStats } from '../../util/stats.ts'
import { BaseAdapter } from './BaseAdapter.ts'
import { aggregateQuantitativeStats } from './stats.ts'
import { isFeatureAdapter } from './util.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { Feature } from '../../util/simpleFeature.ts'
import type { AugmentedRegion as Region } from '../../util/types/index.ts'
import type { FeatureDensity } from './featureDensity.ts'
import type { BaseOptions } from './types.ts'
import type { Observable } from 'rxjs'

function isAdapterConfigSnapshot(
  value: unknown,
): value is Record<string, unknown> & { type: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof value.type === 'string'
  )
}

/**
 * Base class for feature adapters to extend. Defines some methods that
 * subclasses must implement.
 */
/** #adapterBase BaseFeatureDataAdapter | features overlapping a region — genes, reads, variants. The common case */
export abstract class BaseFeatureDataAdapter<
  CONF extends AnyConfigurationModel = AnyConfigurationModel,
> extends BaseAdapter<CONF> {
  /**
   * Get all reference sequence names used in the data source
   * Example:
   * public async getRefNames(opts?: BaseOptions): Promise\<string[]\> \}
   *   await this.setup()
   *   const \{ refNames \} = this.metadata
   *   return refNames
   * \}
   *
   *
   * NOTE: If an adapter is unable to determine the reference sequence names,
   * the array will be empty
   * @param opts - Feature adapter options
   */
  public abstract getRefNames(opts?: BaseOptions): Promise<string[]>

  /**
   * Get features from the data source that overlap a region
   * Example:
   * public getFeatures(
   *   region: Region,
   *   opts: BaseOptions,
   * ): Observable<Feature> \{
   *   return ObservableCreate(observer =\> \{
   *     const records = getRecords(assembly, refName, start, end)
   *     records.forEach(record =\> \{
   *       observer.next(this.recordToFeature(record))
   *     \})
   *     observer.complete()
   *   \})
   * \}
   * @param region - Region
   * @param opts - Feature adapter options
   * @returns Observable of Feature objects in the region
   */
  public abstract getFeatures(
    region: Region,
    opts?: BaseOptions,
  ): Observable<Feature>

  /**
   * Return "header info" that is fetched from the data file, or other info
   * that would not simply be in the config of the file. The return value can
   * be `{tag:string, data: any}[]` e.g. list of tags with their values which
   * is how VCF,BAM,CRAM return values for getInfo or it can be a nested JSON
   * object
   */
  public async getHeader(_opts?: BaseOptions): Promise<unknown> {
    return null
  }

  /**
   * Return info that is primarily used for interpreting the data that is there,
   * primarily in reference to being used for augmenting feature details panels
   */
  public async getMetadata(_opts?: BaseOptions): Promise<unknown> {
    return null
  }

  /**
   * Adapters that are frequently called on multiple regions simultaneously
   * may want to implement a more efficient custom version of this method.
   *
   * The regions are fetched concurrently, so each gets its own
   * {@link createStatusFanOut} slot rather than the caller's raw
   * `statusCallback`: they all report the same phases ("Downloading
   * features"), and sharing one status field meant the last writer won and the
   * first region to finish cleared the label while the rest were still
   * downloading. Aggregated, N regions read as one Σbytes bar — the same helper
   * `callEachRegion` uses to give the per-region RPCs on the main thread a slot
   * apiece.
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
    opts: BaseOptions = {},
  ) {
    const slot = createStatusFanOut(opts.statusCallback)
    return merge(
      ...regions.map(region =>
        this.getFeatures(region, { ...opts, statusCallback: slot() }),
      ),
    )
  }

  /**
   * Convenience wrapper that collects {@link getFeatures} for a region into an
   * array — the common shape across RPC methods (RenderFeatureData, Manhattan,
   * Wiggle, etc.). Pass `opts` so `statusCallback`/`stopToken` reach the
   * adapter; omitting them means no download progress and a fetch that can't be
   * interrupted mid-flight.
   */
  public getFeaturesArray(region: Region, opts: BaseOptions = {}) {
    return firstValueFrom(this.getFeatures(region, opts).pipe(toArray()))
  }

  /**
   * {@link getFeaturesArray} across multiple regions — collects
   * {@link getFeaturesInMultipleRegions} into an array. The common shape in
   * matrix/comparative RPC methods (variants, synteny, dotplot, breakpoint).
   */
  public getFeaturesInMultipleRegionsArray(
    regions: Region[],
    opts: BaseOptions = {},
  ) {
    return firstValueFrom(
      this.getFeaturesInMultipleRegions(regions, opts).pipe(toArray()),
    )
  }

  /**
   * Check if the store has data for the given reference name.
   * @param refName - Name of the reference sequence
   * @returns Whether data source has data for the given reference name
   */
  public async hasDataForRefName(refName: string, opts: BaseOptions = {}) {
    const refNames = await this.getRefNames(opts)
    return refNames.includes(refName)
  }

  /**
   * Calculates the minimum score, maximum score, and other statistics from
   * features over a region, primarily used for quantitative tracks
   */
  public async getRegionQuantitativeStats(region: Region, opts?: BaseOptions) {
    const feats = this.getFeatures(region, {
      ...opts,
      statsEstimationMode: true,
    })
    return scoresToStats(region, feats)
  }
  /**
   * Calculates the minimum score, maximum score, and other statistics from
   * features over multiple regions, primarily used for quantitative tracks
   */
  public async getMultiRegionQuantitativeStats(
    regions: Region[] = [],
    opts?: BaseOptions,
  ) {
    if (!regions.length) {
      return blankStats()
    }
    const stats = await Promise.all(
      regions.map(region => this.getRegionQuantitativeStats(region, opts)),
    )
    return aggregateQuantitativeStats(stats)
  }

  /**
   * Cheap upper bound on the compressed bytes a fetch of `regions` would pull,
   * derived from an index without downloading or parsing any features. The
   * default returns `undefined` ("no cheap estimate"); indexed adapters (tabix)
   * override it, and an adapter that caps what it returns at screen resolution
   * (BigWig, HiC, sequence) simply doesn't — no estimate means no byte gate.
   *
   * The one byte-estimate entry point, used by both halves of the region-too-large
   * gate: the pre-flight `CoreGetRegionByteEstimate` RPC and the in-fetch
   * short-circuit in `executeRenderFeatureData`. The byte *budget* it is compared
   * against is read on the main thread from the adapter's `fetchSizeLimit` config
   * slot, so it never crosses the worker boundary — see
   * agent-docs/reference/REGION_TOO_LARGE.md.
   */
  async getRegionByteSize(
    _regions: Region[],
    _opts?: BaseOptions,
  ): Promise<number | undefined> {
    return undefined
  }

  /**
   * Features per bin over each region, at the view's `bpPerPx`, for the density
   * tier the display draws where the region-too-large gate refused the
   * features. The default reads the `densityAdapter` sidecar slot
   * (`densityAdapterConfigSchemaFields`) through `getSubAdapter`; `undefined`
   * means no tier, and the banner stands. ADR-102 records why no index
   * estimate stands in for a missing sidecar.
   */
  async getFeatureDensity(
    regions: Region[],
    opts: BaseOptions & { bpPerPx: number },
  ): Promise<FeatureDensity[] | undefined> {
    const sidecar: unknown = this.getConf(['densityAdapter'])
    const resolved =
      isAdapterConfigSnapshot(sidecar) && this.getSubAdapter
        ? (await this.getSubAdapter(sidecar)).dataAdapter
        : undefined
    if (resolved && !isFeatureAdapter(resolved)) {
      throw new Error(
        `densityAdapter ${isAdapterConfigSnapshot(sidecar) ? sidecar.type : ''} is not a feature adapter`,
      )
    }
    return resolved
      ? Promise.all(
          regions.map(async region => {
            const features = await resolved.getFeaturesArray(region, opts)
            const starts = new Uint32Array(features.length)
            const ends = new Uint32Array(features.length)
            const scores = new Float32Array(features.length)
            features.forEach((feature, i) => {
              const score = feature.get('score')
              starts[i] = feature.get('start')
              ends[i] = feature.get('end')
              scores[i] = score === undefined ? 0 : score
            })
            return { starts, ends, scores }
          }),
        )
      : undefined
  }

  async getSources(
    regions: Region[],
    opts: BaseOptions = {},
  ): Promise<{ name: string; color?: string; [key: string]: unknown }[]> {
    const features = await this.getFeaturesInMultipleRegionsArray(regions, opts)
    const sources = new Set<string>()
    for (const f of features) {
      const source = f.get('source')
      if (source !== undefined) {
        sources.add(source)
      }
    }
    return [...sources].map(source => ({
      name: source,
    }))
  }

  /**
   * Export data from the adapter in a specified format for given regions.
   * Some adapters (like VcfAdapter) can efficiently export raw data directly
   * from the file without parsing to features.
   *
   * @param regions - Regions to export data from
   * @param formatType - The format to export to (e.g. 'vcf', 'sam', 'bedgraph')
   * @param opts - Feature adapter options
   * @returns Promise resolving to the exported data as a string, or undefined
   *          if the adapter does not support direct export for this format
   */
  public async getExportData(
    _regions: Region[],
    _formatType: string,
    _opts?: BaseOptions,
  ): Promise<string | undefined> {
    return undefined
  }
}
