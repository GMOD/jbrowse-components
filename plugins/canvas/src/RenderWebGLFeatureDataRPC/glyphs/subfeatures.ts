import { applyLabelDimensions } from '../labelUtils.ts'
import { readCachedConfig } from '../renderConfig.ts'
import { findChildGlyph } from './childGlyphs.ts'

import type { FeatureLayout, Glyph, LayoutArgs } from '../types.ts'
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

function filterByGeneGlyphMode(
  subfeatures: Feature[],
  transcriptTypes: string[],
  mode: 'longest' | 'longestCoding',
): Feature[] {
  if (subfeatures.length <= 1) {
    return subfeatures
  }

  const transcriptSubfeatures = subfeatures.filter(sub =>
    transcriptTypes.includes(sub.get('type')),
  )
  let candidates =
    transcriptSubfeatures.length > 0 ? transcriptSubfeatures : subfeatures

  if (mode === 'longestCoding') {
    const codingCandidates = candidates.filter(hasCodingSubfeature)
    if (codingCandidates.length > 0) {
      candidates = codingCandidates
    }
  }

  const longest = candidates.reduce((a, b) =>
    a.get('end') - a.get('start') > b.get('end') - b.get('start') ? a : b,
  )
  return [longest]
}

export const subfeaturesGlyph: Glyph = {
  type: 'Subfeatures',

  match(feature, configContext) {
    const type = feature.get('type')
    const subfeatures = feature.get('subfeatures')
    if (!subfeatures?.length) {
      return false
    }

    const { containerTypes } = configContext

    if (containerTypes.includes(type)) {
      return true
    }

    const isTopLevel = !feature.parent?.()
    const hasNestedSubfeatures = subfeatures.some(
      (f: Feature) => f.get('subfeatures')?.length,
    )
    return isTopLevel && hasNestedSubfeatures
  },

  layout(args: LayoutArgs): FeatureLayout {
    const { feature, bpPerPx, reversed, configContext } = args
    const {
      config,
      featureHeight,
      heightMultiplier,
      geneGlyphMode,
      transcriptTypes,
    } = configContext

    const featureBp = {
      start: feature.get('start'),
      end: feature.get('end'),
    }
    const heightPx = readCachedConfig(featureHeight, config, 'height', feature)
    const baseHeightPx = heightPx * heightMultiplier
    const widthPx = (featureBp.end - featureBp.start) / bpPerPx

    let subfeatures = [...(feature.get('subfeatures') || [])] as Feature[]
    const codingStatus = new Map(
      subfeatures.map(f => [f.id(), hasCodingSubfeature(f)]),
    )
    subfeatures.sort((a, b) => {
      const aHasCDS = codingStatus.get(a.id())
      const bHasCDS = codingStatus.get(b.id())
      if (aHasCDS && !bHasCDS) {
        return -1
      }
      if (!aHasCDS && bHasCDS) {
        return 1
      }
      return 0
    })

    const effectiveMode =
      geneGlyphMode === 'auto' && bpPerPx > 100 ? 'longest' : geneGlyphMode
    if (effectiveMode === 'longest' || effectiveMode === 'longestCoding') {
      subfeatures = filterByGeneGlyphMode(
        subfeatures,
        transcriptTypes,
        effectiveMode,
      )
    }

    const children: FeatureLayout[] = []
    let currentYPx = 0
    const { subfeatureLabels } = configContext

    for (let i = 0; i < subfeatures.length; i++) {
      const child = subfeatures[i]!
      const childType = child.get('type')
      const isChildTranscript = transcriptTypes.includes(childType)
      const childGlyph = findChildGlyph(child, configContext)

      const childLayout = childGlyph.layout({
        ...args,
        feature: child,
        parentFeature: feature,
      })

      applyLabelDimensions(childLayout, {
        feature: child,
        configContext,
        isNested: true,
        isTranscriptChild: isChildTranscript,
      })

      const childBp = {
        start: child.get('start'),
        end: child.get('end'),
      }
      const offsetBp = reversed
        ? featureBp.end - childBp.end
        : childBp.start - featureBp.start
      const xRelativePx = offsetBp / bpPerPx

      childLayout.x = xRelativePx
      childLayout.y = currentYPx

      children.push(childLayout)

      const useExtraHeightForLabels =
        subfeatureLabels === 'below' && isChildTranscript
      const heightForStacking = useExtraHeightForLabels
        ? childLayout.totalLayoutHeight
        : childLayout.height
      currentYPx += heightForStacking
      if (i < subfeatures.length - 1) {
        currentYPx += TRANSCRIPT_PADDING
      }
    }

    const totalHeightPx = currentYPx > 0 ? currentYPx : baseHeightPx

    return {
      feature,
      glyphType: 'Subfeatures',
      x: 0,
      y: 0,
      width: widthPx,
      height: totalHeightPx,
      totalLayoutHeight: totalHeightPx,
      totalLayoutWidth: widthPx,
      leftPadding: 0,
      children,
    }
  },
}
