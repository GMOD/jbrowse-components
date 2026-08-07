import { MafWirePacker } from './mafWirePacker.ts'

import type { MafWireRegionData } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { AlignmentContext, EmptyRecord } from '../types.ts'
import type { MafWirePacked } from './mafWirePacker.ts'

/**
 * Readable literal forms of a packed region, for tests.
 *
 * The wire is columnar (see `MafWireRegionData`), which is unreadable to write
 * by hand and easy to write inconsistently — a `blockRowStart` that disagrees
 * with the rows around it would fabricate a passing test for a shape the packer
 * can never actually emit. So tests describe blocks the obvious way and this
 * runs them through the *real* `MafWirePacker`, which means the packing itself
 * is under test at every call site rather than only where it is named.
 */
export interface TestWireRow {
  sampleId: string
  seq: string
  chr?: string
  start?: number
  strand?: number
  srcSize?: number
  context?: AlignmentContext
}

export interface TestWireBlock {
  startBp: number
  refSeq: string
  rows: TestWireRow[]
  empties?: ({ sampleId: string } & EmptyRecord)[]
}

export function packTestWire(blocks: TestWireBlock[]): MafWirePacked {
  const packer = new MafWirePacker()
  for (const block of blocks) {
    packer.startBlock(block.startBp, block.refSeq)
    for (const row of block.rows) {
      packer.addRow(row)
    }
    for (const empty of block.empties ?? []) {
      packer.addEmpty(empty.sampleId, empty)
    }
  }
  return packer.finishBlocks()
}

/** `packTestWire` plus the two fields the packer doesn't produce. */
export function testWireRegionData(
  blocks: TestWireBlock[],
  rest: Pick<MafWireRegionData, 'coverage' | 'refSampleId'>,
): MafWireRegionData {
  return { ...packTestWire(blocks), ...rest }
}
