import { buildSyntenyRegionData } from '../../LinearSyntenyRPC/buildSyntenyRegionData.ts'

import type { MultiPairFeature } from '@jbrowse/plugin-comparative-adapters'

export function feat(
  overrides: Partial<MultiPairFeature> = {},
): MultiPairFeature {
  return {
    queryGenome: 'genomeA',
    origRefName: 'chr1',
    start: 100,
    end: 200,
    mateStart: 0,
    mateEnd: 100,
    mateRefName: 'chr1',
    strand: 1,
    syriType: undefined,
    identity: 0.99,
    featureId: 'f1',
    segmentId: undefined,
    cigar: undefined,
    cs: undefined,
    ...overrides,
  }
}

export function buildRegionData(
  region: { start: number; end: number; refName?: string },
  features: MultiPairFeature[],
) {
  return buildSyntenyRegionData(
    { start: region.start, end: region.end, refName: region.refName ?? 'chr1' },
    [['genomeA', features]],
  )
}
