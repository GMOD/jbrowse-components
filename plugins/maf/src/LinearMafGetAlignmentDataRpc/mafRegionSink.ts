import { isRowVisible } from '../util/sampleCopies.ts'
import { MafWirePacker } from './mafWirePacker.ts'

import type { AlignmentContext, EmptyRecord } from '../types.ts'

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
export class MafRegionSink extends MafWirePacker {
  readonly discovered = new Set<string>()

  refSampleId: string | undefined

  private visible: Set<string> | undefined

  private visibility = new Map<string, boolean>()

  constructor(visible: Set<string> | undefined) {
    super()
    this.visible = visible
  }

  override startBlock(
    id: string,
    start: number,
    end: number,
    ref: string,
    refFrom: number,
    refTo: number,
    refSampleId: string | undefined,
  ) {
    super.startBlock(id, start, end, ref, refFrom, refTo)
    this.refSampleId ??= refSampleId
  }

  /** Whether the row is visible, settled once per row id as it is discovered. */
  private discover(sampleId: string) {
    let visible = this.visibility.get(sampleId)
    if (visible === undefined) {
      visible = isRowVisible(sampleId, this.visible)
      this.visibility.set(sampleId, visible)
      this.discovered.add(sampleId)
    }
    return visible
  }

  override addRow(
    sampleId: string,
    text: string,
    from: number,
    to: number,
    srcRefName: string,
    srcStart: number,
    strand: number,
    srcSize: number,
    context: AlignmentContext | undefined,
  ) {
    if (this.discover(sampleId)) {
      super.addRow(
        sampleId,
        text,
        from,
        to,
        srcRefName,
        srcStart,
        strand,
        srcSize,
        context,
      )
    }
  }

  override addEmpty(sampleId: string, empty: EmptyRecord) {
    if (this.discover(sampleId)) {
      super.addEmpty(sampleId, empty)
    }
  }
}
