import { SimpleFeature } from '@jbrowse/core/util'

import type { ReducedFeature } from './fetchChains'

/**
 * Helper function to convert a chain of ReducedFeatures into a SimpleFeature
 * with subfeatures representing each part of the chain
 */
export function chainToSimpleFeature(
  chain: ReducedFeature[],
  readsOverlap?: boolean,
) {
  if (chain.length === 0) {
    throw new Error('Chain cannot be empty')
  }

  const firstFeat = chain[0]!

  // Create a synthetic feature that encompasses the entire chain
  const syntheticFeature = new SimpleFeature({
    uniqueId: firstFeat.id,
    id: firstFeat.id,
    name: firstFeat.name,
    refName: firstFeat.refName,
    start: Math.min(...chain.map(f => f.start)),
    end: Math.max(...chain.map(f => f.end)),
    strand: firstFeat.strand,
    flags: firstFeat.flags,
    tlen: firstFeat.tlen,
    pair_orientation: firstFeat.pair_orientation,
    clipPos: firstFeat.clipPos,
    ...(firstFeat.next_ref && { next_ref: firstFeat.next_ref }),
    ...(firstFeat.next_pos !== undefined && { next_pos: firstFeat.next_pos }),
    ...(firstFeat.SA && { SA: firstFeat.SA }),
    ...(readsOverlap !== undefined && { readsOverlap }),
    // Add subfeatures for each part of the chain
    subfeatures: chain.map((feat, idx) => ({
      uniqueId: `${feat.id}_${idx}`,
      id: `${feat.id}_${idx}`,
      name: feat.name,
      refName: feat.refName,
      start: feat.start,
      end: feat.end,
      strand: feat.strand,
      type: 'alignment_part',
      flags: feat.flags,
      tlen: feat.tlen,
      pair_orientation: feat.pair_orientation,
      clipPos: feat.clipPos,
      ...(feat.next_ref && { next_ref: feat.next_ref }),
      ...(feat.next_pos !== undefined && { next_pos: feat.next_pos }),
      ...(feat.SA && { SA: feat.SA }),
    })),
  })

  return syntheticFeature
}
