import { readConfObject } from '@jbrowse/core/configuration'
import { measureText } from '@jbrowse/core/util'

import { getSubparts } from './filterSubparts'
import { chooseGlyphType, truncateLabel } from './util'

import type { RenderConfigContext } from './renderConfig'
import type { FeatureLayout } from './types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Feature } from '@jbrowse/core/util'

const TRANSCRIPT_PADDING = 2
const CODING_TYPES = new Set(['CDS', 'cds'])

function hasCodingSubfeature(feature: Feature): boolean {
  const subfeatures = feature.get('subfeatures') || []
  return subfeatures.some(
    (sub: Feature) =>
      CODING_TYPES.has(sub.get('type')) || hasCodingSubfeature(sub),
  )
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
    feature,
    x,
    y,
    width,
    height: actualHeight,
    totalFeatureHeight: actualHeight,
    totalLayoutHeight: actualHeight,
    totalLayoutWidth: width,
    children: [],
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
      const childFeatures =
        glyphType === 'ProcessedTranscript'
          ? getSubparts(feature, config)
          : subfeatures
      for (const subfeature of childFeatures) {
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

