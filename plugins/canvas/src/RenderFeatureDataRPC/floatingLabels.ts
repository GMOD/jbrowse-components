import { measureText } from '@jbrowse/core/util'

import { LABEL_FONT_SIZE, MAX_DESCRIPTION_LABEL_WIDTH_PX } from './constants.ts'
import { hasVisibleText, truncateLabel, truncateToWidth } from './util.ts'

import type { LabelItem } from './rpcTypes.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'

export function createFeatureFloatingLabels({
  name: rawName,
  description: rawDescription,
  theme,
}: {
  name: string | undefined
  description: string | undefined
  theme: Theme
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
        color: theme.palette.text.primary,
        textWidth: measureText(name, LABEL_FONT_SIZE),
      }
    : undefined

  const descriptionLabel: LabelItem | undefined = shouldShowDescription
    ? {
        text: description,
        // The name→description gap depends on the display mode's label font
        // size, which only the main thread knows, so it's positioned there
        // (labelPositioning.resolveFeatureLabels), not baked in here.
        relativeY: 0,
        color: theme.palette.featureDescription,
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
  theme,
}: {
  displayLabel: string
  featureHeight: number
  subfeatureLabels: string
  parentFeatureId: string
  theme: Theme
}) {
  const truncatedName = truncateLabel(displayLabel)

  const isOverlay = subfeatureLabels === 'overlay'
  const relativeY = isOverlay ? -featureHeight : 0

  return {
    subfeatureLabel: {
      text: truncatedName,
      relativeY,
      // overlay labels sit on a light backing rect, so keep them dark; inline
      // ones read against the track and follow the theme text color
      color: isOverlay
        ? theme.palette.common.black
        : theme.palette.text.primary,
      textWidth: measureText(truncatedName, LABEL_FONT_SIZE),
      isOverlay,
    },
    parentFeatureId,
  }
}
