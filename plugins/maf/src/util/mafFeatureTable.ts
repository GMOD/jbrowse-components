import { ColumnTable } from '@jbrowse/core/util/featureTable'

import { MafWirePacker } from '../LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import { decodeMafStatus } from './mafStatus.ts'

import type { MafWirePacked } from '../LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import type { AlignmentContext } from '../types.ts'
import type { Column } from '@jbrowse/core/util/featureTable'

interface Blocks {
  ids: string[]
  end: number[]
  refName: string
}

/**
 * A region's alignment blocks as a table over the arena the MAF display's
 * worker packs. A block's `alignments` and `empties` are lists over the
 * species rows, keyed by species, and every sequence is text in the one
 * arena, so a `flatten` over `alignments` and the `cells` walk behind it read
 * packed bytes and make no record or string.
 */
export class MafTableSink extends MafWirePacker {
  private blocks: Blocks

  constructor(refName: string) {
    super()
    this.blocks = { ids: [], end: [], refName }
  }

  override startBlock(
    id: string,
    start: number,
    end: number,
    ref: string,
    refFrom: number,
    refTo: number,
  ) {
    this.blocks.ids.push(id)
    this.blocks.end.push(end)
    super.startBlock(id, start, end, ref, refFrom, refTo)
  }

  table() {
    return tableOfPacked(this.finishBlocks(), this.blocks)
  }
}

function contextOf(packed: MafWirePacked, i: number) {
  if (!packed.rowHasContext?.[i]) {
    return undefined
  }
  const context: AlignmentContext = {}
  const leftStatus = decodeMafStatus(packed.rowLeftStatus![i]!)
  const rightStatus = decodeMafStatus(packed.rowRightStatus![i]!)
  if (leftStatus) {
    context.leftStatus = leftStatus
    context.leftCount = packed.rowLeftCount![i]
  }
  if (rightStatus) {
    context.rightStatus = rightStatus
    context.rightCount = packed.rowRightCount![i]
  }
  return context
}

function tableOfPacked(packed: MafWirePacked, blocks: Blocks) {
  const { arena, sampleIds, refNames } = packed
  const number = (values: Uint32Array | Int8Array): Column => ({
    kind: 'number',
    values,
    at: undefined,
  })
  const category = (codes: Uint32Array): Column => ({
    kind: 'category',
    codes,
    labels: refNames,
    at: undefined,
  })
  const species = (codes: Uint32Array): Column => ({
    kind: 'category',
    codes,
    labels: sampleIds,
    at: undefined,
  })
  const rows = new ColumnTable(
    packed.rowOffset.length,
    new Map<string, Column>([
      ['srcRefName', category(packed.rowRefName)],
      ['srcStart', number(packed.rowStart)],
      ['strand', number(packed.rowStrand)],
      ['srcSize', number(packed.rowSrcSize)],
      [
        'seq',
        {
          kind: 'text',
          bytes: arena,
          offset: packed.rowOffset,
          length: packed.rowLength,
          at: undefined,
        },
      ],
      ['context', { kind: 'value', read: i => contextOf(packed, i) }],
    ]),
    String,
  )
  const empties = new ColumnTable(
    packed.emptySample.length,
    new Map<string, Column>([
      ['srcRefName', category(packed.emptyRefName)],
      ['srcStart', number(packed.emptyStart)],
      ['size', number(packed.emptySize)],
      ['strand', number(packed.emptyStrand)],
      ['srcSize', number(packed.emptySrcSize)],
      [
        'status',
        { kind: 'value', read: i => decodeMafStatus(packed.emptyStatus[i]!) },
      ],
    ]),
    String,
  )
  return new ColumnTable(
    blocks.ids.length,
    new Map<string, Column>([
      ['start', number(packed.blockStartBp)],
      ['end', number(Uint32Array.from(blocks.end))],
      ['refName', { kind: 'value', read: () => blocks.refName }],
      ['strand', number(new Int8Array(blocks.ids.length).fill(1))],
      [
        'seq',
        {
          kind: 'text',
          bytes: arena,
          offset: packed.blockRefOffset,
          length: packed.blockRefLength,
          at: undefined,
        },
      ],
      [
        'alignments',
        {
          kind: 'list',
          start: packed.blockRowStart,
          entries: rows,
          keys: species(packed.rowSample),
          at: undefined,
        },
      ],
      [
        'empties',
        {
          kind: 'list',
          start: packed.blockEmptyStart,
          entries: empties,
          keys: species(packed.emptySample),
          at: undefined,
        },
      ],
    ]),
    i => blocks.ids[i]!,
  )
}
