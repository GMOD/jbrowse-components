import { DASH } from '@jbrowse/core/util/alignedBytes'

import { encodeMafStatus } from '../util/mafStatus.ts'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { AlignmentContext, EmptyRecord } from '../types.ts'
import type { MafBlockSink } from '../util/mafBlockSink.ts'

/**
 * A finished pack: every column of the wire except the two things the packer
 * doesn't produce. `coverage` is computed *from* these columns, and
 * `refSampleId` is the RPC's resolution of which row is the reference.
 */
export type MafWirePacked = Omit<MafWireRegionData, 'coverage' | 'refSampleId'>

/**
 * Growable typed-array column, doubling as it fills. Sizing a region exactly
 * up front means holding every block's records until the last one arrives,
 * which measured 1.18x slower and 491 MB against 263 MB of peak RSS on 20000
 * blocks of 8 columns.
 */
class Column<T extends Uint8Array | Int8Array | Uint32Array> {
  private array: T
  private grow: (n: number) => T

  constructor(array: T, grow: (n: number) => T) {
    this.array = array
    this.grow = grow
  }

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

const u32 = () => new Column(new Uint32Array(0), c => new Uint32Array(c))
const u8 = () => new Column(new Uint8Array(0), c => new Uint8Array(c))
const i8 = () => new Column(new Int8Array(0), c => new Int8Array(c))

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
 * Builds a `MafWireRegionData` as a {@link MafBlockSink}: `startBlock` then
 * `addRow` / `addEmpty` per row, no intermediate row objects anywhere.
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
export class MafWirePacker implements MafBlockSink {
  private encoder = new TextEncoder()

  private arena = new Uint8Array(0)

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

  private rowOffset = u32()
  private rowLength = u32()
  private rowSample = u32()
  private rowChr = u32()
  private rowStart = u32()
  private rowStrand = i8()
  private rowSrcSize = u32()

  private blockStartBp = u32()
  private blockEndBp = u32()
  private blockRefOffset = u32()
  private blockRefLength = u32()
  private blockRowStart = u32()
  private blockEmptyStart = u32()

  private emptySample = u32()
  private emptyChr = u32()
  private emptyStatus = u8()
  private emptyStart = u32()
  private emptySize = u32()
  private emptyStrand = i8()
  private emptySrcSize = u32()

  /** Appends `text[from..to)` to the arena and returns its `[offset, length]`. */
  private write(text: string, from: number, to: number) {
    const offset = this.arenaLength
    const length = to - from
    const needed = offset + length
    if (needed > this.arena.length) {
      let capacity = Math.max(1024, this.arena.length)
      while (capacity < needed) {
        capacity *= 2
      }
      const next = new Uint8Array(capacity)
      next.set(this.arena.subarray(0, offset))
      this.arena = next
    }
    let written =
      length <= ASCII_COPY_MAX_LENGTH
        ? this.writeAscii(text, from, to, offset)
        : -1
    if (written < 0) {
      written = this.encoder.encodeInto(
        from === 0 && to === text.length ? text : text.slice(from, to),
        this.arena.subarray(offset, offset + length),
      ).written
    }
    this.arenaLength = offset + written
    return { offset, length: written }
  }

  /**
   * Copy an ASCII `text[from..to)` into the arena a char at a time, or return
   * -1 if it isn't ASCII (leaving the caller to redo it with `encodeInto`,
   * which overwrites from the same offset, so the partial write costs nothing).
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
  private writeAscii(text: string, from: number, to: number, offset: number) {
    const arena = this.arena
    for (let i = from; i < to; i++) {
      const code = text.charCodeAt(i)
      if (code > 0x7f) {
        return -1
      }
      arena[offset + i - from] = code
    }
    return to - from
  }

  /**
   * Opens a block at `startBp` with `ref[refFrom..refTo)` as its reference row.
   * `endBp` is derived here from the reference's non-dash byte count — the
   * block's genomic extent — so no consumer has to re-walk the reference to
   * learn it.
   */
  startBlock(
    _id: string,
    startBp: number,
    _end: number,
    ref: string,
    refFrom: number,
    refTo: number,
    _refSampleId?: string,
  ) {
    const block = this.blockCount++
    const { offset, length } = this.write(ref, refFrom, refTo)
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
    const i = this.rowCount++
    const { offset, length } = this.write(text, from, to)
    this.rowOffset.set(i, offset)
    this.rowLength.set(i, length)
    this.rowSample.set(i, this.samples.indexOf(sampleId))
    this.rowChr.set(i, this.chrs.indexOf(chr))
    this.rowStart.set(i, srcStart)
    this.rowStrand.set(i, strand)
    this.rowSrcSize.set(i, srcSize ?? 0)
    if (context) {
      this.context ??= {
        has: u8(),
        leftStatus: u8(),
        leftCount: u32(),
        rightStatus: u8(),
        rightCount: u32(),
      }
      const { leftStatus, leftCount, rightStatus, rightCount } = context
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
    this.emptyStart.set(i, empty.srcStart)
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
