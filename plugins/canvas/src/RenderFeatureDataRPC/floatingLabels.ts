import { measureText } from '@jbrowse/core/util'

import { readConfigValue } from './renderConfig.ts'
import { truncateLabel } from './util.ts'
import { LABEL_FONT_SIZE } from '../LinearBasicDisplay/components/sharedRendererConstants.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { LabelItem } from './rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'
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
  name: string | undefined
  description: string | undefined
}) {
  const name = truncateLabel(rawName ?? '')
  const description = truncateLabel(rawDescription ?? '')

  const shouldShowLabel = /\S/.test(name)
  const shouldShowDescription = /\S/.test(description)

  const fontSize = shouldShowLabel
    ? readConfigValue<number>(config, ['labels', 'fontSize'], feature)
    : 0

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
        relativeY: fontSize,
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
