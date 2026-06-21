import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import { KIND_BASE, KIND_MARKER } from './syntenyColors.ts'

// One CIGAR-less feature spanning [0, widthBp] on both axes at bpPerPx=1, so
// the on-screen width in px equals widthBp. Location markers are emitted on top
// of the single KIND_BASE block.
function buildWithMarkers(widthBp: number) {
  return buildSyntenyGeometry({
    p11_cumBp: new Float64Array([0]),
    p12_cumBp: new Float64Array([widthBp]),
    p21_cumBp: new Float64Array([0]),
    p22_cumBp: new Float64Array([widthBp]),
    strands: new Int8Array([1]),
    parsedCigars: [[]],
    starts: new Uint32Array([0]),
    ends: new Uint32Array([widthBp]),
    drawCIGAR: false,
    drawCIGARMatchesOnly: false,
    drawLocationMarkers: true,
    bpPerPx0: 1,
    bpPerPx1: 1,
    viewOff0: 0,
    viewOff1: 0,
    viewWidth: widthBp,
  })
}

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
    expect(g.bp1Hi[i]! + g.bp1Lo[i]!).toBe(g.bp2Hi[i]! + g.bp2Lo[i]!)
    expect(g.bp3Hi[i]! + g.bp3Lo[i]!).toBe(g.bp4Hi[i]! + g.bp4Lo[i]!)
  }

  // Endpoints land exactly on the feature corners (t=0 and t=1).
  const first = markers[0]!
  const last = markers.at(-1)!
  expect(g.bp1Hi[first]! + g.bp1Lo[first]!).toBe(0)
  expect(g.bp1Hi[last]! + g.bp1Lo[last]!).toBe(width)
})

test('feature narrower than the 30px average-width gate emits no markers', () => {
  const g = buildWithMarkers(20)
  expect(markerIndices(g.kinds)).toEqual([])
  // The base block is still present.
  expect([...g.kinds]).toEqual([KIND_BASE])
})
