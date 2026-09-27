import { measureText } from '@jbrowse/core/util/measureText'
import { cullOverlappingLabels } from '@jbrowse/display-ui'
import { keepFeatureLabel } from '@jbrowse/plugin-canvas'

import type { LaneGene } from './geneGlyph.ts'
import type { Lane } from './laneStack.ts'
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
}

interface Candidate extends PlacedLaneLabel {
  right: number
  bottom: number
}

type LabelledLane = Pick<Lane, 'assemblyName' | 'glyphTop' | 'spanOf'>

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

function drawnNames(
  lane: LabelledLane,
  genes: readonly LaneGene[],
  boxes: readonly NamedSpan[],
  labelOf: (feature: Feature) => GeneLabel | undefined,
  groups: ReadonlyMap<string, string> | undefined,
  width: number,
  fontFamily: string,
) {
  const out: DrawnName[] = boxes
    .filter(b => b.right >= 0 && b.left <= width)
    .map(b => ({
      ...b,
      width: measureText(b.name, GENE_LABEL_FONT_PX, fontFamily),
    }))
  for (const { feature } of genes) {
    const label = labelOf(feature)
    const span = lane.spanOf(
      feature.get('refName'),
      feature.get('start'),
      feature.get('end'),
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
 * Each lane's gene and placement-box names under its glyphs, decimated as the
 * feature track decimates (`keepFeatureLabel`, then `cullOverlappingLabels`).
 * A pinned group's names skip the room test and are placed first.
 */
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
  fontFamily: string
}): PlacedLaneLabel[] {
  const candidates: Candidate[] = []
  for (const lane of lanes) {
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
      const roomLeft = names[i - 1]?.right ?? -Infinity
      const roomRight = names[i + 1]?.left ?? Infinity
      const pinned = n.group !== undefined && pinnedGroups.has(n.group)
      const textWidth = n.width * (pinned ? BOLD_WIDTH : 1)
      if (
        keepFeatureLabel('fitWidth', roomRight - roomLeft, textWidth, pinned, 1)
      ) {
        const left = (n.left + n.right) / 2 - textWidth / 2
        candidates.push({
          key: `${lane.assemblyName}:${n.id}`,
          text: n.name,
          pinned,
          left,
          right: left + textWidth,
          top,
          bottom: top + GENE_LABEL_FONT_PX,
          width: textWidth,
        })
      }
    })
  }
  const kept = cullOverlappingLabels(
    candidates.filter(c => c.pinned),
    width,
    height,
    GENE_LABEL_HALO_PX,
  )
  const gap = 2 * GENE_LABEL_HALO_PX
  const clear = (c: Candidate) =>
    !kept.some(
      k =>
        k.left - gap < c.right &&
        k.right + gap > c.left &&
        k.top - gap < c.bottom &&
        k.bottom + gap > c.top,
    )
  return [
    ...kept,
    ...cullOverlappingLabels(
      candidates.filter(c => !c.pinned && clear(c)),
      width,
      height,
      GENE_LABEL_HALO_PX,
    ),
  ].map(({ right, bottom, ...placed }) => placed)
}
