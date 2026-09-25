import { SimpleFeature } from '@jbrowse/core/util'

import { geneGlyphShape } from '../geneGlyphShape.ts'
import { getSubfeatures } from '../util.ts'
import { isoformsOf, layoutContainerGlyph } from './glyphUtils.ts'

import type { Span } from '../../shared/mergeSpans.ts'
import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Carries the `parent` handle a synthesized UTR carries, so a `feature.parent`
// jexl and the itemRgb walk reach the gene from the box they paint.
function mergedPart(gene: Feature, type: string, spans: readonly Span[]) {
  const refName = gene.get('refName')
  const strand = gene.get('strand') ?? 0
  return spans.map(
    ([start, end], i) =>
      new SimpleFeature({
        id: `${gene.id()}-merged-${type}-${i}`,
        data: { refName, start, end, strand, type },
        parent: gene,
      }),
  )
}

/**
 * A gene as one row: every transcript's coding spans merged full height, the
 * untranslated remainder thin, and connector lines across the gaps between
 * them.
 *
 * What it draws is `geneGlyphShape`'s union and nothing else, so the picture
 * answers "where does this gene code" rather than "which transcript is
 * representative" — the question `longestCoding` answers by hiding the exons
 * only a minor isoform carries. The parts are synthesized rather than drawn
 * from the subfeature rows, because a merged span belongs to several
 * transcripts at once and to none of them alone.
 *
 * `MergedGene` is emitted by the transcript emitter: a merged span is a box
 * and the gaps between boxes are the connector, which is the shape that
 * emitter already draws. It carries its own glyph type all the same, because
 * `transcriptCoords` must answer nothing here — a merged gene has no exon
 * numbering and no single reading frame.
 */
export function layoutMergedGene(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  const { full, thin } = geneGlyphShape(feature)
  return {
    ...layoutContainerGlyph('MergedGene', args, [
      ...mergedPart(feature, 'CDS', full),
      ...mergedPart(feature, 'UTR', thin),
    ]),
    // The control that offers the other modes appears off this, so a merged
    // gene has to keep reporting how many transcripts it merged.
    hasMultipleIsoforms: isoformsOf(getSubfeatures(feature), config).length > 1,
  }
}
