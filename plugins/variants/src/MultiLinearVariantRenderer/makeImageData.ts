import { featureSpanPx } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import RBush from 'rbush'

import { f2 } from '../shared/constants'
import { drawColorAlleleCount } from '../shared/drawAlleleCount'
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
  } = props
  const region = regions[0]!

  checkStopToken(stopToken)
  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    features: features.values(),
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
  })
  checkStopToken(stopToken)
  const rbush = new RBush()
  let start = performance.now()

  for (const { mostFrequentAlt, feature } of mafs) {
    if (performance.now() - start > 400) {
      checkStopToken(stopToken)
      start = performance.now()
    }
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const w = Math.max(Math.round(rightPx - leftPx), 2)
    const samp = feature.get('genotypes') as Record<string, string>
    let y = -scrollTop

    const s = sources.length
    for (let j = 0; j < s; j++) {
      const { name, HP } = sources[j]!
      const genotype = samp[name]
      const x = Math.floor(leftPx)
      const h = Math.max(rowHeight, 1)
      if (genotype) {
        const isPhased = genotype.includes('|')
        if (renderingMode === 'phased') {
          if (isPhased) {
            const alleles = genotype.split('|')
            if (drawPhased(alleles, ctx, x, y, w, h, HP!, undefined, false)) {
              rbush.insert({
                minX: x,
                maxX: x + w,
                minY: y,
                maxY: y + h,
                genotype,
                name,
                feature: feature.get('name'),
                type: feature.get('description'),
              })
            }
          } else {
            ctx.fillStyle = 'black'
            ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
          }
        } else {
          const alleles = genotype.split(/[/|]/)
          if (
            drawColorAlleleCount(
              alleles,
              ctx,
              x,
              y,
              w,
              h,
              mostFrequentAlt,
              false,
              feature.get('type'),
              feature.get('strand'),
              0.75,
            )
          ) {
            rbush.insert({
              minX: x,
              maxX: x + w,
              minY: y,
              maxY: y + h,
              genotype,
              name,
              feature: feature.get('name'),
              type: feature.get('description'),
            })
          }
        }
      }
      y += rowHeight
    }
  }
  return {
    rbush: rbush.toJSON(),
  }
}
