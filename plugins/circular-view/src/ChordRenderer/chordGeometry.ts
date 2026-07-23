import { parseSvAlt } from '@jbrowse/sv-core'

import type { Block } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

/**
 * The block+position a chord's far end lands on. Prefers a VCF breakend
 * (ALT/INFO), then an explicit `mate` field, else the feature's own end.
 */
export function getEndpoint(
  feature: Feature,
  blocksForRefs: Record<string, Block>,
  startBlock: Block,
) {
  const alt = (feature.get('ALT') as string[] | undefined)?.[0]
  const mate = feature.get('mate') as
    | { refName: string; start: number }
    | undefined
  const parsed = parseSvAlt(feature, alt)
  return parsed
    ? {
        endBlock: blocksForRefs[parsed.mateRefName],
        // parsed.matePos is VCF 1-based; convert to 0-based like the other
        // parseSvAlt consumers (sv-core getBreakendCoveringRegions, arc
        // makeFeaturePair)
        endPosition: parsed.matePos - 1,
      }
    : mate
      ? { endBlock: blocksForRefs[mate.refName], endPosition: mate.start }
      : { endBlock: startBlock, endPosition: feature.get('end') }
}
