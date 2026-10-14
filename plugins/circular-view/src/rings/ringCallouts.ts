import { originHeadId } from '@jbrowse/core/util/originCut'
import { isNamedFeatureHost } from '@jbrowse/display-kit/floatingLabelHost'

import { tickReachPx } from '../CircularView/rulerLabels.ts'
import { stripPerRingPx } from './ringHost.ts'

import type { Ring } from './ringHost.ts'

export const CALLOUT_FONT_PX = 11
const CALLOUT_LINE_PX = 13
const CALLOUT_ELBOW_GAP_PX = 4
const CALLOUT_LEADER_PX = 14

/**
 * What a circle naming its features outside reserves past its ruler: the
 * leader and a line. The text runs level, so it spills sideways into a wide
 * box's spare width rather than claiming radius.
 */
export const calloutGutterPx =
  tickReachPx + CALLOUT_ELBOW_GAP_PX + CALLOUT_LEADER_PX + CALLOUT_LINE_PX

export interface Callout {
  key: string
  text: string
  /** leader from the feature's outer edge, out past the ticks, to the text */
  leader: [number, number][]
  textXY: [number, number]
  side: 'left' | 'right'
}

interface Candidate {
  key: string
  text: string
  turn: number
  anchorPx: number
  weight: number
  y: number
}

/** Spaces one side's labels a line apart within the circle's height. */
function spread(side: Candidate[], labelPx: number) {
  const capacity = Math.floor((2 * labelPx) / CALLOUT_LINE_PX)
  const kept = [...side]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, capacity)
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < kept.length; i++) {
    kept[i]!.y = Math.max(kept[i]!.y, kept[i - 1]!.y + CALLOUT_LINE_PX)
  }
  const last = kept.length - 1
  if (last >= 0) {
    kept[last]!.y = Math.min(kept[last]!.y, labelPx)
  }
  for (let i = last - 1; i >= 0; i--) {
    kept[i]!.y = Math.min(kept[i]!.y, kept[i + 1]!.y - CALLOUT_LINE_PX)
  }
  return kept
}

/**
 * Every feature a ring's display names, labelled level on screen outside the
 * circle's ticks and joined to its feature by a leader, as a plasmid map
 * names its features. Each half of the screen stacks its labels a line apart
 * nearest the height of their features; past what the half holds, the widest
 * features keep theirs. Points are in the screen's frame, centred on the
 * circle, so the caller draws them unrotated.
 */
export function ringCallouts({
  rings,
  radiusPx,
  stripRadiusPx,
  offsetRadians,
}: {
  rings: readonly Ring[]
  radiusPx: number
  stripRadiusPx: number
  offsetRadians: number
}): Callout[] {
  const elbowPx = radiusPx + tickReachPx + CALLOUT_ELBOW_GAP_PX
  const labelPx = elbowPx + CALLOUT_LEADER_PX
  const right: Candidate[] = []
  const left: Candidate[] = []
  for (const ring of rings) {
    const { display } = ring
    if (!isNamedFeatureHost(display)) {
      continue
    }
    const features = display.namedFeatures
    const ids = new Set(features.map(f => f.featureId))
    const scale = stripPerRingPx(ring)
    for (const f of features) {
      const head = originHeadId(f.featureId)
      const anchorPx = ring.outerPx - f.top / scale
      if ((head && ids.has(head)) || anchorPx <= ring.innerPx) {
        continue
      }
      const turn = (f.left + f.width / 2) / stripRadiusPx + offsetRadians
      const candidate = {
        key: `${display.id}-${f.featureId}`,
        text: f.text,
        turn,
        anchorPx: Math.min(anchorPx, ring.outerPx),
        weight: f.width,
        y: labelPx * Math.sin(turn),
      }
      ;(Math.cos(turn) >= 0 ? right : left).push(candidate)
    }
  }
  const place = (side: Candidate[], sign: 1 | -1) =>
    spread(side, labelPx).map(c => {
      const x = sign * Math.sqrt(Math.max(0, labelPx ** 2 - c.y ** 2))
      const at = (r: number): [number, number] => [
        r * Math.cos(c.turn),
        r * Math.sin(c.turn),
      ]
      return {
        key: c.key,
        text: c.text,
        leader: [at(c.anchorPx), at(elbowPx), [x, c.y]],
        textXY: [x + sign * 3, c.y],
        side: sign === 1 ? 'right' : 'left',
      } satisfies Callout
    })
  return [...place(right, 1), ...place(left, -1)]
}
