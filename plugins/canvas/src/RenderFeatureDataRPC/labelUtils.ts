import { measureText } from '@jbrowse/core/util'

import { readConfigValue } from './renderConfig.ts'
import { truncateLabel } from './util.ts'

import type { RenderConfigContext } from './renderConfig.ts'
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
    configContext: RenderConfigContext
    isNested: boolean
    isTranscriptChild: boolean
  },
): void {
  const { feature, configContext, isNested, isTranscriptChild } = args
  const { config, subfeatureLabels, labelAllowed } = configContext

  const showSubfeatureLabels = subfeatureLabels !== 'none'
  const shouldCalculateLabels =
    labelAllowed && (!isNested || (isTranscriptChild && showSubfeatureLabels))

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
  let maxLabelWidthPx = 0

  if (shouldShowName) {
    extraHeightPx += actualFontHeight
    maxLabelWidthPx = Math.max(
      maxLabelWidthPx,
      measureText(name, actualFontHeight),
    )
  }
  if (shouldShowDescription) {
    extraHeightPx += actualFontHeight
    maxLabelWidthPx = Math.max(
      maxLabelWidthPx,
      measureText(description, actualFontHeight),
    )
  }

  const isOverlayMode = isTranscriptChild && subfeatureLabels === 'overlay'
  if (!isOverlayMode) {
    layout.totalLayoutHeight = layout.height + extraHeightPx
  }

  layout.totalLayoutWidth = Math.max(layout.totalLayoutWidth, maxLabelWidthPx)
}
