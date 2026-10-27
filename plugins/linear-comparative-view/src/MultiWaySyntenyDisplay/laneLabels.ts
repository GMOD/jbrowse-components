import { measureText } from '@jbrowse/core/util/measureText'
import { computeLabelLeftPx, keepFeatureLabel } from '@jbrowse/plugin-features'

import type { LaneGene } from './geneGlyph.ts'
import type { Lane } from './laneStack.ts'
import type { Span } from './layoutMultiWay.ts'
import type { Feature } from '@jbrowse/core/util'

export const GENE_LABEL_FONT_PX = 10
export const GENE_LABEL_HALO_PX = 1
export const GENE_LABEL_GAP_PX = 1

const BOLD_WIDTH = 1.1

export interface GeneLabel {
  name: string
  width: number
}

export interface PlacedLaneLabel {
  key: string
  text: string
  pinned: boolean
  left: number
  top: number
  width: number
  row: number
}

interface Candidate extends PlacedLaneLabel {
  maxLeft: number
}

type LabelledLane = Pick<Lane, 'assemblyName' | 'glyphTop' | 'spansOf'>

export interface NamedSpan {
  id: string
  name: string
  left: number
  right: number
  group?: string
}

interface DrawnName extends NamedSpan {
  width: number
}

function widest(spans: readonly Span[]) {
  let best: Span | undefined
  for (const span of spans) {
    if (!best || Math.abs(span[1] - span[0]) > Math.abs(best[1] - best[0])) {
      best = span
    }
  }
  return best
}

function drawnNames(
  lane: LabelledLane,
  genes: readonly LaneGene[],
  boxes: readonly NamedSpan[],
  labelOf: (feature: Feature) => GeneLabel | undefined,
  groups: ReadonlyMap<string, string> | undefined,
  width: number,
  fontFamily: string | undefined,
) {
  const out: DrawnName[] = boxes
    .filter(b => b.right >= 0 && b.left <= width)
    .map(b => ({
      ...b,
      width: measureText(b.name, GENE_LABEL_FONT_PX, fontFamily),
    }))
  for (const { feature, drawn } of genes) {
    const label = labelOf(feature)
    const span = widest(
      lane.spansOf(
        feature.get('refName'),
        drawn.get('start'),
        drawn.get('end'),
      ),
    )
    if (label && span) {
      const left = Math.min(span[0], span[1])
      const right = Math.max(span[0], span[1])
      if (right >= 0 && left <= width) {
        const id = feature.id()
        out.push({ id, ...label, left, right, group: groups?.get(id) })
      }
    }
  }
  return out.sort((a, b) => a.left - b.left)
}

/**
 * Where the free stretch right of `names[i]` ends: the left edge of the next
 * name it does not overlap, so a gene inside another's intron runs to the gene
 * beside the pair, not to the one around it. `names` is sorted by left edge.
 */
function roomRightOf(names: readonly NamedSpan[], i: number) {
  const n = names[i]!
  for (let j = i + 1; j < names.length; j++) {
    if (names[j]!.left >= n.right) {
      return names[j]!.left
    }
  }
  return Infinity
}

function slideToFreeSlots(
  candidates: Candidate[],
  width: number,
  height: number,
) {
  const gap = 2 * GENE_LABEL_HALO_PX
  const rows = new Map<number, PlacedLaneLabel[]>()
  candidates.sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) ||
      a.maxLeft - a.left - (b.maxLeft - b.left) ||
      a.left - b.left,
  )
  for (const { maxLeft, ...c } of candidates) {
    const taken = rows.get(c.row) ?? []
    let left = c.left
    for (const t of taken) {
      if (t.left - gap < left + c.width && t.left + t.width + gap > left) {
        left = t.left + t.width + gap
      }
    }
    if (
      left >= 0 &&
      left <= maxLeft &&
      left + c.width <= width &&
      c.top >= 0 &&
      c.top + GENE_LABEL_FONT_PX <= height
    ) {
      const at = taken.findIndex(t => t.left > left)
      taken.splice(at < 0 ? taken.length : at, 0, { ...c, left })
      rows.set(c.row, taken)
    }
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, taken]) => taken)
}

export function placeLaneLabels({
  lanes,
  genesOf,
  boxesOf = () => [],
  labelOf,
  groupsOf = () => undefined,
  pinnedGroups = new Set(),
  glyphHeight,
  width,
  height,
  fontFamily,
}: {
  lanes: readonly LabelledLane[]
  genesOf: (assemblyName: string) => readonly LaneGene[]
  boxesOf?: (assemblyName: string) => readonly NamedSpan[]
  labelOf: (feature: Feature) => GeneLabel | undefined
  groupsOf?: (assemblyName: string) => ReadonlyMap<string, string> | undefined
  pinnedGroups?: ReadonlySet<string>
  glyphHeight: number
  width: number
  height: number
  fontFamily: string | undefined
}): PlacedLaneLabel[] {
  const candidates: Candidate[] = []
  for (const [row, lane] of lanes.entries()) {
    const names = drawnNames(
      lane,
      genesOf(lane.assemblyName),
      boxesOf(lane.assemblyName),
      labelOf,
      groupsOf(lane.assemblyName),
      width,
      fontFamily,
    )
    const top = lane.glyphTop + glyphHeight + GENE_LABEL_GAP_PX
    names.forEach((n, i) => {
      const pinned = n.group !== undefined && pinnedGroups.has(n.group)
      const textWidth = n.width * (pinned ? BOLD_WIDTH : 1)
      const left = computeLabelLeftPx(textWidth, {
        featureLeftPx: n.left,
        featureRightPx: n.right,
        screenStartPx: 0,
      })
      if (
        keepFeatureLabel(
          'fitWidth',
          roomRightOf(names, i) - left,
          textWidth,
          pinned,
          1,
        )
      ) {
        candidates.push({
          key: `${lane.assemblyName}:${n.id}`,
          text: n.name,
          pinned,
          left,
          maxLeft:
            textWidth <= n.right - n.left
              ? Math.min(n.right, width) - textWidth
              : left,
          top,
          width: textWidth,
          row,
        })
      }
    })
  }
  return slideToFreeSlots(candidates, width, height)
}
