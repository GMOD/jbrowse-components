import { updateStatus } from '@jbrowse/core/util'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { f2 } from '../shared/constants'
import { drawColorAlleleCount, getAlleleColor } from '../shared/drawAlleleCount'
import { drawPhased } from '../shared/drawPhased'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { RenderArgsDeserialized } from './types'
import type { Source } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'

type SampleGenotype = Record<string, string[]>

interface Maf {
  feature: Feature
  mostFrequentAlt: string
}

interface DrawContext {
  ctx: CanvasRenderingContext2D
  sources: Source[]
  startRow: number
  endRow: number
  h: number
  w: number
  scrollTop: number
  splitCache: Record<string, string[]>
  colorCache: Record<string, string | undefined>
  genotypesCache: Map<string, Record<string, string>>
  stopToken?: string
}

function drawPhasedMode(drawCtx: DrawContext, mafs: Maf[]) {
  const {
    ctx,
    sources,
    startRow,
    endRow,
    h,
    w,
    scrollTop,
    splitCache,
    genotypesCache,
    stopToken,
  } = drawCtx

  const arr = [] as string[][]
  const lastCheck = createStopTokenChecker(stopToken)
  for (let idx = 0, l = mafs.length; idx < l; idx++) {
    const { feature } = mafs[idx]!
    const arr2 = [] as string[]
    const hasPhaseSet = (feature.get('FORMAT') as string | undefined)?.includes(
      'PS',
    )
    const x = idx * w

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
                splitCache[genotype] ??
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
              splitCache[genotype] ??
              (splitCache[genotype] = genotype.split('|'))
            drawPhased(alleles, ctx, x, y, w, h, HP!)
          } else {
            ctx.fillStyle = 'black'
            ctx.fillRect(x - f2, y - f2, w + f2, h + f2)
          }
        }
      }
    }
    arr.push(arr2)
    checkStopToken2(lastCheck)
  }

  return arr
}

function drawAlleleCountMode(drawCtx: DrawContext, mafs: Maf[]) {
  const {
    ctx,
    sources,
    startRow,
    endRow,
    h,
    w,
    scrollTop,
    splitCache,
    stopToken,
    colorCache,
    genotypesCache,
  } = drawCtx

  const arr = [] as string[][]
  const lastCheck = createStopTokenChecker(stopToken)

  for (let idx = 0, l = mafs.length; idx < l; idx++) {
    const { feature, mostFrequentAlt } = mafs[idx]!
    const arr2 = [] as string[]
    const hasPhaseSet = (feature.get('FORMAT') as string | undefined)?.includes(
      'PS',
    )
    const x = idx * w

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
    arr.push(arr2)
    checkStopToken2(lastCheck)
  }

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
    statusCallback = () => {},
  } = renderArgs
  const h = rowHeight
  const startRow = Math.floor(scrollTop / h)
  const endRow = Math.min(
    sources.length,
    Math.ceil((scrollTop + canvasHeight) / h),
  )
  const lastCheck = createStopTokenChecker(stopToken)
  const genotypesCache = new Map<string, Record<string, string>>()
  const colorCache = {} as Record<string, string | undefined>
  const splitCache = {} as Record<string, string[]>

  const mafs = await updateStatus('Calculating stats', statusCallback, () =>
    getFeaturesThatPassMinorAlleleFrequencyFilter({
      lastCheck,
      features: features.values(),
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
      genotypesCache,
      splitCache,
    }),
  )

  const m = mafs.length
  const w = canvasWidth / m

  const drawCtx: DrawContext = {
    ctx,
    sources,
    startRow,
    endRow,
    h,
    w,
    scrollTop,
    splitCache,
    colorCache,
    genotypesCache,
    stopToken,
  }

  const arr = await updateStatus(
    'Drawing variant matrix',
    statusCallback,
    () =>
      renderingMode === 'phased'
        ? drawPhasedMode(drawCtx, mafs)
        : drawAlleleCountMode(drawCtx, mafs),
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
