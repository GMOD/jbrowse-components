import { type Observable, firstValueFrom, merge } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { BaseAdapter } from './BaseAdapter'
import {
  aggregateQuantitativeStats,
  calculateFeatureDensityStats,
} from './stats'
import { ObservableCreate } from '../../util/rxjs'
import { blankStats, scoresToStats } from '../../util/stats'

import type { BaseOptions } from './BaseOptions'
import type { Feature } from '../../util/simpleFeature'
import type { AugmentedRegion as Region } from '../../util/types'

/**
 * Base class for feature adapters to extend. Defines some methods that
 * subclasses must implement.
 */
export abstract class BaseFeatureDataAdapter extends BaseAdapter {
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
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   */
  public getFeaturesInRegion(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const hasData = await this.hasDataForRefName(region.refName, opts)
      if (!hasData) {
        observer.complete()
      } else {
        this.getFeatures(region, opts).subscribe(observer)
      }
    })
  }

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   *
   * Currently this just calls getFeatureInRegion for each region. Adapters that
   * are frequently called on multiple regions simultaneously may want to
   * implement a more efficient custom version of this method.
   *
   * @param regions - Regions
   * @param opts - Feature adapter options
   * @returns Observable of Feature objects in the regions
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
    opts: BaseOptions = {},
  ) {
    return merge(
      ...regions.map(region => this.getFeaturesInRegion(region, opts)),
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
    const feats = this.getFeatures(region, opts)
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
   * Calculates the "feature density" of a region. The primary purpose of this
   * API is to alert the user if they are going to be downloading too much
   * information, and give them a hint to zoom in to see more. The default
   * implementation samples from the regions, downloads feature data with
   * getFeatures, and returns an object with the form \{featureDensity:number\}

   * 1. alternative calculations for featureDensity
   * 2. they can also return an object containing a byte size calculation with
   * the format \{bytes:number, fetchSizeLimit:number\}
   *
   * In 2. the fetchSizeLimit is the adapter-defined limit for what it thinks
   * is 'too much data' (e.g. CRAM and BAM may vary on what they think too much
   * data is)
   */
  getRegionFeatureDensityStats(region: Region, opts?: BaseOptions) {
    return calculateFeatureDensityStats(
      region,
      (region2, opts2) => this.getFeatures(region2, opts2),
      opts,
    )
  }

  /**
   * Calculates the "feature density" of a set of regions. Note: Currently only
   * fetches from the first region because it is a heuristic
   */
  public async getMultiRegionFeatureDensityStats(
    regions: Region[],
    opts?: BaseOptions,
  ) {
    if (!regions.length) {
      throw new Error('No regions supplied')
    }
    return this.getRegionFeatureDensityStats(regions[0]!, opts)
  }

  async getSources(
    regions: Region[],
  ): Promise<{ name: string; color?: string; [key: string]: unknown }[]> {
    const features = await firstValueFrom(
      this.getFeaturesInMultipleRegions(regions).pipe(toArray()),
    )
    const sources = new Set<string>()
    for (const f of features) {
      sources.add(f.get('source'))
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
