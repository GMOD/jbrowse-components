import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { readConfObject } from '@jbrowse/core/configuration'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { reduce, filter, toArray } from 'rxjs/operators'
import { Observable } from 'rxjs'
import { getTag, getTagAlt } from '../util'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inc(bin: any, strand: number, type: string, field: string) {
  bin[type][field] = bin[type][field] || { total: 0, '-1': 0, '0': 0, '1': 0 }
  bin[type][field].total++
  bin[type][field][strand]++
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dec(bin: any, strand: number, type: string, field: string) {
  bin[type][field] = bin[type][field] || { total: 0, '-1': 0, '0': 0, '1': 0 }
  bin[type][field].total--
  bin[type][field][strand]--
}

export default class SNPCoverageAdapter extends BaseFeatureDataAdapter {
  protected async configure() {
    const subadapterConf = this.getConf('subadapter')
    const seqConf = this.getConf(['subadapter', 'sequenceAdapter'])
    const dataAdapter = await this.getSubAdapter?.(subadapterConf)

    const seqAdapter = seqConf ? await this.getSubAdapter?.(seqConf) : undefined

    if (!dataAdapter) {
      throw new Error('Failed to get subadapter')
    }

    return {
      subadapter: dataAdapter.dataAdapter as BaseFeatureDataAdapter,
      sequenceAdapter: seqAdapter?.dataAdapter as
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

      const { bins, skipmap } = await this.generateCoverageBins(
        stream,
        region,
        opts,
      )

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

      // make fake features from the coverage
      Object.entries(skipmap).forEach(([key, skip]) => {
        observer.next(
          new SimpleFeature({
            id: key,
            data: {
              type: 'skip',
              start: skip.start,
              end: skip.end,
              strand: skip.strand,
              score: skip.score,
              xs: skip.xs,
            },
          }),
        )
      })

      observer.complete()
    }, opts.signal)
  }

  async estimateRegionsStats(regions: Region[], opts?: BaseOptions) {
    const { subadapter } = await this.configure()
    return subadapter.estimateRegionsStats(regions, opts)
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
    const { originalRefName, refName, start, end } = region
    const binMax = Math.ceil(region.end - region.start)

    const skipmap = {} as {
      [key: string]: {
        score: number
        feature: unknown
        start: number
        end: number
        strand: number
        xs: string
      }
    }

    // bins contain cov feature if they contribute to coverage, or noncov which
    // are interbase or other features that don't contribute to coverage.
    // delskips are elements that don't contribute to coverage, but should be
    // reported also (and are not interbase)
    type BinType = { total: number; strands: { [key: string]: number } }

    // request an extra +1 on the end to get CpG crossing region boundary
    let regionSeq: string | undefined

    if (sequenceAdapter) {
      const [feat] = await sequenceAdapter
        .getFeatures({
          refName: originalRefName || refName,
          start,
          end: end + 1,
          assemblyName: region.assemblyName,
        })
        .pipe(toArray())
        .toPromise()
      regionSeq = feat?.get('seq')
    }

    const bins = await features
      .pipe(
        reduce(
          (bins, feature) => {
            const cigar = feature.get('CIGAR')
            const fstart = feature.get('start')
            const fend = feature.get('end')
            const fstrand = feature.get('strand')
            const cigarOps = parseCigar(cigar)

            for (let j = fstart; j < fend + 1; j++) {
              const i = j - region.start
              if (i >= 0 && i < binMax) {
                const bin = bins[i] || {
                  total: 0,
                  lowqual: {} as BinType,
                  cov: {} as BinType,
                  delskips: {} as BinType,
                  noncov: {} as BinType,
                  ref: {} as BinType,
                }
                if (j !== fend) {
                  bin.total++
                  inc(bin, fstrand, 'ref', 'ref')
                }
                bins[i] = bin
              }
            }

            if (colorBy?.type === 'modifications') {
              const seq = feature.get('seq')
              const mm = getTagAlt(feature, 'MM', 'Mm') || ''

              const ml =
                (getTagAlt(feature, 'ML', 'Ml') as number[] | string) || []

              const probabilities = ml
                ? (typeof ml === 'string'
                    ? ml.split(',').map(e => +e)
                    : ml
                  ).map(e => e / 255)
                : (getTagAlt(feature, 'MP', 'Mp') as string)
                    .split('')
                    .map(s => s.charCodeAt(0) - 33)
                    .map(elt => Math.min(1, elt / 50))

              let probIndex = 0
              getModificationPositions(mm, seq, fstrand).forEach(
                ({ type, positions }) => {
                  const mod = `mod_${type}`
                  for (const pos of getNextRefPos(cigarOps, positions)) {
                    const epos = pos + fstart - region.start
                    if (
                      epos >= 0 &&
                      epos < bins.length &&
                      pos + fstart < fend
                    ) {
                      const bin = bins[epos] || {
                        total: 0,
                        lowqual: {} as BinType,
                        cov: {} as BinType,
                        delskips: {} as BinType,
                        noncov: {} as BinType,
                        ref: {} as BinType,
                      }

                      if (probabilities[probIndex] > 0.5) {
                        inc(bin, fstrand, 'cov', mod)
                      } else {
                        inc(bin, fstrand, 'lowqual', mod)
                      }
                    }
                    probIndex++
                  }
                },
              )
            }

            // methylation based coloring takes into account both reference
            // sequence CpG detection and reads
            else if (colorBy?.type === 'methylation') {
              if (!regionSeq) {
                throw new Error(
                  'no region sequence detected, need sequenceAdapter configuration',
                )
              }
              const seq = feature.get('seq')
              const mm = getTagAlt(feature, 'MM', 'Mm') || ''
              const methBins = new Array(region.end - region.start).fill(0)

              getModificationPositions(mm, seq, fstrand).forEach(
                ({ type, positions }) => {
                  // we are processing methylation
                  if (type === 'm') {
                    for (const pos of getNextRefPos(cigarOps, positions)) {
                      const epos = pos + fstart - region.start
                      if (epos >= 0 && epos < methBins.length) {
                        methBins[epos] = 1
                      }
                    }
                  }
                },
              )

              for (let j = fstart; j < fend; j++) {
                const i = j - region.start
                if (i >= 0 && i < bins.length - 1) {
                  const l1 = regionSeq[i].toLowerCase()
                  const l2 = regionSeq[i + 1].toLowerCase()
                  const bin = bins[i]
                  const bin1 = bins[i + 1]

                  // color
                  if (l1 === 'c' && l2 === 'g') {
                    if (methBins[i] || methBins[i + 1]) {
                      inc(bin, fstrand, 'cov', 'meth')
                      inc(bin1, fstrand, 'cov', 'meth')
                      dec(bin, fstrand, 'ref', 'ref')
                      dec(bin1, fstrand, 'ref', 'ref')
                    } else {
                      inc(bin, fstrand, 'cov', 'unmeth')
                      inc(bin1, fstrand, 'cov', 'unmeth')
                      dec(bin, fstrand, 'ref', 'ref')
                      dec(bin1, fstrand, 'ref', 'ref')
                    }
                  }
                }
              }
            }

            // normal SNP based coloring
            else {
              const mismatches = feature.get('mismatches') as
                | Mismatch[]
                | undefined

              if (mismatches) {
                for (let i = 0; i < mismatches.length; i++) {
                  const mismatch = mismatches[i]
                  const ms = fstart + mismatch.start
                  for (let j = ms; j < ms + mismatchLen(mismatch); j++) {
                    const epos = j - region.start
                    if (epos >= 0 && epos < bins.length) {
                      const bin = bins[epos]
                      const { base, type } = mismatch
                      const interbase = isInterbase(type)
                      if (!interbase) {
                        dec(bin, fstrand, 'ref', 'ref')
                      } else {
                        inc(bin, fstrand, 'noncov', type)
                      }

                      if (type === 'deletion' || type === 'skip') {
                        inc(bin, fstrand, 'delskips', type)
                        bin.total--
                      } else if (!interbase) {
                        inc(bin, fstrand, 'cov', base)
                      }
                    }
                  }
                }

                mismatches
                  .filter(mismatch => mismatch.type === 'skip')
                  .forEach(mismatch => {
                    const mstart = feature.get('start') + mismatch.start
                    const start = mstart
                    const end = mstart + mismatch.length
                    const strand = feature.get('strand')
                    const hash = `${start}_${end}_${strand}`
                    if (!skipmap[hash]) {
                      skipmap[hash] = {
                        feature: feature,
                        start,
                        end,
                        strand,
                        xs: getTag(feature, 'XS') || getTag(feature, 'TS'),
                        score: 1,
                      }
                    } else {
                      skipmap[hash].score++
                    }
                  })
              }
            }

            return bins
          },
          [] as {
            total: number
            lowqual: BinType
            cov: BinType
            delskips: BinType
            noncov: BinType
            ref: BinType
          }[],
        ),
      )
      .toPromise()

    return { bins, skipmap }
  }
}

const { capabilities } = SNPCoverageAdapter
export { capabilities }
