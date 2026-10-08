import { isRowVisible } from '../util/sampleCopies.ts'
import { MafWirePacker } from './mafWirePacker.ts'

import type { AlignmentContext, EmptyRecord } from '../types.ts'
import type { MafBlockSink } from '../util/mafBlockSink.ts'

/**
 * The MAF display's region as it arrives: the visible rows packed, every
 * species discovered in block order, and the reference row found.
 *
 * `refSampleId` is the row the reader named as the reference in the first
 * block that has one, and undefined where the sample set leaves the reference
 * no row. `region.assemblyName` is the *view's* name for the reference and
 * only coincidentally the MAF's, so it is never read here.
 *
 * `discovered` is every species, the visible or not, since a filtered subtree
 * still returns every genome for the sidebar tree; the packer's own sample
 * dictionary sees only the visible rows.
 */
export class MafRegionSink implements MafBlockSink {
  readonly packer = new MafWirePacker()

  readonly discovered = new Set<string>()

  refSampleId: string | undefined

  private visible: Set<string> | undefined

  constructor(visible: Set<string> | undefined) {
    this.visible = visible
  }

  startBlock(
    _id: string,
    start: number,
    _end: number,
    _strand: number,
    ref: string,
    refFrom: number,
    refTo: number,
    refSampleId: string | undefined,
  ) {
    this.packer.startBlockText(start, ref, refFrom, refTo)
    this.refSampleId ??= refSampleId
  }

  addRow(
    sampleId: string,
    text: string,
    from: number,
    to: number,
    chr: string,
    srcStart: number,
    strand: number,
    srcSize: number | undefined,
    context: AlignmentContext | undefined,
  ) {
    this.discovered.add(sampleId)
    if (isRowVisible(sampleId, this.visible)) {
      this.packer.addRowText(
        sampleId,
        text,
        from,
        to,
        chr,
        srcStart,
        strand,
        srcSize,
        context,
      )
    }
  }

  addEmpty(sampleId: string, empty: EmptyRecord) {
    this.discovered.add(sampleId)
    if (isRowVisible(sampleId, this.visible)) {
      this.packer.addEmpty(sampleId, empty)
    }
  }
}
