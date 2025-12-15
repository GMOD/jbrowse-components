import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { forEachWithStopTokenCheck } from '@jbrowse/core/util'

import { lineToCtx, strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import { fillColor, getSingletonColor, strokeColor } from '../shared/color'
import { getPrimaryStrandFromFlags } from '../shared/primaryStrand'
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
import { renderMismatchesCallback } from '../PileupRenderer/renderers/renderMismatchesCallback'

interface MinimalView {
  width: number
  offsetPx: number
  bpToPx: (arg: {
    refName: string
    coord: number
  }) => { offsetPx: number; index: number } | undefined
}

const lastFillStyleMap = new WeakMap<CanvasRenderingContext2D, string>()

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
  stopToken,
}: {
  ctx: CanvasRenderingContext2D
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
  flipStrandLongReadChains: boolean
  config: AnyConfigurationModel
  theme: ThemeOptions
  regions: BaseBlock[]
  bpPerPx: number
  colorBy: ColorBy
  stopToken?: string
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
  setAlignmentFont(ctx)
  const { charWidth, charHeight } = getCharWidthHeight()
  const drawSNPsMuted = shouldDrawSNPsMuted(colorBy.type)
  const drawIndels = shouldDrawIndels()
  const canvasWidth = view.width

  const getStrandColorKey = (strand: number) =>
    strand === -1 ? 'color_rev_strand' : 'color_fwd_strand'

  forEachWithStopTokenCheck(computedChains, stopToken, computedChain => {
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
    const isSingleton = chain.length === 1
    const c1 = nonSupplementary[0] || chain[0]!
    const primaryStrand = getPrimaryStrandFromFlags(c1)

    // Clamp viewOffsetPx to 0 when negative - features should start at canvas pixel 0
    const viewOffsetPx = Math.max(0, view.offsetPx)

    // Draw connecting line for multi-segment long reads
    if (!isSingleton) {
      const firstFeat = chain[0]!
      const lastFeat = chain[chain.length - 1]!

      const firstRefName = firstFeat.get('refName')
      const lastRefName = lastFeat.get('refName')
      const firstRegion = regions.find(
        r =>
          r.refName === firstRefName &&
          r.start < firstFeat.get('end') &&
          firstFeat.get('start') < r.end,
      )
      const lastRegion = regions.find(
        r =>
          r.refName === lastRefName &&
          r.start < lastFeat.get('end') &&
          lastFeat.get('start') < r.end,
      )

      let firstPx = view.bpToPx({
        refName: firstRefName,
        coord: firstFeat.get('start'),
      })?.offsetPx
      let lastPx = view.bpToPx({
        refName: lastRefName,
        coord: lastFeat.get('end'),
      })?.offsetPx

      if (firstPx === undefined && firstRegion) {
        const clippedStart = Math.max(firstFeat.get('start'), firstRegion.start)
        firstPx = view.bpToPx({
          refName: firstRefName,
          coord: clippedStart,
        })?.offsetPx
      }

      if (lastPx === undefined && lastRegion) {
        const clippedEnd = Math.min(lastFeat.get('end'), lastRegion.end)
        lastPx = view.bpToPx({
          refName: lastRefName,
          coord: clippedEnd,
        })?.offsetPx
      }

      if (firstPx !== undefined && lastPx !== undefined) {
        const lineY = chainY + featureHeight / 2
        lineToCtx(
          firstPx - viewOffsetPx,
          lineY,
          lastPx - viewOffsetPx,
          lineY,
          ctx,
          '#6665',
        )
      }
    }

    // Draw the features
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

      const featStrand = feat.get('strand')
      const effectiveStrand =
        isSingleton || !flipStrandLongReadChains
          ? featStrand
          : featStrand * primaryStrand

      const [featureFill, featureStroke] = isSingleton
        ? getSingletonColor(
            {
              tlen: feat.get('template_length'),
              pair_orientation: feat.get('pair_orientation'),
              flags: feat.get('flags'),
            },
            chainData.stats,
          )
        : [
            fillColor[getStrandColorKey(effectiveStrand)],
            strokeColor[getStrandColorKey(effectiveStrand)],
          ]

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
          effectiveStrand,
          featureFill,
          CHEVRON_WIDTH,
          featureStroke,
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

        if (featureFill) {
          if (lastFillStyleMap.get(ctx) !== featureFill) {
            ctx.fillStyle = featureFill
            lastFillStyleMap.set(ctx, featureFill)
          }
        }

        ctx.fillRect(xPos, chainY, width, featureHeight)
        strokeRectCtx(xPos, chainY, width, featureHeight, ctx, featureStroke)
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
          checkRef: true,
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
