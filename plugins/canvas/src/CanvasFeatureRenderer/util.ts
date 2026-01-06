import { getFrame, stripAlpha } from '@jbrowse/core/util'

import { readCachedConfig } from './renderConfig.ts'

import type { RenderConfigContext } from './renderConfig.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

const MAX_LABEL_LENGTH = 50
const UTR_REGEX = /(\bUTR|_UTR|untranslated[_\s]region)\b/i

/**
 * Get the effective strand direction accounting for region reversal.
 * Returns -1 (visual left), 1 (visual right), or 0 (no strand).
 */
export function getEffectiveStrand(strand: number, reversed: boolean): number {
  return strand * (reversed ? -1 : 1)
}

/**
 * Calculate x position for an index within a feature, accounting for strand direction.
 * For reverse strand (effectiveStrand === -1), positions go from right to left.
 * For forward strand (effectiveStrand === 1), positions go from left to right.
 */
export function getStrandAwareX(
  left: number,
  width: number,
  index: number,
  pxPerBp: number,
  effectiveStrand: number,
): number {
  if (effectiveStrand === -1) {
    return left + width - pxPerBp * index
  }
  return left + pxPerBp * index
}

export function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function isOffScreen(left: number, width: number, canvasWidth: number) {
  return left + width < 0 || left > canvasWidth
}

export function isUTR(feature: Feature) {
  return UTR_REGEX.test(feature.get('type') || '')
}

export function getBoxColor({
  feature,
  config,
  configContext,
  colorByCDS,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  colorByCDS: boolean
  theme: Theme
}) {
  const { color1, color3 } = configContext

  let fill: string
  fill = isUTR(feature)
    ? readCachedConfig(color3, config, 'color3', feature)
    : readCachedConfig(color1, config, 'color1', feature)

  const featureType: string | undefined = feature.get('type')
  const featureStrand: -1 | 1 | undefined = feature.get('strand')
  const featurePhase: 0 | 1 | 2 | undefined = feature.get('phase')

  if (
    colorByCDS &&
    featureType === 'CDS' &&
    featureStrand !== undefined &&
    featurePhase !== undefined
  ) {
    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')

    const frame = getFrame(
      featureStart,
      featureEnd,
      featureStrand,
      featurePhase,
    )
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    if (frameColor) {
      fill = frameColor
    }
  }

  return fill
}

export function getStrokeColor({
  feature,
  config,
  configContext,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  theme: Theme
}) {
  const { color2 } = configContext
  const c = readCachedConfig(color2, config, 'color2', feature)
  return c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
}
