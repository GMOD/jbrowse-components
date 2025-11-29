import { forEachWithStopTokenCheck, updateStatus } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { f2 } from '../shared/constants'
import { drawColorAlleleCount, getAlleleColor } from '../shared/drawAlleleCount'
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
    rowHeight,
    scrollTop,
    statusCallback = () => {},
  } = renderArgs
  const sln = sources.length
  const h = rowHeight
  const startRow = scrollTop > 0 ? Math.floor(scrollTop / h) : 0
  const endRow = Math.min(sln, Math.ceil((scrollTop + canvasHeight) / h))
  checkStopToken(stopToken)

  const genotypesCache = new Map<string, Record<string, string>>()
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
  const arr = [] as string[][]
  const m = mafs.length
  const w = canvasWidth / m

  await updateStatus('Drawing variant matrix', statusCallback, () => {
    const colorCache = {} as Record<string, string | undefined>
    const splitCache = {} as Record<string, string[]>
    forEachWithStopTokenCheck(
      mafs,
      stopToken,
      ({ feature, mostFrequentAlt }, idx) => {
        const arr2 = [] as string[]
        const hasPhaseSet = (
          feature.get('FORMAT') as string | undefined
        )?.includes('PS')
        const x = (idx / m) * canvasWidth
        if (hasPhaseSet) {
          const samp = feature.get('samples') as Record<string, SampleGenotype>
          for (let j = startRow; j < endRow; j++) {
            const y = j * h - scrollTop
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
                    const alleles = (splitCache[genotype] ||= genotype.split('|'))
                    drawPhased(alleles, ctx, x, y, w, h, HP!, PS)
                  } else {
                    ctx.fillStyle = 'black'
                    ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
                  }
                } else {
                  const c = getAlleleColor(
                    genotype,
                    mostFrequentAlt,
                    colorCache,
                    splitCache,
                    true,
                  )
                  if (c) {
                    drawColorAlleleCount(c, ctx, x, y, w, h)
                  }
                }
              }
            }
          }
        } else {
          const featureId = feature.id()
          let samp = genotypesCache.get(featureId)
          if (!samp) {
            samp = feature.get('genotypes') as Record<string, string>
            genotypesCache.set(featureId, samp)
          }
          for (let j = startRow; j < endRow; j++) {
            const y = j * h - scrollTop
            const { name, HP } = sources[j]!
            const genotype = samp[name]
            if (genotype) {
              arr2.push(genotype)
              const isPhased = genotype.includes('|')
              if (renderingMode === 'phased') {
                if (isPhased) {
                  const alleles = (splitCache[genotype] ||= genotype.split('|'))
                  drawPhased(alleles, ctx, x, y, w, h, HP!)
                } else {
                  ctx.fillStyle = 'black'
                  ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
                }
              } else {
                const c = getAlleleColor(
                  genotype,
                  mostFrequentAlt,
                  colorCache,
                  splitCache,
                  true,
                )
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
  const featureData = mafs.map(({ feature }) => ({
    alt: feature.get('ALT') as string[],
    ref: feature.get('REF') as string,
    name: feature.get('name') as string,
    description: feature.get('description') as string,
    length: feature.get('end') - feature.get('start'),
  }))

  return {
    mafs,
    arr,
    featureData,
  }
}
