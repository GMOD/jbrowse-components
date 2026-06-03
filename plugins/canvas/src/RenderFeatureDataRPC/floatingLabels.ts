import { measureText } from '@jbrowse/core/util'

import { LABEL_FONT_SIZE, MAX_DESCRIPTION_LABEL_WIDTH_PX } from './constants.ts'
import { hasVisibleText, truncateLabel, truncateToWidth } from './util.ts'

import type { LabelItem } from './rpcTypes.ts'

const FEATURE_NAME_COLOR = 'black'
const FEATURE_DESCRIPTION_COLOR = 'blue'

export function createFeatureFloatingLabels({
  name: rawName,
  description: rawDescription,
}: {
  name: string | undefined
  description: string | undefined
}) {
  const name = truncateLabel(rawName ?? '')
  const description = truncateToWidth(
    rawDescription ?? '',
    MAX_DESCRIPTION_LABEL_WIDTH_PX,
    LABEL_FONT_SIZE,
  )

  const shouldShowLabel = hasVisibleText(name)
  const shouldShowDescription = hasVisibleText(description)

  const nameLabel: LabelItem | undefined = shouldShowLabel
    ? {
        text: name,
        relativeY: 0,
        color: FEATURE_NAME_COLOR,
        textWidth: measureText(name, LABEL_FONT_SIZE),
      }
    : undefined

  const descriptionLabel: LabelItem | undefined = shouldShowDescription
    ? {
        text: description,
        relativeY: shouldShowLabel ? LABEL_FONT_SIZE : 0,
        color: FEATURE_DESCRIPTION_COLOR,
        textWidth: measureText(description, LABEL_FONT_SIZE),
      }
    : undefined

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
  const truncatedName = truncateLabel(displayLabel)

  const isOverlay = subfeatureLabels === 'overlay'
  const relativeY = isOverlay ? -featureHeight : 0

  return {
    subfeatureLabel: {
      text: truncatedName,
      relativeY,
      color: FEATURE_NAME_COLOR,
      textWidth: measureText(truncatedName, LABEL_FONT_SIZE),
      isOverlay,
      tooltip,
    },
    parentFeatureId,
  }
}
