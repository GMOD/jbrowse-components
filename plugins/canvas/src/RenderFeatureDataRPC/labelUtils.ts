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

// Reads the config-jexl name/description for a top-level feature.
// Returns undefined for empty/falsy values so callers can use simple truthiness.
export function readFeatureLabels(
  config: DisplayConfig,
  feature: Feature,
): { name: string | undefined; description: string | undefined } {
  const name =
    (readConfigValue(config, ['labels', 'name'], feature)) || undefined
  const description =
    (readConfigValue(config, ['labels', 'description'], feature)) || undefined
  return { name, description }
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
    const { name: configName, description: configDescription } =
      isTranscriptChild
        ? { name: undefined, description: undefined }
        : readFeatureLabels(config, feature)
    const name = isTranscriptChild
      ? truncateLabel(getFeatureName(feature) ?? '')
      : (configName ?? '')
    const description = configDescription ?? ''
    const labelCount =
      (hasVisibleText(name) ? 1 : 0) + (hasVisibleText(description) ? 1 : 0)

    const isOverlayMode = isTranscriptChild && subfeatureLabels === 'overlay'
    if (!isOverlayMode && labelCount > 0) {
      layout.totalLayoutHeight = layout.height + labelCount * LABEL_FONT_SIZE
    }
  }
}
