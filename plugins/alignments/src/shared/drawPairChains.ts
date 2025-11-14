import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import { renderAlignment } from '../PileupRenderer/renderers/renderAlignment'
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
import { getPairedColor, getSingletonColor } from './color'
import { CHEVRON_WIDTH } from './util'

import type { ChainData } from './fetchChains'
import type { FlatbushEntry } from './flatbushType'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { ThemeOptions } from '@mui/material'

type LGV = LinearGenomeViewModel

export function drawPairChains({
  ctx,
  type,
  chainData,
  view,
  chainYOffsets,
  renderChevrons,
  featureHeight,
  featuresForFlatbush,
  computedChains,
  config,
  theme: configTheme,
  regions,
  bpPerPx,
  colorBy,
}: {
  ctx: CanvasRenderingContext2D
  type: string
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
  const defaultColor = readConfObject(config, 'color') === '#f0f'
  const theme = createJBrowseTheme(configTheme)
  const colorMap = getColorBaseMap(theme)
  const colorContrastMap = getContrastBaseMap(theme)
  const { charWidth, charHeight } = getCharWidthHeight()
  const drawSNPsMuted = shouldDrawSNPsMuted(colorBy?.type)
  const drawIndels = shouldDrawIndels()
  const canvasWidth = view.dynamicBlocks?.totalWidthPx || 800

  for (const computedChain of computedChains) {
    const { id, chain, minX, maxX } = computedChain

    // Guard clause: skip non-paired-end chains
    let isPairedEnd = false
    for (const element of chain) {
      if (element.get('flags') & 1) {
        isPairedEnd = true
        break
      }
    }
    if (!isPairedEnd) {
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
    const hasBothMates = nonSupplementary.length === 2

    // Get colors based on whether both mates are visible
    const [pairedFill, pairedStroke] = hasBothMates
      ? getPairedColor({
          type,
          v0: nonSupplementary[0]!,
          v1: nonSupplementary[1]!,
          stats: chainData.stats,
        }) || ['#888', '#888']
      : getSingletonColor(nonSupplementary[0] || chain[0]!, chainData.stats)

    // Draw connecting line for pairs with both mates visible
    if (hasBothMates) {
      const v0 = nonSupplementary[0]!
      const v1 = nonSupplementary[1]!
      const r1s = view.bpToPx({
        refName: v0.get('refName'),
        coord: v0.get('start'),
      })?.offsetPx
      const r2s = view.bpToPx({
        refName: v1.get('refName'),
        coord: v1.get('start'),
      })?.offsetPx

      if (r1s !== undefined && r2s !== undefined) {
        const lineY = chainY + featureHeight / 2
        lineToCtx(
          r1s - view.offsetPx,
          lineY,
          r2s - view.offsetPx,
          lineY,
          ctx,
          '#6665',
        )
      }
    }

    // Draw the paired-end features (both mates or singleton)
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
          feat.get('strand'),
          pairedFill,
          CHEVRON_WIDTH,
          pairedStroke,
        )
      } else {
        fillRectCtx(xPos, chainY, width, featureHeight, ctx, pairedFill)
        strokeRectCtx(xPos, chainY, width, featureHeight, ctx, pairedStroke)
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
