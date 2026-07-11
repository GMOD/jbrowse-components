import { measureText } from '@jbrowse/core/util'

import { LABEL_FONT_SIZE, MAX_DESCRIPTION_LABEL_WIDTH_PX } from './constants.ts'
import { hasVisibleText, truncateLabel, truncateToWidth } from './util.ts'

import type { LabelItem } from './rpcTypes.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'

// Single constructor for a LabelItem so textWidth is always the measured width
// of `text` at LABEL_FONT_SIZE — the invariant the layout/hit-test reservations
// rely on (see maxLabelTextWidth). relativeY defaults to 0; the main thread
// (labelPositioning) sets the final name→description gap.
function labelItem(text: string, color: string, relativeY = 0): LabelItem {
  return {
    text,
    relativeY,
    color,
    textWidth: measureText(text, LABEL_FONT_SIZE),
  }
}

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

  // The name→description gap depends on the display mode's label font size,
  // which only the main thread knows, so relativeY stays 0 here and is set in
  // labelPositioning.resolveFeatureLabels.
  const nameLabel = shouldShowLabel
    ? labelItem(name, theme.palette.text.primary)
    : undefined
  const descriptionLabel = shouldShowDescription
    ? labelItem(description, theme.palette.featureDescription)
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
