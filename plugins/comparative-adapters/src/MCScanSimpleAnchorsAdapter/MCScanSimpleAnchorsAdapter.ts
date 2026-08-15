import { openLocation } from '@jbrowse/core/util/io'

import { McscanAnchorsAdapterBase } from '../McscanAnchorsAdapterBase.ts'
import { anchorScore } from '../mcscanUtil.ts'

import type { AnchorsSource } from '../McscanAnchorsAdapterBase.ts'
import type { BareFeature } from '../mcscanUtil.ts'
import type { MCScanSimpleAnchorsAdapterConfig } from './configSchema.ts'

// A `.anchors.simple` row names the first and last gene of a block on each side
// (`startGene1 endGene1 startGene2 endGene2 size orientation`), so a side spans
// from one gene to the other rather than being a single gene. Both genes of a
// block sit on the same contig, so the span keeps the first one's refName — the
// same refName getRefNames reports, which is what keeps the two answers from
// disagreeing.
function spanBetween(first: BareFeature, last: BareFeature): BareFeature {
  return {
    refName: first.refName,
    start: Math.min(first.start, last.start),
    end: Math.max(first.end, last.end),
    name: `${first.name}-${last.name}`,
    score: first.score,
    strand: first.strand,
  }
}

export default class MCScanSimpleAnchorsAdapter extends McscanAnchorsAdapterBase<MCScanSimpleAnchorsAdapterConfig> {
  protected anchorsSource(): AnchorsSource {
    return {
      anchors: openLocation(
        this.getConf('mcscanSimpleAnchorsLocation'),
        this.pluginManager,
      ),
      parseRow: ([n11, n12, n21, n22, score, strand], join, rowNum) => {
        const starts = join(n11, n21)
        const ends = join(n12, n22)
        return starts === undefined || ends === undefined
          ? undefined
          : {
              a: spanBetween(starts.a, ends.a),
              b: spanBetween(starts.b, ends.b),
              rowNum,
              // the file states the block's orientation, so unlike the
              // gene-to-gene anchors format this is not the product of the
              // two BED strands
              strand: strand === '-' ? -1 : 1,
              score: anchorScore(score),
            }
      },
    }
  }
}
