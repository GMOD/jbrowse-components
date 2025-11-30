import { forEachWithStopTokenCheck, updateStatus } from '@jbrowse/core/util'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { f2 } from '../shared/constants'
import { drawColorAlleleCount, getAlleleColor } from '../shared/drawAlleleCount'
import { drawPhased } from '../shared/drawPhased'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { RenderArgsDeserialized } from './types'
import type { Source } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

type SampleGenotype = Record<string, string[]>

interface MafEntry {
  feature: Feature
  mostFrequentAlt: string
}

interface DrawParams {
  mafs: MafEntry[]
  sources: Source[]
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  scrollTop: number
  startRow: number
  endRow: number
  genotypesCache: Map<string, Record<string, string>>
  stopToken?: string
}

function drawPhasedMode({
  mafs,
  sources,
  ctx,
  w,
  h,
  scrollTop,
  startRow,
  endRow,
  genotypesCache,
  stopToken,
}: DrawParams) {
  const mafsLen = mafs.length
  const arr = new Array<string[]>(mafsLen)
  const splitCache = {} as Record<string, string[]>

  forEachWithStopTokenCheck(mafs, stopToken, ({ feature }, idx) => {
    const arr2 = [] as string[]
    const x = idx * w
    const hasPhaseSet = (feature.get('FORMAT') as string | undefined)?.includes(
      'PS',
    )

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
            if (isPhased) {
              const PS = s.PS?.[0]
              const alleles =
                splitCache[genotype] ||
                (splitCache[genotype] = genotype.split('|'))
              drawPhased(alleles, ctx, x, y, w, h, HP!, PS)
            } else {
              ctx.fillStyle = 'black'
              ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
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
          if (isPhased) {
            const alleles =
              splitCache[genotype] ||
              (splitCache[genotype] = genotype.split('|'))
            drawPhased(alleles, ctx, x, y, w, h, HP!)
          } else {
            ctx.fillStyle = 'black'
            ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
          }
        }
      }
    }
    arr[idx] = arr2
  })
  return arr
}

function drawAlleleCountMode({
  mafs,
  sources,
  ctx,
  w,
  h,
  scrollTop,
  startRow,
  endRow,
  genotypesCache,
  stopToken,
}: DrawParams) {
  const mafsLen = mafs.length
  const arr = new Array<string[]>(mafsLen)
  const colorCache = {} as Record<string, string | undefined>
  const splitCache = {} as Record<string, string[]>

  forEachWithStopTokenCheck(
    mafs,
    stopToken,
    ({ feature, mostFrequentAlt }, idx) => {
      const arr2 = [] as string[]
      const x = idx * w
      const hasPhaseSet = (
        feature.get('FORMAT') as string | undefined
      )?.includes('PS')

      if (hasPhaseSet) {
        const samp = feature.get('samples') as Record<string, SampleGenotype>
        for (let j = startRow; j < endRow; j++) {
          const y = j * h - scrollTop
          const { name } = sources[j]!
          const s = samp[name]
          if (s) {
            const genotype = s.GT?.[0]
            if (genotype) {
              arr2.push(genotype)
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
      } else {
        const featureId = feature.id()
        let samp = genotypesCache.get(featureId)
        if (!samp) {
          samp = feature.get('genotypes') as Record<string, string>
          genotypesCache.set(featureId, samp)
        }
        for (let j = startRow; j < endRow; j++) {
          const y = j * h - scrollTop
          const { name } = sources[j]!
          const genotype = samp[name]
          if (genotype) {
            arr2.push(genotype)
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
      arr[idx] = arr2
    },
  )
  return arr
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

  const w = mafs.length > 0 ? canvasWidth / mafs.length : 0
  const drawParams: DrawParams = {
    mafs,
    sources,
    ctx,
    w,
    h,
    scrollTop,
    startRow,
    endRow,
    genotypesCache,
    stopToken,
  }

  const arr = await updateStatus('Drawing variant matrix', statusCallback, () =>
    renderingMode === 'phased'
      ? drawPhasedMode(drawParams)
      : drawAlleleCountMode(drawParams),
  )

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
