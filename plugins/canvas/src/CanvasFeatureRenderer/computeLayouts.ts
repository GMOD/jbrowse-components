import { createFeatureFloatingLabels } from './floatingLabels'
import { layoutFeature } from './simpleLayout'
import { readFeatureLabels } from './util'

import type { RenderConfigContext } from './renderConfig'
import type { LayoutRecord } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'
import type { Theme } from '@mui/material'

const yPadding = 5

export function computeLayouts({
  features,
  bpPerPx,
  region,
  config,
  configContext,
  layout,
  theme,
}: {
  features: Map<string, Feature>
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  layout: BaseLayout<unknown>
  theme: Theme
}): LayoutRecord[] {
  const reversed = region.reversed || false
  const layoutRecords: LayoutRecord[] = []

  for (const feature of features.values()) {
    const featureLayout = layoutFeature({
      feature,
      bpPerPx,
      reversed,
      config,
      configContext,
      theme,
    })

    const totalLayoutWidth = featureLayout.totalLayoutWidth
    const totalLayoutHeight = featureLayout.totalLayoutHeight
    const totalFeatureHeight = featureLayout.totalFeatureHeight

    const { name, description } = readFeatureLabels(config, feature)

    const floatingLabels = createFeatureFloatingLabels({
      feature,
      config,
      configContext,
      name,
      description,
      theme,
    })

    const featureStart = feature.get('start')
    const featureEnd = feature.get('end')
    const leftPaddingBp = featureLayout.leftPadding * bpPerPx
    const rightPaddingBp =
      (totalLayoutWidth - featureLayout.width - featureLayout.leftPadding) *
      bpPerPx
    const layoutStart = featureStart - leftPaddingBp
    const layoutEnd = featureEnd + rightPaddingBp

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
