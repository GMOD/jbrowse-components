import { measureText } from '@jbrowse/core/util'

import {
  LABEL_FONT_SIZE,
  MAX_DESCRIPTION_LABEL_WIDTH_PX,
  MORE_ISOFORMS_FONT_SCALE,
} from './constants.ts'
import { hasVisibleText, truncateLabel, truncateToWidth } from './util.ts'

import type { LabelItem } from './rpcTypes.ts'

// Single constructor for a LabelItem so textWidth is always the measured width
// of `text` at the base size this label DRAWS at — the invariant the
// layout/hit-test reservations rely on (see maxRenderedLabelWidth), since every
// one converts with `renderedTextWidth`, which scales from LABEL_FONT_SIZE.
// `fontSize` is that base size, and only the isoform badge passes anything but
// the default (see MORE_ISOFORMS_FONT_SCALE). relativeY defaults to 0; the main
// thread (labelPositioning) sets the final name→description gap.
function labelItem(
  text: string,
  relativeY = 0,
  fontSize = LABEL_FONT_SIZE,
): LabelItem {
  return {
    text,
    relativeY,
    textWidth: measureText(text, fontSize),
  }
}

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

  // The name→description gap depends on the display mode's label font size,
  // which only the main thread knows, so relativeY stays 0 here and is set in
  // labelPositioning.resolveFeatureLabels.
  const nameLabel = shouldShowLabel ? labelItem(name) : undefined
  const descriptionLabel = shouldShowDescription
    ? labelItem(description)
    : undefined

  return { nameLabel, descriptionLabel }
}

// The isoform badge that rides after a collapsed gene's name: what is missing
// from THIS gene, rather than a track-wide count of what is shown.
//
// Plain ASCII — `measureText`'s width table is Helvetica indexed by char code
// and falls back to an average outside it, so a typographic minus would be
// reserved at a width nothing measured. Through `labelItem` at the size it
// draws at, which is what keeps the packer's reservation and the drawn text
// agreeing across the two sizes (see the invariant there).
//
// Its width is part of the gene's name-row reservation, so the packer asks for
// it at the count it is probing and the committed layout writes the same text
// (see `decideLabelReservations`).
export function createMoreIsoformsLabel(hidden: number, expanded: boolean) {
  return {
    ...labelItem(
      expanded ? 'show fewer' : `+${hidden} more`,
      0,
      LABEL_FONT_SIZE * MORE_ISOFORMS_FONT_SCALE,
    ),
    hidden,
    expanded,
  }
}

export function createTranscriptFloatingLabel({
  displayLabel,
  featureHeight,
  subfeatureLabels,
}: {
  displayLabel: string
  featureHeight: number
  subfeatureLabels: string
}) {
  const isOverlay = subfeatureLabels === 'overlay'

  return {
    // Through `labelItem` like every other label, so the "textWidth is always
    // the measured width of `text` at LABEL_FONT_SIZE" invariant above is one
    // constructor rather than a claim this one also happened to honor. It was
    // spelled out here, `measureText` and all — the only thing it adds is
    // `isOverlay`, which is why it reads as a spread now.
    //
    // `isOverlay` is what the main thread colors by: an overlay label sits on
    // a light backing rect and stays dark, an inline one reads against the
    // track and follows the theme text color (see labelColors).
    ...labelItem(truncateLabel(displayLabel), isOverlay ? -featureHeight : 0),
    isOverlay,
  }
}
