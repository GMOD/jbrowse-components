import { openFeatureWidget } from '@jbrowse/core/util'

import { insertionForwardStart } from './components/findRowHover.ts'
import { resolveMafRowHover } from './components/mafHitTest.ts'

import type { InsertionHit } from './components/findRowHover.ts'
import type { LinearMafDisplayModel } from './stateModel.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The feature-details widget for one insertion marker. Taken as a resolved hit
 * rather than mouse coordinates, because the right-click menu holds the hit and
 * the anchor it was resolved at is long gone by the time an item is clicked.
 */
export function openInsertionWidget(
  node: IStateTreeNode,
  hover: InsertionHit & { sampleLabel: string },
) {
  const { length, sequence, chr, pos, strand, sampleLabel } = hover
  const start =
    pos === undefined ? 0 : insertionForwardStart(pos, length, strand)
  openFeatureWidget(node, {
    uniqueId: `maf-insertion-${chr}-${start}-${sampleLabel}`,
    type: 'insertion',
    name: `Insertion (${length}bp)`,
    refName: chr ?? '',
    start,
    end: start + length,
    length,
    sequence,
    // The MAF column order is the reference's, so a '-' row's bases read
    // against its own forward strand backwards. Said out loud rather than
    // silently reverse-complementing them: what the file holds is what the
    // display drew.
    sequenceOrientation:
      strand === -1
        ? 'alignment order (reverse complement of the sample forward strand)'
        : 'sample forward strand',
    sample: sampleLabel,
    strand,
  })
}

/**
 * On a plain click over an insertion marker, open the feature-details widget
 * with the inserted sequence. The hover tooltip drops the sequence once it
 * exceeds 20bp (see `MafAlignmentTooltipContents`), so clicking is the only
 * way to read a long insertion. Mirrors plugin-alignments' click-an-insertion →
 * `openCigarWidget` flow (same `insertion` feature type + `length`/`sequence`
 * fields). No-op unless the click lands on an insertion marker — the row hover
 * resolves a cell/deletion/empty otherwise — and only in `bases` mode where the
 * markers are actually drawn.
 */
export function openInsertionWidgetOnClick(
  model: LinearMafDisplayModel,
  mouseX: number,
  mouseY: number,
) {
  if (model.basesRenderingActive) {
    const hover = resolveMafRowHover(model, mouseX, mouseY)
    if (hover?.kind === 'insertion') {
      openInsertionWidget(model, hover)
    }
  }
}
