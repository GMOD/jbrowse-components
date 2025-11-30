import { readConfObject } from '@jbrowse/core/configuration'
import {
  bpToPx,
  calculateLayoutBounds,
  getFrame,
  measureText,
  stripAlpha,
} from '@jbrowse/core/util'

import { getSubparts } from './filterSubparts'
import { isUTR } from './isUTR'

import type {
  ComputeLayoutsResult,
  FeatureLayout,
  FloatingLabelData,
  GlyphType,
  RenderConfigContext,
  SubfeatureInfo,
} from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature, Region } from '@jbrowse/core/util'
import type { BaseLayout } from '@jbrowse/core/util/layouts'
import type { Theme } from '@mui/material'

const TRANSCRIPT_PADDING = 2
const CODING_TYPES = new Set(['CDS', 'cds'])
const MAX_LABEL_LENGTH = 50
const xPadding = 3
const yPadding = 5

export { xPadding, yPadding }

export function truncateLabel(text: string, maxLength = MAX_LABEL_LENGTH) {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function normalizeColor(color: string, fallback = 'black') {
  return color === '#f0f' ? fallback : color
}

export function createRenderConfigContext(
  config: AnyConfigurationModel,
): RenderConfigContext {
  const displayMode = readConfObject(config, 'displayMode') as string
  const showLabels = readConfObject(config, 'showLabels') as boolean
  const showDescriptions = readConfObject(config, 'showDescriptions') as boolean
  const subfeatureLabels = readConfObject(config, 'subfeatureLabels') as string
  const transcriptTypes = readConfObject(config, 'transcriptTypes') as string[]
  const containerTypes = readConfObject(config, 'containerTypes') as string[]
  const geneGlyphMode = readConfObject(config, 'geneGlyphMode') as string
  const fontHeight = readConfObject(config, ['labels', 'fontSize']) as number
  const featureHeight = readConfObject(config, 'height') as number
  const isHeightCallback = config.height?.isCallback ?? false

  return {
    displayMode,
    transcriptTypes,
    containerTypes,
    showLabels,
    showDescriptions,
    subfeatureLabels,
    geneGlyphMode,
    fontHeight,
    featureHeight,
    labelAllowed: displayMode !== 'collapse',
    isHeightCallback,
  }
}

function hasCodingSubfeature(feature: Feature): boolean {
  const subfeatures = feature.get('subfeatures') || []
  return subfeatures.some(
    (sub: Feature) =>
      CODING_TYPES.has(sub.get('type')) || hasCodingSubfeature(sub),
  )
}

export function chooseGlyphType({
  feature,
  configContext,
}: {
  feature: Feature
  configContext: RenderConfigContext
}): GlyphType {
  const type = feature.get('type')
  const subfeatures = feature.get('subfeatures')
  const { transcriptTypes, containerTypes } = configContext

  if (subfeatures?.length && type !== 'CDS') {
    const hasSubSub = subfeatures.some(f => f.get('subfeatures')?.length)
    const hasCDS = subfeatures.some(f => f.get('type') === 'CDS')
    if (transcriptTypes.includes(type) && hasCDS) {
      return 'ProcessedTranscript'
    } else if (
      (!feature.parent() && hasSubSub) ||
      containerTypes.includes(type)
    ) {
      return 'Subfeatures'
    } else {
      return 'Segments'
    }
  } else if (type === 'CDS') {
    return 'CDS'
  } else {
    return 'Box'
  }
}

export function getChildFeatures({
  feature,
  glyphType,
  config,
}: {
  feature: Feature
  glyphType: GlyphType
  config: AnyConfigurationModel
}): Feature[] {
  if (glyphType === 'ProcessedTranscript') {
    return getSubparts(feature, config)
  }
  return feature.get('subfeatures') || []
}

export function getBoxColor({
  feature,
  config,
  colorByCDS,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  colorByCDS: boolean
  theme: Theme
}) {
  let fill: string = isUTR(feature)
    ? readConfObject(config, 'color3', { feature })
    : readConfObject(config, 'color1', { feature })

  const featureType: string | undefined = feature.get('type')
  const featureStrand: -1 | 1 | undefined = feature.get('strand')
  const featurePhase: 0 | 1 | 2 | undefined = feature.get('phase')

  if (
    colorByCDS &&
    featureType === 'CDS' &&
    featureStrand !== undefined &&
    featurePhase !== undefined
  ) {
    const frame = getFrame(
      feature.get('start'),
      feature.get('end'),
      featureStrand,
      featurePhase,
    )
    const frameColor = theme.palette.framesCDS.at(frame)?.main
    if (frameColor) {
      fill = frameColor
    }
  }

  return fill
}

export function getStrokeColor({
  feature,
  config,
  theme,
}: {
  feature: Feature
  config: AnyConfigurationModel
  theme: Theme
}) {
  const c = readConfObject(config, 'color2', { feature }) as string
  return c === '#f0f' ? stripAlpha(theme.palette.text.secondary) : c
}

export function layoutFeature(args: {
  feature: Feature
  bpPerPx: number
  reversed: boolean
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  parentX?: number
  parentY?: number
  isNested?: boolean
  isTranscriptChild?: boolean
}): FeatureLayout {
  const {
    feature,
    bpPerPx,
    reversed,
    config,
    configContext,
    parentX = 0,
    parentY = 0,
    isNested = false,
    isTranscriptChild = false,
  } = args

  const {
    displayMode,
    transcriptTypes,
    showLabels,
    showDescriptions,
    subfeatureLabels,
    fontHeight,
    labelAllowed,
    geneGlyphMode,
    featureHeight,
    isHeightCallback,
  } = configContext

  const glyphType = chooseGlyphType({ feature, configContext })

  const parentFeature = feature.parent()
  let x = parentX
  if (parentFeature) {
    const relativeX = reversed
      ? parentFeature.get('end') - feature.get('end')
      : feature.get('start') - parentFeature.get('start')
    x = parentX + relativeX / bpPerPx
  }

  const height = isHeightCallback
    ? (readConfObject(config, 'height', { feature }) as number)
    : featureHeight
  const actualHeight = displayMode === 'compact' ? height / 2 : height
  const width = (feature.get('end') - feature.get('start')) / bpPerPx
  const y = parentY

  const layout: FeatureLayout = {
    featureId: feature.id(),
    x,
    y,
    width,
    height: actualHeight,
    totalFeatureHeight: actualHeight,
    totalLayoutHeight: actualHeight,
    totalLayoutWidth: width,
    children: [],
    glyphType,
  }

  const subfeatures = feature.get('subfeatures') || []
  if (subfeatures.length > 0 && displayMode !== 'reducedRepresentation') {
    if (glyphType === 'Subfeatures') {
      let sortedSubfeatures = [...subfeatures].sort((a, b) => {
        const aHasCDS = hasCodingSubfeature(a)
        const bHasCDS = hasCodingSubfeature(b)
        if (aHasCDS && !bHasCDS) {
          return -1
        }
        if (!aHasCDS && bHasCDS) {
          return 1
        }
        return 0
      })

      if (
        (geneGlyphMode === 'longest' || geneGlyphMode === 'longestCoding') &&
        sortedSubfeatures.length > 1
      ) {
        const transcriptSubfeatures = sortedSubfeatures.filter(sub =>
          transcriptTypes.includes(sub.get('type')),
        )
        let candidates =
          transcriptSubfeatures.length > 0
            ? transcriptSubfeatures
            : sortedSubfeatures

        if (geneGlyphMode === 'longestCoding') {
          const codingCandidates = candidates.filter(hasCodingSubfeature)
          if (codingCandidates.length > 0) {
            candidates = codingCandidates
          }
        }

        const longest = candidates.reduce((a, b) =>
          a.get('end') - a.get('start') > b.get('end') - b.get('start') ? a : b,
        )
        sortedSubfeatures = [longest]
      }

      let currentY = parentY
      for (let i = 0; i < sortedSubfeatures.length; i++) {
        const subfeature = sortedSubfeatures[i]!
        const childType = subfeature.get('type')
        const isChildTranscript = transcriptTypes.includes(childType)
        const childLayout = layoutFeature({
          feature: subfeature,
          bpPerPx,
          reversed,
          config,
          configContext,
          parentX: x,
          parentY: currentY,
          isNested: true,
          isTranscriptChild: isChildTranscript,
        })
        layout.children.push(childLayout)
        const useExtraHeightForLabels =
          subfeatureLabels === 'below' && isChildTranscript
        const heightForStacking = useExtraHeightForLabels
          ? childLayout.totalLayoutHeight
          : childLayout.height
        currentY += heightForStacking
        if (i < sortedSubfeatures.length - 1) {
          currentY += TRANSCRIPT_PADDING
        }
      }
      const totalStackedHeight = currentY - parentY
      layout.height = totalStackedHeight
      layout.totalFeatureHeight = totalStackedHeight
      layout.totalLayoutHeight = totalStackedHeight
    } else {
      for (const subfeature of getChildFeatures({
        feature,
        glyphType,
        config,
      })) {
        layout.children.push(
          layoutFeature({
            feature: subfeature,
            bpPerPx,
            reversed,
            config,
            configContext,
            parentX: x,
            parentY,
            isNested: true,
          }),
        )
      }
    }
  }

  const showSubfeatureLabels = subfeatureLabels !== 'none'
  const shouldCalculateLabels =
    labelAllowed && (!isNested || (isTranscriptChild && showSubfeatureLabels))

  if (shouldCalculateLabels) {
    const effectiveShowLabels = isTranscriptChild ? true : showLabels
    const effectiveShowDescriptions = isTranscriptChild
      ? false
      : showDescriptions

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

    let extraHeight = 0
    let maxLabelWidth = 0
    if (shouldShowName) {
      extraHeight += fontHeight
      maxLabelWidth = Math.max(maxLabelWidth, measureText(name, fontHeight))
    }
    if (shouldShowDescription) {
      extraHeight += fontHeight
      maxLabelWidth = Math.max(
        maxLabelWidth,
        measureText(description, fontHeight),
      )
    }

    const isOverlayMode = isTranscriptChild && subfeatureLabels === 'overlay'
    if (!isOverlayMode) {
      layout.totalLayoutHeight = layout.totalFeatureHeight + extraHeight
    }

    layout.totalLayoutWidth = Math.max(layout.width, maxLabelWidth)
  }

  return layout
}

function createFeatureFloatingLabels({
  name,
  description,
  showLabels,
  showDescriptions,
  fontHeight,
  nameColor,
  descriptionColor,
}: {
  name: string
  description: string
  showLabels: boolean
  showDescriptions: boolean
  fontHeight: number
  nameColor: string
  descriptionColor: string
}): FloatingLabelData[] {
  const floatingLabels: FloatingLabelData[] = []
  const truncatedName = truncateLabel(name)
  const truncatedDesc = truncateLabel(description)
  const shouldShowName = showLabels && /\S/.test(truncatedName)
  const shouldShowDesc = showDescriptions && /\S/.test(truncatedDesc)

  if (shouldShowName) {
    floatingLabels.push({
      text: truncatedName,
      relativeY: 0,
      color: normalizeColor(nameColor),
    })
  }
  if (shouldShowDesc) {
    floatingLabels.push({
      text: truncatedDesc,
      relativeY: shouldShowName ? fontHeight : 0,
      color: normalizeColor(descriptionColor),
    })
  }

  return floatingLabels
}

function createSubfeatureFloatingLabel({
  transcriptName,
  featureHeight,
  subfeatureLabels,
  color,
}: {
  transcriptName: string
  featureHeight: number
  subfeatureLabels: string
  color: string
}): FloatingLabelData | null {
  if (!transcriptName) {
    return null
  }

  const truncatedName = truncateLabel(transcriptName)
  const isOverlay = subfeatureLabels === 'overlay'
  const relativeY = isOverlay ? 2 - featureHeight : 0

  return {
    text: truncatedName,
    relativeY,
    color: normalizeColor(color),
    isOverlay,
  }
}

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
  allFeatures,
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
  allFeatures: Map<string, Feature>
}) {
  const showSubfeatureLabels = subfeatureLabels !== 'none'
  for (const child of featureLayout.children) {
    const childFeature = allFeatures.get(child.featureId)
    if (!childFeature) {
      continue
    }
    const childType = childFeature.get('type')
    const isTranscript = transcriptTypes.includes(childType)

    if (!isTranscript) {
      addNestedSubfeaturesToLayout({
        layout,
        featureLayout: child,
        allFeatures,
      })
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
      const label = createSubfeatureFloatingLabel({
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
      addNestedSubfeaturesToLayout({
        layout,
        featureLayout: child,
        allFeatures,
      })
    }
  }
}

export function addNestedSubfeaturesToLayout({
  layout,
  featureLayout,
  allFeatures,
}: {
  layout: BaseLayout<unknown>
  featureLayout: FeatureLayout
  allFeatures: Map<string, Feature>
}) {
  for (const child of featureLayout.children) {
    const childFeature = allFeatures.get(child.featureId)
    if (!childFeature) {
      continue
    }
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
      addNestedSubfeaturesToLayout({
        layout,
        featureLayout: child,
        allFeatures,
      })
    }
  }
}

export function buildFeatureMap(
  features: Map<string, Feature>,
  config: AnyConfigurationModel,
): Map<string, Feature> {
  const allFeatures = new Map<string, Feature>()

  function addFeatureAndSubfeatures(feature: Feature) {
    allFeatures.set(feature.id(), feature)
    const subfeatures = feature.get('subfeatures') || []
    for (const sub of subfeatures) {
      addFeatureAndSubfeatures(sub)
    }
    // Also add processed subparts (which may include generated UTR features)
    const subparts = getSubparts(feature, config)
    for (const sub of subparts) {
      allFeatures.set(sub.id(), sub)
    }
  }

  for (const feature of features.values()) {
    addFeatureAndSubfeatures(feature)
  }

  return allFeatures
}

export function computeLayouts({
  features,
  bpPerPx,
  region,
  config,
  configContext,
  layout,
  labelColor = 'black',
}: {
  features: Map<string, Feature>
  bpPerPx: number
  region: Region
  config: AnyConfigurationModel
  configContext: RenderConfigContext
  layout: BaseLayout<unknown>
  labelColor?: string
}): ComputeLayoutsResult {
  const reversed = region.reversed || false
  const {
    showLabels,
    showDescriptions,
    fontHeight,
    subfeatureLabels,
    transcriptTypes,
  } = configContext

  const allFeatures = buildFeatureMap(features, config)
  const subfeatureCoords: number[] = []
  const subfeatureInfos: SubfeatureInfo[] = []

  for (const feature of features.values()) {
    const featureLayout = layoutFeature({
      feature,
      bpPerPx,
      reversed,
      config,
      configContext,
    })

    const name = String(
      readConfObject(config, ['labels', 'name'], { feature }) || '',
    )
    const description = String(
      readConfObject(config, ['labels', 'description'], { feature }) || '',
    )
    const nameColor = readConfObject(config, ['labels', 'nameColor'], {
      feature,
    }) as string
    const descriptionColor = readConfObject(
      config,
      ['labels', 'descriptionColor'],
      { feature },
    ) as string

    const floatingLabels = createFeatureFloatingLabels({
      name,
      description,
      showLabels,
      showDescriptions,
      fontHeight,
      nameColor,
      descriptionColor,
    })

    const layoutWidthBp =
      featureLayout.totalLayoutWidth * bpPerPx + xPadding * bpPerPx
    const [layoutStart, layoutEnd] = calculateLayoutBounds(
      feature.get('start'),
      feature.get('end'),
      layoutWidthBp,
      reversed,
    )

    const topPx = layout.addRect(
      feature.id(),
      layoutStart,
      layoutEnd,
      featureLayout.totalLayoutHeight + yPadding,
      feature,
      {
        label: name || feature.get('name') || feature.get('id'),
        description:
          description || feature.get('description') || feature.get('note'),
        refName: feature.get('refName'),
        totalLayoutWidth: featureLayout.totalLayoutWidth + xPadding,
        featureLayout,
        ...(floatingLabels.length > 0
          ? {
              floatingLabels,
              totalFeatureHeight: featureLayout.totalFeatureHeight,
            }
          : {}),
      },
    )

    if (topPx === null) {
      continue
    }

    // Add subfeatures to layout with flatbush data for hit detection
    const featureType = feature.get('type')
    const isGene = featureType === 'gene'
    const hasTranscriptChildren = featureLayout.children.some(child => {
      const childFeature = allFeatures.get(child.featureId)
      return childFeature && transcriptTypes.includes(childFeature.get('type'))
    })

    // Adjust child positions to absolute coordinates (like canvas makeImageData.ts)
    const start = feature.get(reversed ? 'end' : 'start')
    const startPx = bpToPx(start, region, bpPerPx)

    const adjustedLayout = {
      ...featureLayout,
      x: startPx + featureLayout.x,
      y: topPx + featureLayout.y,
      children: adjustChildPositions(featureLayout.children, startPx, topPx),
    }

    if (isGene && hasTranscriptChildren) {
      addSubfeaturesToLayoutAndFlatbush({
        layout,
        featureLayout: adjustedLayout,
        parentFeatureId: feature.id(),
        subfeatureCoords,
        subfeatureInfos,
        config,
        subfeatureLabels,
        transcriptTypes,
        labelColor,
        allFeatures,
      })
    } else if (adjustedLayout.children.length > 0) {
      addNestedSubfeaturesToLayout({
        layout,
        featureLayout: adjustedLayout,
        allFeatures,
      })
    }
  }

  return {
    subfeatureCoords,
    subfeatureInfos,
  }
}
