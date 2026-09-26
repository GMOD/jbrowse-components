import { aggregateFieldName } from './markRuleFacts.ts'
import {
  DEFAULT_AGGREGATE_OP,
  DEFAULT_COVERAGE_AS,
  DEFAULT_PILEUP_AS,
} from './markVocabulary.ts'

import type { AggregateOpName } from './markVocabulary.ts'

/** The far end a `mate` step writes, as `x2` reads a position on another sequence. */
export const MATE_X2 = { chrom: 'mate.refName', pos: 'mate.start' } as const

/**
 * The channels a step list fills for a mark that leaves them unwritten, the
 * way a ggplot2 stat names the variable its geom reads: `y` is the depth a
 * `coverage` writes or the one summary a single-op `aggregate` writes, `row`
 * the row a `pileup` packs, and `x2` the other end a `mate` finds.
 */
export interface StepChannels {
  y?: string
  row?: string
  x2?: typeof MATE_X2
}

/** A step as a config node or a snapshot holds it, defaults present or not. */
export interface ChannelStep {
  type: string
  as?: string | readonly string[]
  ops?: readonly { op?: AggregateOpName; field?: string; as?: string }[]
}

function outputOf(step: ChannelStep, fallback: string) {
  return typeof step.as === 'string' && step.as !== '' ? step.as : fallback
}

/**
 * What {@link StepChannels} a mark's steps leave it, read over the display's,
 * the facet's and then the mark's own steps in the order they run. An
 * `aggregate` or `coverage` makes its features anew, so it clears the row and
 * the other end a step before it wrote, and an aggregate writing two
 * summaries names no `y`.
 */
export function stepChannels(
  steps: readonly (ChannelStep | undefined)[],
): StepChannels {
  let channels: StepChannels = {}
  for (const step of steps) {
    switch (step?.type) {
      case undefined: {
        break
      }
      case 'coverage': {
        channels = { y: outputOf(step, DEFAULT_COVERAGE_AS) }
        break
      }
      case 'aggregate': {
        const [only, ...rest] = step.ops ?? []
        channels =
          only && rest.length === 0
            ? {
                y: aggregateFieldName({
                  op: only.op ?? DEFAULT_AGGREGATE_OP,
                  field: only.field,
                  as: only.as,
                }),
              }
            : {}
        break
      }
      case 'pileup': {
        channels = { ...channels, row: outputOf(step, DEFAULT_PILEUP_AS) }
        break
      }
      case 'mate': {
        channels = { ...channels, x2: MATE_X2 }
        break
      }
      default: {
        break
      }
    }
  }
  return channels
}
