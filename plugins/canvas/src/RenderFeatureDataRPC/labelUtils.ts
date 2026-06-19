import { LABEL_FONT_SIZE } from './constants.ts'
import { readConfigValueSafe } from './renderConfig.ts'
import { hasVisibleText, truncateLabel } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { FeatureLayout } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

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

// Reads the config-jexl name/description for a top-level feature. The
// labels.name/labels.description defaults ARE jexl, so a plugin-registered jexl
// function only resolves when the worker pluginManager's jexl instance is
// passed (same contract as the `mouseover` slot).
// Returns undefined for empty/falsy values so callers can use simple truthiness.
export function readFeatureLabels(
  config: DisplayConfig,
  feature: Feature,
  jexl?: JexlInstance,
): { name: string | undefined; description: string | undefined } {
  return {
    name: toLabelString(
      readConfigValueSafe<unknown>(
        config,
        ['labels', 'name'],
        feature,
        jexl,
        undefined,
      ),
    ),
    description: toLabelString(
      readConfigValueSafe<unknown>(
        config,
        ['labels', 'description'],
        feature,
        jexl,
        undefined,
      ),
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
    jexl?: JexlInstance
  },
) {
  const { feature, config, isNested, isTranscriptChild, jexl } = args
  const { subfeatureLabels } = config
  const showSubfeatureLabels = subfeatureLabels !== 'none'

  if (!isNested || (isTranscriptChild && showSubfeatureLabels)) {
    const { name: configName, description: configDescription } =
      isTranscriptChild
        ? { name: undefined, description: undefined }
        : readFeatureLabels(config, feature, jexl)
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
