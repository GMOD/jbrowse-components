import { DASH } from '../util/asciiBytes.ts'
import { encodeMafStatus } from '../util/mafStatus.ts'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { AlignmentContext, EmptyRecord } from '../types.ts'

/**
 * A finished pack: every column of the wire except the two things the packer
 * doesn't produce. `coverage` is computed *from* these columns, and
 * `refSampleId` is the RPC's resolution of which row is the reference.
 */
export type MafWirePacked = Omit<MafWireRegionData, 'coverage' | 'refSampleId'>

/**
 * Up-front sizes for the packer's allocations, for a caller that already knows
 * them. Wrong hints are safe — every writer grows — and so is passing nothing,
 * which is what the RPC does.
 *
 * **It used to buffer a region's blocks to make these exact, and that was the
 * more expensive half of the trade.** Growing the arena by doubling copies it,
 * but sizing it exactly means holding every block's records and `seq` strings
 * until the last one arrives, and on the block shape real files have that
 * intermediate costs 1.18x and 228 MB of peak RSS. See the comment in
 * `executeMafAlignmentData` for the measurement.
 */
export interface MafWireReserve {
  blocks?: number
  rows?: number
  empties?: number
  bytes?: number
}

/**
 * Growable typed-array column. The `Writer` pattern the plugin already uses for
 * per-base output (`MismatchWriter`, `InstanceWriter`): seeded with the caller's
 * count so the common path allocates exactly once, with doubling as a
 * correctness backstop rather than the expected route.
 */
class Column<T extends Uint8Array | Int8Array | Uint32Array> {
  constructor(
    private array: T,
    private grow: (n: number) => T,
  ) {}

  at(index: number) {
    if (index >= this.array.length) {
      let capacity = Math.max(1, this.array.length)
      while (capacity <= index) {
        capacity *= 2
      }
      const next = this.grow(capacity)
      next.set(this.array)
      this.array = next
    }
    return this.array
  }

  set(index: number, value: number) {
    this.at(index)[index] = value
  }

  // Right-sized copy, not a subarray view: these are retained for as long as
  // the region is loaded, so a view would pin the doubling slack with them.
  //
  // Exactly `count` entries even when the backing array never grew that far,
  // which `slice` alone does not give: the context columns are created at the
  // first row that carries an `i` line and only ever grown by a `set`, so a
  // stanza whose last few species have no `i` line left `rowHasContext` shorter
  // than `rowCount` — ragged against every other per-row column, and against
  // what `MafWireRegionData` documents. `grow` zero-fills, so the padding is the
  // "absent" value each column already uses.
  finish(count: number) {
    // `at` is what grows *and* copies; `grow` alone allocates a fresh array and
    // would silently return the padding in place of the data.
    return (count > 0 ? this.at(count - 1) : this.array).slice(0, count) as T
  }
}

/**
 * Sequence length at or below which a row is copied into the arena with a
 * `charCodeAt` loop rather than `TextEncoder.encodeInto` — see `writeAscii` for
 * the measurement behind the number.
 */
const ASCII_COPY_MAX_LENGTH = 64

const u32 = (n: number) =>
  new Column(new Uint32Array(n), c => new Uint32Array(c))
const u8 = (n: number) => new Column(new Uint8Array(n), c => new Uint8Array(c))
const i8 = (n: number) => new Column(new Int8Array(n), c => new Int8Array(c))

/** Interns a repeated string to its index, building the wire's dictionary. */
class Dictionary {
  private byValue = new Map<string, number>()

  readonly values: string[] = []

  indexOf(value: string) {
    let index = this.byValue.get(value)
    if (index === undefined) {
      index = this.values.length
      this.values.push(value)
      this.byValue.set(value, index)
    }
    return index
  }
}

/**
 * Builds a `MafWireRegionData` by streaming: `startBlock` then `addRow` /
 * `addEmpty` per row, no intermediate row objects anywhere.
 *
 * Sequence text is encoded straight into the shared arena with `encodeInto`,
 * so a row's bases are copied exactly once between the adapter's string and
 * the GPU — where the object-shaped wire encoded each row into its own
 * `Uint8Array` and then paid `postMessage` to detach every one of them.
 *
 * `encodeInto` is given a destination of exactly `seq.length` bytes, which is
 * right because MAF alignment text is ASCII: one byte per column is the
 * assumption the entire render path makes, since every consumer indexes a row's
 * bytes by the reference's column number. A non-ASCII byte would therefore
 * already have broken rendering before reaching here; it truncates the row
 * rather than overflowing into the next one, because the reported `written` is
 * what becomes `rowLength`.
 *
 * The reference sequence is written as its own arena slice rather than aliasing
 * the reference species' row — see `MafWireRegionData.arena`.
 */
export class MafWirePacker {
  private encoder = new TextEncoder()

  private arena: Uint8Array

