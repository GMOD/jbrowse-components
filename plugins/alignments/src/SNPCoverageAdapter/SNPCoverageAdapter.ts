import {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import { Region } from '@jbrowse/core/util/types'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import SimpleFeature, { Feature } from '@jbrowse/core/util/simpleFeature'
import { toArray, filter } from 'rxjs/operators'
import { getSnapshot } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { getSubAdapterType } from '@jbrowse/core/data_adapters/dataAdapterCache'
import PluginManager from '@jbrowse/core/PluginManager'
import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { Mismatch, parseCigar } from '../BamAdapter/MismatchParser'

import NestedFrequencyTable from '../NestedFrequencyTable'

// get relative reference sequence positions for positions given relative to
// the read sequence
function* getNextRefPos(cigarOps: string[], positions: number[]) {
  let cigarIdx = 0
  let readPos = 0
  let refPos = 0

  for (let i = 0; i < positions.length; i++) {
    for (
      ;
      cigarIdx < cigarOps.length && readPos < positions[i];
      cigarIdx += 2
    ) {
      const len = +cigarOps[cigarIdx]
      const op = cigarOps[cigarIdx + 1]
      if (op === 'S' || op === 'I') {
        readPos += len
      } else if (op === 'D' || op === 'N') {
        refPos += len
      } else if (op === 'M' || op === 'X' || op === '=') {
        readPos += len
        refPos += len
      }
    }

    yield positions[i] - readPos + refPos
  }
}

// get tag from BAM or CRAM feature, where CRAM uses feature.get('tags') and
// BAM does not
function getTag(feature: Feature, tag: string) {
  const tags = feature.get('tags')
  return tags ? tags[tag] : feature.get(tag)
}

// use fallback alt tag, used in situations where upper case/lower case tags
// exist e.g. Mm/MM for base modifications
function getTagAlt(feature: Feature, tag: string, alt: string) {
  return getTag(feature, tag) || getTag(feature, alt)
}

function getModificationPositions(feature: Feature) {
  const mm = (getTagAlt(feature, 'MM', 'Mm') as string) || ''
  const mods = mm.split(';')
  const seq = feature.get('seq')

  return mods.map(mod => {
    const [basemod, ...rest] = mod.split(',')

    const [base, strand, ...type] = basemod.split('')
    if (strand === '-') {
      console.warn('unsupported negative strand modifications')
      return []
    }

    let i = 0
    return rest
      .map(score => +score)
      .map(delta => {
        do {
          if (base === 'N' || base === seq[i]) {
            delta--
          }
          i++
        } while (delta >= 0)
        return --i
      })
  })
}

export default (_: PluginManager) => {
  return class SNPCoverageAdapter extends BaseFeatureDataAdapter {
    private subadapter: BaseFeatureDataAdapter

    public constructor(
      config: AnyConfigurationModel,
      getSubAdapter?: getSubAdapterType,
    ) {
      super(config)

      const dataAdapter = getSubAdapter?.(getSnapshot(config.subadapter))
        .dataAdapter

      if (dataAdapter instanceof BaseFeatureDataAdapter) {
        this.subadapter = dataAdapter
      } else {
        throw new Error(`invalid subadapter type '${config.subadapter.type}'`)
      }
    }

    getFeatures(
      region: Region,
      opts: BaseOptions & { filters?: SerializableFilterChain } = {},
    ) {
      return ObservableCreate<Feature>(async observer => {
        let stream = this.subadapter.getFeatures(region, opts)

        if (opts.filters) {
          stream = stream.pipe(
            filter(feature => opts.filters?.passes(feature, opts) || true),
          )
        }
        const features = await stream.pipe(toArray()).toPromise()

        const bins = this.generateCoverageBins(features, region, opts)

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
    generateCoverageBins(
      features: Feature[],
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

      for (let i = 0; i < features.length; i++) {
        const feature = features[i]
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
          getModificationPositions(feature).forEach((positions, idx) => {
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
        }
      }

      return bins
    }
  }
}
