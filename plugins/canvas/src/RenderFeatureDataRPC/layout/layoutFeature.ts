import { findGlyph } from '../glyphs/index.ts'
import { applyLabelDimensions } from '../labelUtils.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

export function layoutFeature(args: {
  feature: Feature
  bpPerPx: number
  reversed: boolean
  config: DisplayConfig
  isNested?: boolean
  isTranscriptChild?: boolean
}) {
  const {
    feature,
    bpPerPx,
    reversed,
    config,
    isNested = false,
    isTranscriptChild = false,
  } = args

  const layoutArgs: LayoutArgs = {
    feature,
    bpPerPx,
    reversed,
    config,
  }

  const layout = findGlyph(feature, config).layout(layoutArgs)

  if (isNested || isTranscriptChild) {
    applyLabelDimensions(layout, {
      feature,
      config,
      isNested,
      isTranscriptChild,
    })
  }

  return layout
}