  private arenaLength = 0

  private samples = new Dictionary()

  private chrs = new Dictionary()

  private blockCount = 0

  private rowCount = 0

  private emptyCount = 0

  // Absent until a row carries an `i` line, so the two adapters that never
  // produce one ship no context columns at all.
  private context:
    | {
        has: Column<Uint8Array>
        leftStatus: Column<Uint8Array>
        leftCount: Column<Uint32Array>
        rightStatus: Column<Uint8Array>
        rightCount: Column<Uint32Array>
      }
    | undefined

  private rowOffset
  private rowLength
  private rowSample
  private rowChr
  private rowStart
  private rowStrand
  private rowSrcSize

  private blockStartBp
  private blockEndBp
  private blockRefOffset
  private blockRefLength
  private blockRowStart
  private blockEmptyStart

  private emptySample
  private emptyChr
  private emptyStatus
  private emptyStart
  private emptySize
  private emptyStrand
  private emptySrcSize

  constructor(reserve: MafWireReserve = {}) {
    const blocks = reserve.blocks ?? 0
    const rows = reserve.rows ?? 0
    const empties = reserve.empties ?? 0
    this.arena = new Uint8Array(reserve.bytes ?? 0)

    this.rowOffset = u32(rows)
    this.rowLength = u32(rows)
    this.rowSample = u32(rows)
    this.rowChr = u32(rows)
    this.rowStart = u32(rows)
    this.rowStrand = i8(rows)
    this.rowSrcSize = u32(rows)

    this.blockStartBp = u32(blocks)
    this.blockEndBp = u32(blocks)
    this.blockRefOffset = u32(blocks)
    this.blockRefLength = u32(blocks)
    this.blockRowStart = u32(blocks + 1)
    this.blockEmptyStart = u32(blocks + 1)

    this.emptySample = u32(empties)
    this.emptyChr = u32(empties)
    this.emptyStatus = u8(empties)
    this.emptyStart = u32(empties)
    this.emptySize = u32(empties)
    this.emptyStrand = i8(empties)
    this.emptySrcSize = u32(empties)
  }

  /**
   * Appends `seq` to the arena and returns its `[offset, length]`.
   *
   * Takes bytes as readily as a string, because an adapter that can hand over
   * bytes should never have to build the string first. `MafTabixAdapter` reads
   * its alignment column straight out of the decompressed bgzf buffer, so its
   * sequence is copied exactly once — here — where going through a string would
   * mean a UTF-16 decode, several substrings, and a re-encode.
   */
  private write(seq: string | Uint8Array) {
    const offset = this.arenaLength
    const needed = offset + seq.length
    if (needed > this.arena.length) {
      let capacity = Math.max(1024, this.arena.length)
      while (capacity < needed) {
        capacity *= 2
      }
      const next = new Uint8Array(capacity)
      next.set(this.arena.subarray(0, offset))
      this.arena = next
    }
    let written: number
    if (typeof seq === 'string') {
      written =
        seq.length <= ASCII_COPY_MAX_LENGTH ? this.writeAscii(seq, offset) : -1
      if (written < 0) {
        written = this.encoder.encodeInto(
          seq,
          this.arena.subarray(offset, offset + seq.length),
        ).written
      }
    } else {
      this.arena.set(seq, offset)
      written = seq.length
    }
    this.arenaLength = offset + written
    return { offset, length: written }
  }

  /**
   * Copy an ASCII `seq` into the arena a char at a time, or return -1 if it
   * isn't ASCII (leaving the caller to redo it with `encodeInto`, which
   * overwrites from the same offset, so the partial write costs nothing).
   *
   * Worth having only for short rows, hence `ASCII_COPY_MAX_LENGTH`.
   * `encodeInto` is a C++ call that needs a `Uint8Array` destination, so every
   * row also allocates an `arena.subarray` view for it — and a real MAF is
   * mostly *short* rows: UCSC's ce11 26-way has a median block of 7bp, so the
   * per-call overhead is paid ~1.2M times per buffered region for seven bytes
   * of payload each. Measured over 12MB of sequence: 4.6x at 7 chars, 1.75x at
   * 20, break-even around 70, and 2.5x the *wrong* way by 200 — `encodeInto`
   * vectorizes and this cannot, so the threshold is what keeps a
   * few-large-blocks region on the fast path for its shape.
   */
  private writeAscii(seq: string, offset: number) {
    const arena = this.arena
    const len = seq.length
    for (let i = 0; i < len; i++) {
      const code = seq.charCodeAt(i)
      if (code > 0x7f) {
        return -1
      }
      arena[offset + i] = code
    }
    return len
  }

