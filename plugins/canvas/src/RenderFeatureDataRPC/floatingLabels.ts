import { measureText } from '@jbrowse/core/util'

import {
  LABEL_FONT_SIZE,
  MAX_DESCRIPTION_LABEL_WIDTH_PX,
  MORE_ISOFORMS_FONT_SCALE,
} from './constants.ts'
import { hasVisibleText, truncateLabel, truncateToWidth } from './util.ts'

import type { SubfeatureLabels } from './displayModes.ts'
import type {
  FeatureDataResult,
  FloatingLabelsDataMap,
  LabelItem,
  LabelKinds,
} from './rpcTypes.ts'

// Single constructor for a LabelItem, so textWidth is always the measured width
// of `text` at the base size the label DRAWS at — the invariant every layout
// and hit-test reservation converts from.
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
  // which only the main thread knows, so relativeY stays 0 here.
  const nameLabel = shouldShowLabel ? labelItem(name) : undefined
  const descriptionLabel = shouldShowDescription
    ? labelItem(description)
    : undefined

  return { nameLabel, descriptionLabel }
}

// Plain ASCII text: `measureText`'s width table is Helvetica indexed by char
// code and falls back to an average outside it, so a typographic minus would be
// reserved at a width nothing measured.
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
    // `isOverlay` is what the main thread colors by: an overlay label sits on
    // a light backing rect and stays dark, an inline one follows the theme text
    // color.
    ...labelItem(truncateLabel(displayLabel), isOverlay ? -featureHeight : 0),
    isOverlay,
  }
}

export function labelKindsOf(labels: FloatingLabelsDataMap): LabelKinds {
  const kinds = { name: false, description: false, subfeature: false }
  for (const label of labels.values()) {
    kinds.name ||= !!label.nameLabel
    kinds.description ||= !!label.descriptionLabel
    kinds.subfeature ||= !!label.subfeatureLabel
  }
  return kinds
}

/**
 * Whether subfeature labels sit on their bodies in these regions. `auto`
 * overlays only what the worker labeled, cleavage products alone, so a track
 * with none keeps the unlabeled fit floor. A fixture without `labelKinds` is
 * tallied from its labels.
 */
export function overlaysSubfeatureLabels(
  mode: SubfeatureLabels,
  regions: Iterable<
    Pick<FeatureDataResult, 'labelKinds' | 'floatingLabelsData'>
  >,
) {
  if (mode !== 'auto') {
    return mode === 'overlay'
  }
  for (const { labelKinds, floatingLabelsData } of regions) {
    if ((labelKinds ?? labelKindsOf(floatingLabelsData)).subfeature) {
      return true
    }
  }
  return false
}
