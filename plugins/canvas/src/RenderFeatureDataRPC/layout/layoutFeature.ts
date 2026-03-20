import { findGlyph } from '../glyphs/index.ts'
import { applyLabelDimensions } from '../labelUtils.ts'

import type { RenderConfigContext } from '../renderConfig.ts'
import type { LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export function layoutFeature(args: {
  feature: Feature
  bpPerPx: number
  reversed: boolean
  configContext: RenderConfigContext
  isNested?: boolean
  isTranscriptChild?: boolean
}) {
  const {
    feature,
    bpPerPx,
    reversed,
    configContext,
    isNested = false,
    isTranscriptChild = false,
  } = args

  const layoutArgs: LayoutArgs = {
    feature,
    bpPerPx,
    reversed,
    configContext,
  }

  const layout = findGlyph(feature, configContext).layout(layoutArgs)

  // Only apply label dimensions for nested/transcript children where
  // totalLayoutHeight is used for stacking within parent glyphs.
  // Top-level features skip this — layout.ts owns their height decisions.
  if (isNested || isTranscriptChild) {
    applyLabelDimensions(layout, {
      feature,
      configContext,
      isNested,
      isTranscriptChild,
    })
  }

  return layout
}
