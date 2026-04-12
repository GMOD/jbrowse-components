import { findGlyph } from '../glyphs/index.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

export function layoutFeature(args: {
  feature: Feature
  bpPerPx: number
  reversed: boolean
  config: DisplayConfig
}) {
  const { feature, bpPerPx, reversed, config } = args
  return findGlyph(feature, config)({ feature, bpPerPx, reversed, config })
}
