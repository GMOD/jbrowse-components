import {
  sashimiBandsOf,
  sashimiLabels,
} from '../../LinearAlignmentsDisplay/renderers/sashimiMarks.ts'
import { makeTestRenderState } from '../../LinearAlignmentsDisplay/testUtils.ts'
import { SASHIMI_SIDES, buildSashimiBandFeeds } from './bandFeed.ts'
import { visibleRegionJunctions } from './computeOverlay.ts'
import { mergeJunctions } from './junctions.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { RegionInfo } from '../arcs/arcTypes.ts'
import type { JunctionFilter } from './junctions.ts'

export interface TestDisplayedRegion extends RegionInfo {
  reversed?: boolean
}

export interface ComputeSashimiArcsOpts extends JunctionFilter {
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>
  visibleRegions: {
    refName: string
    displayedRegionIndex: number
  }[]
  /**
   * The view's displayed regions, drawn abutting from x 0 at 1px per bp; one
   * covering all of chr1 when absent.
   */
  displayed?: TestDisplayedRegion[]
  viewWidthPx: number
  coverageHeight: number
  sashimiArcsHeight: number
  downJunctionKeys: ReadonlySet<string>
}

const ALL_OF_CHR1: TestDisplayedRegion[] = [
  { refName: 'chr1', start: 0, end: 2 ** 31, displayedRegionIndex: 0 },
]

const COLORS = {
  colorFwdStrand: [1, 0, 0],
  colorRevStrand: [0, 0, 1],
  colorPairLR: [0.5, 0.5, 0.5],
} satisfies Parameters<typeof buildSashimiBandFeeds>[0]['colors']

// The view's region table for regions laid out left to right, a reversed one
// anchored on its end and counting down.
function linkRegionsOf(displayed: TestDisplayedRegion[]) {
  let px = 0
  return displayed.map(r => {
    const anchorPx = px
    px += r.end - r.start
    return {
      anchorPx,
      anchorBp: r.reversed ? r.end : r.start,
      signedPxPerBp: r.reversed ? -1 : 1,
    }
  })
}

// The merge, the feed and the marks' label placement composed: every junction
// the marks draw, tagged with its side, the displayed regions its feet are
// filed under and its count label where one shows (x in canvas px, y from its
// band's top), ascending by score.
export function computeSashimiArcs(opts: ComputeSashimiArcsOpts) {
  const displayed = opts.displayed ?? ALL_OF_CHR1
  const junctions = [
    ...mergeJunctions(
      visibleRegionJunctions(opts.rpcDataMap, opts.visibleRegions),
      opts,
    ).values(),
  ]
  const feeds = buildSashimiBandFeeds({
    junctions,
    downJunctionKeys: opts.downJunctionKeys,
    displayed,
    colors: COLORS,
  })
  const state = makeTestRenderState({
    canvasWidth: opts.viewWidthPx,
    canvasHeight: 400,
    coverageHeight: opts.coverageHeight,
    sashimiArcsHeight: opts.sashimiArcsHeight,
    linkRegions: linkRegionsOf(displayed),
    sections: [
      {
        pileupTopOffset: 200,
        coverageTopOffset: 0,
        covClipTop: 0,
        covClipHeight: opts.coverageHeight,
        pileupClipTop: 200,
        pileupClipHeight: 200,
        connectorClipTop: 0,
        connectorClipHeight: 0,
        sashimiBandTop: opts.coverageHeight,
      },
    ],
  })
  const bands = sashimiBandsOf(state, state.sections[0]!)
  const labels = new Map(
    sashimiLabels(state, [feeds]).map(label => [label.key, label]),
  )
  return [...feeds]
    .flatMap(([regionIndex, feed]) =>
      SASHIMI_SIDES.flatMap(side =>
        feed[side === 'up' ? 'upHits' : 'downHits'].map((j, i) => {
          const label = labels.get(`0:${j.key}`)
          return {
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
            label: label && {
              x: label.x,
              y: label.y - (bands[side]?.top ?? 0),
            },
          }
        }),
      ),
    )
    .sort((a, b) => a.score - b.score)
}
