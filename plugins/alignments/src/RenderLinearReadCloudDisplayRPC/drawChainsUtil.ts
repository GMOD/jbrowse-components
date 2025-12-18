import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import { getCigarOps } from '../PileupRenderer/renderers/cigarUtil'
import { renderMismatchesCallback } from '../PileupRenderer/renderers/renderMismatchesCallback'
import { renderModifications } from '../PileupRenderer/renderers/renderModifications'
import { SAM_FLAG_PAIRED, SAM_FLAG_SUPPLEMENTARY } from '../shared/samFlags'
import {
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

export interface MismatchData {
  coords: number[]
  items: FlatbushItem[]
}

export function getStrandColorKey(strand: number) {
  return strand === -1 ? 'color_rev_strand' : 'color_fwd_strand'
}

export function chainIsPairedEnd(chain: Feature[]) {
  for (const element of chain) {
    if (element.get('flags') & 1) {
      return true
    }
  }
  return false
}

export function collectNonSupplementary(chain: Feature[]) {
  const result: Feature[] = []
  for (const element of chain) {
    if (!(element.get('flags') & 2048)) {
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
): MismatchRenderingConfig {
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

  return {
    mismatchAlpha,
    minSubfeatureWidth,
    largeInsertionIndicatorScale,
    hideSmallIndels,
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

export function aggregateMismatchData(
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
