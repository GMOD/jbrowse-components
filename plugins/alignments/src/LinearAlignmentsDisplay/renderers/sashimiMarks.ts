import {
  defineMark,
  linkApex,
  linkMark,
  withPassId,
} from '@jbrowse/render-core/marks'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import {
  SASHIMI_MAX_STROKE_PX,
  SASHIMI_SIDES,
} from '../../features/sashimi/bandFeed.ts'
import {
  SASHIMI_APEX_CLEARANCE_PX,
  sashimiLabelSpanPx,
} from '../../features/sashimi/computeOverlay.ts'

import type {
  SashimiBandFeed,
  SashimiSide,
} from '../../features/sashimi/bandFeed.ts'
import type { RenderState, SectionRender } from './rendererTypes.ts'
import type { LinkParams, Mark } from '@jbrowse/render-core/marks'

/** One side's band in screen px: where its arcs stand and the box that clips them. */
export interface SashimiBand {
  top: number
  height: number
  clipTop: number
  clipHeight: number
}

/** A section's render state with the band each side's arcs draw in. */
export interface SashimiBandState extends RenderState {
  sashimi: Record<SashimiSide, SashimiBand | undefined>
}

/**
 * Where a section's two sides draw. Up arcs hang off the histogram's zero
 * line, one scalebar offset above the coverage band's bottom, and may rise
 * into its top margin; down arcs hang from the top of the strip the layout
 * reserved, short of its bottom by the room a count label needs past an apex.
 */
export function sashimiBandsOf(
  state: RenderState,
  sec: SectionRender,
): SashimiBandState['sashimi'] {
  const upHeight = state.coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET
  const downHeight = state.sashimiArcsHeight - SASHIMI_APEX_CLEARANCE_PX
  return {
    up:
      upHeight > 0
        ? {
            top: sec.coverageTopOffset + YSCALEBAR_LABEL_OFFSET,
            height: upHeight,
            clipTop: sec.covClipTop,
            clipHeight: sec.covClipHeight,
          }
        : undefined,
    down:
      sec.sashimiBandTop !== undefined && downHeight > 0
        ? {
            top: sec.sashimiBandTop,
            height: downHeight,
            clipTop: sec.sashimiBandTop,
            clipHeight: state.sashimiArcsHeight,
          }
        : undefined,
  }
}

function sideParams(band: SashimiBand, state: RenderState, down: boolean) {
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
      domain: [1, SASHIMI_MAX_STROKE_PX] as [number, number],
      scale: 'linear' as const,
      range: [1, SASHIMI_MAX_STROKE_PX] as [number, number],
    },
  } satisfies LinkParams
}

const NO_BAND: SashimiBand = { top: 0, height: 0, clipTop: 0, clipHeight: 0 }

function sideMark(side: SashimiSide) {
  return defineMark({
    shape: withPassId(linkMark, side === 'up' ? 'sashimiUp' : 'sashimiDown'),
    channels: (f: SashimiBandFeed) => f[side],
    params: (s: SashimiBandState) =>
      sideParams(s.sashimi[side] ?? NO_BAND, s, side === 'down'),
    enabled: (s: SashimiBandState) => s.sashimi[side] !== undefined,
  })
}

/**
 * The splice junctions, `up` then `down`, in `SASHIMI_SIDES` order: a dome
 * from donor to acceptor whose apex plots the junction's span and whose stroke
 * its read count. Each spans the view, so a junction crosses a collapsed
 * intron whole.
 */
export const SASHIMI_MARKS: Mark<SashimiBandFeed, SashimiBandState>[] = [
  sideMark('up'),
  sideMark('down'),
]

/** A junction's read count, at its arc's apex in canvas px. */
export interface SashimiLabel {
  key: string
  x: number
  y: number
  count: number
}

const HITS = { up: 'upHits', down: 'downHits' } as const

/**
 * The count labels of every section, each at the apex its mark draws
 * (`linkApex`), so a label cannot stand where no arc does: an arc too narrow
 * on screen for its count gets none, nor does one whose apex is off the
 * canvas or whose dome the band clips to its legs.
 */
export function sashimiLabels(
  state: RenderState,
  sectionFeeds: readonly (ReadonlyMap<number, SashimiBandFeed> | undefined)[],
): SashimiLabel[] {
  const labels: SashimiLabel[] = []
  state.sections.forEach((sec, s) => {
    const feeds = sectionFeeds[s]
    if (!feeds || feeds.size === 0) {
      return
    }
    const bands = sashimiBandsOf(state, sec)
    for (const side of SASHIMI_SIDES) {
      const band = bands[side]
      if (band) {
        const params = sideParams(band, state, side === 'down')
        for (const [regionIdx, feed] of feeds) {
          const block = canvasWideBlock(regionIdx, state.canvasWidth)
          const hits = feed[HITS[side]]
          for (let i = 0; i < hits.length; i++) {
            const { key, count } = hits[i]!
            const apex = linkApex(feed[side], block, state, params, i)
            if (
              apex &&
              2 * apex.halfWidth >= sashimiLabelSpanPx(count) &&
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
