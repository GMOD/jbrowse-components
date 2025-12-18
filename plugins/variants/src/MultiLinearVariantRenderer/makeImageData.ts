import { featureSpanPx, updateStatus } from '@jbrowse/core/util'
import Flatbush from '@jbrowse/core/util/flatbush'
import { checkStopToken, checkStopToken2 } from '@jbrowse/core/util/stopToken'

import { f2 } from '../shared/constants'
import { drawColorAlleleCount, getAlleleColor } from '../shared/drawAlleleCount'
import { drawPhased } from '../shared/drawPhased'
import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils'

import type { MultiRenderArgsDeserialized } from './types'
import type { Source } from '../shared/types'
import type { Feature, Region } from '@jbrowse/core/util'

interface Maf {
  feature: Feature
  mostFrequentAlt: string
}

interface DrawContext {
  ctx: CanvasRenderingContext2D
  sources: Source[]
  region: Region
  bpPerPx: number
  startRow: number
  endRow: number
  h: number
  drawH: number
  scrollTop: number
  splitCache: Record<string, string[]>
  drawRef: boolean
  genotypesCache: Map<string, Record<string, string>>
  stopToken?: string
}

interface ItemData {
  items: { name: string; genotype: string; featureId: string; bpLen: number }[]
  coords: number[]
}

function drawPhasedMode(drawCtx: DrawContext, itemData: ItemData, mafs: Maf[]) {
  const {
    ctx,
    sources,
    region,
    bpPerPx,
    startRow,
    endRow,
    h,
    drawH,
    scrollTop,
    splitCache,
    drawRef,
    genotypesCache,
    stopToken,
  } = drawCtx
  const { items, coords } = itemData
  const lastCheck = { time: Date.now() }
  let idx = 0

  for (const { feature } of mafs) {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const featureId = feature.id()
    const bpLen = feature.get('end') - feature.get('start')
    const w = Math.max(Math.round(rightPx - leftPx), 2)
    const x = Math.floor(leftPx)
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
        const isPhased = genotype.includes('|')
        if (isPhased) {
          const alleles =
            splitCache[genotype] ?? (splitCache[genotype] = genotype.split('|'))
          if (
            drawPhased(alleles, ctx, x, y, w, drawH, HP!, undefined, drawRef)
          ) {
            items.push({ name, genotype, featureId, bpLen })
            coords.push(x, y, x + w, y + drawH)
          }
        } else {
          ctx.fillStyle = 'black'
          ctx.fillRect(x - f2, y - f2, w + f2, drawH + f2)
        }
      }
    }
    checkStopToken2(stopToken, idx++, lastCheck)
  }
}

function drawAlleleCountMode(
  drawCtx: DrawContext,
  itemData: ItemData,
  mafs: Maf[],
  colorCache: Record<string, string | undefined>,
) {
  const {
    ctx,
    sources,
    region,
    bpPerPx,
    startRow,
    endRow,
    h,
    drawH,
    scrollTop,
    splitCache,
    drawRef,
    genotypesCache,
    stopToken,
  } = drawCtx
  const { items, coords } = itemData
  const lastCheck = { time: Date.now() }
  let idx = 0

  for (const { mostFrequentAlt, feature } of mafs) {
    const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
    const featureId = feature.id()
    const bpLen = feature.get('end') - feature.get('start')
    const w = Math.max(Math.round(rightPx - leftPx), 2)
    const x = Math.floor(leftPx)
    let samp = genotypesCache.get(featureId)
    if (!samp) {
      samp = feature.get('genotypes') as Record<string, string>
      genotypesCache.set(featureId, samp)
    }
    const featureType = feature.get('type')
    const featureStrand = feature.get('strand')
    const alpha = bpLen > 5 ? 0.75 : 1

    for (let j = startRow; j < endRow; j++) {
      const y = j * h - scrollTop
      const { name } = sources[j]!
      const genotype = samp[name]
      if (genotype) {
        const c = getAlleleColor(
          genotype,
          mostFrequentAlt,
          colorCache,
          splitCache,
          drawRef,
        )
        if (c) {
          drawColorAlleleCount(
            c,
            ctx,
            x,
            y,
            w,
            drawH,
            featureType,
            featureStrand,
            alpha,
          )
          items.push({ name, genotype, featureId, bpLen })
          coords.push(x, y, x + w, y + drawH)
        }
      }
    }
    checkStopToken2(stopToken, idx++, lastCheck)
  }
}

export async function makeImageData(
  ctx: CanvasRenderingContext2D,
  props: MultiRenderArgsDeserialized,
) {
  const {
    scrollTop,
    minorAlleleFrequencyFilter,
    sources,
    rowHeight,
    height: canvasHeight,
    features,
    regions,
    bpPerPx,
    renderingMode,
    stopToken,
    lengthCutoffFilter,
    referenceDrawingMode,
    statusCallback = () => {},
  } = props
  const region = regions[0]!
  checkStopToken(stopToken)

  const coords = [] as number[]
  const items = [] as {
    name: string
    genotype: string
    featureId: string
    bpLen: number
  }[]
  const colorCache = {} as Record<string, string | undefined>
  const splitCache = {} as Record<string, string[]>
  const genotypesCache = new Map<string, Record<string, string>>()
  const drawRef = referenceDrawingMode === 'draw'
  const h = rowHeight
  const drawH = Math.max(rowHeight, 1)
  const startRow = Math.floor(scrollTop / h)
  const endRow = Math.min(
    sources.length,
    Math.ceil((scrollTop + canvasHeight) / h),
  )

  const mafs = await updateStatus('Calculating stats', statusCallback, () =>
    getFeaturesThatPassMinorAlleleFrequencyFilter({
      stopToken,
      features: features.values(),
      minorAlleleFrequencyFilter,
      lengthCutoffFilter,
      genotypesCache,
      splitCache,
    }),
  )
  checkStopToken(stopToken)

  const drawCtx: DrawContext = {
    ctx,
    sources,
    region,
    bpPerPx,
    startRow,
    endRow,
    h,
    drawH,
    scrollTop,
    splitCache,
    drawRef,
    genotypesCache,
    stopToken,
  }
  const itemData: ItemData = { items, coords }

  await updateStatus('Drawing variants', statusCallback, () => {
    if (renderingMode === 'phased') {
      drawPhasedMode(drawCtx, itemData, mafs)
    } else {
      drawAlleleCountMode(drawCtx, itemData, mafs, colorCache)
    }
  })

  const flatbush = new Flatbush(Math.max(items.length, 1))
  if (items.length) {
    for (let i = 0, l = coords.length; i < l; i += 4) {
      flatbush.add(coords[i]!, coords[i + 1]!, coords[i + 2], coords[i + 3])
    }
  } else {
    flatbush.add(0, 0)
  }
  flatbush.finish()

  const featureGenotypeMap = {} as Record<
    string,
    {
      alt: unknown
      ref: unknown
      name: unknown
      description: unknown
      length: number
    }
  >
  for (const { feature } of mafs) {
    const id = feature.id()
    featureGenotypeMap[id] = {
      alt: feature.get('ALT'),
      ref: feature.get('REF'),
      name: feature.get('name'),
      description: feature.get('description'),
      length: feature.get('end') - feature.get('start'),
    }
  }

  return {
    flatbush: flatbush.data,
    items,
    featureGenotypeMap,
  }
}
