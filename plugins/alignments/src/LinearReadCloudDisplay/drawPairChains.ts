import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'

import { renderMismatchesCallback } from '../PileupRenderer/renderers/renderMismatchesCallback'
import { lineToCtx, strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import { getPairedColor } from '../shared/color'
import {
  CHEVRON_WIDTH,
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  setAlignmentFont,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from '../shared/util'

import type { FlatbushEntry } from '../shared/flatbushType'
import type { ChainData, ColorBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { ThemeOptions } from '@mui/material'

interface MinimalView {
  offsetPx: number
  bpToPx: (arg: {
    refName: string
    coord: number
  }) => { offsetPx: number; index: number } | undefined
}

const lastFillStyleMap = new WeakMap<CanvasRenderingContext2D, string>()

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
  canvasWidth,
  bpPerPx,
  colorBy,
  stopToken,
}: {
  ctx: CanvasRenderingContext2D
  type: string
  chainData: ChainData
  view: MinimalView
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
  canvasWidth: number
  regions: BaseBlock[]
  bpPerPx: number
  colorBy: ColorBy
  stopToken?: string
}): void {
  // Setup rendering configuration from PileupRenderer
  const mismatchAlpha = readConfObject(config, 'mismatchAlpha')
  const minSubfeatureWidth = readConfObject(config, 'minSubfeatureWidth') ?? 1
  const largeInsertionIndicatorScale = readConfObject(
    config,
    'largeInsertionIndicatorScale',
  )
  const hideSmallIndels = readConfObject(config, 'hideSmallIndels') as boolean
  const theme = createJBrowseTheme(configTheme)
  const colorMap = getColorBaseMap(theme)
  const colorContrastMap = getContrastBaseMap(theme)
  setAlignmentFont(ctx)
  const { charWidth, charHeight } = getCharWidthHeight()
  const drawSNPsMuted = shouldDrawSNPsMuted(colorBy.type)
  const drawIndels = shouldDrawIndels()

  forEachWithStopTokenCheck(computedChains, stopToken, computedChain => {
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
      return
    }

    let chainY = chainYOffsets.get(id)
    if (chainY === undefined) {
      return
    }

    // Collect non-supplementary alignments
    const nonSupplementary: Feature[] = []
    for (const element of chain) {
      if (!(element.get('flags') & 2048)) {
        nonSupplementary.push(element)
      }
    }
    const hasBothMates = nonSupplementary.length === 2

    // Get colors for this read pair/singleton
    const feat = nonSupplementary[0] || chain[0]!
    const [pairedFill, pairedStroke] = getPairedColor({
      type,
      v0: feat,
      stats: chainData.stats,
    }) || ['lightgrey', '#888']

    // Clamp viewOffsetPx to 0 when negative - features should start at canvas pixel 0
    const viewOffsetPx = Math.max(0, view.offsetPx)

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
          r1s - viewOffsetPx,
          lineY,
          r2s - viewOffsetPx,
          lineY,
          ctx,
          '#6665',
        )
      }
    }

    // Draw the paired-end features (both mates or singleton)
    const chainMinXPx = minX - viewOffsetPx
    const chainMaxXPx = maxX - viewOffsetPx

    for (let i = 0, l = chain.length; i < l; i++) {
      const feat = chain[i]!
      const featRefName = feat.get('refName')
      const featStart = feat.get('start')
      const featEnd = feat.get('end')

      const s = view.bpToPx({
        refName: featRefName,
        coord: featStart,
      })
      const e = view.bpToPx({
        refName: featRefName,
        coord: featEnd,
      })

      const region = regions.find(
        r =>
          r.refName === featRefName && r.start < featEnd && featStart < r.end,
      )

      let startPx: number | undefined
      let endPx: number | undefined

      if (s && e) {
        startPx = s.offsetPx
        endPx = e.offsetPx
      } else if (region) {
        const clippedStart = Math.max(featStart, region.start)
        const clippedEnd = Math.min(featEnd, region.end)

        const clippedStartPx = view.bpToPx({
          refName: featRefName,
          coord: clippedStart,
        })?.offsetPx
        const clippedEndPx = view.bpToPx({
          refName: featRefName,
          coord: clippedEnd,
        })?.offsetPx

        if (clippedStartPx !== undefined && clippedEndPx !== undefined) {
          startPx = clippedStartPx
          endPx = clippedEndPx
        }
      }

      if (startPx === undefined || endPx === undefined) {
        continue
      }

      let xPos = startPx - viewOffsetPx
      let width = Math.max(endPx - startPx, 3)

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
        // avoid drawing negative width features for SVG exports
        if (width < 0) {
          xPos += width
          width = -width
        }
        if (featureHeight < 0) {
          chainY += featureHeight
          // no need to negate featureHeight, it's not used again
        }

        if (pairedFill) {
          if (lastFillStyleMap.get(ctx) !== pairedFill) {
            ctx.fillStyle = pairedFill
            lastFillStyleMap.set(ctx, pairedFill)
          }
        }

        ctx.fillRect(xPos, chainY, width, featureHeight)
        strokeRectCtx(xPos, chainY, width, featureHeight, ctx, pairedStroke)
      }

      // Render mismatches on top if available
      if (region) {
        // renderMismatches uses bpSpanPx which calculates (bp - region.start) / bpPerPx
        // This doesn't account for where the region is positioned in static blocks
        // Use canvas translation to shift the coordinate system by the offset difference
        ctx.save()
        const offsetAdjustment = region.offsetPx - viewOffsetPx
        ctx.translate(offsetAdjustment, 0)

        // After translation, use a large canvasWidth to avoid clipping on the right side
        // The actual canvas clipping will handle bounds correctly
        const effectiveCanvasWidth = canvasWidth + Math.abs(offsetAdjustment)

        renderMismatchesCallback({
          ctx,
          feat: layoutFeat,
          bpPerPx,
          regions,
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
          canvasWidth: effectiveCanvasWidth,
          checkRef: true,
        })

        ctx.restore()
      }
    }

    // Add one flatbush entry per chain covering the full extent
    // This allows hovering over the entire chain including connecting lines
    const firstFeat = chain[0]!
    featuresForFlatbush.push({
      x1: chainMinXPx,
      y1: chainY,
      x2: chainMaxXPx,
      y2: chainY + featureHeight,
      data: {
        name: firstFeat.get('name'),
        refName: firstFeat.get('refName'),
        start: firstFeat.get('start'),
        end: firstFeat.get('end'),
        strand: firstFeat.get('strand'),
        flags: firstFeat.get('flags'),
        id: firstFeat.id(),
        tlen: firstFeat.get('template_length') || 0,
        pair_orientation: firstFeat.get('pair_orientation') || '',
        clipPos: firstFeat.get('clipPos') || 0,
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
        id: f.id(),
        tlen: f.get('template_length') || 0,
        pair_orientation: f.get('pair_orientation') || '',
        clipPos: f.get('clipPos') || 0,
      })),
    })
  })
}
