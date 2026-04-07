import { readConfObject } from '@jbrowse/core/configuration'
import { measureText } from '@jbrowse/core/util'

import { readCachedConfig } from './renderConfig.ts'
import { truncateLabel } from './util.ts'

import type { RenderConfigContext } from './renderConfig.ts'
import type { FeatureLayout } from './types.ts'
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
  const { config, subfeatureLabels, fontHeight, labelAllowed } = configContext

  const showSubfeatureLabels = subfeatureLabels !== 'none'
  const shouldCalculateLabels =
    labelAllowed && (!isNested || (isTranscriptChild && showSubfeatureLabels))

  if (!shouldCalculateLabels) {
    return
  }

  const effectiveShowDescriptions = !isTranscriptChild

  // for transcript children, use the feature name directly (matching
  // createTranscriptFloatingLabel) instead of the config callback which may
  // be empty in the RPC worker's mock config
  const name = isTranscriptChild
    ? truncateLabel(
        String(feature.get('name') || feature.get('id') || ''),
      )
    : truncateLabel(
        String(readConfObject(config, ['labels', 'name'], { feature }) || ''),
      )
  const shouldShowName = /\S/.test(name)

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
