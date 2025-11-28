import { forEachWithStopTokenCheck, updateStatus } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { f2 } from '../shared/constants'
import { getAlleleColor } from '../shared/drawAlleleCount'
import { drawPhasedBatched } from '../shared/drawPhased'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { RenderArgsDeserialized } from './types'

type SampleGenotype = Record<string, string[]>

interface SplitResult {
  alleles: string[]
  isPhased: boolean
}

function getSplitResult(
  genotype: string,
  cache: Record<string, SplitResult>,
): SplitResult {
  let result = cache[genotype]
  if (!result) {
    const alleles = genotype.split(/[/|]/)
    result = {
      alleles,
      isPhased: alleles.length > 1 && genotype.includes('|'),
    }
    cache[genotype] = result
  }
  return result
}

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
  } = renderArgs

  const { statusCallback = () => {} } = renderArgs
  const sln = sources.length
  const h = rowHeight
  const startRow = scrollTop > 0 ? Math.floor(scrollTop / h) : 0
  const endRow = Math.min(sln, Math.ceil((scrollTop + canvasHeight) / h))
  const numRows = endRow - startRow
  checkStopToken(stopToken)

  const sourceNames = new Array<string>(numRows)
  const sourceHPs = new Array<number>(numRows)
  for (let j = 0; j < numRows; j++) {
    const source = sources[startRow + j]!
    sourceNames[j] = source.name
    sourceHPs[j] = source.HP!
  }

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
  const w = canvasWidth / mafs.length
  const wAdj = w + f2
  const hAdj = h + f2
  const isPhasedMode = renderingMode === 'phased'
  const xF2 = -f2
  const yBase = startRow * h - scrollTop

  await updateStatus('Drawing variant matrix', statusCallback, () => {
    const colorCache = {} as Record<string, string | undefined>
    const splitCache = {} as Record<string, SplitResult>
    const splitCacheSimple = {} as Record<string, string[]>
    const colorBatches = {} as Record<string, Array<[number, number]>>

    forEachWithStopTokenCheck(
      mafs,
      stopToken,
      ({ feature, mostFrequentAlt }, idx) => {
        const arr2 = [] as string[]
        const x = idx * w
        const xAdj = x + xF2
        const hasPhaseSet = (
          feature.get('FORMAT') as string | undefined
        )?.includes('PS')

        if (hasPhaseSet) {
          const samp = feature.get('samples') as Record<string, SampleGenotype>
          for (let j = 0; j < numRows; j++) {
            const y = yBase + j * h
            const name = sourceNames[j]!
            const HP = sourceHPs[j]!
            const s = samp[name]
            if (s) {
              const genotype = s.GT?.[0]
              if (genotype) {
                arr2.push(genotype)
                if (isPhasedMode) {
                  const { alleles, isPhased } = getSplitResult(genotype, splitCache)
                  if (isPhased) {
                    const PS = s.PS?.[0]
                    drawPhasedBatched(alleles, colorBatches, x, y, HP, PS)
                  } else {
                    const batch = colorBatches['black'] || (colorBatches['black'] = [])
                    batch.push([xAdj, y - f2])
                  }
                } else {
                  const c = getAlleleColor(
                    genotype,
                    mostFrequentAlt,
                    colorCache,
                    splitCacheSimple,
                    true,
                  )
                  if (c) {
                    const batch = colorBatches[c] || (colorBatches[c] = [])
                    batch.push([xAdj, y - f2])
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
          for (let j = 0; j < numRows; j++) {
            const y = yBase + j * h
            const name = sourceNames[j]!
            const HP = sourceHPs[j]!
            const genotype = samp[name]
            if (genotype) {
              arr2.push(genotype)
              if (isPhasedMode) {
                const { alleles, isPhased } = getSplitResult(genotype, splitCache)
                if (isPhased) {
                  drawPhasedBatched(alleles, colorBatches, x, y, HP)
                } else {
                  const batch = colorBatches['black'] || (colorBatches['black'] = [])
                  batch.push([xAdj, y - f2])
                }
              } else {
                const c = getAlleleColor(
                  genotype,
                  mostFrequentAlt,
                  colorCache,
                  splitCacheSimple,
                  true,
                )
                if (c) {
                  const batch = colorBatches[c] || (colorBatches[c] = [])
                  batch.push([xAdj, y - f2])
                }
              }
            }
          }
        }
        arr.push(arr2)
      },
    )

    for (const [color, rects] of Object.entries(colorBatches)) {
      ctx.fillStyle = color
      for (const [rx, ry] of rects) {
        ctx.fillRect(rx, ry, wAdj, hAdj)
      }
    }
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
