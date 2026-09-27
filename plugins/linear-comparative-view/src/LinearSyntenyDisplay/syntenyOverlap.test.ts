import { createCanvas } from 'canvas'

import { KIND_BASE } from '../LinearSyntenyRPC/syntenyKinds.ts'
import { drawSyntenyTrack } from './drawSyntenyTrack.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'

// A pixel several ribbons cover shows the strongest of them once overlaps stop
// stacking, on a real rasterizer: the crossing of an inversion's tiles is the
// case, and it went black at the default alpha. The fixture is an inverted
// ribbon, a bowtie crossing at the canvas centre, so it is sampled inside the
// top half, where the ribbon covers the pixel whole.
const W = 200
const H = 60
const GREY = 0xff828282
const FAINT_GREY = 0x60828282

function ribbons(colors: number[]): SyntenyInstanceData {
  const n = colors.length
  return {
    bp1: new Float32Array(n).fill(20),
    bp2: new Float32Array(n).fill(180),
    bp3: new Float32Array(n).fill(20),
    bp4: new Float32Array(n).fill(180),
    base0: 0,
    base1: 0,
    colors: Uint32Array.from(colors),
    kinds: new Uint8Array(n).fill(KIND_BASE),
    instanceFeatureIdx: Uint32Array.from(colors.map((_, i) => i)),
    alignmentLengths: new Float32Array(n).fill(10000),
    instanceCount: n,
  }
}

function samplePixel(colors: number[], ground: string, overlapsStack: boolean) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, W, H)
  drawSyntenyTrack(
    ctx,
    ribbons(colors),
    {
      yTop: 0,
      height: H,
      alpha: 0.3,
      fadeThinAlignments: false,
      minAlignmentLength: 0,
      hoveredFeatureId: 0,
      clickedFeatureId: 0,
      offsetPx0: 0,
      offsetPx1: 0,
      bpPerPx0: 1,
      bpPerPx1: 1,
      drawCurves: false,
    },
    W,
    300,
    ground,
    overlapsStack,
  )
  return [...ctx.getImageData(W / 2, 6, 1, 1).data.slice(0, 3)]
}

function near(a: number[], b: number[]) {
  a.forEach((c, i) => {
    expect(Math.abs(c - b[i]!)).toBeLessThanOrEqual(1)
  })
}

describe.each(['#fff', '#121212'])('over a %s band', ground => {
  test('ten stacked ribbons land where one does', () => {
    const one = samplePixel([GREY], ground, false)
    near(samplePixel(new Array(10).fill(GREY), ground, false), one)
    near(samplePixel([GREY], ground, true), one)
  })

  test('the strongest ribbon shows whichever order they arrive in', () => {
    const strong = samplePixel([GREY], ground, false)
    near(samplePixel([GREY, FAINT_GREY], ground, false), strong)
    near(samplePixel([FAINT_GREY, GREY], ground, false), strong)
  })
})

test('stacking is still the pairwise default, and ten ribbons darken', () => {
  const one = samplePixel([GREY], '#fff', true)
  const ten = samplePixel(new Array(10).fill(GREY), '#fff', true)
  expect(ten[0]!).toBeLessThan(one[0]! - 60)
})
