import * as arcShader from '../../shaders/slang/arc.iface.generated.ts'
import * as arcFlatShader from '../../shaders/slang/arcFlat.iface.generated.ts'
import * as arcLineShader from '../../shaders/slang/arcLine.iface.generated.ts'
import { ARC_WIDTH_MAX_SCALE } from './arcLineWidth.ts'
import { arcsToRegionResult } from './arcRegions.ts'
import {
  packArcFlats,
  packArcLines,
  packArcMarkers,
  packArcs,
} from './packGpu.ts'
import {
  ARC_SHAPE_ARC,
  ARC_SHAPE_FLAT,
  ARC_SHAPE_FLAT_SPLIT,
} from './shapes.ts'

import type { ComputedArc } from './arcTypes.ts'

// Deliberately not 1: a packer that dropped the configured width on the floor
// and shipped a bare scale factor would still satisfy every assertion below if
// the base were 1.
const BASE_WIDTH = 3

function arc(
  shapeType: number,
  bp: number,
  colorType = 0,
  support = 1,
): ComputedArc {
  return {
    p1: { refName: 'chr1', bp },
    p2: { refName: 'chr1', bp: bp + 500 },
    colorType,
    shapeType,
    yBp: bp * 2,
    spanBp: bp * 2,
    support,
    key: `chr1\0${bp}\0chr1\0${bp + 500}\0${colorType}\0${shapeType}`,
  }
}

// Curved arcs and flat read-cloud connectors are two passes with two vertex
// counts (130 vs 6), fed from ONE `arcShapeTypes` array. Each packer compacts
// its own kind out of that array and sizes its buffer from a count computed
// somewhere else entirely (`numFlatArcs`, in arcsToRegionResult). If those two
// walks ever disagree, the buffer is the wrong length and instances go missing
// or read past their data — silently, since a short buffer just draws fewer
// arcs. So pin the split from both ends.
describe('arc pack split (curved vs flat)', () => {
  it('sends each shape to its own buffer, sized by its own count', () => {
    const data = arcsToRegionResult(
      [
        arc(ARC_SHAPE_ARC, 100),
        arc(ARC_SHAPE_FLAT, 200),
        arc(ARC_SHAPE_ARC, 300),
        arc(ARC_SHAPE_FLAT_SPLIT, 400),
      ],
      [],
    )
    expect(data.numArcs).toBe(4)
    expect(data.numFlatArcs).toBe(2)

    // 2 curved of 4 total, 2 flat — each buffer exactly its own instances.
    expect(packArcs(data, BASE_WIDTH).byteLength).toBe(
      2 * arcShader.INSTANCE_STRIDE_BYTES,
    )
    expect(packArcFlats(data, BASE_WIDTH).byteLength).toBe(
      2 * arcFlatShader.INSTANCE_STRIDE_BYTES,
    )
    // Two endpoint squares per flat arc, and none for the curved ones.
    expect(packArcMarkers(data).byteLength).toBeGreaterThan(0)
  })

  it('packs the curved instances, not the first N of a mixed array', () => {
    // The flat arc sits FIRST, so a packer that copied a prefix instead of
    // compacting would ship it to the curve pass and drop the real curve.
    const data = arcsToRegionResult(
      [arc(ARC_SHAPE_FLAT, 200, 5), arc(ARC_SHAPE_ARC, 700, 6)],
      [],
    )
    const view = new DataView(packArcs(data, BASE_WIDTH))
    // x1 is the first field of the arc instance (see arc.slang's Instance).
    expect(view.getUint32(0, true)).toBe(700)
  })

  it('marks only the split variant dashed', () => {
    const data = arcsToRegionResult(
      [arc(ARC_SHAPE_FLAT, 100), arc(ARC_SHAPE_FLAT_SPLIT, 200)],
      [],
    )
    const stride = arcFlatShader.INSTANCE_STRIDE_BYTES
    const view = new DataView(packArcFlats(data, BASE_WIDTH))
    const dashed = arcFlatShader.INSTANCE_OFFSET_F32.dashed * 4
    expect(view.getFloat32(dashed, true)).toBe(0)
    expect(view.getFloat32(stride + dashed, true)).toBe(1)
  })

  it('read cloud leaves the curve pass empty and arc mode the flat pass', () => {
    // The modes are disjoint by construction (computeArcShape emits a flat
    // shape iff `cloud`), which is why the extra pass is free.
    const cloud = arcsToRegionResult([arc(ARC_SHAPE_FLAT, 100)], [])
    expect(packArcs(cloud, BASE_WIDTH).byteLength).toBe(0)

    const arcs = arcsToRegionResult([arc(ARC_SHAPE_ARC, 100)], [])
    expect(packArcFlats(arcs, BASE_WIDTH).byteLength).toBe(0)
    expect(packArcMarkers(arcs).byteLength).toBe(0)
  })
})

