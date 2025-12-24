import { readStaticConfObject } from '@jbrowse/core/configuration'

import { createTranscriptFloatingLabel } from './floatingLabels'

import type { JexlLike } from './renderConfig'
import type { FloatingLabelData } from './floatingLabels'
import type { FeatureLayout, SubfeatureInfo } from './types'
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
  configSnapshot,
  jexl,
  subfeatureLabels,
  transcriptTypes,
  labelColor,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  configSnapshot: Record<string, any>
  jexl: JexlLike
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

    const displayLabel = String(
      readStaticConfObject(
        configSnapshot,
        'subfeatureMouseover',
        { feature: childFeature },
        jexl,
      ) || '',
    )

    subfeatureInfos.push({
      displayLabel,
      type: childType,
    })

    const floatingLabels: FloatingLabelData[] = []
    if (showSubfeatureLabels) {
      const label = createTranscriptFloatingLabel({
        displayLabel,
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
              featureWidth: child.width,
              leftPadding: 0,
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
