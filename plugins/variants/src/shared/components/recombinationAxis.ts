import { axisPlotBox, scoreToAxisY } from '@jbrowse/wiggle-core'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Ticks at the ends plus three between them: enough to read a 0..max ramp
// without crowding a strip that is rarely more than ~60px tall.
const NUM_INTERVALS = 4

export type RecombinationBox = ReturnType<typeof axisPlotBox>

/**
 * The plot box the recombination curve and its y-axis share — the same
 * `YSCALEBAR_LABEL_OFFSET` inset at both ends that every wiggle-family display
 * uses, so the numbers beside the curve are the numbers the curve was drawn
 * against.
 */
export function recombinationBox(height: number): RecombinationBox {
  return axisPlotBox(height)
}

/**
 * Screen y for one recombination value. The single mapping the curve and the
 * axis both go through, which is the agreement `YScaleTicks` requires of a
 * producer and its renderer — stated here as one function rather than as two
 * copies of `topPadding + plotHeight * (1 - value / maxValue)`.
 */
export function recombinationY(
  value: number,
  maxValue: number,
  box: RecombinationBox,
) {
  return scoreToAxisY(value / maxValue, box)
}

/**
 * Evenly spaced ticks from 0 to `maxValue`, labelled to two decimals — the
 * `1 - r²` range is [0, 1], so two decimals is the resolution that distinguishes
 * adjacent ticks without inventing precision.
 */
export function recombinationTicks(
  height: number,
  maxValue: number,
): YScaleTicks {
  const box = recombinationBox(height)
  return {
    yTop: box.yTop,
    yBottom: box.yBottom,
    items: Array.from({ length: NUM_INTERVALS + 1 }, (_, i) => {
      const value = (maxValue * i) / NUM_INTERVALS
      return {
        value,
        y: recombinationY(value, maxValue, box),
        label: value.toFixed(2),
      }
    }),
  }
}
