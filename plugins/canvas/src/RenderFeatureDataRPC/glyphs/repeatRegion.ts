import { getSubfeatures } from '../util.ts'
import { layoutContainerGlyph } from './glyphUtils.ts'

import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// EDTA / LTR_retriever-style intact transposons: a `repeat_region` parent whose
// children (the two LTRs, the two target-site duplications, the internal
// retrotransposon) span overlapping ranges. Rendered like a transcript — the
// subparts share one row joined by a connecting line and the parent itself gets
// no box — so the structure stays visible instead of collapsing to a flat box.
// See GMOD/jbrowse-components#3080.
export function isRepeatRegion(feature: Feature) {
  return (
    feature.get('type') === 'repeat_region' &&
    getSubfeatures(feature).length > 0
  )
}

export function layoutRepeatRegion(args: LayoutArgs): FeatureLayout {
  return layoutContainerGlyph(
    'RepeatRegion',
    args,
    getSubfeatures(args.feature),
  )
}
