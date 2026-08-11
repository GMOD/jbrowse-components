import { CIGAR_D, CIGAR_M } from '@jbrowse/cigar-utils'

import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import { KIND_BASE, KIND_MARKER } from './syntenyColors.ts'

// One feature spanning [0, widthBp] on both axes at bpPerPx=1, so the on-screen
// width in px equals widthBp. Location markers are emitted on top of the single
// KIND_BASE block. `cigar` defaults to none; passing one turns CIGAR detail on,
// which routes the marker ladder through the rendered segments instead.
function buildWithMarkers(widthBp: number, cigar: number[] = []) {
  return buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([widthBp]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([widthBp]),
    strands: new Int8Array([1]),
    parsedCigars: [cigar],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([widthBp]),
    drawCIGAR: cigar.length > 0,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: true,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: widthBp,
  })
}

const op = (len: number, code: number) => (len << 4) | code

function markerIndices(kinds: Uint8Array) {
  return [...kinds].flatMap((k, i) => (k === KIND_MARKER ? [i] : []))
}

test('wide feature emits floor(width/20)+1 evenly-spaced zero-width markers', () => {
  const width = 1000
  const g = buildWithMarkers(width)
  const markers = markerIndices(g.kinds)

  // numMarkers = max(2, floor(averageWidth/20)+1); averageWidth == 1000 px.
  expect(markers.length).toBe(Math.floor(width / 20) + 1)

  // Each marker is a vertical tick: a point on each axis (top span and bottom
  // span both zero).
  for (const i of markers) {
    expect(g.bp1[i]!).toBe(g.bp2[i]!)
    expect(g.bp3[i]!).toBe(g.bp4[i]!)
  }

  // Endpoints land exactly on the feature corners (t=0 and t=1). base0 == 0
  // here (viewOff0 == 0), so window-relative bp equals cumBp.
  const first = markers[0]!
  const last = markers.at(-1)!
  expect(g.bp1[first]!).toBe(0)
  expect(g.bp1[last]!).toBe(width)
})

test('feature narrower than the 30px average-width gate emits no markers', () => {
  const g = buildWithMarkers(20)
  expect(markerIndices(g.kinds)).toEqual([])
  // The base block is still present.
  expect([...g.kinds]).toEqual([KIND_BASE])
})

// The regression this file exists for. Rendered CIGAR segments are ~1px wide by
// construction (visitCigarRenderedSegments emits as soon as either axis has
// advanced past one pixel), so a per-segment 30px width gate rejected all of
// them: with the default cigarMode 'full', every feature carrying a CIGAR lost
// its markers entirely. The ladder is per feature, so the CIGAR is invisible to
// it — a 1000px feature gets the same ticks either way.
test('a fine-grained CIGAR does not cost the feature its markers', () => {
  const width = 1000
  // 100 x 10M: 100 rendered segments, each 10px, none of them 30px wide.
  const cigar = Array.from({ length: 100 }, () => op(10, CIGAR_M))

  const withCigar = markerIndices(buildWithMarkers(width, cigar).kinds)
  const without = markerIndices(buildWithMarkers(width).kinds)
  expect(withCigar.length).toBe(without.length)
  expect(withCigar.length).toBe(Math.floor(width / 20) + 1)
})

// And the reason the ladder is fed the segments rather than the corners: each
// tick joins the pair the CIGAR actually aligns, so the ticks shear where the
// alignment does. Interpolating across the corners would smear one 100bp
// deletion evenly over the whole ribbon.
test('markers follow the CIGAR through a deletion', () => {
  // Top spans 1000, bottom 900: 500M, 100D (top only), 400M.
  const g = buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([1000]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([900]),
    strands: new Int8Array([1]),
    parsedCigars: [[op(500, CIGAR_M), op(100, CIGAR_D), op(400, CIGAR_M)]],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([1000]),
    drawCIGAR: true,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: true,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: 1000,
  })
  // Offset between a tick's two ends, in bp, in ladder order.
  const shear = markerIndices(g.kinds).map(i => g.bp1[i]! - g.bp3[i]!)

  // Flat on either side of the deletion, and exactly its length apart after —
  // not the 0..100 ramp corner interpolation would have drawn.
  expect(shear[0]).toBe(0)
  expect(shear.at(-1)).toBe(100)
  expect([...new Set(shear)].sort((a, b) => a - b)).toEqual([0, 40, 80, 100])
})
