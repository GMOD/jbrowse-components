import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { reduce, filter, toArray } from 'rxjs/operators'
import { Observable } from 'rxjs'
import { getTagAlt } from '../util'
import {
  parseCigar,
  getNextRefPos,
  getModificationPositions,
  Mismatch,
} from '../BamAdapter/MismatchParser'

interface SNPCoverageOptions extends BaseOptions {
  filters?: SerializableFilterChain
}

function mismatchLen(mismatch: Mismatch) {
  return !isInterbase(mismatch.type) ? mismatch.length : 1
}

function isInterbase(type: string) {
  return type === 'softclip' || type === 'hardclip' || type === 'insertion'
}

export default class SNPCoverageAdapter extends BaseFeatureDataAdapter {
  protected async configure() {
    const subadapterConfig = readConfObject(this.config, 'subadapter')
    const sequenceConf = readConfObject(this.config, [
      'subadapter',
      'sequenceAdapter',
    ])
    const dataAdapter = await this.getSubAdapter?.(subadapterConfig)

    const sequenceAdapter = sequenceConf
      ? await this.getSubAdapter?.(sequenceConf)
      : undefined

    if (!dataAdapter) {
      throw new Error('Failed to get subadapter')
    }

    return {
      subadapter: dataAdapter.dataAdapter as BaseFeatureDataAdapter,
      sequenceAdapter: sequenceAdapter?.dataAdapter as
        | BaseFeatureDataAdapter
        | undefined,
    }
  }

  getFeatures(region: Region, opts: SNPCoverageOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { subadapter } = await this.configure()
      let stream = subadapter.getFeatures(region, opts)

      if (opts.filters) {
        const { filters } = opts
        stream = stream.pipe(filter(f => filters.passes(f, opts)))
      }

      const bins = await this.generateCoverageBins(stream, region, opts)

      bins.forEach((bin, index) => {
        if (bin.total) {
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
        }
      })

      observer.complete()
    }, opts.signal)
  }

  async getRefNames(opts: BaseOptions = {}) {
    const { subadapter } = await this.configure()
    return subadapter.getRefNames(opts)
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
    const { sequenceAdapter } = await this.configure()
    const { refName, start, end } = region
    const binMax = Math.ceil(region.end - region.start)

    // bins contain cov feature if they contribute to coverage, or noncov which
    // are interbase or other features that don't contribute to coverage.
    // delskips are elements that don't contribute to coverage, but should be
    // reported also (and are not interbase)
    const initBins = Array.from({ length: binMax }, () => ({
      total: 0,
      ref: 0,
      cov: {} as { [key: string]: number },
      delskips: {} as { [key: string]: number },
      noncov: {} as { [key: string]: number },
    }))

    // request an extra +1 on the end to get CpG crossing region boundary
    let regionSeq: string | undefined

    if (sequenceAdapter) {
      const [feat] = await sequenceAdapter
        .getFeatures({ refName, start, end: end + 1, assemblyName: 'na' })
        .pipe(toArray())
        .toPromise()
      regionSeq = feat?.get('seq')
    }

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
          }

          // methylation based coloring takes into account both reference sequence CpG detection and reads
          else if (colorBy?.type === 'methylation') {
            if (!regionSeq) {
              throw new Error(
                'no region sequence detected, need sequenceAdapter configuration',
              )
            }
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

          // normal SNP based coloring
          else {
            const mismatches = feature.get('mismatches')
            for (let i = 0; i < mismatches?.length; i++) {
              const mismatch = mismatches[i] as Mismatch
              const mstart = fstart + mismatch.start
              for (let j = mstart; j < mstart + mismatchLen(mismatch); j++) {
                const epos = j - region.start
                if (epos >= 0 && epos < bins.length) {
                  const bin = bins[epos]
                  const { base, type } = mismatch
                  const interbase = isInterbase(type)
                  if (!interbase) {
                    bin.ref--
                  } else {
                    if (!bin.noncov[type]) {
                      bin.noncov[type] = 0
                    }
                    bin.noncov[type]++
                  }

                  if (type === 'deletion' || type === 'skip') {
                    if (!bin.delskips[type]) {
                      bin.delskips[type] = 0
                    }
                    bin.delskips[type]++
                    bin.total--
                  } else if (!interbase) {
                    if (!bin.cov[base]) {
                      bin.cov[base] = 0
                    }
                    bin.cov[base]++
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

const { capabilities } = SNPCoverageAdapter
export { capabilities }
