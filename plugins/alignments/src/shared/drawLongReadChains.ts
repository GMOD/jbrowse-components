import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import { renderMismatches } from '../PileupRenderer/renderers/renderMismatches'
import {
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from '../PileupRenderer/util'
import { fillRectCtx, lineToCtx, strokeRectCtx } from './canvasUtils'
import { drawChevron } from './chevron'
import { fillColor, getSingletonColor, strokeColor } from './color'
import { getPrimaryStrandFromFlags } from './primaryStrand'
import { CHEVRON_WIDTH } from './util'

import type { ChainData } from './fetchChains'
import type { FlatbushEntry } from './flatbushType'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import { ThemeOptions } from '@mui/material'

type LGV = LinearGenomeViewModel

export function drawLongReadChains({
  ctx,
  chainData,
  view,
  chainYOffsets,
  renderChevrons,
  featureHeight,
  featuresForFlatbush,
  computedChains,
  flipStrandLongReadChains,
  config,
  theme: configTheme,
  regions,
  bpPerPx,
  colorBy,
}: {
  ctx: CanvasRenderingContext2D
  chainData: ChainData
  view: LGV
  chainYOffsets: Map<string, number>
  renderChevrons: boolean
  featureHeight: number
  featuresForFlatbush: FlatbushEntry[]
  computedChains: {
    distance: number
    minX: number
    maxX: number
    chain: Feature[]
    id: string
  }[]
  flipStrandLongReadChains: boolean
  config: AnyConfigurationModel
  theme: ThemeOptions
  regions: { refName: string; start: number; end: number }[]
  bpPerPx: number
  colorBy: { type: string; tag?: string; extra?: Record<string, unknown> }
}): void {
  // Setup rendering configuration from PileupRenderer
  const mismatchAlpha = readConfObject(config, 'mismatchAlpha')
  const minSubfeatureWidth = readConfObject(config, 'minSubfeatureWidth')
  const largeInsertionIndicatorScale = readConfObject(
    config,
    'largeInsertionIndicatorScale',
  )
  const hideSmallIndels = readConfObject(config, 'hideSmallIndels') as boolean
  const theme = createJBrowseTheme(configTheme)
  const colorMap = getColorBaseMap(theme)
  const colorContrastMap = getContrastBaseMap(theme)
  const { charWidth, charHeight } = getCharWidthHeight()
  const drawSNPsMuted = shouldDrawSNPsMuted(colorBy?.type)
  const drawIndels = shouldDrawIndels()
  const canvasWidth = view.dynamicBlocks?.totalWidthPx || 800

  const getStrandColorKey = (strand: number) =>
    strand === -1 ? 'color_rev_strand' : 'color_fwd_strand'

  for (const computedChain of computedChains) {
    const { id, chain, minX, maxX } = computedChain

    // Guard clause: skip paired-end reads (handled by drawPairChains)
    let isPairedEnd = false
    for (const element of chain) {
      if (element.get('flags') & 1) {
        isPairedEnd = true
        break
      }
    }
    if (isPairedEnd) {
      continue
    }

    const chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      continue
    }

    // Collect non-supplementary alignments
    const nonSupplementary: Feature[] = []
    for (const element of chain) {
      if (!(element.get('flags') & 2048)) {
        nonSupplementary.push(element)
      }
    }
    const isSingleton = chain.length === 1
    const c1 = nonSupplementary[0] || chain[0]!
    const primaryStrand = getPrimaryStrandFromFlags(c1)

    // Draw connecting line for multi-segment long reads
    if (!isSingleton) {
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      const firstPx = view.bpToPx({
        refName: firstFeat.get('refName'),
        coord: firstFeat.get('start'),
      })?.offsetPx
      const lastPx = view.bpToPx({
        refName: lastFeat.get('refName'),
        coord: lastFeat.get('end'),
      })?.offsetPx

      if (firstPx !== undefined && lastPx !== undefined) {
        const lineY = chainY + featureHeight / 2
        lineToCtx(
          firstPx - view.offsetPx,
          lineY,
          lastPx - view.offsetPx,
          lineY,
          ctx,
          '#6665',
        )
      }
    }

    // Draw the features
    const viewOffsetPx = view.offsetPx
    const chainMinXPx = minX - viewOffsetPx
    const chainMaxXPx = maxX - viewOffsetPx

    for (let i = 0, l = chain.length; i < l; i++) {
      const feat = chain[i]!
      const s = view.bpToPx({
        refName: feat.get('refName'),
        coord: feat.get('start'),
      })
      const e = view.bpToPx({
        refName: feat.get('refName'),
        coord: feat.get('end'),
      })

      if (!s || !e) {
        continue
      }

      const featStrand = feat.get('strand')
      const effectiveStrand =
        isSingleton || !flipStrandLongReadChains
          ? featStrand
          : featStrand * primaryStrand

      const [featureFill, featureStroke] = isSingleton
        ? getSingletonColor(feat, chainData.stats)
        : [
            fillColor[getStrandColorKey(effectiveStrand)],
            strokeColor[getStrandColorKey(effectiveStrand)],
          ]

      const xPos = s.offsetPx - viewOffsetPx
      const width = Math.max(e.offsetPx - s.offsetPx, 3)

      // Render the alignment base shape
      const layoutFeat = {
        feature: feat,
        heightPx: featureHeight,
        topPx: chainY,
      }

      if (renderChevrons) {
        drawChevron(
          ctx,
          xPos,
          chainY,
          width,
          featureHeight,
          effectiveStrand,
          featureFill,
          CHEVRON_WIDTH,
          featureStroke,
        )
      } else {
        fillRectCtx(xPos, chainY, width, featureHeight, ctx, featureFill)
        strokeRectCtx(xPos, chainY, width, featureHeight, ctx, featureStroke)
      }

      // Render mismatches on top if available
      const region = regions[0]
      if (region) {
        renderMismatches({
          ctx,
          feat: layoutFeat,
          renderArgs: {
            config,
            bpPerPx,
            regions,
            colorBy,
            theme: configTheme,
          } as any,
          hideSmallIndels,
          mismatchAlpha,
          drawSNPsMuted,
          drawIndels,
          largeInsertionIndicatorScale,
          minSubfeatureWidth,
          charWidth,
          charHeight,
          colorMap,
          colorContrastMap,
          canvasWidth,
        })
      }

      featuresForFlatbush.push({
        x1: xPos,
        y1: chainY,
        x2: xPos + width,
        y2: chainY + featureHeight,
        data: {
          name: feat.get('name'),
          refName: feat.get('refName'),
          start: feat.get('start'),
          end: feat.get('end'),
          strand: feat.get('strand'),
          flags: feat.get('flags'),
        },
        chainId: id,
        chainMinX: chainMinXPx,
        chainMaxX: chainMaxXPx,
        chain: chain.map(f => ({
          name: f.get('name'),
          refName: f.get('refName'),
          start: f.get('start'),
          end: f.get('end'),
          strand: f.get('strand'),
          flags: f.get('flags'),
        })),
      })
    }
  }
}
