import { clipBlock } from '../blockClipUtils.ts'
import { MockHal } from '../hal/mockHal.ts'
import { drawMarks, uploadMarks } from './markBackend.ts'
import { spanMark } from './spanMark.ts'
import { defineMark } from './types.ts'

import type { SpanChannels, SpanParams } from './spanMark.ts'
import type { MarkShape } from './types.ts'

interface State {
  canvasWidth: number
  canvasHeight: number
  span: SpanParams
}

const borrowedShape: MarkShape<SpanChannels, SpanParams> = {
  ...spanMark,
  id: 'spanBorrower',
  pass: { ...spanMark.pass, id: 'spanBorrower' },
}

const channels = (d: SpanChannels) => d
const params = (s: State) => s.span

const owner = defineMark({ shape: spanMark, channels, params })
const MARKS = [
  owner,
  defineMark({ shape: borrowedShape, channels, params, bufferOf: owner }),
]

const REGION: SpanChannels = {
  x: Uint32Array.of(10),
  x2: Uint32Array.of(90),
  row: Uint32Array.of(0),
  color: Uint32Array.of(0xff0000ff),
  count: 1,
}

const STATE: State = {
  canvasWidth: 300,
  canvasHeight: 80,
  span: {
    rowHeight: 10,
    rowProportion: 1,
    minWidthPx: 0,
    seamPx: 0,
    scrollTop: 0,
  },
}

// A block occupying the middle third of the canvas, so a viewport left at the
// canvas default is a different rect than the one the clip asks for.
const BLOCK = {
  displayedRegionIndex: 0,
  start: 0,
  end: 100,
  screenStartPx: 100,
  screenEndPx: 200,
  reversed: false,
}

test('uploadMarks fills the marks that own a buffer, never a borrower', () => {
  const hal = new MockHal(MARKS.map(m => m.pass))
  uploadMarks(hal, 0, MARKS, REGION)
  expect(hal.callsOf('uploadBuffer').map(c => c.args[1])).toEqual(['span'])
  expect(hal.getBuffer(0, 'spanBorrower')).toBeUndefined()
})

test('drawMarks sets the viewport to the clip before the first draw', () => {
  const hal = new MockHal(MARKS.map(m => m.pass))
  const clip = clipBlock(BLOCK, STATE.canvasWidth, STATE.canvasHeight, {
    x: 1,
    y: 1,
  })!
  uploadMarks(hal, 0, MARKS, REGION)
  hal.beginFrame(0, 0, 0, 0)
  drawMarks(
    hal,
    new ArrayBuffer(hal.uniformByteSize),
    MARKS,
    BLOCK,
    clip,
    REGION,
    STATE,
    0,
  )
  hal.endFrame()
  expect(hal.draws().map(d => d.viewport)).toEqual([
    { x: 100, y: 0, w: 100, h: 80 },
    { x: 100, y: 0, w: 100, h: 80 },
  ])
})

test('drawMarks leaves the scissor its caller set', () => {
  const hal = new MockHal(MARKS.map(m => m.pass))
  const clip = clipBlock(BLOCK, STATE.canvasWidth, STATE.canvasHeight, {
    x: 1,
    y: 1,
  })!
  uploadMarks(hal, 0, MARKS, REGION)
  hal.beginFrame(0, 0, 0, 0)
  hal.setScissor(clip.pxX, 20, clip.pxW, 30)
  drawMarks(
    hal,
    new ArrayBuffer(hal.uniformByteSize),
    MARKS,
    BLOCK,
    clip,
    REGION,
    STATE,
    0,
  )
  hal.endFrame()
  expect(hal.draws().map(d => d.scissor)).toEqual([
    { x: 100, y: 20, w: 100, h: 30 },
    { x: 100, y: 20, w: 100, h: 30 },
  ])
})
