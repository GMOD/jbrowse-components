import { stepsOutput } from './markRuleFacts.ts'

import type { StepOutline } from './markRuleFacts.ts'

/** The far end a `mate` step writes, as `x2` reads a position on another sequence. */
export const MATE_X2 = { refName: 'mate.refName', pos: 'mate.start' } as const

/**
 * The channels a step list fills for a mark that leaves them unwritten, the
 * way a ggplot2 stat names the variable its geom reads: `y` is the depth a
 * `coverage` writes or the one summary a single-op `aggregate` or `window`
 * writes, `row` the row a `pileup` packs, and `x2` the other end a `mate`
 * finds.
 */
export interface StepChannels {
  y?: string
  row?: string
  x2?: typeof MATE_X2
}

/** A step as a config node or a snapshot holds it, defaults present or not. */
export type ChannelStep = StepOutline

/**
 * What {@link StepChannels} a mark's steps leave it, read over the display's,
 * the facet's and then the mark's own steps in the order they run. A step
 * that makes its features anew keeps a channel only where it keeps the field
 * that channel read, as an `aggregate` grouped by a pileup's `row` does.
 */
export function stepChannels(
  steps: readonly (ChannelStep | undefined)[],
): StepChannels {
  const { channels, surviving } = stepsOutput(steps)
  const y = channels.get('y')
  const row = channels.get('row')
  const x2 = channels.has('x2') && (!surviving || surviving.has(MATE_X2.pos))
  return {
    ...(y === undefined ? {} : { y }),
    ...(row === undefined ? {} : { row }),
    ...(x2 ? { x2: MATE_X2 } : {}),
  }
}
