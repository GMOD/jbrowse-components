import { keyframes } from '../util/tss-react/index.ts'

// Animate opacity (a compositor-offloaded property) rather than visibility so
// the animation keeps running on the GPU compositor thread while the main
// thread is busy. visibility/width/color animations run on the main thread and
// freeze during jank.
export const dot1 = keyframes`
  0%, 25% { opacity: 0; }
  25.1%, 100% { opacity: 1; }
`
export const dot2 = keyframes`
  0%, 50% { opacity: 0; }
  50.1%, 100% { opacity: 1; }
`
export const dot3 = keyframes`
  0%, 75% { opacity: 0; }
  75.1%, 100% { opacity: 1; }
`
