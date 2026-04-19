import { findGlyph } from '../glyphs/index.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

export function layoutFeature(args: {
  feature: Feature
  reversed: boolean
  config: DisplayConfig
}) {
  return findGlyph(args.feature, args.config)(args)
}
