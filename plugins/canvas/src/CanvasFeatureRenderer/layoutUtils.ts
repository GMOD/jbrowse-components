import { readConfObject } from '@jbrowse/core/configuration'

import { createTranscriptFloatingLabel } from './floatingLabels'

import type { FloatingLabelData } from './floatingLabels'
import type { FeatureLayout, SubfeatureInfo } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

export function adjustChildPositions(
  children: FeatureLayout[],
  xOffset: number,
  yOffset: number,
): FeatureLayout[] {
  return children.map(child => ({
    ...child,
    x: child.x + xOffset,
    y: child.y + yOffset,
    children: adjustChildPositions(child.children, xOffset, yOffset),
  }))
}

export function addSubfeaturesToLayoutAndFlatbush({
  layout,
  featureLayout,
  subfeatureCoords,
  subfeatureInfos,
  config,
  subfeatureLabels,
  transcriptTypes,
  labelColor,
  parentTooltip,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  subfeatureLabels: string
  transcriptTypes: string[]
  labelColor: string
  parentTooltip: string
}) {
  const showSubfeatureLabels = subfeatureLabels !== 'none'
  for (const child of featureLayout.children) {
    const childFeature = child.feature
    const childType = childFeature.get('type')
    const isTranscript = transcriptTypes.includes(childType)

    if (!isTranscript) {
      continue
    }

    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')

    const childLeftPx = child.x
    const childRightPx = child.x + child.totalLayoutWidth
    const topPx = child.y
    const bottomPx = child.y + child.totalLayoutHeight
    subfeatureCoords.push(childLeftPx, topPx, childRightPx, bottomPx)

    const displayLabel = String(
      readConfObject(config, 'subfeatureMouseover', {
        feature: childFeature,
      }) || '',
    )

    subfeatureInfos.push({
      featureId: childFeature.id(),
      parentFeatureId: featureLayout.feature.id(),
      displayLabel,
      type: childType,
      leftPx: childLeftPx,
      topPx,
      rightPx: childRightPx,
      bottomPx,
    })

    const floatingLabels: FloatingLabelData[] = []
    if (showSubfeatureLabels) {
      const label = createTranscriptFloatingLabel({
        displayLabel,
        featureHeight: child.height,
        subfeatureLabels,
        color: labelColor,
        parentFeatureId: featureLayout.feature.id(),
        tooltip: parentTooltip,
      })
      if (label) {
        floatingLabels.push(label)
      }
    }

    layout.addRect(
      childFeature.id(),
      childStart,
      childEnd,
      bottomPx - topPx,
      childFeature,
      {
        refName: childFeature.get('refName'),
        ...(showSubfeatureLabels && floatingLabels.length > 0
          ? {
              floatingLabels,
              totalFeatureHeight: child.height,
              totalLayoutWidth: child.totalLayoutWidth,
              actualTopPx: topPx,
              featureWidth: child.width,
              leftPadding: 0,
            }
          : {}),
      },
    )
  }
}
