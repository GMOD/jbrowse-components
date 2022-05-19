import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { AugmentedRegion as Region } from '@jbrowse/core/util/types'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { toArray } from 'rxjs/operators'
import {
  getTag,
  getTagAlt,
  fetchSequence,
  shouldFetchReferenceSequence,
} from '../util'
import {
  parseCigar,
  getNextRefPos,
  getModificationPositions,
  Mismatch,
} from '../BamAdapter/MismatchParser'

function mismatchLen(mismatch: Mismatch) {
  return !isInterbase(mismatch.type) ? mismatch.length : 1
}

function isInterbase(type: string) {
  return type === 'softclip' || type === 'hardclip' || type === 'insertion'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inc(bin: any, strand: number, type: string, field: string) {
  let thisBin = bin[type][field]
  if (thisBin === undefined) {
    thisBin = bin[type][field] = {
      total: 0,
      '-1': 0,
      '0': 0,
      '1': 0,
    }
  }
  thisBin.total++
  thisBin[strand]++
}

export default class SNPCoverageAdapter extends BaseFeatureDataAdapter {
  protected async configure() {
    const subadapterConfig = this.getConf('subadapter')
    const sequenceConf = this.getConf(['subadapter', 'sequenceAdapter'])
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

  async fetchSequence(region: Region) {
    const { sequenceAdapter } = await this.configure()
    if (!sequenceAdapter) {
      return undefined
    }

    return fetchSequence(region, sequenceAdapter)
  }

  getFeatures(region: Region, opts: BaseOptions = {}) {
    return ObservableCreate<Feature>(async observer => {
      const { subadapter } = await this.configure()
      const feats = await subadapter
        .getFeatures(region, opts)
        .pipe(toArray())
        .toPromise()

      const { bins, skipmap } = await this.generateCoverageBins(
        feats,
        region,
        opts,
      )

      bins.forEach((bin, index) => {
        observer.next(
          new SimpleFeature({
            id: `${this.id}-${region.start + index}`,
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

  async generateCoverageBins(
    features: Feature[],
    region: Region,
    opts: { bpPerPx?: number; colorBy?: { type: string; tag?: string } },
  ) {
    const { colorBy } = opts
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

    // bins contain:
    // - cov feature if they contribute to coverage
    // - noncov are insertions/clip features that don't contribute to coverage
    // - delskips deletions or introns that don't contribute to coverage
    type BinType = { total: number; strands: { [key: string]: number } }

    const regionSeq =
      features.length && shouldFetchReferenceSequence(opts.colorBy?.type)
        ? await this.fetchSequence(region)
        : undefined

    const bins = [] as {
      total: number
      ref: number
      '-1': 0
      '0': 0
      '1': 0
      lowqual: BinType
      cov: BinType
      delskips: BinType
      noncov: BinType
    }[]

    for (let i = 0; i < features.length; i++) {
      const feature = features[i]
      const fstart = feature.get('start')
      const fend = feature.get('end')
      const fstrand = feature.get('strand') as -1 | 0 | 1

      for (let j = fstart; j < fend + 1; j++) {
        const i = j - region.start
        if (i >= 0 && i < binMax) {
          if (bins[i] === undefined) {
            bins[i] = {
              total: 0,
              ref: 0,
              '-1': 0,
              '0': 0,
              '1': 0,
              lowqual: {} as BinType,
              cov: {} as BinType,
              delskips: {} as BinType,
              noncov: {} as BinType,
            }
          }
          if (j !== fend) {
            bins[i].total++
            bins[i].ref++
            bins[i][fstrand]++
          }
        }
      }

      if (colorBy?.type === 'modifications') {
        const seq = feature.get('seq') as string
        const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
        const ops = parseCigar(feature.get('CIGAR'))
        const fend = feature.get('end')

        getModificationPositions(mm, seq, fstrand).forEach(
          ({ type, positions }) => {
            const mod = `mod_${type}`
            for (const pos of getNextRefPos(ops, positions)) {
              if (pos < 0 || pos > fend) {
                continue
              }
              const epos = pos + fstart - region.start
              if (epos >= 0 && epos < bins.length && pos + fstart < fend) {
                const bin = bins[epos]
                if (bin) {
                  inc(bin, fstrand, 'cov', mod)
                } else {
                  console.warn(
                    'Undefined position in modifications snpcoverage encountered',
                  )
                }
              }
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
        const ops = parseCigar(feature.get('CIGAR'))

        getModificationPositions(mm, seq, fstrand).forEach(
          ({ type, positions }) => {
            // we are processing methylation
            if (type === 'm') {
              for (const pos of getNextRefPos(ops, positions)) {
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
                bins[i].ref--
                bins[i][fstrand]--
                bins[i + 1].ref--
                bins[i + 1][fstrand]--
              } else {
                inc(bin, fstrand, 'cov', 'unmeth')
                inc(bin1, fstrand, 'cov', 'unmeth')
                bins[i].ref--
                bins[i][fstrand]--
                bins[i + 1].ref--
                bins[i + 1][fstrand]--
              }
            }
          }
        }
      }

      // normal SNP based coloring
      else {
        const mismatches = feature.get('mismatches') as Mismatch[] | undefined

        if (mismatches) {
          for (let i = 0; i < mismatches.length; i++) {
            const mismatch = mismatches[i]
            const mstart = fstart + mismatch.start
            for (let j = mstart; j < mstart + mismatchLen(mismatch); j++) {
              const epos = j - region.start
              if (epos >= 0 && epos < bins.length) {
                const bin = bins[epos]
                const { base, type } = mismatch
                const interbase = isInterbase(type)
                if (!interbase) {
                  bin.ref--
                  bin[fstrand]--
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
    }

    return { bins, skipmap }
  }
}

const { capabilities } = SNPCoverageAdapter
export { capabilities }
