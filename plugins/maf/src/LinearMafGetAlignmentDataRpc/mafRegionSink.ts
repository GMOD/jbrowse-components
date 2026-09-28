import { MafWirePacker } from './mafWirePacker.ts'

import type { AlignmentContext, EmptyRecord } from '../types.ts'
import type { MafBlockSink } from '../util/mafBlockSink.ts'

function sameText(
  a: string,
  aFrom: number,
  aTo: number,
  b: string,
  bFrom: number,
  bTo: number,
) {
  const n = aTo - aFrom
  if (n !== bTo - bFrom) {
    return false
  }
  if (a === b && aFrom === bFrom) {
    return true
  }
  for (let i = 0; i < n; i++) {
    if (a.charCodeAt(aFrom + i) !== b.charCodeAt(bFrom + i)) {
      return false
    }
  }
  return true
}

/**
 * The MAF display's region as it arrives: the visible rows packed, every
 * species discovered in block order, and the reference row found.
 *
 * `refSampleId` is the row the block's reference sequence came from, found by
 * sequence identity in the first block that has one. The obvious answer,
 * `region.assemblyName`, is the *view's* name for the reference and only
 * coincidentally the MAF's: a MAF-tabix track sets `refAssemblyName` when the
 * two differ, and a bigMaf/TAF file names its reference by whatever db name it
 * was built with. Where they differed the name matched no row, the reference's
 * self-match stayed in the conservation denominator, and an all-divergent
 * column read `1/N` instead of 0. Rows arrive in stanza order, reference
 * first, so a later species byte-identical across the block cannot win.
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

  private seeking = false

  private refText = ''

  private refFrom = 0

  private refTo = 0

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
  ) {
    this.packer.startBlockText(start, ref, refFrom, refTo)
    this.seeking = this.refSampleId === undefined && refTo > refFrom
    if (this.seeking) {
      this.refText = ref
      this.refFrom = refFrom
      this.refTo = refTo
    }
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
    if (
      this.seeking &&
      sameText(text, from, to, this.refText, this.refFrom, this.refTo)
    ) {
      this.refSampleId = sampleId
      this.seeking = false
    }
    this.discovered.add(sampleId)
    if (!this.visible || this.visible.has(sampleId)) {
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
    if (!this.visible || this.visible.has(sampleId)) {
      this.packer.addEmpty(sampleId, empty)
    }
  }
}
