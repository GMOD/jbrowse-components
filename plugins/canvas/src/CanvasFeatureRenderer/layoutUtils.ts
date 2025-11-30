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
  parentFeatureId,
  subfeatureCoords,
  subfeatureInfos,
  config,
  subfeatureLabels,
  transcriptTypes,
  labelColor,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  parentFeatureId: string
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  subfeatureLabels: string
  transcriptTypes: string[]
  labelColor: string
}) {
  const showSubfeatureLabels = subfeatureLabels !== 'none'
  for (const child of featureLayout.children) {
    const childFeature = child.feature
    const childType = childFeature.get('type')
    const isTranscript = transcriptTypes.includes(childType)

    if (!isTranscript) {
      addNestedSubfeaturesToLayout({ layout, featureLayout: child })
      continue
    }

    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')

    const childLeftPx = child.x
    const childRightPx = child.x + child.totalLayoutWidth
    const topPx = child.y
    const bottomPx = child.y + child.totalLayoutHeight
    subfeatureCoords.push(childLeftPx, topPx, childRightPx, bottomPx)

    const transcriptName = String(
      readConfObject(config, ['labels', 'name'], { feature: childFeature }) ||
        '',
    )

    subfeatureInfos.push({
      subfeatureId: childFeature.id(),
      parentFeatureId,
      type: childType,
      name: transcriptName,
    })

    const floatingLabels: FloatingLabelData[] = []
    if (showSubfeatureLabels) {
      const label = createTranscriptFloatingLabel({
        transcriptName,
        featureHeight: child.height,
        subfeatureLabels,
        color: labelColor,
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
            }
          : {}),
      },
    )

    if (child.children.length > 0) {
      addNestedSubfeaturesToLayout({ layout, featureLayout: child })
    }
  }
}

export function addNestedSubfeaturesToLayout({
  layout,
  featureLayout,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
}) {
  for (const child of featureLayout.children) {
    const childFeature = child.feature
    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')

    layout.addRect(
      childFeature.id(),
      childStart,
      childEnd,
      child.height,
      childFeature,
      {
        refName: childFeature.get('refName'),
      },
    )

    if (child.children.length > 0) {
      addNestedSubfeaturesToLayout({ layout, featureLayout: child })
    }
  }
}
