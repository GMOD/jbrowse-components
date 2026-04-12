import { measureText } from '@jbrowse/core/util'

import { readConfigValue } from './renderConfig.ts'
import { truncateLabel } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { LabelItem } from './rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

const FLOATING_LABEL_FONT_SIZE = 11

export function createFeatureFloatingLabels({
  feature,
  config,
  nameColor,
  descriptionColor,
  name: rawName,
  description: rawDescription,
}: {
  feature: Feature
  config: DisplayConfig
  nameColor: string
  descriptionColor: string
  name: string
  description: string
}) {
  const name = truncateLabel(rawName)
  const description = truncateLabel(rawDescription)

  const shouldShowLabel = /\S/.test(name)
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
    currentY += readConfigValue<number>(config, ['labels', 'fontSize'], feature)
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
