import { firstValueFrom, merge } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { blankStats, scoresToStats } from '../../util/stats.ts'
import { BaseAdapter } from './BaseAdapter.ts'
import { aggregateQuantitativeStats } from './stats.ts'

import type { AnyConfigurationModel } from '../../configuration/index.ts'
import type { Feature } from '../../util/simpleFeature.ts'
import type { AugmentedRegion as Region } from '../../util/types/index.ts'
import type { BaseOptions, RegionByteEstimate } from './types.ts'
import type { Observable } from 'rxjs'

/**
 * Base class for feature adapters to extend. Defines some methods that
 * subclasses must implement.
 */
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
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
    opts: BaseOptions = {},
  ) {
    return merge(...regions.map(region => this.getFeatures(region, opts)))
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
   * Estimates how much data a fetch of `regions` would pull, so a display can
   * warn the user (and offer force-load) before downloading too much. Returns
   * the adapter's cheap index-only byte estimate via `getRegionByteSize` (the
   * tabix family overrides it); adapters with no index estimate return no bytes
   * and aren't byte-gated. BAM/CRAM/VCF override this to attach their own
   * `fetchSizeLimit`; self-summarizing adapters (BigWig) return `alwaysRender`.
   */
  public async getMultiRegionByteEstimate(
    regions: Region[],
    opts?: BaseOptions,
  ): Promise<RegionByteEstimate> {
    return regions[0]
      ? { bytes: await this.getRegionByteSize(regions, opts) }
      : {}
  }

  /**
   * Cheap upper bound on the compressed bytes a fetch of `regions` would pull,
   * derived from an index without downloading or parsing any features. The
   * default returns `undefined` ("no cheap estimate"); indexed adapters (tabix)
   * override it. Lets a fetch short-circuit an over-budget region before
   * touching feature data — see `executeRenderFeatureData`.
   */
  async getRegionByteSize(
    _regions: Region[],
    _opts?: BaseOptions,
  ): Promise<number | undefined> {
    return undefined
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
