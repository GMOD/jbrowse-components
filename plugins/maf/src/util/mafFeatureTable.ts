import { ColumnTable } from '@jbrowse/core/util/featureTable'

import { MafWirePacker } from '../LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import { addFeatureBlock, featureBlocks } from './mafBlockSink.ts'
import { decodeMafStatus } from './mafStatus.ts'

import type { MafWirePacked } from '../LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import type { AlignmentContext, EmptyRecord } from '../types.ts'
import type { MafBlockSink } from './mafBlockSink.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Column } from '@jbrowse/core/util/featureTable'
import type { Observable } from 'rxjs'

interface Blocks {
  ids: string[]
  start: number[]
  end: number[]
  strand: number[]
  refName: string
}

/**
 * A region's alignment blocks as a table over the arena the MAF display's
 * worker packs. A block's `alignments` and `empties` are lists over the
 * species rows, keyed by species, and every sequence is text in the one
 * arena, so a `flatten` over `alignments` and the `cells` walk behind it read
 * packed bytes and make no record or string.
 */
export class MafTableSink implements MafBlockSink {
  private packer = new MafWirePacker()

  private blocks: Blocks

  constructor(refName: string) {
    this.blocks = { ids: [], start: [], end: [], strand: [], refName }
  }

  startBlock(
    id: string,
    start: number,
    end: number,
    strand: number,
    ref: string,
    refFrom: number,
    refTo: number,
  ) {
    this.blocks.ids.push(id)
    this.blocks.start.push(start)
    this.blocks.end.push(end)
    this.blocks.strand.push(strand)
    this.packer.startBlockText(start, ref, refFrom, refTo)
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

  addEmpty(sampleId: string, empty: EmptyRecord) {
    this.packer.addEmpty(sampleId, empty)
  }

  table() {
    return tableOfPacked(this.packer.finishBlocks(), this.blocks)
  }
}

/** {@link MafTableSink} over blocks as `MafFeature`s. */
export async function mafFeatureTable(
  features: Observable<Feature>,
  refName: string,
) {
  const sink = new MafTableSink(refName)
  await featureBlocks(features, sink)
  return sink.table()
}

/** {@link mafFeatureTable} over blocks already fetched. */
export function mafFeatureTableOf(
  features: Iterable<Feature>,
  refName: string,
) {
  const sink = new MafTableSink(refName)
  for (const feature of features) {
    addFeatureBlock(sink, feature)
  }
  return sink.table()
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
  const { arena, sampleIds, chrNames } = packed
  const number = (values: Uint32Array | Int8Array): Column => ({
    kind: 'number',
    values,
    at: undefined,
  })
  const category = (codes: Uint32Array): Column => ({
    kind: 'category',
    codes,
    labels: chrNames,
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
      ['chr', category(packed.rowChr)],
      ['srcStart', number(packed.rowStart)],
      ['strand', number(packed.rowStrand)],
      [
        'srcSize',
        { kind: 'value', read: i => packed.rowSrcSize[i] || undefined },
      ],
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
      ['chr', category(packed.emptyChr)],
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
      ['start', number(Uint32Array.from(blocks.start))],
      ['end', number(Uint32Array.from(blocks.end))],
      ['refName', { kind: 'value', read: () => blocks.refName }],
      ['strand', number(Int8Array.from(blocks.strand))],
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
