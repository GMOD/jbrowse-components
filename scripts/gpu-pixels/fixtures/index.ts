import features from './features.ts'
import marks from './marks.ts'
import variant from './variant.ts'

import type { PixelFixture } from '../fixture.ts'

export const FIXTURES: readonly PixelFixture[] = [
  ...features,
  ...variant,
  ...marks,
]
