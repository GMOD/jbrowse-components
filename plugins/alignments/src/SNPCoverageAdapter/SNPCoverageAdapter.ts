import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { reduce, filter } from 'rxjs/operators'
import { getSnapshot } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { Observable } from 'rxjs'
import { getTagAlt } from '../util'
import {
  parseCigar,
  getNextRefPos,
  getModificationPositions,
} from '../BamAdapter/MismatchParser'

export default class SNPCoverageAdapter extends BaseFeatureDataAdapter {
  private subadapter: BaseFeatureDataAdapter

  private sequenceAdapter: BaseFeatureDataAdapter

  public constructor(
    config: AnyConfigurationModel,
    getSubAdapter?: getSubAdapterType,
  ) {
    super(config)

    const dataAdapter = getSubAdapter?.(getSnapshot(config.subadapter))
      .dataAdapter
    const sequenceAdapter = getSubAdapter?.(
      readConfObject(config, ['subadapter', 'sequenceAdapter']),
    ).dataAdapter

    if (!sequenceAdapter) {
      throw new Error('failed to initialize adapter, no sequence adapter')
    }
    if (!dataAdapter) {
      throw new Error('failed to initialize adapter, no subadapter')
    }
    this.subadapter = dataAdapter as BaseFeatureDataAdapter

    this.sequenceAdapter = sequenceAdapter as BaseFeatureDataAdapter
  }

  getFeatures(
    region: Region,
    opts: BaseOptions & { filters?: SerializableFilterChain } = {},
  ) {
    return ObservableCreate<Feature>(async observer => {
      let stream = this.subadapter.getFeatures(region, opts)

      if (opts.filters) {
        const { filters } = opts
        stream = stream.pipe(filter(f => filters.passes(f, opts)))
      }

      const bins = await this.generateCoverageBins(stream, region, opts)

      bins.forEach((bin, index) => {
        observer.next(
          new SimpleFeature({
            id: `${this.id}-${region.start}-${index}`,
            data: {
              score: bin.total,
              snpinfo: bin,
              start: region.start + index,
              end: region.start + index + 1,
              refName: region.refName,
            },
          }),
        )
      })

      observer.complete()
    }, opts.signal)
  }

  async getRefNames(opts: BaseOptions = {}) {
    return this.subadapter.getRefNames(opts)
  }

  freeResources(/* { region } */): void {}

  /**
   * Generates coverage bins from features which details
   * the reference, mismatches, strands, and coverage info
   * @param features - Features of region to be passed in
   * @param region - Region
   * @param bpPerPx - base pairs per pixel
   * @returns Array of nested frequency tables
   */
  async generateCoverageBins(
    features: Observable<Feature>,
    region: Region,
    opts: { bpPerPx?: number; colorBy?: { type: string; tag?: string } },
  ) {
    const { colorBy } = opts
    const leftBase = region.start
    const rightBase = region.end
    const binMax = Math.ceil(rightBase - leftBase)

    const bins = new Array(binMax)
    for (let i = 0; i < bins.length; i++) {
      bins[i] = { total: 0, ref: 0, cov: {}, noncov: {} }
    }

    return features
      .pipe(
        reduce((bins: any[], feature: Feature) => {
          const start = feature.get('start')
          const end = feature.get('end')
          const cigarOps = parseCigar(feature.get('CIGAR'))

          for (let j = start; j < end; j++) {
            const pos = j - leftBase
            const bin = bins[pos]
            if (pos >= 0 && pos < bins.length) {
              bin.total++
              bin.ref++
            }
          }

          if (colorBy?.type === 'modifications') {
            const seq = feature.get('seq')
            const mm = getTagAlt(feature, 'MM', 'Mm') || ''

            getModificationPositions(mm, seq).forEach((positions, idx) => {
              const mod = `mod_${idx}`
              for (const pos of getNextRefPos(cigarOps, positions)) {
                const epos = pos + feature.get('start') - leftBase
                const bin = bins[epos]
                if (epos >= 0 && epos < bins.length) {
                  bin.ref--
                  if (!bin.cov[mod]) {
                    bin.cov[mod] = 1
                  } else {
                    bin.cov[mod]++
                  }
                }
              }
            })
          } else {
          }
          return bins
        }, bins),
      )
      .toPromise()
  }
}
