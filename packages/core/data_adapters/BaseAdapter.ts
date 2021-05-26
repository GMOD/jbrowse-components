import { Observable, merge } from 'rxjs'
import { takeUntil } from 'rxjs/operators'
import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'
import { ObservableCreate } from '../util/rxjs'
import { checkAbortSignal, hashCode, observeAbortSignal } from '../util'
import { Feature } from '../util/simpleFeature'
import {
  AnyConfigurationModel,
  ConfigurationSchema,
} from '../configuration/configurationSchema'
import { getSubAdapterType } from './dataAdapterCache'
import { Region, NoAssemblyRegion } from '../util/types'
import { blankStats, rectifyStats, scoresToStats } from '../util/stats'

export interface BaseOptions {
  signal?: AbortSignal
  bpPerPx?: number
  sessionId?: string
  statusCallback?: (message: string) => void
  headers?: Record<string, string>
  [key: string]: unknown
}

// see
// https://www.typescriptlang.org/docs/handbook/2/classes.html#abstract-construct-signatures
// for why this is the abstract construct signature
export interface AnyAdapter {
  new (
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
  ): AnyDataAdapter
}

export type AnyDataAdapter =
  | BaseAdapter
  | BaseFeatureDataAdapter
  | BaseRefNameAliasAdapter
  | RegionsAdapter
  | SequenceAdapter

// generates a short "id fingerprint" from the config passed to the base
// feature adapter by recursively enumerating props, but if config is too big
// does not process entire config (FromConfigAdapter for example can be large)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function idMaker(args: any, id = '') {
  const keys = Object.keys(args)
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]
    if (id.length > 5000) {
      break
    }
    if (typeof args[key] === 'object' && args[key]) {
      id += idMaker(args[key], id)
    } else {
      id += `${key}-${args[key]};`
    }
  }
  return hashCode(id)
}

export abstract class BaseAdapter {
  public id: string

  static capabilities = [] as string[]

  config: AnyConfigurationModel

  getSubAdapter?: getSubAdapterType

  constructor(
    config: AnyConfigurationModel = ConfigurationSchema('empty', {}).create(),
    getSubAdapter?: getSubAdapterType,
  ) {
    this.config = config
    this.getSubAdapter = getSubAdapter
    // note: we use switch on jest here for more simple feature IDs
    // in test environment
    if (typeof jest === 'undefined') {
      const data = isStateTreeNode(config) ? getSnapshot(config) : config
      this.id = `${idMaker(data)}`
    } else {
      this.id = 'test'
    }
  }

  /**
   * Called to provide a hint that data tied to a certain region will not be
   * needed for the forseeable future and can be purged from caches, etc
   * @param region - Region
   */
  public abstract freeResources(region: Region): void
}

/**
 * Base class for feature adapters to extend. Defines some methods that
 * subclasses must implement.
 */
export abstract class BaseFeatureDataAdapter extends BaseAdapter {
  /**
   * Get all reference sequence names used in the data source
   *
   * NOTE: If an adapter is unable to determine the reference sequence names,
   * the array will be empty
   * @param opts - Feature adapter options
   */
  public abstract async getRefNames(opts?: BaseOptions): Promise<string[]>
  // public abstract async getRefNames(opts?: BaseOptions): Promise<string[]>
  //   await this.setup()
  //   const { refNames } = this.metadata
  //   return refNames
  // }

