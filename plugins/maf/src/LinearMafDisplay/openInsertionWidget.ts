import { openFeatureWidget } from '@jbrowse/core/util'

import { insertionForwardStart } from './components/findRowHover.ts'
import { resolveMafRowHover } from './components/mafHitTest.ts'

import type { LinearMafDisplayModel } from './stateModel.ts'

/**
 * On a plain click over an insertion marker, open the feature-details widget
 * with the inserted sequence. The hover tooltip drops the sequence once it
 * exceeds 20bp (see `formatInsertionLabel`), so clicking is the only way to
 * read a long insertion. Mirrors plugin-alignments' click-an-insertion →
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
      const { length, sequence, chr, pos, strand, sampleLabel } = hover
      const start =
        pos === undefined ? 0 : insertionForwardStart(pos, length, strand)
      openFeatureWidget(model, {
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
  }
}
