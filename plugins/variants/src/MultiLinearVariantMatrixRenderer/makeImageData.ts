import { updateStatus } from '@jbrowse/core/util'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { RenderArgsDeserializedWithFeaturesAndLayout } from './types'
import { drawColorAlleleCount } from '../shared/drawAlleleCount'
import { drawPhased } from '../shared/drawPhased'

const fudgeFactor = 0.6
const f2 = fudgeFactor / 2

type SampleGenotype = Record<string, string[]>

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
  const h = canvasHeight / sources.length
  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter(
    features.values(),
    minorAlleleFrequencyFilter,
  )
  const arr = [] as string[][]
  const m = mafs.length
  const w = canvasWidth / m

  updateStatus('Drawing variant matrix', statusCallback, () => {
    for (let i = 0; i < m; i++) {
      const arr2 = [] as string[]
      const { feature } = mafs[i]!
      const hasPhaseSet = (feature.get('format') as string).includes('PS')
      if (hasPhaseSet) {
        const samp = feature.get('samples') as Record<string, SampleGenotype>
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
        const samp = feature.get('genotypes') as Record<string, string>
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
  })
  return {
    mafs,
    arr,
  }
}
