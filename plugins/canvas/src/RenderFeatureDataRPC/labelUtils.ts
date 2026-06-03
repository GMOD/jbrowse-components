import { LABEL_FONT_SIZE } from './constants.ts'
import { isLabelAllowed, readConfigValue } from './renderConfig.ts'
import { hasVisibleText, truncateLabel } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { FeatureLayout } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

// A label value may be a string, a multi-valued array (e.g. a GFF attribute
// whose value contained unescaped commas, parsed into multiple values), or
// absent. Normalize to a single string so downstream width-measurement and
// truncation always operate on text, never an array.
function toLabelString(value: unknown) {
  if (value === undefined || value === null) {
    return undefined
  }
  const text = Array.isArray(value) ? value.join(',') : String(value)
  return text || undefined
}

export function getFeatureName(feature: Feature): string | undefined {
  // empty-string name falls back to id
  return toLabelString(feature.get('name')) ?? toLabelString(feature.get('id'))
}

// Reads the config-jexl name/description for a top-level feature.
// Returns undefined for empty/falsy values so callers can use simple truthiness.
export function readFeatureLabels(
  config: DisplayConfig,
  feature: Feature,
): { name: string | undefined; description: string | undefined } {
  return {
    name: toLabelString(readConfigValue(config, ['labels', 'name'], feature)),
    description: toLabelString(
      readConfigValue(config, ['labels', 'description'], feature),
    ),
  }
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
