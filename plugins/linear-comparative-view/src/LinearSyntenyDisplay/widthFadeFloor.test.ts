import { WIDTH_FADE_FLOOR } from '@jbrowse/synteny-core'

import { KIND_BASE } from '../LinearSyntenyRPC/syntenyColors.ts'
import { thinWidthFade } from './shaders/syntenyTypes.js.generated.ts'

// The circular view fades its ribbons to the floor synteny-core holds, and this
// shader to its own constant, so a faded alignment keeps the same least alpha in
// both views only while the two numbers agree
test('the shader fades a vanishing ribbon to the shared floor', () => {
  expect(thinWidthFade(0, KIND_BASE, true)).toBeCloseTo(WIDTH_FADE_FLOOR, 6)
})
