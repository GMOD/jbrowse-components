import {
  defineMark,
  linkLabelAnchor,
  linkMark,
  withPassId,
} from '@jbrowse/render-core/marks'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import {
  JUNCTION_MAX_STROKE_PX,
  JUNCTION_SIDES,
} from '../../features/junctions/bandFeed.ts'
import {
  JUNCTION_APEX_CLEARANCE_PX,
  junctionLabelSpanPx,
} from '../../features/junctions/computeOverlay.ts'
import { sectionRenderState } from './rendererTypes.ts'

import type {
  JunctionsBandFeed,
  JunctionSide,
} from '../../features/junctions/bandFeed.ts'
import type {
  DisplayRenderState,
  RenderState,
  SectionRender,
} from './rendererTypes.ts'
import type { LinkParams, Mark } from '@jbrowse/render-core/marks'

/** One side's band in screen px: where its arcs stand and the box that clips them. */
export interface JunctionsBand {
  top: number
  height: number
  clipTop: number
  clipHeight: number
}

/** A section's render state with the band each side's arcs draw in. */
export interface JunctionsBandState extends RenderState {
  junctions: Record<JunctionSide, JunctionsBand | undefined>
}

/** The state the junctions marks draw and hit-test a section's bands by. */
export function junctionsBandState(
  state: DisplayRenderState,
  sec: SectionRender,
): JunctionsBandState {
  return {
    ...sectionRenderState(state, sec),
    junctions: junctionsBandsOf(state, sec),
  }
}

/**
 * Where a section's two sides draw. Up arcs hang off the histogram's zero
 * line, one scalebar offset above the coverage band's bottom, and may rise
 * into its top margin; down arcs hang from the top of the strip the layout
 * reserved, short of its bottom by the room a count label needs past an apex.
 * A strip stacked above the coverage band takes the up arcs instead: they
 * stand on its floor, short of its top by the same label room, and nothing
 * draws down.
 */
export function junctionsBandsOf(
  state: DisplayRenderState,
  sec: SectionRender,
): JunctionsBandState['junctions'] {
  const upHeight = state.coverage.height - 2 * YSCALEBAR_LABEL_OFFSET
  const { junctionsBand } = sec
  const stripHeight = (junctionsBand?.height ?? 0) - JUNCTION_APEX_CLEARANCE_PX
  const strip = junctionsBand && stripHeight > 0 ? junctionsBand : undefined
  return junctionsBand?.above
    ? {
        up: strip
          ? {
              top: strip.top + JUNCTION_APEX_CLEARANCE_PX,
              height: stripHeight,
              clipTop: strip.top,
              clipHeight: strip.height,
            }
          : undefined,
        down: undefined,
      }
    : {
        up:
          upHeight > 0
            ? {
                top: sec.coverageTopOffset + YSCALEBAR_LABEL_OFFSET,
                height: upHeight,
                clipTop: sec.coverageTopOffset,
                clipHeight: state.coverage.height,
              }
            : undefined,
        down: strip
          ? {
              top: strip.top,
              height: stripHeight,
              clipTop: strip.top,
              clipHeight: strip.height,
            }
          : undefined,
      }
}

function sideParams(band: JunctionsBand, state: RenderState, down: boolean) {
  return {
    reverse: down,
    rowOffsetPx: band.top,
    rowHeight: band.height,
    domain: [0, 1] as [number, number],
    scaleType: 'linear' as const,
    regions: state.linkRegions,
    linkShape: 'dome' as const,
    valued: true,
    sizePx: 1,
    sizeScale: {
      domain: [1, JUNCTION_MAX_STROKE_PX] as [number, number],
      scale: 'linear' as const,
      range: [1, JUNCTION_MAX_STROKE_PX] as [number, number],
    },
  } satisfies LinkParams
}

const NO_BAND: JunctionsBand = { top: 0, height: 0, clipTop: 0, clipHeight: 0 }

function sideMark(side: JunctionSide) {
  return defineMark({
    shape: withPassId(
      linkMark,
      side === 'up' ? 'junctionsUp' : 'junctionsDown',
    ),
    channels: (f: JunctionsBandFeed) => f[side],
    params: (s: JunctionsBandState) =>
      sideParams(s.junctions[side] ?? NO_BAND, s, side === 'down'),
    enabled: (s: JunctionsBandState) => s.junctions[side] !== undefined,
  })
}

/**
 * The splice junctions by side: a dome from donor to acceptor whose apex plots
 * the junction's span and whose stroke its read count. Each spans the view, so
 * a junction crosses a collapsed intron whole.
 */
export const JUNCTION_MARK: Record<
  JunctionSide,
  Mark<JunctionsBandFeed, JunctionsBandState>
> = { up: sideMark('up'), down: sideMark('down') }

/** `JUNCTION_MARK` in `JUNCTION_SIDES` order, for the uploads and the hit chain. */
export const JUNCTION_MARKS = JUNCTION_SIDES.map(side => JUNCTION_MARK[side])

/** A junction's read count, at its arc's apex in canvas px. */
export interface JunctionLabel {
  key: string
  x: number
  y: number
  count: number
}

/** The feed array holding each side's junctions, by side. */
export const JUNCTION_HITS = { up: 'upHits', down: 'downHits' } as const

/**
 * The count labels of every section, each where its mark says a label stands
 * (`linkLabelAnchor`): the apex, or over the middle of the stretch in view for
 * a junction the view sits inside. An arc too narrow on screen for its count
 * gets none, nor does one with nothing on the canvas.
 */
export function junctionLabels(
  state: DisplayRenderState,
  sectionFeeds: readonly (ReadonlyMap<number, JunctionsBandFeed> | undefined)[],
): JunctionLabel[] {
  const labels: JunctionLabel[] = []
  state.sections.forEach((sec, s) => {
    const feeds = sectionFeeds[s]
    if (!feeds || feeds.size === 0) {
      return
    }
    const bandState = junctionsBandState(state, sec)
    for (const side of JUNCTION_SIDES) {
      const band = bandState.junctions[side]
      if (band) {
        const params = sideParams(band, bandState, side === 'down')
        for (const [regionIdx, feed] of feeds) {
          const block = canvasWideBlock(regionIdx, state.canvasWidth)
          const hits = feed[JUNCTION_HITS[side]]
          for (let i = 0; i < hits.length; i++) {
            const { key, count } = hits[i]!
            const apex = linkLabelAnchor(
              feed[side],
              block,
              bandState,
              params,
              i,
            )
            if (
              apex &&
              2 * apex.halfWidth >= junctionLabelSpanPx(count) &&
              apex.x >= 0 &&
              apex.x <= state.canvasWidth
            ) {
              labels.push({ key: `${s}:${key}`, x: apex.x, y: apex.y, count })
            }
          }
        }
      }
    }
  })
  return labels
}
