import { applyMafLine } from '../util/mafLines.ts'
import { makeSourceResolver } from '../util/parseAssemblyName.ts'
import { RecordSlots } from '../util/recordSlots.ts'
import { freeRowId } from '../util/sampleCopies.ts'

import type { AlignmentContext, EmptyRecord } from '../types.ts'
import type { MafBlockSink } from '../util/mafBlockSink.ts'
import type { MafLineTarget, MafSourceLine } from '../util/mafLines.ts'

/**
 * A bigMaf stanza, its lines `;`-joined, into a {@link MafBlockSink}: its rows
 * and empties in the order a record keyed by species lists them, with no
 * record per species. The reference is the first `s` line, taken before the
 * sample filter, so a reference the filter drops still positions the block
 * and names no row.
 * `applyMafLine` is the line grammar, shared with the bgzip MAF reader.
 */
export class BigMafBlockReader implements MafLineTarget {
  private resolver
  private rows = new RecordSlots()
  private empties = new RecordSlots()

  private seq: string[] = []
  private chr: string[] = []
  private srcStart: number[] = []
  private strand: number[] = []
  private srcSize: number[] = []
  private rowContext: (AlignmentContext | undefined)[] = []
  private emptyRecord: EmptyRecord[] = []
  private lastRowId = new Map<string, string>()

  constructor(sampleIds: Set<string> | undefined) {
    this.resolver = makeSourceResolver(sampleIds)
  }

  row(sampleId: string, chr: string, line: MafSourceLine) {
    const { rows } = this
    const rowId = freeRowId(sampleId, id => rows.slotOf(id) !== -1)
    this.lastRowId.set(sampleId, rowId)
    const slot = rows.slot(rows.key(rowId))
    this.seq[slot] = line.seq
    this.chr[slot] = chr
    this.srcStart[slot] = line.start
    this.strand[slot] = line.strand
    this.srcSize[slot] = line.srcSize
    this.rowContext[slot] = undefined
  }

  context(sampleId: string, context: AlignmentContext) {
    const slot = this.rows.slotOf(this.lastRowId.get(sampleId))
    if (slot !== -1) {
      this.rowContext[slot] = context
    }
  }

  empty(sampleId: string, empty: EmptyRecord) {
    const { empties } = this
    const rowId = freeRowId(sampleId, id => empties.slotOf(id) !== -1)
    this.emptyRecord[empties.slot(empties.key(rowId))] = empty
  }

  read(
    sink: MafBlockSink,
    id: string,
    start: number,
    end: number,
    stanza: string,
  ) {
    const { rows, empties } = this
    rows.startBlock()
    empties.startBlock()
    this.lastRowId.clear()
    const { resolve } = this.resolver
    let ref: string | undefined
    let refSampleId: string | undefined
    for (const line of stanza.split(';')) {
      const s = applyMafLine(line, resolve, this)
      if (s && ref === undefined) {
        ref = s.seq
        refSampleId = resolve(s.src)?.assemblyName || undefined
      }
    }
    ref ??= ''
    sink.startBlock(id, start, end, 0, ref, 0, ref.length, refSampleId)
    const rowOrder = rows.order()
    for (let j = 0; j < rows.count; j++) {
      const slot = rowOrder[j]!
      const seq = this.seq[slot]!
      sink.addRow(
        rows.nameAt(slot),
        seq,
        0,
        seq.length,
        this.chr[slot]!,
        this.srcStart[slot]!,
        this.strand[slot]!,
        this.srcSize[slot],
        this.rowContext[slot],
      )
    }
    const emptyOrder = empties.order()
    for (let j = 0; j < empties.count; j++) {
      const slot = emptyOrder[j]!
      sink.addEmpty(empties.nameAt(slot), this.emptyRecord[slot]!)
    }
  }

  reportUnmatched() {
    this.resolver.reportUnmatched()
  }
}