  /**
   * Opens a block at `startBp` with `refSeq` as its reference row. `endBp` is
   * derived here from the reference's non-dash byte count — the block's genomic
   * extent — so no consumer has to re-walk the reference to learn it.
   */
  startBlock(startBp: number, refSeq: string | Uint8Array) {
    const block = this.blockCount++
    const { offset, length } = this.write(refSeq)
    let refLen = 0
    for (let i = offset; i < offset + length; i++) {
      if (this.arena[i] !== DASH) {
        refLen++
      }
    }
    this.blockStartBp.set(block, startBp)
    this.blockEndBp.set(block, startBp + refLen)
    this.blockRefOffset.set(block, offset)
    this.blockRefLength.set(block, length)
    this.blockRowStart.set(block, this.rowCount)
    this.blockEmptyStart.set(block, this.emptyCount)
  }

  addRow(row: {
    sampleId: string
    seq: string | Uint8Array
    chr?: string
    start?: number
    strand?: number
    srcSize?: number
    context?: AlignmentContext
  }) {
    const i = this.rowCount++
    const { offset, length } = this.write(row.seq)
    this.rowOffset.set(i, offset)
    this.rowLength.set(i, length)
    this.rowSample.set(i, this.samples.indexOf(row.sampleId))
    this.rowChr.set(i, this.chrs.indexOf(row.chr ?? ''))
    this.rowStart.set(i, row.start ?? 0)
    this.rowStrand.set(i, row.strand ?? 1)
    this.rowSrcSize.set(i, row.srcSize ?? 0)
    if (row.context) {
      this.context ??= {
        has: u8(0),
        leftStatus: u8(0),
        leftCount: u32(0),
        rightStatus: u8(0),
        rightCount: u32(0),
      }
      const { leftStatus, leftCount, rightStatus, rightCount } = row.context
      this.context.has.set(i, 1)
      this.context.leftStatus.set(i, encodeMafStatus(leftStatus))
      this.context.leftCount.set(i, leftCount ?? 0)
      this.context.rightStatus.set(i, encodeMafStatus(rightStatus))
      this.context.rightCount.set(i, rightCount ?? 0)
    }
  }

  addEmpty(sampleId: string, empty: EmptyRecord) {
    const i = this.emptyCount++
    this.emptySample.set(i, this.samples.indexOf(sampleId))
    this.emptyChr.set(i, this.chrs.indexOf(empty.chr))
    this.emptyStatus.set(i, encodeMafStatus(empty.status))
    this.emptyStart.set(i, empty.start)
    this.emptySize.set(i, empty.size)
    this.emptyStrand.set(i, empty.strand)
    this.emptySrcSize.set(i, empty.srcSize)
  }

  /**
   * Seals the per-block row/empty ranges and right-sizes every column.
   *
   * Stops short of a whole `MafWireRegionData` because coverage is computed
   * *from* this — `buildMafCoverageRegion` reads these very columns — so the
   * caller finishes the wire by spreading `coverage` and `refSampleId` on.
   */
  finishBlocks(): MafWirePacked {
    // The `blockCount + 1` sentinel: block b's rows end where block b+1's
    // begin, so the last block needs no special case downstream.
    this.blockRowStart.set(this.blockCount, this.rowCount)
    this.blockEmptyStart.set(this.blockCount, this.emptyCount)
    const rows = this.rowCount
    const blocks = this.blockCount
    const empties = this.emptyCount
    const context = this.context
    return {
      arena: this.arena.slice(0, this.arenaLength),

      rowOffset: this.rowOffset.finish(rows),
      rowLength: this.rowLength.finish(rows),
      rowSample: this.rowSample.finish(rows),
      rowChr: this.rowChr.finish(rows),
      rowStart: this.rowStart.finish(rows),
      rowStrand: this.rowStrand.finish(rows),
      rowSrcSize: this.rowSrcSize.finish(rows),

      rowHasContext: context?.has.finish(rows),
      rowLeftStatus: context?.leftStatus.finish(rows),
      rowLeftCount: context?.leftCount.finish(rows),
      rowRightStatus: context?.rightStatus.finish(rows),
      rowRightCount: context?.rightCount.finish(rows),

      blockStartBp: this.blockStartBp.finish(blocks),
      blockEndBp: this.blockEndBp.finish(blocks),
      blockRefOffset: this.blockRefOffset.finish(blocks),
      blockRefLength: this.blockRefLength.finish(blocks),
      blockRowStart: this.blockRowStart.finish(blocks + 1),
      blockEmptyStart: this.blockEmptyStart.finish(blocks + 1),

      emptySample: this.emptySample.finish(empties),
      emptyChr: this.emptyChr.finish(empties),
      emptyStatus: this.emptyStatus.finish(empties),
      emptyStart: this.emptyStart.finish(empties),
      emptySize: this.emptySize.finish(empties),
      emptyStrand: this.emptyStrand.finish(empties),
      emptySrcSize: this.emptySrcSize.finish(empties),

      sampleIds: this.samples.values,
      chrNames: this.chrs.values,
    }
  }
}
