import { readConfObject } from '@jbrowse/core/configuration'
import { measureText } from '@jbrowse/core/util'

import { readCachedConfig } from './renderConfig'
import { truncateLabel } from './util'

import type { RenderConfigContext } from './renderConfig'
import type { FeatureLayout } from './types'
import type { Feature } from '@jbrowse/core/util'

/**
 * Calculate label dimensions and update layout accordingly.
 */
export function applyLabelDimensions(
  layout: FeatureLayout,
  args: {
    feature: Feature
    configContext: RenderConfigContext
    isNested: boolean
    isTranscriptChild: boolean
  },
): void {
  const { feature, configContext, isNested, isTranscriptChild } = args
  const {
    config,
    showLabels,
    showDescriptions,
    subfeatureLabels,
    fontHeight,
    labelAllowed,
  } = configContext

  const showSubfeatureLabels = subfeatureLabels !== 'none'
  const shouldCalculateLabels =
    labelAllowed && (!isNested || (isTranscriptChild && showSubfeatureLabels))

  if (!shouldCalculateLabels) {
    return
  }

  const effectiveShowLabels = isTranscriptChild ? true : showLabels
  const effectiveShowDescriptions = isTranscriptChild ? false : showDescriptions

  const name = truncateLabel(
    String(readConfObject(config, ['labels', 'name'], { feature }) || ''),
  )
  const shouldShowName = /\S/.test(name) && effectiveShowLabels

  const description = truncateLabel(
    String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    ),
  )
  const shouldShowDescription =
    /\S/.test(description) && effectiveShowDescriptions

  const actualFontHeight = readCachedConfig(
    fontHeight,
    config,
    ['labels', 'fontSize'],
    feature,
  )

  let extraHeightPx = 0
  let maxLabelWidthPx = 0

  if (shouldShowName) {
    extraHeightPx += actualFontHeight
    maxLabelWidthPx = Math.max(
      maxLabelWidthPx,
      measureText(name, actualFontHeight),
    )
  }
  if (shouldShowDescription) {
    extraHeightPx += actualFontHeight
    maxLabelWidthPx = Math.max(
      maxLabelWidthPx,
      measureText(description, actualFontHeight),
    )
  }

  const isOverlayMode = isTranscriptChild && subfeatureLabels === 'overlay'
  if (!isOverlayMode) {
    layout.totalLayoutHeight = layout.height + extraHeightPx
  }

  layout.totalLayoutWidth = Math.max(layout.totalLayoutWidth, maxLabelWidthPx)
}
