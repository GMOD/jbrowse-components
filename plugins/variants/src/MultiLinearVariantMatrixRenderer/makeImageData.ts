import {
  getColorAlleleCount,
  getColorPhased,
  getColorPhasedWithPhaseSet,
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
  PS?: string,
) {
  ctx.fillStyle =
    PS !== undefined
      ? getColorPhasedWithPhaseSet(alleles, HP, PS)
      : getColorPhased(alleles, HP)
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

  const { statusCallback = () => {} } = renderArgs
  statusCallback('Drawing variant matrix')
  const h = canvasHeight / sources.length
  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter(
    features.values(),
    minorAlleleFrequencyFilter,
  )

  const arr = [] as string[][]
  const m = mafs.length
  const w = canvasWidth / m
  for (let i = 0; i < m; i++) {
    const arr2 = [] as string[]
    const f = mafs[i]!
    const hasPhaseSet = (f.get('format') as string).includes('PS')
    if (hasPhaseSet) {
      const samp = f.get('samples') as Record<string, Record<string, string[]>>
      const x = (i / mafs.length) * canvasWidth
      const sln = sources.length
      for (let j = 0; j < sln; j++) {
        const y = (j / sln) * canvasHeight
        const { name, HP } = sources[j]!
        const s = samp[name]
        if (s) {
          const genotype = s.GT?.[0]
          if (genotype) {
            arr2.push(genotype)
            const isPhased = genotype.includes('|')
            if (renderingMode === 'phased') {
              if (isPhased) {
                const PS = s.PS?.[0]
                const alleles = genotype.split('|')
                drawPhased(alleles, ctx, x, y, w, h, HP!, PS)
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
    } else {
      const samp = f.get('genotypes') as Record<string, string>
      const x = (i / mafs.length) * canvasWidth
      const sln = sources.length
      for (let j = 0; j < sln; j++) {
        const y = (j / sln) * canvasHeight
        const { name, HP } = sources[j]!
        const genotype = samp[name]
        if (genotype) {
          arr2.push(genotype)
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
    arr.push(arr2)
  }
  return {
    mafs,
    arr,
  }
}
