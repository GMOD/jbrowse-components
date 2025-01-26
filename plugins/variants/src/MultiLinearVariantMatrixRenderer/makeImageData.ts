import { set1 } from '@jbrowse/core/ui/colors'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../util'

import type { RenderArgsDeserializedWithFeaturesAndLayout } from './types'

const fudgeFactor = 0.6
const f2 = fudgeFactor / 2

function drawUnphased(
  alleles: string[],
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const total = alleles.length
  let alt = 0
  let uncalled = 0
  let alt2 = 0
  let ref = 0
  for (const allele of alleles) {
    if (allele === '1') {
      alt++
    } else if (allele === '0') {
      ref++
    } else if (allele === '.') {
      uncalled++
    } else {
      alt2++
    }
  }

  if (alt) {
    ctx.fillStyle = `hsl(200,50%,${80 - (alt / total) * 50}%)`
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
  if (ref === total) {
    ctx.fillStyle = `#ccc`
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
  if (alt2) {
    ctx.fillStyle = `hsla(0,50%,50%,${alt2 / total / 2})`
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
  if (uncalled) {
    ctx.fillStyle = `hsla(50,50%,50%,${uncalled / total / 2})`
    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
  }
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
  const c = +alleles[HP]!
  ctx.fillStyle = c ? set1[c - 1] || 'black' : '#ccc'
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
  const { phasedMode, minorAlleleFrequencyFilter, sources, features } =
    renderArgs
  const h = canvasHeight / sources.length
  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter(
    features.values(),
    minorAlleleFrequencyFilter,
  )

  const m = mafs.length
  const w = canvasWidth / m
  for (let i = 0; i < m; i++) {
    const f = mafs[i]!
    const samp = f.get('genotypes') as Record<string, string>
    const x = (i / mafs.length) * canvasWidth
    const s = sources.length
    for (let j = 0; j < s; j++) {
      const y = (j / s) * canvasHeight
      const { name, HP } = sources[j]!
      const genotype = samp[name]!
      const isPhased = genotype.includes('|')
      if (phasedMode === 'phasedOnly') {
        if (isPhased) {
          const alleles = genotype.split('|')
          drawPhased(alleles, ctx, x, y, w, h, HP!)
        } else {
          ctx.fillStyle = 'black'
          ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
        }
      } else {
        const alleles = genotype.split(/[/|]/)
        drawUnphased(alleles, ctx, x, y, w, h)
      }
    }
  }
  return {
    mafs,
  }
}
