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
  const mafs = await updateStatus('Calculating stats', statusCallback, () =>
    getFeaturesThatPassMinorAlleleFrequencyFilter({
      stopToken,
      features: features.values(),
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
    }),
  )
  checkStopToken(stopToken)

  const coords = [] as number[]
  const items = [] as any[]
  await updateStatus('Drawing variants', statusCallback, () => {
    forEachWithStopTokenCheck(
      mafs,
      stopToken,
      ({ mostFrequentAlt, feature }) => {
        const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
        const featureId = feature.id()
        const bpLen = feature.get('end') - feature.get('start')
        const w = Math.max(Math.round(rightPx - leftPx), 2)
        const samp = feature.get('genotypes') as Record<string, string>
        let y = -scrollTop

        const s = sources.length
        if (renderingMode === 'phased') {
          for (let j = 0; j < s; j++) {
            const { name, HP } = sources[j]!
            const genotype = samp[name]
            const x = Math.floor(leftPx)
            const h = Math.max(rowHeight, 1)
            if (genotype) {
              const isPhased = genotype.includes('|')
              if (isPhased) {
                const alleles = genotype.split('|')
                if (
                  drawPhased(
                    alleles,
                    ctx,
                    x,
                    y,
                    w,
                    h,
                    HP!,
                    undefined,
                    referenceDrawingMode === 'draw',
                  )
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
          const colorCache = {} as Record<string, string | undefined>
          for (let j = 0; j < s; j++) {
            const { name } = sources[j]!
            const genotype = samp[name]
            const x = Math.floor(leftPx)
            const h = Math.max(rowHeight, 1)
            if (genotype) {
              let c = colorCache[genotype]
              if (c === undefined) {
                let alt = 0
                let uncalled = 0
                let alt2 = 0
                let ref = 0
                const alleles = genotype.split(/[/|]/)
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
                  referenceDrawingMode === 'draw',
                )
                colorCache[genotype] = c
              }
              if (c) {
                drawColorAlleleCount(
                  c,
                  ctx,
                  x,
                  y,
                  w,
                  h,
                  feature.get('type'),
                  feature.get('strand'),
                  bpLen > 5 ? 0.75 : 1,
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
    for (let i = 0; i < coords.length; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    // flatbush does not like 0 items
    flatbush.add(0, 0)
  }
  flatbush.finish()
  return {
    flatbush: flatbush.data,
    items,
    featureGenotypeMap: Object.fromEntries(
      mafs.map(({ feature }) => [
        feature.id(),
        {
          alt: feature.get('ALT'),
          ref: feature.get('REF'),
          name: feature.get('name'),
          description: feature.get('description'),
          length: feature.get('end') - feature.get('start'),
        },
      ]),
    ),
  }
}
