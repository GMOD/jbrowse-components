import RBush from 'rbush'
import {
  getColorAlleleCount,
  getColorPhased,
} from '../shared/multiVariantColor'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../util'

import type { RenderArgsDeserializedWithFeaturesAndLayout } from './types'

const fudgeFactor = 0.6
const f2 = fudgeFactor / 2

function drawColorAlleleCount(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = getColorAlleleCount(alleles)
  ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
}

function drawPhased(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  HP: number,
) {
  ctx.fillStyle = getColorPhased(alleles, HP)
  ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
}

export function makeImageData({
  ctx,
  canvasWidth,
  canvasHeight,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  canvasHeight: number
  renderArgs: RenderArgsDeserializedWithFeaturesAndLayout
}) {
  const {
    renderingMode: renderingMode,
    minorAlleleFrequencyFilter,
    sources,
    features,
  } = renderArgs
  const h = canvasHeight / sources.length
  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter(
    features.values(),
    minorAlleleFrequencyFilter,
  )

  const m = mafs.length
  const w = canvasWidth / m
  const rbush = new RBush()
  for (let i = 0; i < m; i++) {
    const f = mafs[i]!
    const samp = f.get('genotypes') as Record<string, string>

    const x = (i / mafs.length) * canvasWidth
    const s = sources.length
    for (let j = 0; j < s; j++) {
      const y = (j / s) * canvasHeight
      const { name, HP } = sources[j]!
      const genotype = samp[name]
      if (genotype) {
        rbush.insert({
          minX: x - f2,
          minY: y - f2,
          maxX: x - f2 + w + f2,
          maxY: y - f2 + h + f2,
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
    }
  }
  return {
    mafs,
    rbush,
  }
}