  /**
   * Get features from the data source that overlap a region
   * @param region - Region
   * @param options - Feature adapter options
   * @returns Observable of Feature objects in the region
   */
  public abstract getFeatures(
    region: Region,
    opts?: BaseOptions,
  ): Observable<Feature>
  // public abstract getFeatures(
  //   region: Region,
  //   opts: BaseOptions,
  // ): Observable<Feature> {
  //   return ObservableCreate(observer => {
  //     const records = getRecords(assembly, refName, start, end)
  //     records.forEach(record => {
  //       observer.next(this.recordToFeature(record))
  //     })
  //     observer.complete()
  //   })
  // }

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
      checkAbortSignal(opts.signal)
      if (!hasData) {
        // console.warn(`no data for ${region.refName}`)
        observer.complete()
      } else {
        this.getFeatures(region, opts)
          .pipe(takeUntil(observeAbortSignal(opts.signal)))
          .subscribe(observer)
      }
    })
  }

  /**
   * Checks if the store has data for the given assembly and reference
   * sequence, and then gets the features in the region if it does.
   *
   * Currently this just calls getFeatureInRegion for each region. Adapters
   * that are frequently called on multiple regions simultaneously may
   * want to implement a more efficient custom version of this method.
   *
   * Currently this just calls getFeatureInRegion for each region. Adapters that
   * are frequently called on multiple regions simultaneously may want to
   * implement a more efficient custom version of this method.
   * @param regions - Regions
   * @param opts - Feature adapter options
   * @returns Observable of Feature objects in the regions
   */
  public getFeaturesInMultipleRegions(
    regions: Region[],
    opts: BaseOptions = {},
  ) {
    const obs = merge(
      ...regions.map(region => {
        return ObservableCreate<Feature>(async observer => {
          const hasData = await this.hasDataForRefName(region.refName, opts)
          checkAbortSignal(opts.signal)
          if (!hasData) {
            // console.warn(`no data for ${region.refName}`)
            observer.complete()
          } else {
            this.getFeatures(region, opts).subscribe(observer)
          }
        })
      }),
    )

    if (opts.signal) {
      return obs.pipe(takeUntil(observeAbortSignal(opts.signal)))
    }
    return obs
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

  public async getRegionStats(region: Region, opts?: BaseOptions) {
    const feats = this.getFeatures(region, opts)
    return scoresToStats(region, feats)
  }

  public async getMultiRegionStats(regions: Region[] = [], opts?: BaseOptions) {
    if (!regions.length) {
      return blankStats()
    }
    const feats = await Promise.all(
      regions.map(region => this.getRegionStats(region, opts)),
    )

    const scoreMax = feats
      .map(s => s.scoreMax)
      .reduce((acc, curr) => Math.max(acc, curr))
    const scoreMin = feats
      .map(s => s.scoreMin)
      .reduce((acc, curr) => Math.min(acc, curr))
    const scoreSum = feats.map(s => s.scoreSum).reduce((a, b) => a + b, 0)
    const scoreSumSquares = feats
      .map(s => s.scoreSumSquares)
      .reduce((a, b) => a + b, 0)
    const featureCount = feats
      .map(s => s.featureCount)
      .reduce((a, b) => a + b, 0)
    const basesCovered = feats
      .map(s => s.basesCovered)
      .reduce((a, b) => a + b, 0)

    return rectifyStats({
      scoreMin,
      scoreMax,
      featureCount,
      basesCovered,
      scoreSumSquares,
      scoreSum,
    })
  }
}

export interface RegionsAdapter extends BaseAdapter {
  getRegions(opts: BaseOptions): Promise<NoAssemblyRegion[]>
}

export interface SequenceAdapter
  extends BaseFeatureDataAdapter,
    RegionsAdapter {}

export function isSequenceAdapter(
  thing: AnyDataAdapter,
): thing is SequenceAdapter {
  return 'getRegions' in thing && 'getFeatures' in thing
}

export function isRegionsAdapter(
  thing: AnyDataAdapter,
): thing is RegionsAdapter {
  return 'getRegions' in thing
}

export function isFeatureAdapter(
  thing: AnyDataAdapter,
): thing is BaseFeatureDataAdapter {
  return 'getFeatures' in thing
}

export interface Alias {
  refName: string
  aliases: string[]
}
export interface BaseRefNameAliasAdapter extends BaseAdapter {
  getRefNameAliases(opts: BaseOptions): Promise<Alias[]>
}
export function isRefNameAliasAdapter(
  thing: object,
): thing is BaseRefNameAliasAdapter {
  return 'getRefNameAliases' in thing
}
