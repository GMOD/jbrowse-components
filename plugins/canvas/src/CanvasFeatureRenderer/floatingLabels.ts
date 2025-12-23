import { readConfObject } from '@jbrowse/core/configuration'
import { measureText } from '@jbrowse/core/util'

import { buildFeatureTooltip, readLabelColors, truncateLabel } from './util'

import type { RenderConfigContext } from './renderConfig'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'
import type { Theme } from '@mui/material'

const FLOATING_LABEL_FONT_SIZE = 11

export interface FloatingLabelData {
  text: string
  relativeY: number
  color: string
  textWidth: number
  isOverlay?: boolean
  tooltip?: string
}

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
  name: rawName,
  description: rawDescription,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  name: string
  description: string
  theme: Theme
}): FloatingLabelData[] {
  const { showLabels, showDescriptions, fontHeight } = configContext

  const name = truncateLabel(rawName)
  const description = truncateLabel(rawDescription)
  const { nameColor, descriptionColor } = readLabelColors(config, feature, theme)

  const shouldShowLabel = /\S/.test(name) && showLabels
  const shouldShowDescription = /\S/.test(description) && showDescriptions

  if (!shouldShowLabel && !shouldShowDescription) {
    return []
  }

  const actualFontHeight = readConfObject(
    config,
    ['labels', 'fontSize'],
    { feature, theme },
  ) as number

  const floatingLabels: FloatingLabelData[] = []

  // Build tooltip using shared function (same as CanvasFeatureRendering)
  const tooltip = buildFeatureTooltip({
    mouseOver: feature.get('_mouseOver') as string | undefined,
    label: rawName,
    description: rawDescription,
  })

  if (shouldShowLabel) {
    floatingLabels.push({
      text: name,
      relativeY: 0,
      color: nameColor,
      textWidth: measureText(name, FLOATING_LABEL_FONT_SIZE),
      tooltip,
    })
  }

  if (shouldShowDescription) {
    floatingLabels.push({
      text: description,
      relativeY: shouldShowLabel ? actualFontHeight : 0,
      color: descriptionColor,
      textWidth: measureText(description, FLOATING_LABEL_FONT_SIZE),
      tooltip,
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
}: {
  displayLabel: string
  featureHeight: number
  subfeatureLabels: string
  color: string
}): FloatingLabelData | null {
  if (!displayLabel) {
    return null
  }

  const truncatedName = truncateLabel(displayLabel)

  // For 'overlay' mode, position label at top of feature (negative relativeY)
  // For 'below' mode, position label at bottom of feature (relativeY = 0)
  // The label Y formula is: featureTop + totalFeatureHeight + relativeY
  // For overlay: we want featureTop + 2, so relativeY = 2 - totalFeatureHeight
  const isOverlay = subfeatureLabels === 'overlay'
  const relativeY = isOverlay ? 2 - featureHeight : 0

  return {
    text: truncatedName,
    relativeY,
    color,
    textWidth: measureText(truncatedName, FLOATING_LABEL_FONT_SIZE),
    isOverlay,
    tooltip: buildFeatureTooltip({ label: displayLabel }),
  }
}
