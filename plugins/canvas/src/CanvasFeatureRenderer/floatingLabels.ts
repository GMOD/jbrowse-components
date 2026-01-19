import { measureText } from '@jbrowse/core/util'

import { readCachedConfig } from './renderConfig.ts'
import { truncateLabel } from './util.ts'

import type { RenderConfigContext } from './renderConfig.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { FloatingLabelData } from '@jbrowse/plugin-linear-genome-view'

const FLOATING_LABEL_FONT_SIZE = 11

/**
 * Create floating labels for a top-level feature (gene, etc.)
 *
 * Labels are positioned relative to the feature's visual bottom.
 * relativeY = 0 means the label starts at the feature's bottom edge.
 */
export function createFeatureFloatingLabels({
  feature,
  config,
  configContext,
  nameColor,
  descriptionColor,
  name: rawName,
  description: rawDescription,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  nameColor: string
  descriptionColor: string
  name: string
  description: string
}): FloatingLabelData[] {
  const { showLabels, showDescriptions, fontHeight } = configContext

  const name = truncateLabel(rawName)
  const description = truncateLabel(rawDescription)

  const shouldShowLabel = /\S/.test(name) && showLabels
  const shouldShowDescription = /\S/.test(description) && showDescriptions

  if (!shouldShowLabel && !shouldShowDescription) {
    return []
  }

  const actualFontHeight = readCachedConfig(
    fontHeight,
    config,
    ['labels', 'fontSize'],
    feature,
  )

  const floatingLabels: FloatingLabelData[] = []

  if (shouldShowLabel && shouldShowDescription) {
    floatingLabels.push(
      {
        text: name,
        relativeY: 0,
        color: nameColor,
        textWidth: measureText(name, FLOATING_LABEL_FONT_SIZE),
      },
      {
        text: description,
        relativeY: actualFontHeight,
        color: descriptionColor,
        textWidth: measureText(description, FLOATING_LABEL_FONT_SIZE),
        isDescription: true,
      },
    )
  } else if (shouldShowLabel) {
    floatingLabels.push({
      text: name,
      relativeY: 0,
      color: nameColor,
      textWidth: measureText(name, FLOATING_LABEL_FONT_SIZE),
    })
  } else if (shouldShowDescription) {
    floatingLabels.push({
      text: description,
      relativeY: 0,
      color: descriptionColor,
      textWidth: measureText(description, FLOATING_LABEL_FONT_SIZE),
      isDescription: true,
    })
  }

  return floatingLabels
}

/**
 * Create floating labels for a transcript subfeature
 *
 * For 'overlay' mode, labels are positioned at the top of the feature.
 * For 'below' mode, labels are positioned at the bottom.
 */
export function createTranscriptFloatingLabel({
  displayLabel,
  featureHeight,
  subfeatureLabels,
  color,
  parentFeatureId,
  subfeatureId,
  tooltip,
}: {
  displayLabel: string
  featureHeight: number
  subfeatureLabels: string
  color: string
  parentFeatureId: string
  subfeatureId: string
  tooltip: string
}): FloatingLabelData | null {
  if (!displayLabel) {
    return null
  }

  const truncatedName = truncateLabel(displayLabel)

  // For 'overlay' mode, position label at top of feature (negative relativeY)
  // For 'below' mode, position label at bottom of feature (relativeY = 0)
  // The label Y formula is: featureTop + featureHeight + relativeY
  // For overlay: we want featureTop + 2, so relativeY = 2 - featureHeight
  const isOverlay = subfeatureLabels === 'overlay'
  const relativeY = isOverlay ? 2 - featureHeight : 0

  return {
    text: truncatedName,
    relativeY,
    color,
    textWidth: measureText(truncatedName, FLOATING_LABEL_FONT_SIZE),
    isOverlay,
    parentFeatureId,
    subfeatureId,
    tooltip,
  }
}

export { type FloatingLabelData } from '@jbrowse/plugin-linear-genome-view'
