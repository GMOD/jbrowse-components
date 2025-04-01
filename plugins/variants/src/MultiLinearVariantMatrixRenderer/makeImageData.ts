import { updateStatus } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { f2 } from '../shared/constants'
import { drawColorAlleleCount } from '../shared/drawAlleleCount'
import { drawPhased } from '../shared/drawPhased'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { RenderArgsDeserialized } from './types'

type SampleGenotype = Record<string, string[]>

export async function makeImageData({
  ctx,
  canvasWidth,
  canvasHeight,
  renderArgs,
}: {
  ctx: CanvasRenderingContext2D
  canvasWidth: number
  canvasHeight: number
  renderArgs: RenderArgsDeserialized
}) {
  const {
    renderingMode,
    minorAlleleFrequencyFilter,
    sources,
    features,
    stopToken,
    lengthCutoffFilter,
  } = renderArgs

  const { statusCallback = () => {} } = renderArgs
  const h = canvasHeight / sources.length
  checkStopToken(stopToken)
  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    features: features.values(),
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
  })
  checkStopToken(stopToken)
  const arr = [] as string[][]
  const m = mafs.length
  const w = canvasWidth / m

  await updateStatus('Drawing variant matrix', statusCallback, () => {
    let start = performance.now()
    for (let i = 0; i < m; i++) {
      if (performance.now() - start > 400) {
        checkStopToken(stopToken)
        start = performance.now()
      }
      const arr2 = [] as string[]
      const { feature, mostFrequentAlt } = mafs[i]!
      const hasPhaseSet = (
        feature.get('FORMAT') as string | undefined
      )?.includes('PS')
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
                drawColorAlleleCount(alleles, ctx, x, y, w, h, mostFrequentAlt)
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
              drawColorAlleleCount(alleles, ctx, x, y, w, h, mostFrequentAlt)
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
