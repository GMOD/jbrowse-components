import { CIGAR_D, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import { pickFeatureAtPoint } from './syntenyPickEngine.ts'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { PickCanvasLike, PickIndex } from './syntenyPickEngine.ts'
import type {
  SyntenyRenderState,
  SyntenyTrackRenderParams,
} from './syntenyRenderingBackendTypes.ts'

const packed = (len: number, op: number) => (len << 4) | op

function pointInPolygon(x: number, y: number, pts: [number, number][]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!
    const [xj, yj] = pts[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function createPickCtx(): PickCanvasLike {
  let pts: [number, number][] = []
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    beginPath() {
      pts = []
    },
    closePath() {},
    moveTo(x: number, y: number) {
      pts.push([x, y])
    },
    lineTo(x: number, y: number) {
      pts.push([x, y])
    },
    bezierCurveTo(
      _a: number,
      _b: number,
      _c: number,
      _d: number,
      x: number,
      y: number,
    ) {
      pts.push([x, y])
    },
    fill() {},
    stroke() {},
    isPointInPath(x: number, y: number) {
      return pointInPolygon(x, y, pts)
    },
  }
}

// The hg38/hs1 arrangement, shrunk: feature 0 is the wide block whose CIGAR
// carries a deletion over x=[200,400], feature 1 a small alignment lying inside
// that deletion's span. `compareDrawOrder` puts the small one second, which is
// what the pick engine's backwards walk needs to answer it.
function geometry() {
  return buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0, 260]),
    p12_cumBp: new Float64Array([600, 290]),
    p21_cumBp: new Float64Array([0, 260]),
    p22_cumBp: new Float64Array([600, 290]),
    queryGridAnchors: new Float64Array([0, 0]),
    strands: new Int8Array([1, 1]),
    parsedCigars: [
      [packed(200, CIGAR_M), packed(200, CIGAR_D), packed(200, CIGAR_M)],
      [],
    ],
    starts: new Uint32Array([0, 260]),
    ends: new Uint32Array([600, 290]),
    drawCIGAR: true,
    drawCIGARMatchesOnly: false,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 700,
  })
}

function pickedFeatureAt(x: number) {
  const g = geometry()
  const data: SyntenyInstanceData = {
    ...g,
    colors: new Uint32Array(g.instanceCount).fill(0xff808080),
  }
  const params: SyntenyTrackRenderParams = {
    yTop: 0,
    height: 100,
    alpha: 1,
    fadeThinAlignments: true,
    minAlignmentLength: 0,
    hoveredFeatureId: 0,
    clickedFeatureId: 0,
    offsetPx0: 0,
    offsetPx1: 0,
    bpPerPx0: 1,
    bpPerPx1: 1,
    drawCurves: false,
  }
  const state: SyntenyRenderState = {
    overdrawPx: 300,
    perTrack: new Map([[0, params]]),
  }
  const hit = pickFeatureAtPoint({
    ctx: createPickCtx(),
    state,
    regions: new Map([[0, data]]),
    pickIndices: new Map<number, PickIndex>(),
    canvasLogicalWidth: 800,
    x,
    y: 50,
  })
  return hit && data.instanceFeatureIdx[hit.instanceIndex]
}

// The bug this fixes, end to end. Sorting the small alignment above the large
// one only reaches the hover if the geometry keeps each feature's instances
// contiguous: with the base and CIGAR passes split, the large block's deletion
// quad outranked the small block's body and answered here instead.
test('a small alignment inside a large one answers the hover', () => {
  expect(pickedFeatureAt(275)).toBe(1)
})

test('the large block still answers where the small one is not', () => {
  expect(pickedFeatureAt(100)).toBe(0)
  expect(pickedFeatureAt(500)).toBe(0)
})
