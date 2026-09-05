import { syntenyPanBufferPx } from '@jbrowse/synteny-core'

import type { CumBpSpan } from '@jbrowse/synteny-core'

// The emit window a fetch at this viewport gets on one axis, before the snap
// and the clamp: the viewport plus a pan buffer each side, in that axis's
// cumBp. What a geometry suite passes as `window0`/`window1` when it is not
// about the window itself.
export function viewportWindow({
  viewOff,
  viewWidth,
  bpPerPx,
}: {
  viewOff: number
  viewWidth: number
  bpPerPx: number
}): CumBpSpan {
  const bufferPx = syntenyPanBufferPx(viewWidth)
  return {
    lo: (viewOff - bufferPx) * bpPerPx,
    hi: (viewOff + viewWidth + bufferPx) * bpPerPx,
  }
}
