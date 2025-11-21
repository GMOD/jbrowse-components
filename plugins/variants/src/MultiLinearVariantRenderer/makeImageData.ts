import {
  featureSpanPx,
  forEachWithStopTokenCheck,
  updateStatus,
} from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { f2 } from '../shared/constants'
import {
  drawColorAlleleCount,
  getColorAlleleCount,
} from '../shared/drawAlleleCount'
import { drawPhased } from '../shared/drawPhased'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { MultiRenderArgsDeserialized } from './types'

export async function makeImageData(
  ctx: CanvasRenderingContext2D,
  props: MultiRenderArgsDeserialized,
) {
  const {
    scrollTop,
    minorAlleleFrequencyFilter,
    sources,
    rowHeight,
    features,
    regions,
    bpPerPx,
    renderingMode,
    stopToken,
    lengthCutoffFilter,
    referenceDrawingMode,
  } = props
  const region = regions[0]!
  const { statusCallback = () => {} } = props
  checkStopToken(stopToken)

  const coords = [] as number[]
  const items = [] as any[]
  const colorCache = {} as Record<string, string | undefined>
  const splitCache = {} as Record<string, string[]>
  const genotypesCache = new Map<string, Record<string, string>>()
  const drawRef = referenceDrawingMode === 'draw'
  const h = Math.max(rowHeight, 1)

  const mafs = await updateStatus('Calculating stats', statusCallback, () =>
    getFeaturesThatPassMinorAlleleFrequencyFilter({
      stopToken,
      features: features.values(),
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
      genotypesCache,
    }),
  )
  checkStopToken(stopToken)

  await updateStatus('Drawing variants', statusCallback, () => {
    forEachWithStopTokenCheck(
      mafs,
      stopToken,
      ({ mostFrequentAlt, feature }) => {
        const start = feature.get('start')
        const end = feature.get('end')
        const bpLen = end - start
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        const featureId = feature.id()
        const w = Math.max(Math.round(rightPx - leftPx), 2)
        let samp = genotypesCache.get(featureId)
        if (!samp) {
          samp = feature.get('genotypes') as Record<string, string>
          genotypesCache.set(featureId, samp)
        }
        const featureType = feature.get('type')
        const featureStrand = feature.get('strand')
        const alpha = bpLen > 5 ? 0.75 : 1
        const x = Math.floor(leftPx)
        let y = -scrollTop

        const s = sources.length
        if (renderingMode === 'phased') {
          for (let j = 0; j < s; j++) {
            const { name, HP } = sources[j]!
            const genotype = samp[name]
            if (genotype) {
              const isPhased = genotype.includes('|')
              if (isPhased) {
                const alleles =
                  splitCache[genotype] ||
                  (splitCache[genotype] = genotype.split('|'))
                if (
                  drawPhased(alleles, ctx, x, y, w, h, HP!, undefined, drawRef)
                ) {
                  items.push({
                    name,
                    genotype,
                    featureId,
                    bpLen,
                  })
                  coords.push(x, y, x + w, y + h)
                }
              } else {
                ctx.fillStyle = 'black'
                ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
              }
            }
            y += rowHeight
          }
        } else {
          for (let j = 0; j < s; j++) {
            const { name } = sources[j]!
            const genotype = samp[name]
            if (genotype) {
              const cacheKey = genotype + ':' + mostFrequentAlt
              let c = colorCache[cacheKey]
              if (c === undefined) {
                let alt = 0
                let uncalled = 0
                let alt2 = 0
                let ref = 0
                const alleles =
                  splitCache[genotype] ||
                  (splitCache[genotype] = genotype.split(/[/|]/))
                const total = alleles.length

                for (let i = 0; i < total; i++) {
                  const allele = alleles[i]!
                  if (allele === mostFrequentAlt) {
                    alt++
                  } else if (allele === '0') {
                    ref++
                  } else if (allele === '.') {
                    uncalled++
                  } else {
                    alt2++
                  }
                }
                c = getColorAlleleCount(
                  ref,
                  alt,
                  alt2,
                  uncalled,
                  total,
                  drawRef,
                )
                colorCache[cacheKey] = c
              }
              if (c) {
                drawColorAlleleCount(
                  c,
                  ctx,
                  x,
                  y,
                  w,
                  h,
                  featureType,
                  featureStrand,
                  alpha,
                )

                items.push({
                  name,
                  genotype,
                  featureId,
                  bpLen,
                })
                coords.push(x, y, x + w, y + h)
              }
            }
            y += rowHeight
          }
        }
      },
    )
  })

  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (items.length) {
    for (let i = 0, l = coords.length; i < l; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2]!, coords[i + 3]!)
    }
  } else {
    flatbush.add(0, 0)
  }
  flatbush.finish()

  const featureGenotypeMap = {} as Record<
    string,
    {
      alt: unknown
      ref: unknown
      name: unknown
      description: unknown
      length: number
    }
  >
  for (const { feature } of mafs) {
    const id = feature.id()
    featureGenotypeMap[id] = {
      alt: feature.get('ALT'),
      ref: feature.get('REF'),
      name: feature.get('name'),
      description: feature.get('description'),
      length: feature.get('end') - feature.get('start'),
    }
  }

  return {
    flatbush: flatbush.data,
    items,
    featureGenotypeMap,
  }
}
