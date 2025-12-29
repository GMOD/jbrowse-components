import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import { getCigarOps } from '../PileupRenderer/renderers/cigarUtil'
import { renderMismatchesCallback } from '../PileupRenderer/renderers/renderMismatchesCallback'
import { renderModifications } from '../PileupRenderer/renderers/renderModifications'
import { strokeRectCtx } from '../shared/canvasUtils'
import { drawChevron } from '../shared/chevron'
import { SAM_FLAG_PAIRED, SAM_FLAG_SUPPLEMENTARY } from '../shared/samFlags'
import {
  CHEVRON_WIDTH,
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  setAlignmentFont,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from '../shared/util'

import type { FlatbushItem, LayoutFeature } from '../PileupRenderer/types'
import type { ColorBy, ModificationTypeWithColor } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'
import type { ThemeOptions } from '@mui/material'

// Get connecting line color based on theme mode
export function getConnectingLineColor(configTheme: ThemeOptions) {
  const theme = createJBrowseTheme(configTheme)
  return theme.palette.mode === 'dark' ? '#aaa8' : '#6665'
}
export const MIN_FEATURE_WIDTH_PX = 3
export const CLIP_RECT_HEIGHT = 100000

export function renderFeatureShape({
  ctx,
  xPos,
  yPos,
  width,
  height,
  strand,
  fillStyle,
  strokeStyle,
  renderChevrons,
  showOutline = true,
}: {
  ctx: CanvasRenderingContext2D
  xPos: number
  yPos: number
  width: number
  height: number
  strand: number
  fillStyle: string
  strokeStyle: string
  renderChevrons: boolean
  showOutline?: boolean
}) {
  if (renderChevrons) {
    drawChevron(
      ctx,
      xPos,
      yPos,
      width,
      height,
      strand,
      fillStyle,
      CHEVRON_WIDTH,
      showOutline ? strokeStyle : undefined,
    )
  } else {
    // Handle negative dimensions for SVG exports
    let drawX = xPos
    let drawY = yPos
    let drawWidth = width
    if (drawWidth < 0) {
      drawX += drawWidth
      drawWidth = -drawWidth
    }
    if (height < 0) {
      drawY += height
    }

    ctx.fillStyle = fillStyle
    ctx.fillRect(drawX, drawY, drawWidth, height)
    if (showOutline) {
      strokeRectCtx(drawX, drawY, drawWidth, height, ctx, strokeStyle)
    }
  }
}

export interface MismatchData {
  coords: number[]
  items: FlatbushItem[]
}

export function getStrandColorKey(strand: number) {
  return strand === -1 ? 'color_rev_strand' : 'color_fwd_strand'
}

export function chainIsPairedEnd(chain: Feature[]) {
  for (const element of chain) {
    if (element.get('flags') & SAM_FLAG_PAIRED) {
      return true
    }
  }
  return false
}

export function collectNonSupplementary(chain: Feature[]) {
  const result: Feature[] = []
  for (const element of chain) {
    if (!(element.get('flags') & SAM_FLAG_SUPPLEMENTARY)) {
      result.push(element)
    }
  }
  return result
}

export interface MismatchRenderingConfig {
  mismatchAlpha: boolean | undefined
  minSubfeatureWidth: number
  largeInsertionIndicatorScale: number
  hideSmallIndels: boolean
  hideMismatches: boolean
  hideLargeIndels: boolean
  colorMap: Record<string, string>
  colorContrastMap: Record<string, string>
  charWidth: number
  charHeight: number
  drawSNPsMuted: boolean
  drawIndels: boolean
}

export function getMismatchRenderingConfig(
  ctx: CanvasRenderingContext2D,
  config: AnyConfigurationModel,
  configTheme: ThemeOptions,
  colorBy: ColorBy,
  overrides?: {
    hideSmallIndels?: boolean
    hideMismatches?: boolean
    hideLargeIndels?: boolean
  },
): MismatchRenderingConfig {
  const mismatchAlpha = readConfObject(config, 'mismatchAlpha')
  const minSubfeatureWidth = readConfObject(config, 'minSubfeatureWidth') ?? 1
  const largeInsertionIndicatorScale = readConfObject(
    config,
    'largeInsertionIndicatorScale',
  )
  const hideSmallIndels =
    overrides?.hideSmallIndels ??
    (readConfObject(config, 'hideSmallIndels') as boolean)
  const hideMismatches =
    overrides?.hideMismatches ??
    (readConfObject(config, 'hideMismatches') as boolean)
  const hideLargeIndels =
    overrides?.hideLargeIndels ??
    (readConfObject(config, 'hideLargeIndels') as boolean | undefined) ??
    false
  const theme = createJBrowseTheme(configTheme)
  const colorMap = getColorBaseMap(theme)
  const colorContrastMap = getContrastBaseMap(theme)
  setAlignmentFont(ctx)
  const { charWidth, charHeight } = getCharWidthHeight()
  const drawSNPsMuted = shouldDrawSNPsMuted(colorBy.type)
  const drawIndels = shouldDrawIndels()

  return {
    mismatchAlpha,
    minSubfeatureWidth,
    largeInsertionIndicatorScale,
    hideSmallIndels,
    hideMismatches,
    hideLargeIndels,
    colorMap,
    colorContrastMap,
    charWidth,
    charHeight,
    drawSNPsMuted,
    drawIndels,
  }
}

export function featureOverlapsRegion(
  featRefName: string,
  featStart: number,
  featEnd: number,
  region: BaseBlock,
) {
  return (
    featRefName === region.refName &&
    featStart < region.end &&
    featEnd > region.start
  )
}

export function calculateFeaturePositionPx(
  featStart: number,
  featEnd: number,
  regionStart: number,
  regionEnd: number,
  bpPerPx: number,
) {
  const clippedStart = Math.max(featStart, regionStart)
  const clippedEnd = Math.min(featEnd, regionEnd)
  const xPos = (clippedStart - regionStart) / bpPerPx
  const width = Math.max(
    (clippedEnd - clippedStart) / bpPerPx,
    MIN_FEATURE_WIDTH_PX,
  )
  return { xPos, width }
}

/**
 * Find min start and max end coordinates across all features in a chain
 * that are on the specified reference. Returns undefined if no features match.
 */
export function getChainBoundsOnRef(chain: Feature[], refName: string) {
  let minStart = Number.MAX_VALUE
  let maxEnd = Number.MIN_VALUE

  for (const element of chain) {
    const f = element
    if (f.get('refName') === refName) {
      minStart = Math.min(minStart, f.get('start'))
      maxEnd = Math.max(maxEnd, f.get('end'))
    }
  }

  return minStart !== Number.MAX_VALUE ? { minStart, maxEnd } : undefined
}

function aggregateMismatchData(
  ret: MismatchData,
  regionStartPx: number,
  allCoords: number[],
  allItems: FlatbushItem[],
) {
  for (let i = 0; i < ret.coords.length; i += 4) {
    allCoords.push(
      ret.coords[i]! + regionStartPx,
      ret.coords[i + 1]!,
      ret.coords[i + 2]! + regionStartPx,
      ret.coords[i + 3]!,
    )
  }
  for (const item of ret.items) {
    allItems.push(item)
  }
}

export function renderFeatureModifications({
  ctx,
  feat,
  layoutFeat,
  region,
  regionStartPx,
  bpPerPx,
  colorBy,
  visibleModifications,
  allCoords,
  allItems,
}: {
  ctx: CanvasRenderingContext2D
  feat: Feature
  layoutFeat: LayoutFeature
  region: BaseBlock
  regionStartPx: number
  bpPerPx: number
  colorBy: ColorBy
  visibleModifications?: Record<string, ModificationTypeWithColor>
  allCoords: number[]
  allItems: FlatbushItem[]
}) {
  if (colorBy.type !== 'modifications' || !visibleModifications) {
    return
  }

  const cigarOps = getCigarOps(feat.get('NUMERIC_CIGAR') || feat.get('CIGAR'))
  const modRet = renderModifications({
    ctx,
    feat: layoutFeat,
    region,
    bpPerPx,
    renderArgs: {
      colorBy,
      visibleModifications,
    },
    cigarOps,
  })

  aggregateMismatchData(modRet, regionStartPx, allCoords, allItems)
}

export function renderFeatureMismatchesAndModifications({
  ctx,
  feat,
  layoutFeat,
  region,
  regionStartPx,
  bpPerPx,
  canvasWidth,
  colorBy,
  visibleModifications,
  mismatchConfig,
  allCoords,
  allItems,
}: {
  ctx: CanvasRenderingContext2D
  feat: Feature
  layoutFeat: LayoutFeature
  region: BaseBlock
  regionStartPx: number
  bpPerPx: number
  canvasWidth: number
  colorBy: ColorBy
  visibleModifications?: Record<string, ModificationTypeWithColor>
  mismatchConfig: MismatchRenderingConfig
  allCoords: number[]
  allItems: FlatbushItem[]
}) {
  const ret = renderMismatchesCallback({
    ctx,
    feat: layoutFeat,
    checkRef: true,
    bpPerPx,
    regions: [region],
    canvasWidth,
    ...mismatchConfig,
  })
  aggregateMismatchData(ret, regionStartPx, allCoords, allItems)

  renderFeatureModifications({
    ctx,
    feat,
    layoutFeat,
    region,
    regionStartPx,
    bpPerPx,
    colorBy,
    visibleModifications,
    allCoords,
    allItems,
  })
}
