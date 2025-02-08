import { featureSpanPx } from '@jbrowse/core/util'
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
  } = props
  const region = regions[0]!
  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter(
    features.values(),
    minorAlleleFrequencyFilter,
  )
  const rbush = new RBush()
  for (const { feature } of mafs) {
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
        rbush.insert({
          minX: x - f2,
          maxX: x + w + f2,
          minY: y - f2,
          maxY: y + h + f2,
          genotype,
        })
        const isPhased = genotype.includes('|')
        if (renderingMode === 'phased') {
          if (isPhased) {
            const alleles = genotype.split('|')
            drawPhased(alleles, ctx, x, y, w, h, HP!)
          } else {
            ctx.fillStyle = 'black'
            ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
          }
        } else {
          const alleles = genotype.split(/[/|]/)
          drawColorAlleleCount(alleles, ctx, x, y, w, h)
        }
      }
      y += rowHeight
    }
  }
  return {
    rbush: rbush.toJSON(),
  }
}
