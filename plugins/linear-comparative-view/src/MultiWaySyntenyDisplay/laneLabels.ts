import { measureText } from '@jbrowse/core/util/measureText'
import { cullOverlappingLabels } from '@jbrowse/display-ui'
import { keepFeatureLabel } from '@jbrowse/plugin-canvas'

import type { LaneGene } from './geneGlyph.ts'
import type { Lane } from './laneStack.ts'

export const GENE_LABEL_FONT_PX = 10
export const GENE_LABEL_HALO_PX = 1
export const GENE_LABEL_GAP_PX = 1

export interface PlacedLaneLabel {
  key: string
  text: string
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

interface DrawnName {
  id: string
  name: string
  left: number
  right: number
}

function drawnNames(
  lane: LabelledLane,
  genes: readonly LaneGene[],
  width: number,
) {
  const out: DrawnName[] = []
  for (const { feature } of genes) {
    const name: unknown = feature.get('name')
    const span = lane.spanOf(
      feature.get('refName'),
      feature.get('start'),
      feature.get('end'),
    )
    if (typeof name === 'string' && name && span) {
      const left = Math.min(span[0], span[1])
      const right = Math.max(span[0], span[1])
      if (right >= 0 && left <= width) {
        out.push({ id: feature.id(), name, left, right })
      }
    }
  }
  return out.sort((a, b) => a.left - b.left)
}

/**
 * Each lane's gene names, in the row under its glyphs, decimated the way the
 * feature track decimates: a name is kept only where the gap between its
 * neighbours' edges holds it (`keepFeatureLabel`), and of the names left, one
 * meeting a kept name's halo is dropped (`cullOverlappingLabels`).
 */
export function placeLaneLabels({
  lanes,
  genesOf,
  glyphHeight,
  width,
  height,
  fontFamily,
}: {
  lanes: readonly LabelledLane[]
  genesOf: (assemblyName: string) => readonly LaneGene[]
  glyphHeight: number
  width: number
  height: number
  fontFamily: string
}): PlacedLaneLabel[] {
  const candidates: Candidate[] = []
  for (const lane of lanes) {
    const names = drawnNames(lane, genesOf(lane.assemblyName), width)
    const top = lane.glyphTop + glyphHeight + GENE_LABEL_GAP_PX
    names.forEach((n, i) => {
      const roomLeft = names[i - 1]?.right ?? -Infinity
      const roomRight = names[i + 1]?.left ?? Infinity
      const textWidth = measureText(n.name, GENE_LABEL_FONT_PX, fontFamily)
      if (
        keepFeatureLabel('fitWidth', roomRight - roomLeft, textWidth, false, 1)
      ) {
        const left = (n.left + n.right) / 2 - textWidth / 2
        candidates.push({
          key: `${lane.assemblyName}:${n.id}`,
          text: n.name,
          left,
          right: left + textWidth,
          top,
          bottom: top + GENE_LABEL_FONT_PX,
          width: textWidth,
        })
      }
    })
  }
  return cullOverlappingLabels(
    candidates,
    width,
    height,
    GENE_LABEL_HALO_PX,
  ).map(({ right, bottom, ...placed }) => placed)
}
