import { readConfObject } from '@jbrowse/core/configuration'

import { createTranscriptFloatingLabel } from './floatingLabels'

import type { FloatingLabelData } from './floatingLabels'
import type { FeatureLayout, SubfeatureInfo } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseLayout } from '@jbrowse/core/util/layouts'

/**
 * Recursively adjust child layout positions to absolute coordinates
 */
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

/**
 * Add transcript children of a gene to secondary flatbush and layout.
 *
 * This provides extra info (transcript ID) when hovering over transcripts.
 * The parent gene's bounding box is already in the primary flatbush for highlighting.
 */
export function addSubfeaturesToLayoutAndFlatbush({
  layout,
  featureLayout,
  parentFeatureId,
  subfeatureCoords,
  subfeatureInfos,
  config,
  showSubfeatureLabels,
  subfeatureLabelPosition,
  transcriptTypes,
  labelColor,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  parentFeatureId: string
  subfeatureCoords: number[]
  subfeatureInfos: SubfeatureInfo[]
  config: AnyConfigurationModel
  showSubfeatureLabels: boolean
  subfeatureLabelPosition: string
  transcriptTypes: string[]
  labelColor: string
}) {
  for (const child of featureLayout.children) {
    const childFeature = child.feature
    if (!childFeature) {
      continue
    }

    const childType = childFeature.get('type')
    const isTranscript = transcriptTypes.includes(childType)

    // Only add transcript-type children to secondary flatbush
    if (!isTranscript) {
      // Non-transcript children just get stored in layout
      addNestedSubfeaturesToLayout({ layout, featureLayout: child, config })
      continue
    }

    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')

    // Add the transcript's bounding box to secondary flatbush
    // Use totalLayoutWidth and totalLayoutHeight to include label extent
    const childLeftPx = child.x
    const childRightPx = child.x + child.totalLayoutWidth
    const topPx = child.y
    const bottomPx = child.y + child.totalLayoutHeight
    subfeatureCoords.push(childLeftPx, topPx, childRightPx, bottomPx)

    // Get name for subfeature info (for tooltips/details)
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

    // Create floatingLabels for transcript when showSubfeatureLabels is enabled
    const floatingLabels: FloatingLabelData[] = []
    if (showSubfeatureLabels) {
      const label = createTranscriptFloatingLabel({
        transcriptName,
        featureHeight: child.height,
        subfeatureLabelPosition,
        color: labelColor,
      })
      if (label) {
        floatingLabels.push(label)
      }
    }

    // Store child feature using addRect so CoreGetFeatureDetails can access it
    // Note: We store the actual visual Y position (topPx) in serializableData because
    // the layout's collision detection places rects at different positions than
    // where they're visually rendered within the parent gene glyph
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

    // Store layout/feature data for nested children (CDS, UTR, exons)
    if (child.children.length > 0) {
      addNestedSubfeaturesToLayout({ layout, featureLayout: child, config })
    }
  }
}

/**
 * Recursively add deeply nested children (CDS, UTR, exons) to layout only.
 *
 * They won't be separate mouseover targets, but their data is available
 * for CoreGetFeatureDetails.
 */
export function addNestedSubfeaturesToLayout({
  layout,
  featureLayout,
  config,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  config: AnyConfigurationModel
}) {
  for (const child of featureLayout.children) {
    const childFeature = child.feature
    if (childFeature) {
      const childStart = childFeature.get('start')
      const childEnd = childFeature.get('end')

      layout.addRect(childFeature.id(), childStart, childEnd, child.height, childFeature, {
        refName: childFeature.get('refName'),
      })

      if (child.children.length > 0) {
        addNestedSubfeaturesToLayout({ layout, featureLayout: child, config })
      }
    }
  }
}
