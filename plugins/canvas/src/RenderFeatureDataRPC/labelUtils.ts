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

// Reads a single config-jexl label slot. The labels.name/labels.description
// defaults ARE jexl, so a plugin-registered jexl function only resolves when
// the worker pluginManager's jexl instance is passed (same contract as the
// `mouseover` slot). Returns undefined for empty/falsy values so callers can
// use simple truthiness.
function readFeatureLabel(
  config: DisplayConfig,
  feature: Feature,
  which: 'name' | 'description',
  jexl?: JexlInstance,
) {
  return toLabelString(
    readConfigValueSafe<unknown>(
      config,
      ['labels', which],
      feature,
      jexl,
      undefined,
    ),
  )
}

// Config-jexl name only. Subfeature label paths (mature-protein regions, repeat
// subparts) render a single name line, so evaluating the description slot too
// would waste a jexl eval per feature.
export function readFeatureName(
  config: DisplayConfig,
  feature: Feature,
  jexl?: JexlInstance,
) {
  return readFeatureLabel(config, feature, 'name', jexl)
}

export function readFeatureLabels(
  config: DisplayConfig,
  feature: Feature,
  jexl?: JexlInstance,
): { name: string | undefined; description: string | undefined } {
  return {
    name: readFeatureLabel(config, feature, 'name', jexl),
    description: readFeatureLabel(config, feature, 'description', jexl),
  }
}

// Reserves a label row under a transcript child in `below` mode so stacking
// accounts for the floating name drawn beneath it. Only the transcript-child
// path reserves height (top-level and overlay labels float without reserving);
// the name is the feature's own name/id, never a config-jexl slot, so this pass
// stays jexl-free.
export function applyLabelDimensions(
  layout: FeatureLayout,
  args: {
    feature: Feature
    config: DisplayConfig
    isTranscriptChild: boolean
  },
) {
  const { feature, config, isTranscriptChild } = args
  if (isTranscriptChild && config.subfeatureLabels === 'below') {
    const name = truncateLabel(getFeatureName(feature) ?? '')
    if (hasVisibleText(name)) {
      layout.totalLayoutHeight = layout.height + LABEL_FONT_SIZE
    }
  }
}
