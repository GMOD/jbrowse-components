import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'

import {
  getCharWidthHeight,
  getColorBaseMap,
  getContrastBaseMap,
  setAlignmentFont,
  shouldDrawIndels,
  shouldDrawSNPsMuted,
} from '../shared/util'

import type { ColorBy } from '../shared/types'
import type { FlatbushItem } from '../PileupRenderer/types'
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