// The per-instance stroke width, read back out of the packed buffer the way the
// vertex stage reads it: word `INSTANCE_OFFSET_F32.lineWidthPx` of instance `i`.
function packedWidth(
  buf: ArrayBuffer,
  i: number,
  layout: { INSTANCE_STRIDE_WORDS: number; lineWidthPx: number },
) {
  return new Float32Array(buf)[
    i * layout.INSTANCE_STRIDE_WORDS + layout.lineWidthPx
  ]
}

const CURVED_WIDTH = {
  INSTANCE_STRIDE_WORDS: arcShader.INSTANCE_STRIDE_WORDS,
  lineWidthPx: arcShader.INSTANCE_OFFSET_F32.lineWidthPx,
}
const FLAT_WIDTH = {
  INSTANCE_STRIDE_WORDS: arcFlatShader.INSTANCE_STRIDE_WORDS,
  lineWidthPx: arcFlatShader.INSTANCE_OFFSET_F32.lineWidthPx,
}
const LINE_WIDTH = {
  INSTANCE_STRIDE_WORDS: arcLineShader.INSTANCE_STRIDE_WORDS,
  lineWidthPx: arcLineShader.INSTANCE_OFFSET_F32.lineWidthPx,
}

// Width is per instance because an arc is a junction, not a read: `resolveArcs`
// folds identical connections and counts them, and `arcLineWidth` turns that
// count into ink. The packers resolve it on the CPU — the shaders never see a
// support count — so this is where the GPU path's copy of that promise is
// pinned.
describe('arc stroke width per instance', () => {
  // The guarantee that made coalescing safe to switch on for every existing
  // figure: a lone read still packs the configured width EXACTLY, so a feed
  // with no repeats draws what it drew before. Exact equality, not
  // toBeCloseTo — "one read is a hair thicker than it used to be" is precisely
  // the regression this is here to catch, and 3 is exact in Float32.
  it('packs the configured width, unchanged, for a support-1 arc', () => {
    const data = arcsToRegionResult([arc(ARC_SHAPE_ARC, 100, 0, 1)], [])
    expect(packedWidth(packArcs(data, BASE_WIDTH), 0, CURVED_WIDTH)).toBe(
      BASE_WIDTH,
    )
  })

  it('packs a support-32 arc wider, and inside the cap', () => {
    const data = arcsToRegionResult(
      [arc(ARC_SHAPE_ARC, 100, 0, 1), arc(ARC_SHAPE_ARC, 900, 0, 32)],
      [],
    )
    const buf = packArcs(data, BASE_WIDTH)
    const one = packedWidth(buf, 0, CURVED_WIDTH)!
    const many = packedWidth(buf, 1, CURVED_WIDTH)!
    expect(one).toBe(BASE_WIDTH)
    // 5 doublings at ARC_WIDTH_PER_DOUBLING = 0.55 → 3.75x, still under the cap.
    expect(many).toBeCloseTo(BASE_WIDTH * 3.75, 5)
    expect(many).toBeLessThanOrEqual(BASE_WIDTH * ARC_WIDTH_MAX_SCALE)
  })

  // Flat read-cloud connectors coalesce on the same key and Canvas2D widens
  // them from the same call, so the flat pass carries a width too — otherwise
  // read cloud on the GPU would disagree with its own SVG export.
  it('carries the width on flat connectors as well', () => {
    const data = arcsToRegionResult(
      [arc(ARC_SHAPE_FLAT, 100, 0, 1), arc(ARC_SHAPE_FLAT_SPLIT, 900, 0, 32)],
      [],
    )
    const buf = packArcFlats(data, BASE_WIDTH)
    expect(packedWidth(buf, 0, FLAT_WIDTH)).toBe(BASE_WIDTH)
    expect(packedWidth(buf, 1, FLAT_WIDTH)!).toBeGreaterThan(BASE_WIDTH)
  })

  // And on the connector ticks, which is the newest of the three and the one
  // that had nowhere to put a count at all: a tick was a fixed-width mark, so a
  // 40-read translocation and one mismapped pair drew identically.
  it('carries the width on connector ticks as well', () => {
    const data = arcsToRegionResult(
      [],
      [
        {
          x: { refName: 'chr1', bp: 100 },
          support: 1,
          partnerRefNames: ['c2'],
        },
        {
          x: { refName: 'chr1', bp: 900 },
          support: 32,
          partnerRefNames: ['c2'],
        },
      ],
    )
    const buf = packArcLines(data, BASE_WIDTH)
    expect(packedWidth(buf, 0, LINE_WIDTH)).toBe(BASE_WIDTH)
    expect(packedWidth(buf, 1, LINE_WIDTH)!).toBeCloseTo(BASE_WIDTH * 3.75, 5)
  })
})
