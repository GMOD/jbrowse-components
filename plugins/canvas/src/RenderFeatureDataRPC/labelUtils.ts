import { isLabelAllowed, readConfigValue } from './renderConfig.ts'
import { truncateLabel } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { FeatureLayout } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

export function getFeatureName(feature: Feature) {
  return String(feature.get('name') || feature.get('id') || '')
}

export function getFeatureDescription(feature: Feature) {
  return String(feature.get('note') || feature.get('description') || '')
}

export function applyLabelDimensions(
  layout: FeatureLayout,
  args: {
    feature: Feature
    config: DisplayConfig
    isNested: boolean
    isTranscriptChild: boolean
  },
): void {
  const { feature, config, isNested, isTranscriptChild } = args
  const { subfeatureLabels } = config

  const showSubfeatureLabels = subfeatureLabels !== 'none'
  const shouldCalculateLabels =
    isLabelAllowed(config) &&
    (!isNested || (isTranscriptChild && showSubfeatureLabels))

  if (!shouldCalculateLabels) {
    return
  }

  const effectiveShowDescriptions = !isTranscriptChild

  const name = isTranscriptChild
    ? truncateLabel(getFeatureName(feature))
    : truncateLabel(readConfigValue(config, ['labels', 'name'], feature))
  const shouldShowName = /\S/.test(name)

  const description = truncateLabel(
    readConfigValue(config, ['labels', 'description'], feature),
  )
  const shouldShowDescription =
    /\S/.test(description) && effectiveShowDescriptions

  const actualFontHeight = readConfigValue<number>(
    config,
    ['labels', 'fontSize'],
    feature,
  )

  let extraHeightPx = 0
  if (shouldShowName) {
    extraHeightPx += actualFontHeight
  }
  if (shouldShowDescription) {
    extraHeightPx += actualFontHeight
  }

  const isOverlayMode = isTranscriptChild && subfeatureLabels === 'overlay'
  if (!isOverlayMode) {
    layout.totalLayoutHeight = layout.height + extraHeightPx
  }
}
