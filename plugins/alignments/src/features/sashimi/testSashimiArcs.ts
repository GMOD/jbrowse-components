import { buildSashimiBandFeeds, SASHIMI_SIDES } from './bandFeed.ts'
import {
  projectSashimiLabels,
  visibleRegionJunctions,
} from './computeOverlay.ts'
import { mergeJunctions } from './junctions.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { RegionInfo } from '../arcs/arcTypes.ts'
import type { ProjectSashimiLabelsOpts } from './computeOverlay.ts'
import type { JunctionFilter } from './junctions.ts'

export interface ComputeSashimiArcsOpts
  extends ProjectSashimiLabelsOpts, JunctionFilter {
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>
  visibleRegions: {
    refName: string
    displayedRegionIndex: number
  }[]
  /** The view's displayed regions; one covering all of chr1 when absent. */
  displayed?: RegionInfo[]
}

const ALL_OF_CHR1: RegionInfo[] = [
  { refName: 'chr1', start: 0, end: 2 ** 31, displayedRegionIndex: 0 },
]

const COLORS = {
  colorFwdStrand: [1, 0, 0],
  colorRevStrand: [0, 0, 1],
  colorPairLR: [0.5, 0.5, 0.5],
} satisfies Parameters<typeof buildSashimiBandFeeds>[0]['colors']

// The merge, the feed and the label projection composed: every junction the
// marks draw, tagged with its side, the displayed region it is filed under and
// its count label where one shows, ascending by score.
export function computeSashimiArcs(opts: ComputeSashimiArcsOpts) {
  const junctions = [
    ...mergeJunctions(
      visibleRegionJunctions(opts.rpcDataMap, opts.visibleRegions),
      opts,
    ).values(),
  ]
  const labels = projectSashimiLabels(junctions, opts)
  const feeds = buildSashimiBandFeeds({
    junctions,
    downJunctionKeys: opts.downJunctionKeys,
    displayed: opts.displayed ?? ALL_OF_CHR1,
    colors: COLORS,
  })
  return [...feeds]
    .flatMap(([regionIndex, feed]) =>
      SASHIMI_SIDES.flatMap(side =>
        feed[side === 'up' ? 'upHits' : 'downHits'].map((j, i) => ({
          start: j.start,
          end: j.end,
          refName: j.refName,
          score: j.count,
          strand: j.strand,
          motif: j.motif,
          side,
          regionIndex,
          endRegionIndex: feed[side].x2Region[i]!,
          y: feed[side].y![i]!,
          size: feed[side].size![i]!,
          label: labels[side].find(l => l.key === j.key),
        })),
      ),
    )
    .sort((a, b) => a.score - b.score)
}
