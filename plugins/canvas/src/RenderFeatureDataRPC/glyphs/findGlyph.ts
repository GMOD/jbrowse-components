import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { layoutBox } from './box.ts'
import { layoutCrisprGuide } from './crisprGuide.ts'
import { hasCDSSubfeature, hasContainerChildren } from './glyphUtils.ts'
import {
  hasMatureProteinChildren,
  layoutMatureProteinRegion,
} from './matureProteinRegion.ts'
import { layoutMotif } from './motif.ts'
import { layoutProcessedTranscript } from './processed.ts'
import { isRepeatRegion, layoutRepeatRegion } from './repeatRegion.ts'
import { layoutSegments } from './segments.ts'
import { layoutSubfeatures } from './subfeatures.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Keyed lowercase, so the lookup below matches whatever casing the file used.
const TYPE_GLYPHS: Record<string, (args: LayoutArgs) => FeatureLayout> = {
  guide_rna: layoutCrisprGuide,
  motif: layoutMotif,
}

export function findGlyph(
  feature: Feature,
  config: DisplayConfig,
  isTopLevel?: boolean,
): (args: LayoutArgs) => FeatureLayout {
  isTopLevel ??= !feature.parent?.()
  const type = featureType(feature)
  const subfeatures = getSubfeatures(feature)

  const typeGlyph = TYPE_GLYPHS[type.toLowerCase()]
  if (typeGlyph) {
    return typeGlyph
  }
  if (isCDS(feature)) {
    return hasMatureProteinChildren(feature)
      ? layoutMatureProteinRegion
      : layoutBox
  }
  if (subfeatures.length > 0) {
    const { containerTypes } = config

    // Deliberately NOT gated on isTopLevel, unlike the heuristics below: the
    // same shape appears a level deeper as gene → mRNA → CDS → mat_peptide, and
    // dispatch recurses only through layoutSubfeatures — so a top-level-only
    // test drops every cleavage product to a flat CDS box.
    if (subfeatures.some(f => isCDS(f) && hasMatureProteinChildren(f))) {
      return layoutSubfeatures
    }

    // Checked before the shapes below: a repeat_region matches none of the
    // transcript/container heuristics and would fall through to Segments.
    if (isTopLevel && isRepeatRegion(feature)) {
      return layoutRepeatRegion
    }

    // The three container shapes are chosen structurally, not by type, so a
    // custom transcript type works without configuration. `containerTypes` is
    // the one explicit override, and `featureAdmission` lowercases the same
    // slot — a case-sensitive test here would let `showOnlyGenes` admit a
    // feature the dispatch then refuses to stack.
    if (
      isTopLevel &&
      (containerTypes.some(t => t.toLowerCase() === type.toLowerCase()) ||
        hasContainerChildren(feature))
    ) {
      return layoutSubfeatures
    }
    if (hasCDSSubfeature(feature)) {
      return layoutProcessedTranscript
    }
    return layoutSegments
  }
  return layoutBox
}
