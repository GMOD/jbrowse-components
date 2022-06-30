import { BigWig } from '@gmod/bbi'
import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { updateStatus } from '@jbrowse/core/util'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { rectifyStats, UnrectifiedFeatureStats } from '@jbrowse/core/util/stats'

interface WiggleOptions extends BaseOptions {
  resolution?: number
}

export default class BigWigAdapter extends BaseFeatureDataAdapter {
  private setupP?: Promise<{ bigwig: BigWig; header: any }>

  public static capabilities = [
    'hasResolution',
    'hasLocalStats',
    'hasGlobalStats',
  ]

  private async setupPre(opts?: BaseOptions) {
    const { statusCallback = () => {} } = opts || {}
    const bigwig = new BigWig({
      filehandle: openLocation(
        this.getConf('bigWigLocation'),
        this.pluginManager,
      ),
    })
    const header = await updateStatus(
      'Downloading bigwig header',
      statusCallback,
      () => bigwig.getHeader(opts),
    )
    return { bigwig, header }
  }

  async setup(opts?: BaseOptions) {
    if (!this.setupP) {
      this.setupP = this.setupPre(opts).catch(e => {
        this.setupP = undefined
        throw e
      })
    }
    return this.setupP
  }

  public async getRefNames(opts?: BaseOptions) {
    const {
      header: { refsByName },
    } = await this.setup(opts)
    return Object.keys(refsByName)
  }

  public async refIdToName(refId: number) {
    const {
      header: { refsByNumber },
    } = await this.setup()
    return refsByNumber[refId]?.name
  }

  public async getGlobalStats(opts?: BaseOptions) {
    const {
      header: { totalSummary },
    } = await this.setup(opts)
    return rectifyStats(totalSummary as UnrectifiedFeatureStats)
  }

  public getFeatures(region: Region, opts: WiggleOptions = {}) {
    const { refName, start, end } = region
    const {
      bpPerPx = 0,
      signal,
      resolution = 1,
      statusCallback = () => {},
    } = opts
    return ObservableCreate<Feature>(async observer => {
      statusCallback('Downloading bigwig data')
      const source = this.getConf('source')
      const { bigwig } = await this.setup(opts)
      const feats = await bigwig.getFeatures(refName, start, end, {
        ...opts,
        basesPerSpan: bpPerPx / resolution,
      })

      for (let i = 0; i < feats.length; i++) {
        const data = feats[i]
        if (source) {
          // @ts-ignore
          data.source = source
        }
        // @ts-ignore
        data.refName = refName
        const uniqueId = `${region.refName}:${data.start}-${data.end}`
        observer.next({
          // @ts-ignore
          get: (str: string) => (data as Record<string, unknown>)[str],
          id: () => `${source}-${uniqueId}`,
          toJSON: () => ({ ...data, uniqueId }),
        })
      }
      observer.complete()
    }, signal)
  }

  // always render bigwig instead of calculating a feature density for it
  async estimateRegionsStats(_regions: Region[]) {
    return { featureDensity: 0 }
  }

  public freeResources(): void {}
}
