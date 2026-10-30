import alignments from './alignments.ts'
import features from './features.ts'
import marks from './marks.ts'
import variant from './variant.ts'
import wiggle from './wiggle.ts'

import type { PixelFixture } from '../fixture.ts'

export const FIXTURES: readonly PixelFixture[] = [
  ...features,
  ...variant,
  ...marks,
  ...wiggle,
  ...alignments,
]
