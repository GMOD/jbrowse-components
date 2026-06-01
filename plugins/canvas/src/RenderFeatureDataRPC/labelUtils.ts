import { LABEL_FONT_SIZE } from './constants.ts'
import { isLabelAllowed, readConfigValue } from './renderConfig.ts'
import { hasVisibleText, truncateLabel } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { FeatureLayout } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

export function getFeatureName(feature: Feature): string | undefined {
  // || intentional: empty-string name should fall back to id
  const v = feature.get('name') || feature.get('id')
  return v || undefined
}

export function getFeatureDescription(feature: Feature): string | undefined {
  return (
    (feature.get('note') as string | undefined) ??
    (feature.get('description') as string | undefined)
  )
}

export function applyLabelDimensions(
  layout: FeatureLayout,
  args: {
    feature: Feature
    config: DisplayConfig
    isNested: boolean
    isTranscriptChild: boolean
  },
) {
  const { feature, config, isNested, isTranscriptChild } = args
  const { subfeatureLabels } = config
  const showSubfeatureLabels = subfeatureLabels !== 'none'

  if (
    isLabelAllowed(config) &&
    (!isNested || (isTranscriptChild && showSubfeatureLabels))
  ) {
    const name = isTranscriptChild
      ? truncateLabel(getFeatureName(feature) ?? '')
      : truncateLabel(readConfigValue(config, ['labels', 'name'], feature))
    const description = isTranscriptChild
      ? ''
      : truncateLabel(
          readConfigValue(config, ['labels', 'description'], feature),
        )
    const labelCount =
      (hasVisibleText(name) ? 1 : 0) + (hasVisibleText(description) ? 1 : 0)

    const isOverlayMode = isTranscriptChild && subfeatureLabels === 'overlay'
    if (!isOverlayMode && labelCount > 0) {
      layout.totalLayoutHeight = layout.height + labelCount * LABEL_FONT_SIZE
    }
  }
}
