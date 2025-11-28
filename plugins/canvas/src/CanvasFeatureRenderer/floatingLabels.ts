import { readConfObject } from '@jbrowse/core/configuration'

import { truncateLabel } from './util'

import type { RenderConfigContext } from './renderConfig'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

export interface FloatingLabelData {
  text: string
  relativeY: number
  color: string
  isOverlay?: boolean
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
  nameColor,
  descriptionColor,
}: {
  feature: Feature
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  nameColor: string
  descriptionColor: string
}): FloatingLabelData[] {
  const { showLabels, showDescriptions, fontHeight } = configContext

  const name = truncateLabel(
    String(readConfObject(config, ['labels', 'name'], { feature }) || ''),
  )
  const description = truncateLabel(
    String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    ),
  )

  const shouldShowLabel = /\S/.test(name) && showLabels
  const shouldShowDescription = /\S/.test(description) && showDescriptions

  if (!shouldShowLabel && !shouldShowDescription) {
    return []
  }

  // Only re-read fontHeight if it's a callback (feature-dependent)
  const actualFontHeight =
    fontHeight ??
    (readConfObject(config, ['labels', 'fontSize'], { feature }) as number)

  const floatingLabels: FloatingLabelData[] = []

  if (shouldShowLabel && shouldShowDescription) {
    floatingLabels.push(
      {
        text: name,
        relativeY: 0,
        color: nameColor,
      },
      {
        text: description,
        relativeY: actualFontHeight,
        color: descriptionColor,
      },
    )
  } else if (shouldShowLabel) {
    floatingLabels.push({
      text: name,
      relativeY: 0,
      color: nameColor,
    })
  } else if (shouldShowDescription) {
    floatingLabels.push({
      text: description,
      relativeY: 0,
      color: descriptionColor,
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
  transcriptName,
  featureHeight,
  subfeatureLabelPosition,
  color,
}: {
  transcriptName: string
  featureHeight: number
  subfeatureLabelPosition: string
  color: string
}): FloatingLabelData | null {
  if (!transcriptName) {
    return null
  }

  const truncatedName = truncateLabel(transcriptName)

  // For 'overlay' mode, position label at top of feature (negative relativeY)
  // For 'below' mode, position label at bottom of feature (relativeY = 0)
  // The label Y formula is: featureTop + totalFeatureHeight + relativeY
  // For overlay: we want featureTop + 2, so relativeY = 2 - totalFeatureHeight
  const isOverlay = subfeatureLabelPosition === 'overlay'
  const relativeY = isOverlay ? 2 - featureHeight : 0

  return {
    text: truncatedName,
    relativeY,
    color,
    isOverlay,
  }
}
