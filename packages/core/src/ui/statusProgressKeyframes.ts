import { keyframes } from '../util/tss-react/index.ts'

// The indeterminate sweep. One bar rather than MUI's two: two say nothing the
// first does not, and this one is drawn over work that is already saturating a
// thread.
//
// `transform` alone, like `loadingDotKeyframes`, because the compositor owns it
// — a `left` or `width` animation runs on the main thread and freezes during
// exactly the jank this bar exists to explain. The bar is 40% of the track, so
// -100% of its own width parks it clear of the left edge and 350% carries its
// left edge past the right one.
export const indeterminateSweep = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(350%); }
`
