import { MockHal } from '../hal/mockHal.ts'
import { GpuMarkBackend } from './markBackend.ts'
import { HIDDEN_ROW, buildRowTable } from './rowTable.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { RowTable } from './rowTable.ts'
import type { SpanChannels } from './spanMark.ts'

// A reorder, focus, hide or recolour is one table upload and no instance
// bytes: the buffer packed at arrival carries keys, and the table alone moves.

interface State {
  canvasWidth: number
  canvasHeight: number
  rowTable: RowTable | undefined
}

const mark = defineMark({
  shape: spanMark,
  channels: (c: SpanChannels) => c,
  params: (s: State) => ({
    rowHeight: 10,
    rowProportion: 1,
    minWidthPx: 0,
    seamPx: 0,
    scrollTop: 0,
    rowTable: s.rowTable,
  }),
})

const REGION: SpanChannels = {
  x: Uint32Array.of(10, 30, 50),
  x2: Uint32Array.of(20, 40, 60),
  row: Uint32Array.of(0, 1, 2),
  color: Uint32Array.of(0xff0000ff, 0xff00ff00, 0xffff0000),
  count: 3,
}

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 0,
  screenEndPx: 100,
  reversed: false,
}

const listed = buildRowTable(Uint32Array.of(0, 1, 2))
const reordered = buildRowTable(Uint32Array.of(2, 0, 1))
const focused = buildRowTable(Uint32Array.of(0, HIDDEN_ROW, 1))
const recoloured = buildRowTable(
  Uint32Array.of(0, 1, 2),
  Uint32Array.of(0xff123456, 0, 0),
)

function frames(...tables: (RowTable | undefined)[]) {
  const hal = new MockHal([mark.pass])
  const backend = new GpuMarkBackend(hal, [mark])
  backend.upload(0, REGION)
  for (const rowTable of tables) {
    backend.renderBlocks([block], new Map([[0, REGION]]), {
      canvasWidth: 100,
      canvasHeight: 30,
      rowTable,
    })
  }
  return {
    buffers: hal.callsOf('uploadBuffer').length,
    textures: hal.callsOf('uploadTexture').map(c => c.args.slice(1)),
    draws: hal.draws().length,
  }
}

test('a reorder, a focus and a recolour each upload the table once and no instance bytes', () => {
  expect(
    frames(listed, listed, reordered, reordered, focused, recoloured),
  ).toEqual({
    buffers: 1,
    textures: [
      [24, 3, 2],
      [24, 3, 2],
      [24, 3, 2],
      [24, 3, 2],
    ],
    draws: 6,
  })
})

test('a pass drawn with no table binds the inert table once and keeps drawing', () => {
  expect(frames(undefined, undefined)).toEqual({
    buffers: 1,
    textures: [[1024, 256, 1]],
    draws: 2,
  })
})
