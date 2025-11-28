import { readConfObject } from '@jbrowse/core/configuration'
import { measureText } from '@jbrowse/core/util'

import { getSubparts } from './filterSubparts'
import { chooseGlyphType, truncateLabel } from './util'

import type { FeatureLayout } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

// Padding between transcripts in pixels
const TRANSCRIPT_PADDING = 2

// Types that indicate a coding transcript
const CODING_TYPES = new Set(['CDS', 'cds'])

function hasCodingSubfeature(feature: Feature): boolean {
  const subfeatures = feature.get('subfeatures') || []
  for (const sub of subfeatures) {
    const type = sub.get('type')
    if (CODING_TYPES.has(type)) {
      return true
    }
    // Check nested subfeatures (e.g., CDS inside exon)
    if (hasCodingSubfeature(sub)) {
      return true
    }
  }
  return false
}

/**
 * Create layout for a feature and its subfeatures using simple coordinate tracking
 */
export function layoutFeature(args: {
  feature: Feature
  bpPerPx: number
  reversed: boolean
  config: AnyConfigurationModel
  parentX?: number
  parentY?: number
  isNested?: boolean
  displayMode?: string
  transcriptTypes?: string[]
  containerTypes?: string[]
  showLabels?: boolean
  showDescriptions?: boolean
  showSubfeatureLabels?: boolean
  subfeatureLabelPosition?: string
  fontHeight?: number
  labelAllowed?: boolean
  isTranscriptChild?: boolean
}): FeatureLayout {
  const {
    feature,
    bpPerPx,
    reversed,
    config,
    parentX = 0,
    parentY = 0,
    isNested = false,
    displayMode: displayModeArg,
    transcriptTypes: transcriptTypesArg,
    containerTypes: containerTypesArg,
    showLabels: showLabelsArg,
    showDescriptions: showDescriptionsArg,
    showSubfeatureLabels: showSubfeatureLabelsArg,
    subfeatureLabelPosition: subfeatureLabelPositionArg,
    fontHeight: fontHeightArg,
    labelAllowed: labelAllowedArg,
    isTranscriptChild = false,
  } = args

  // Pre-read config values once (use provided args to avoid repeated readConfObject calls)
  const displayMode =
    displayModeArg ?? (readConfObject(config, 'displayMode') as string)
  const transcriptTypes =
    transcriptTypesArg ?? readConfObject(config, 'transcriptTypes')
  const containerTypes =
    containerTypesArg ?? readConfObject(config, 'containerTypes')
  const showSubfeatureLabels =
    showSubfeatureLabelsArg ??
    (readConfObject(config, 'showSubfeatureLabels') as boolean)
  const subfeatureLabelPosition =
    subfeatureLabelPositionArg ??
    (readConfObject(config, 'subfeatureLabelPosition') as string)

  const glyphType = chooseGlyphType({
    feature,
    transcriptTypes,
    containerTypes,
  })

  // Calculate x position
  const parentFeature = feature.parent()
  let x = parentX
  if (parentFeature) {
    const relativeX = reversed
      ? parentFeature.get('end') - feature.get('end')
      : feature.get('start') - parentFeature.get('start')
    x = parentX + relativeX / bpPerPx
  }

  // Calculate dimensions
  const height = readConfObject(config, 'height', { feature }) as number
  const actualHeight = displayMode === 'compact' ? height / 2 : height
  const width = (feature.get('end') - feature.get('start')) / bpPerPx

  // Start with feature at parent's y position
  const y = parentY

  const layout: FeatureLayout = {
    feature,
    x,
    y,
    width,
    height: actualHeight,
    totalFeatureHeight: actualHeight, // Visual height (will be updated for stacked children)
    totalLayoutHeight: actualHeight, // Layout height including label space (will be updated below)
    totalLayoutWidth: width, // Layout width including label space (will be updated below)
    children: [],
  }

  // Handle subfeatures
  const subfeatures = feature.get('subfeatures') || []
  if (subfeatures.length > 0 && displayMode !== 'reducedRepresentation') {
    if (glyphType === 'Subfeatures') {
      // Sort transcripts so coding transcripts (with CDS) appear first
      const sortedSubfeatures = [...subfeatures].sort((a, b) => {
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

      // Stack subfeatures vertically (for genes with multiple transcripts)
      let currentY = parentY
      for (let i = 0; i < sortedSubfeatures.length; i++) {
        const subfeature = sortedSubfeatures[i]!
        // Check if this child is a transcript type
        const childType = subfeature.get('type')
        const isChildTranscript = transcriptTypes.includes(childType)
        const childLayout = layoutFeature({
          feature: subfeature,
          bpPerPx,
          reversed,
          config,
          parentX: x,
          parentY: currentY,
          isNested: true,
          displayMode,
          transcriptTypes,
          containerTypes,
          showSubfeatureLabels,
          subfeatureLabelPosition,
          // Mark transcript children so they can have labels
          isTranscriptChild: isChildTranscript,
        })
        layout.children.push(childLayout)
        // When subfeature labels are enabled with 'below' position, use totalLayoutHeight (includes label space)
        // For 'overlay' position or when labels are disabled, use visual height only
        const useExtraHeightForLabels =
          showSubfeatureLabels &&
          isChildTranscript &&
          subfeatureLabelPosition === 'below'
        const heightForStacking = useExtraHeightForLabels
          ? childLayout.totalLayoutHeight
          : childLayout.height
        currentY += heightForStacking
        // Add padding between transcripts (but not after the last one)
        if (i < sortedSubfeatures.length - 1) {
          currentY += TRANSCRIPT_PADDING
        }
      }
      // Update heights to include all stacked children
      const totalStackedHeight = currentY - parentY
      layout.height = totalStackedHeight
      layout.totalFeatureHeight = totalStackedHeight
      layout.totalLayoutHeight = totalStackedHeight
    } else if (glyphType === 'ProcessedTranscript') {
      // Overlay subfeatures (CDS, UTR on transcript)
      const subparts = getSubparts(feature, config)
      for (const subfeature of subparts) {
        const childLayout = layoutFeature({
          feature: subfeature,
          bpPerPx,
          reversed,
          config,
          parentX: x,
          parentY,
          isNested: true,
          displayMode,
          transcriptTypes,
          containerTypes,
        })
        layout.children.push(childLayout)
      }
    } else {
      // Overlay subfeatures (default for Segments, etc.)
      for (const subfeature of subfeatures) {
        const childLayout = layoutFeature({
          feature: subfeature,
          bpPerPx,
          reversed,
          config,
          parentX: x,
          parentY,
          isNested: true,
          displayMode,
          transcriptTypes,
          containerTypes,
        })
        layout.children.push(childLayout)
      }
    }
  }

  // Add extra height and width for labels (name and description)
  // Labels are drawn by floating label system, but we need to reserve space
  const labelAllowed = labelAllowedArg ?? displayMode !== 'collapsed'
  // Allow labels for:
  // 1. Top-level features (not nested) - always when labelAllowed
  // 2. Transcript children - when showSubfeatureLabels is enabled
  const shouldCalculateLabels =
    labelAllowed && (!isNested || (isTranscriptChild && showSubfeatureLabels))

  if (shouldCalculateLabels) {
    // Use pre-read values if provided to avoid repeated readConfObject calls
    // For transcript children, only show name (not description) to keep labels compact
    const showLabels = isTranscriptChild
      ? true
      : (showLabelsArg ?? readConfObject(config, 'showLabels'))
    const showDescriptions = isTranscriptChild
      ? false
      : (showDescriptionsArg ?? readConfObject(config, 'showDescriptions'))
    const fontHeight =
      fontHeightArg ??
      (readConfObject(config, ['labels', 'fontSize'], {
        feature,
      }) as number)

    const name = truncateLabel(
      String(readConfObject(config, ['labels', 'name'], { feature }) || ''),
    )
    const shouldShowName = /\S/.test(name) && showLabels

    const description = truncateLabel(
      String(
        readConfObject(config, ['labels', 'description'], { feature }) || '',
      ),
    )
    const shouldShowDescription = /\S/.test(description) && showDescriptions

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

    // totalFeatureHeight stays as visual height (without labels)
    // Add label height to totalLayoutHeight for vertical collision detection
    // For transcript children with 'overlay' position, don't reserve extra space
    const isOverlayMode =
      isTranscriptChild && subfeatureLabelPosition === 'overlay'
    if (!isOverlayMode) {
      layout.totalLayoutHeight = layout.totalFeatureHeight + extraHeight
    }

    // IMPORTANT: totalLayoutWidth is the MAX of feature width or label width, not the sum.
    // Labels are displayed below the feature, horizontally aligned with the feature start
    // (but clamped to stay within the viewport). The layout width determines the horizontal
    // space needed for collision detection:
    // 1. Short features with long labels: layout width = label width (label may extend past feature)
    // 2. Long features with short labels: layout width = feature width (label fits within)
    // The collision detection uses this width to prevent labels from overlapping vertically
    // when features are stacked, while allowing horizontal label overlap across rows.
    layout.totalLayoutWidth = Math.max(layout.width, maxLabelWidth)
  }

  return layout
}

/**
 * Get layout for a specific feature by ID from the tree
 */
export function findFeatureLayout(
  layout: FeatureLayout,
  featureId: string,
): FeatureLayout | null {
  if (layout.feature.id() === featureId) {
    return layout
  }
  for (const child of layout.children) {
    const found = findFeatureLayout(child, featureId)
    if (found) {
      return found
    }
  }
  return null
}

/**
 * Calculate total layout width including label width
 * For top-level features, this should return totalLayoutWidth
 */
export function getLayoutWidth(layout: FeatureLayout): number {
  if (layout.children.length === 0) {
    return layout.totalLayoutWidth
  }

  // For features with children, find the max x+totalLayoutWidth among all children
  let maxRight = layout.totalLayoutWidth
  for (const child of layout.children) {
    const childRight = child.x + getLayoutWidth(child)
    maxRight = Math.max(maxRight, childRight)
  }
  return maxRight
}

/**
 * Calculate visual height of layout for label positioning
 * Always returns visual height (without label space)
 */
export function getLayoutHeight(layout: FeatureLayout): number {
  if (layout.children.length === 0) {
    return layout.height
  }

  // For features with children, find the max y+height among all children
  let maxBottom = layout.height
  for (const child of layout.children) {
    const childBottom = child.y + getLayoutHeight(child)
    maxBottom = Math.max(maxBottom, childBottom)
  }
  return maxBottom
}
