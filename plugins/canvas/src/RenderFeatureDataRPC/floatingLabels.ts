import { measureText } from '@jbrowse/core/util'

import { readConfigValue } from './renderConfig.ts'
import { truncateLabel } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { LabelItem } from './rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

const FLOATING_LABEL_FONT_SIZE = 11
const FEATURE_NAME_COLOR = 'black'
const FEATURE_DESCRIPTION_COLOR = 'blue'

export function createFeatureFloatingLabels({
  feature,
  config,
  name: rawName,
  description: rawDescription,
}: {
  feature: Feature
  config: DisplayConfig
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
      color: FEATURE_NAME_COLOR,
      textWidth: measureText(name, FLOATING_LABEL_FONT_SIZE),
    }
    currentY += readConfigValue<number>(config, ['labels', 'fontSize'], feature)
  }

  if (shouldShowDescription) {
    descriptionLabel = {
      text: description,
      relativeY: currentY,
      color: FEATURE_DESCRIPTION_COLOR,
      textWidth: measureText(description, FLOATING_LABEL_FONT_SIZE),
    }
  }

  return { nameLabel, descriptionLabel }
}

export function createTranscriptFloatingLabel({
  displayLabel,
  featureHeight,
  subfeatureLabels,
  parentFeatureId,
  tooltip,
}: {
  displayLabel: string
  featureHeight: number
  subfeatureLabels: string
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
      color: FEATURE_NAME_COLOR,
      textWidth: measureText(truncatedName, FLOATING_LABEL_FONT_SIZE),
      isOverlay,
      tooltip,
    },
    parentFeatureId,
  }
}
