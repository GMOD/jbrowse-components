import { createFeatureFloatingLabels } from './floatingLabels'
import { layoutFeature } from './layoutFeature'

import type { JexlLike, RenderConfigContext } from './renderConfig'
import type { LayoutRecord } from './types'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'
import type { Theme } from '@mui/material'

const yPadding = 5

export function computeLayouts({
  features,
  bpPerPx,
  region,
  configSnapshot,
  configContext,
  layout,
  theme,
  jexl,
}: {
  features: Map<string, Feature>
  bpPerPx: number
  region: Region
  configSnapshot: Record<string, any>
  configContext: RenderConfigContext
  layout: BaseLayout<unknown>
  theme: Theme
  jexl: JexlLike
}): LayoutRecord[] {
  const reversed = region.reversed || false
  const layoutRecords: LayoutRecord[] = []

  for (const feature of features.values()) {
    const featureLayout = layoutFeature({
      feature,
      bpPerPx,
      reversed,
      configSnapshot,
      configContext,
      theme,
      jexl,
    })

    const totalLayoutWidth = featureLayout.totalLayoutWidth
    const totalLayoutHeight = featureLayout.totalLayoutHeight
    const totalFeatureHeight = featureLayout.totalFeatureHeight

    const name = featureLayout.name || ''
    const description = featureLayout.description || ''

    const floatingLabels = createFeatureFloatingLabels({
      feature,
      configSnapshot,
      configContext,
      name,
      description,
      theme,
      jexl,
    })

    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')
    const leftPaddingBp = featureLayout.leftPadding * bpPerPx
    const rightPaddingBp =
      (totalLayoutWidth - featureLayout.width - featureLayout.leftPadding) *
      bpPerPx

    // When reversed, visual left = genomic right, so swap padding allocation
    const layoutStart = reversed
      ? featureStart - rightPaddingBp
      : featureStart - leftPaddingBp
    const layoutEnd = reversed
      ? featureEnd + leftPaddingBp
      : featureEnd + rightPaddingBp

    const topPx = layout.addRect(
      feature.id(),
      layoutStart,
      layoutEnd,
      totalLayoutHeight + yPadding,
      feature,
      {
        label: name,
        description,
        refName: feature.get('refName'),
        floatingLabels,
        totalFeatureHeight,
        totalLayoutWidth,
        featureWidth: featureLayout.width,
        leftPadding: featureLayout.leftPadding,
      },
    )

    if (topPx !== null) {
      layoutRecords.push({
        feature,
        layout: featureLayout,
        topPx,
        label: name,
        description,
      })
    }
  }

  return layoutRecords
}
