import { defineMark } from '@jbrowse/render-core/marks'

import { ringShape } from './ringShape.ts'

import type { RingChannels } from './ringShape.ts'
import type { MarkFrame, MarkImage } from '@jbrowse/render-core/marks'

/** Rings one canvas draws: a pass holds one texture, so one pass per ring. */
export const RING_PASSES = 8

/** One ring's payload: its annulus, and the strip it samples. */
export interface RingCell {
  index: number
  display: { paintCount: number; renderNow: () => void }
  channels: RingChannels
  strip: MarkImage | undefined
}

export interface RingFrame extends MarkFrame {
  centerX: number
  centerY: number
  offsetRadians: number
}

/**
 * The mark list a ring canvas draws through: `RING_PASSES` ring marks, the
 * i-th drawing the cell keyed i and sampling its strip.
 */
export const ringMarks = Array.from({ length: RING_PASSES }, (_, i) => {
  const own = (cell: RingCell) => cell.index % RING_PASSES === i
  return defineMark<
    RingCell,
    RingFrame,
    RingChannels,
    ReturnType<typeof params>
  >({
    shape: ringShape(`ring${i}`),
    channels: cell => (own(cell) ? cell.channels : undefined),
    params,
    texture: (_state, cell) => (own(cell) ? cell.strip : undefined),
  })
})

function params(state: RingFrame, cell: RingCell) {
  return {
    centerX: state.centerX,
    centerY: state.centerY,
    offsetRadians: state.offsetRadians,
    strip: cell.strip,
  }
}
