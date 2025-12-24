import { readConfObject } from '@jbrowse/core/configuration'

import { createFeatureFloatingLabels } from './floatingLabels'
import { layoutFeature } from './layoutFeature'

import type { RenderConfigContext } from './renderConfig'
import type { LayoutRecord } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

const yPadding = 5

export function layoutFeatures({
  features,
  bpPerPx,
  region,
  config,
  configContext,
  layout,
}: {
  features: Map<string, Feature>
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  layout: BaseLayout<unknown>
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
    })

    const totalLayoutWidth = featureLayout.totalLayoutWidth
    const totalLayoutHeight = featureLayout.totalLayoutHeight
    const totalFeatureHeight = featureLayout.totalFeatureHeight

    const name = String(
      readConfObject(config, ['labels', 'name'], { feature }) || '',
    )
    const description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )

    const floatingLabels = createFeatureFloatingLabels({
      feature,
      config,
      configContext,
      nameColor: 'black',
      descriptionColor: 'blue',
      name,
      description,
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
