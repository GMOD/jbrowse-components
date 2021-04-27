import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { getSnapshot } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { reduce, filter, toArray } from 'rxjs/operators'
import { Observable } from 'rxjs'
import { getTagAlt } from '../util'
import {
  parseCigar,
  getNextRefPos,
  getModificationPositions,
} from '../BamAdapter/MismatchParser'

interface SNPCoverageOptions extends BaseOptions {
  filters?: SerializableFilterChain
}

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

  getFeatures(region: Region, opts: SNPCoverageOptions) {
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
    const binMax = Math.ceil(region.end - region.start)

    const initBins = Array.from({ length: binMax }, () => ({
      total: 0,
      ref: 0,
      cov: {},
      noncov: {},
    }))
    const { refName, start, end } = region

    // request an extra +1 on the end to get CpG crossing region boundary
    const [feat] = await this.sequenceAdapter
      .getFeatures({ refName, start, end: end + 1 })
      .pipe(toArray())
      .toPromise()
    const regionSeq = feat?.get('seq')

    const ii = 0

    return features
      .pipe(
        reduce((bins, feature) => {
          const cigar = feature.get('CIGAR')
          const fstart = feature.get('start')
          const fend = feature.get('end')
          const cigarOps = parseCigar(cigar)

          for (let j = fstart; j < fend; j++) {
            const i = j - region.start
            if (i >= 0 && i < bins.length) {
              const bin = bins[i]
              bin.total++
              bin.ref++
            }
          }

          if (colorBy?.type === 'modifications') {
            const seq = feature.get('seq')
            const mm = getTagAlt(feature, 'MM', 'Mm') || ''

            getModificationPositions(mm, seq).forEach(({ type, positions }) => {
              const mod = `mod_${type}`
              for (const pos of getNextRefPos(cigarOps, positions)) {
                const epos = pos + fstart - region.start
                if (epos >= 0 && epos < bins.length) {
                  const bin = bins[epos]
                  bin.ref--
                  if (!bin.cov[mod]) {
                    bin.cov[mod] = 0
                  }
                  bin.cov[mod]++
                }
              }
            })
          } else if (colorBy?.type === 'methylation') {
            const seq = feature.get('seq')
            const mm = getTagAlt(feature, 'MM', 'Mm') || ''
            const methBins = new Array(region.end - region.start).fill(0)

            getModificationPositions(mm, seq).forEach(({ type, positions }) => {
              // we are processing methylation
              if (type === 'm') {
                for (const pos of getNextRefPos(cigarOps, positions)) {
                  const epos = pos + fstart - region.start
                  if (epos >= 0 && epos < methBins.length) {
                    methBins[epos] = 1
                  }
                }
              }
            })

            for (let j = fstart; j < fend; j++) {
              const i = j - region.start
              if (i >= 0 && i < bins.length) {
                const l2 = regionSeq[i + 1]
                const l1 = regionSeq[i]
                const bin = bins[i]
                // color
                if (l1.toUpperCase() === 'C' && l2.toUpperCase() === 'G') {
                  if (methBins[i]) {
                    bin.ref--

                    if (!bin.cov.meth) {
                      bin.cov.meth = 0
                    }
                    bin.cov.meth++
                  } else {
                    bin.ref--

                    if (!bin.cov.unmeth) {
                      bin.cov.unmeth = 0
                    }
                    bin.cov.unmeth++
                  }
                }
              }
            }
          }

          return bins
        }, initBins),
      )
      .toPromise()
  }
}
