import { forEachWithStopTokenCheck, updateStatus } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { f2 } from '../shared/constants'
import {
  drawColorAlleleCount,
  getColorAlleleCount,
} from '../shared/drawAlleleCount'
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
  const mafs = await updateStatus('Calculating stats', statusCallback, () =>
    getFeaturesThatPassMinorAlleleFrequencyFilter({
      stopToken,
      features: features.values(),
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
    }),
  )
  checkStopToken(stopToken)
  const arr = [] as string[][]
  const m = mafs.length
  const w = canvasWidth / m

  await updateStatus('Drawing variant matrix', statusCallback, () => {
    const colorCache = {} as Record<string, string | undefined>
    forEachWithStopTokenCheck(
      mafs,
      stopToken,
      ({ feature, mostFrequentAlt }, idx) => {
        const arr2 = [] as string[]
        const hasPhaseSet = (
          feature.get('FORMAT') as string | undefined
        )?.includes('PS')
        if (hasPhaseSet) {
          const samp = feature.get('samples') as Record<string, SampleGenotype>
          const x = (idx / mafs.length) * canvasWidth
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
                      true,
                    )
                    colorCache[genotype] = c
                  }
                  if (c) {
                    drawColorAlleleCount(c, ctx, x, y, w, h)
                  }
                }
              }
            }
          }
        } else {
          const samp = feature.get('genotypes') as Record<string, string>
          const x = (idx / mafs.length) * canvasWidth
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
                  c = getColorAlleleCount(ref, alt, alt2, uncalled, total, true)
                  colorCache[genotype] = c
                }
                if (c) {
                  drawColorAlleleCount(c, ctx, x, y, w, h)
                }
              }
            }
          }
        }
        arr.push(arr2)
      },
    )
  })
  return {
    mafs,
    arr,
  }
}
