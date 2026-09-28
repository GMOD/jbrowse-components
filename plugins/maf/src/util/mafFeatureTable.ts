import { ColumnTable } from '@jbrowse/core/util/featureTable'
import { subscribeToObservable } from '@jbrowse/core/util/rxjs'

import { MafWirePacker } from '../LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import { decodeMafStatus } from './mafStatus.ts'

import type { MafWirePacked } from '../LinearMafGetAlignmentDataRpc/mafWirePacker.ts'
import type {
  AlignmentContext,
  AlignmentRecord,
  EmptyRecord,
} from '../types.ts'
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
export async function mafFeatureTable(
  features: Observable<Feature>,
  refName: string,
) {
  const packer = new MafWirePacker()
  const blocks: Blocks = { ids: [], start: [], end: [], strand: [], refName }
  await subscribeToObservable(features, feature => {
    addBlock(packer, blocks, feature)
  })
  return tableOfPacked(packer.finishBlocks(), blocks)
}

/** {@link mafFeatureTable} over blocks already fetched. */
export function mafFeatureTableOf(
  features: Iterable<Feature>,
  refName: string,
) {
  const packer = new MafWirePacker()
  const blocks: Blocks = { ids: [], start: [], end: [], strand: [], refName }
  for (const feature of features) {
    addBlock(packer, blocks, feature)
  }
  return tableOfPacked(packer.finishBlocks(), blocks)
}

function addBlock(packer: MafWirePacker, blocks: Blocks, feature: Feature) {
  const alignments = feature.get('alignments') as Record<
    string,
    AlignmentRecord
  >
  const empties = feature.get('empties') as
    | Record<string, EmptyRecord>
    | undefined
  blocks.ids.push(feature.id())
  blocks.start.push(feature.get('start'))
  blocks.end.push(feature.get('end'))
  blocks.strand.push(feature.get('strand') ?? 0)
  packer.startBlock(feature.get('start'), feature.get('seq') as string)
  for (const sampleId in alignments) {
    packer.addRow({ sampleId, ...alignments[sampleId]! })
  }
  for (const sampleId in empties) {
    packer.addEmpty(sampleId, empties[sampleId]!)
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
