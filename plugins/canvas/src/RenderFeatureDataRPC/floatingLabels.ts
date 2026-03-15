import { measureText } from '@jbrowse/core/util'

import { readCachedConfig } from './renderConfig.ts'
import { truncateLabel } from './util.ts'

import type { RenderConfigContext } from './renderConfig.ts'
import type { LabelItem } from './rpcTypes.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

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
}) {
  const { showLabels, fontHeight } = configContext

  const name = truncateLabel(rawName)
  const description = truncateLabel(rawDescription)

  const shouldShowLabel = /\S/.test(name) && showLabels
  const shouldShowDescription = /\S/.test(description)

  let nameLabel: LabelItem | undefined
  let descriptionLabel: LabelItem | undefined
  let currentY = 0

  if (shouldShowLabel) {
    nameLabel = {
      text: name,
      relativeY: currentY,
      color: nameColor,
      textWidth: measureText(name, FLOATING_LABEL_FONT_SIZE),
    }
    currentY += readCachedConfig(
      fontHeight,
      config,
      ['labels', 'fontSize'],
      feature,
    )
  }

  if (shouldShowDescription) {
    descriptionLabel = {
      text: description,
      relativeY: currentY,
      color: descriptionColor,
      textWidth: measureText(description, FLOATING_LABEL_FONT_SIZE),
    }
  }

  return { nameLabel, descriptionLabel }
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
  tooltip,
}: {
  displayLabel: string
  featureHeight: number
  subfeatureLabels: string
  color: string
  parentFeatureId: string
  subfeatureId: string
  tooltip: string
}) {
  if (!displayLabel) {
    return undefined
  }

  const truncatedName = truncateLabel(displayLabel)

  const isOverlay = subfeatureLabels === 'overlay'
  const relativeY = isOverlay ? -featureHeight : 0

  return {
    subfeatureLabel: {
      text: truncatedName,
      relativeY,
      color,
      textWidth: measureText(truncatedName, FLOATING_LABEL_FONT_SIZE),
      isOverlay,
      tooltip,
    },
    parentFeatureId,
  }
}
