import {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  SERIF_H_PX,
  SERIF_HALF_W_PX,
  drawInsertionMarker,
  insertionBarWidth,
} from './index.ts'

// Records the path the marker draws so the serif caps can be read back as
// geometry. The shader draws these from the same two generated constants
// (insertion.slang's `serifPos`), which is the whole point of exporting them —
// the two used to be a 3x1px rectangle on the GPU and a 4x2px triangle here.
function recordingCtx() {
  const rects: number[][] = []
  const paths: number[][][] = []
  let current: number[][] = []
  const ctx = {
    fillStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push([x, y, w, h])
    },
    fillText() {},
    beginPath() {
      current = []
    },
    moveTo(x: number, y: number) {
      current.push([x, y])
    },
    lineTo(x: number, y: number) {
      current.push([x, y])
    },
    closePath() {},
    fill() {
      paths.push(current)
    },
  }
  return { ctx, rects, paths }
}

const X = 100
const TOP = 20
const HEIGHT = 10
// Past INSERTION_SERIF_MIN_PX_PER_BP, so the caps draw.
const ZOOMED_IN = INSERTION_SERIF_MIN_PX_PER_BP

function draw(length: number, pxPerBp: number) {
  const { ctx, rects, paths } = recordingCtx()
  drawInsertionMarker(ctx, X, TOP, HEIGHT, length, pxPerBp)
  return { rects, paths }
}

test('the bar spans the row at the width the shader computes', () => {
  const { rects } = draw(3, ZOOMED_IN)
  const w = insertionBarWidth(3, ZOOMED_IN, HEIGHT)
  expect(rects).toEqual([[X - w / 2, TOP, w, HEIGHT]])
})

test('both serif caps are wedges of the exported size, on their row edges', () => {
  const { paths } = draw(3, ZOOMED_IN)
  expect(paths).toEqual([
    // Top cap: base on the row's top edge, point down into the row.
    [
      [X - SERIF_HALF_W_PX, TOP],
      [X + SERIF_HALF_W_PX, TOP],
      [X, TOP + SERIF_H_PX],
    ],
    // Bottom cap: the mirror of it, so the mark reads as a symmetric I-beam.
    [
      [X - SERIF_HALF_W_PX, TOP + HEIGHT],
      [X + SERIF_HALF_W_PX, TOP + HEIGHT],
      [X, TOP + HEIGHT - SERIF_H_PX],
    ],
  ])
})

test('no caps once zoomed out past the serif threshold', () => {
  expect(draw(3, INSERTION_SERIF_MIN_PX_PER_BP - 0.01).paths).toEqual([])
})

test('no caps on a long insertion, which draws as a bare bar', () => {
  expect(draw(LONG_INSERTION_MIN_LENGTH, ZOOMED_IN).paths).toEqual([])
})
