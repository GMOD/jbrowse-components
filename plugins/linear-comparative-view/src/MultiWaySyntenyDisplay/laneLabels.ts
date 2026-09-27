import { measureText } from '@jbrowse/core/util/measureText'
import { cullOverlappingLabels } from '@jbrowse/display-ui'
import { keepFeatureLabel } from '@jbrowse/plugin-canvas'

import type { LaneGene } from './geneGlyph.ts'
import type { Lane } from './laneStack.ts'
import type { Feature } from '@jbrowse/core/util'

export const GENE_LABEL_FONT_PX = 10
export const GENE_LABEL_HALO_PX = 1
export const GENE_LABEL_GAP_PX = 1

// a bold name's advance over the regular widths `measureText` tabulates
const BOLD_WIDTH = 1.1

export interface PlacedLaneLabel {
  key: string
  text: string
  /** of the hovered or selected group, so kept first and drawn bold */
  pinned: boolean
  /** the label's left edge, in the stack's px */
  left: number
  /** the label box's top, in the stack's px */
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
  /** the group the gene carries, where one claims it */
  group?: string
}

function drawnNames(
  lane: LabelledLane,
  genes: readonly LaneGene[],
  boxes: readonly NamedSpan[],
  textOf: (feature: Feature) => string | undefined,
  groups: ReadonlyMap<string, string> | undefined,
  width: number,
) {
  const out = boxes.filter(b => b.right >= 0 && b.left <= width)
  for (const { feature } of genes) {
    const name = textOf(feature)
    const span = lane.spanOf(
      feature.get('refName'),
      feature.get('start'),
      feature.get('end'),
    )
    if (name && span) {
      const left = Math.min(span[0], span[1])
      const right = Math.max(span[0], span[1])
      if (right >= 0 && left <= width) {
        const id = feature.id()
        out.push({ id, name, left, right, group: groups?.get(id) })
      }
    }
  }
  return out.sort((a, b) => a.left - b.left)
}

/**
 * Each lane's gene names, in the row under its glyphs — its genes' own and
 * those of the placement boxes standing in for genes its annotation lacks —
 * decimated the way the feature track decimates: a name is kept only where the gap between its
 * neighbours' edges holds it (`keepFeatureLabel`), and of the names left, one
 * meeting a kept name's halo is dropped (`cullOverlappingLabels`). The names of
 * a pinned group — the hovered or selected one — skip the room test and are
 * placed first, so the group reads down the whole stack.
 */
export function placeLaneLabels({
  lanes,
  genesOf,
  boxesOf = () => [],
  textOf,
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
  /** a gene's label, `geneTextOf` */
  textOf: (feature: Feature) => string | undefined
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
      textOf,
      groupsOf(lane.assemblyName),
      width,
    )
    const top = lane.glyphTop + glyphHeight + GENE_LABEL_GAP_PX
    names.forEach((n, i) => {
      const roomLeft = names[i - 1]?.right ?? -Infinity
      const roomRight = names[i + 1]?.left ?? Infinity
      const pinned = n.group !== undefined && pinnedGroups.has(n.group)
      const textWidth =
        measureText(n.name, GENE_LABEL_FONT_PX, fontFamily) *
        (pinned ? BOLD_WIDTH : 1)
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
