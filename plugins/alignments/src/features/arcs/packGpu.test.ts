import * as arcShader from '../../LinearAlignmentsDisplay/shaders/slang/arc.iface.generated.ts'
import * as arcFlatShader from '../../LinearAlignmentsDisplay/shaders/slang/arcFlat.iface.generated.ts'
import {
  ARC_SHAPE_ARC,
  ARC_SHAPE_FLAT,
  ARC_SHAPE_FLAT_SPLIT,
  arcsToRegionResult,
} from './compute.ts'
import { packArcFlats, packArcMarkers, packArcs } from './packGpu.ts'

import type { ComputedArc } from './compute.ts'

function arc(shapeType: number, bp: number, colorType = 0): ComputedArc {
  return {
    p1: { refName: 'chr1', bp },
    p2: { refName: 'chr1', bp: bp + 500 },
    colorType,
    shapeType,
    yBp: bp * 2,
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
    expect(packArcs(data).byteLength).toBe(2 * arcShader.INSTANCE_STRIDE_BYTES)
    expect(packArcFlats(data).byteLength).toBe(
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
    const view = new DataView(packArcs(data))
    // x1 is the first field of the arc instance (see arc.slang's Instance).
    expect(view.getUint32(0, true)).toBe(700)
  })

  it('marks only the split variant dashed', () => {
    const data = arcsToRegionResult(
      [arc(ARC_SHAPE_FLAT, 100), arc(ARC_SHAPE_FLAT_SPLIT, 200)],
      [],
    )
    const stride = arcFlatShader.INSTANCE_STRIDE_BYTES
    const view = new DataView(packArcFlats(data))
    // dashed is the last field (x1, x2, yBp, dashed) — a f32 flag.
    expect(view.getFloat32(stride - 4, true)).toBe(0)
    expect(view.getFloat32(2 * stride - 4, true)).toBe(1)
  })

  it('read cloud leaves the curve pass empty and arc mode the flat pass', () => {
    // The modes are disjoint by construction (computeArcShape emits a flat
    // shape iff `cloud`), which is why the extra pass is free.
    const cloud = arcsToRegionResult([arc(ARC_SHAPE_FLAT, 100)], [])
    expect(packArcs(cloud).byteLength).toBe(0)

    const arcs = arcsToRegionResult([arc(ARC_SHAPE_ARC, 100)], [])
    expect(packArcFlats(arcs).byteLength).toBe(0)
    expect(packArcMarkers(arcs).byteLength).toBe(0)
  })
})
