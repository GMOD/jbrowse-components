import { measureText } from '@jbrowse/core/util'

import { LABEL_FONT_SIZE, MAX_DESCRIPTION_LABEL_WIDTH_PX } from './constants.ts'
import { hasVisibleText, truncateLabel, truncateToWidth } from './util.ts'

import type { LabelItem } from './rpcTypes.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'

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
  palette,
}: {
  name: string | undefined
  description: string | undefined
  palette: JBrowsePalette
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
    ? labelItem(name, palette.text.primary)
    : undefined
  const descriptionLabel = shouldShowDescription
    ? labelItem(description, palette.featureDescription)
    : undefined

  return { nameLabel, descriptionLabel }
}

// The isoform badge that rides after a collapsed gene's name: what is missing
// from this gene, on this gene, rather than a track-wide count of what is shown.
//
// Reads "+3 more" collapsed and "− fewer" expanded — the second is not a count,
// because the number it would name is the number of isoforms now on screen,
// which is the one thing the reader can already see.
//
// Through `labelItem` like every other label, so the packer's width reservation
// and the drawn text agree by construction (see the invariant there).
export function createMoreIsoformsLabel({
  overflow,
  palette,
}: {
  overflow: { hidden: number; expanded: boolean }
  palette: JBrowsePalette
}) {
  const { hidden, expanded } = overflow
  return hidden > 0
    ? {
        ...labelItem(
          expanded ? '− fewer' : `+${hidden} more`,
          palette.primary.main,
        ),
        expanded,
      }
    : undefined
}

export function createTranscriptFloatingLabel({
  displayLabel,
  featureHeight,
  subfeatureLabels,
  parentFeatureId,
  palette,
}: {
  displayLabel: string
  featureHeight: number
  subfeatureLabels: string
  parentFeatureId: string
  palette: JBrowsePalette
}) {
  const truncatedName = truncateLabel(displayLabel)

  const isOverlay = subfeatureLabels === 'overlay'
  const relativeY = isOverlay ? -featureHeight : 0

  return {
    subfeatureLabel: {
      // Through `labelItem` like every other label, so the "textWidth is always
      // the measured width of `text` at LABEL_FONT_SIZE" invariant above is one
      // constructor rather than a claim this one also happened to honor. It was
      // spelled out here, `measureText` and all — the only thing it adds is
      // `isOverlay`, which is why it reads as a spread now.
      //
      // overlay labels sit on a light backing rect, so keep them dark; inline
      // ones read against the track and follow the theme text color
      ...labelItem(
        truncatedName,
        isOverlay ? palette.common.black : palette.text.primary,
        relativeY,
      ),
      isOverlay,
    },
    parentFeatureId,
  }
}
