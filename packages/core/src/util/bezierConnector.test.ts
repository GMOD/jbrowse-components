import { bezierConnectorPath } from './bezierConnector.ts'

// Parse the two cubic control-point Ys out of an "M .. C cx1 cy1 cx2 cy2 x y" path.
function controlYs(path: string) {
  const m = /C ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/.exec(path)!
  return [Number(m[2]), Number(m[4])] as const
}

function controlXs(path: string) {
  const m = /C ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/.exec(path)!
  return [Number(m[1]), Number(m[3])] as const
}

// Sample the curve itself, rather than the control points that shape it.
function cubicYAt(path: string, t: number) {
  const m =
    /M [\d.-]+ ([\d.-]+) C [\d.-]+ ([\d.-]+) [\d.-]+ ([\d.-]+) [\d.-]+ ([\d.-]+)/.exec(
      path,
    )!
  const [y0, y1, y2, y3] = m.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
  ]
  const u = 1 - t
  return (
    u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
  )
}

test('same-row connection bows the control points up so it is not a flat line', () => {
  const path = bezierConnectorPath({
    x1: 0,
    y1: 100,
    x2: 50,
    y2: 100,
    s1: 1,
    s2: 1,
  })
  const [cy1, cy2] = controlYs(path)
  // both control points lifted above the shared row (smaller y = up on screen)
  expect(cy1).toBeLessThan(100)
  expect(cy2).toBeLessThan(100)
  expect(cy1).toBe(cy2)
})

test('bow fades out as the endpoints move to different rows', () => {
  const near = controlYs(
    bezierConnectorPath({
      x1: 0,
      y1: 100,
      x2: 50,
      y2: 110,
      s1: 1,
      s2: 1,
    }),
  )
  const far = controlYs(
    bezierConnectorPath({
      x1: 0,
      y1: 100,
      x2: 50,
      y2: 400,
      s1: 1,
      s2: 1,
    }),
  )
  // near rows still get a partial bow off their endpoint Y
  expect(near[0]).toBeLessThan(100)
  // rows farther apart than the max bow get no artificial lift
  expect(far[0]).toBe(100)
  expect(far[1]).toBe(400)
})

test('adjacent endpoints draw a straight line, not a curly-cue', () => {
  // reads a few px apart: too little span to afford a handle or a bow
  const path = bezierConnectorPath({
    x1: 200,
    y1: 100,
    x2: 203,
    y2: 104,
    s1: 1,
    s2: 1,
    leadingEnd2: true,
  })
  const [cx1, cx2] = controlXs(path)
  const [cy1, cy2] = controlYs(path)
  // control points stay within a px of the endpoints they belong to, so the
  // cubic is visually the straight segment from (200,100) to (203,104)
  expect(Math.abs(cx1 - 200)).toBeLessThan(2)
  expect(Math.abs(cx2 - 203)).toBeLessThan(2)
  expect(Math.abs(cy1 - 100)).toBeLessThan(2)
  expect(Math.abs(cy2 - 104)).toBeLessThan(2)
})

test('close endpoints do not overshoot into a loop', () => {
  // 30px apart: the opposing handles must not fly past each other, which is
  // what folds the curve back into a loop-de-loop
  const [cx1, cx2] = controlXs(
    bezierConnectorPath({
      x1: 0,
      y1: 100,
      x2: 30,
      y2: 130,
      s1: 1,
      s2: 1,
      leadingEnd2: true,
    }),
  )
  expect(cx1).toBeLessThan(30)
  expect(cx2).toBeGreaterThan(0)
})

test('vertically separated endpoints still spend a long handle', () => {
  // stacked split views: vertical span alone earns the handle, up to the ceiling
  const handleFor = (y2: number) =>
    controlXs(
      bezierConnectorPath({
        x1: 100,
        y1: 0,
        x2: 100,
        y2,
        s1: 1,
        s2: 1,
        leadingEnd2: true,
      }),
    )[0] - 100
  expect(handleFor(600)).toBe(180)
  expect(handleFor(2000)).toBe(200)
})

test('MAX_HANDLE_PX bounds the fold-back hook on a full-width inversion', () => {
  // 2000px of span would otherwise buy a 600px handle, flinging the leading
  // end's hook back across unrelated reads
  const [cx1] = controlXs(
    bezierConnectorPath({
      x1: 0,
      y1: 100,
      x2: 2000,
      y2: 100,
      s1: 1,
      s2: 1,
    }),
  )
  expect(cx1).toBe(200)
})

test('a discordant connection dips below the reads, not above them', () => {
  const [cy1, cy2] = controlYs(
    bezierConnectorPath({
      x1: 0,
      y1: 100,
      x2: 200,
      y2: 100,
      s1: 1,
      s2: 1,
      dip: true,
    }),
  )
  // larger y = down on screen; a concordant connection here would bow up
  expect(cy1).toBeGreaterThan(100)
  expect(cy2).toBeGreaterThan(100)
  expect(cy1).toBe(cy2)
})

// Control-point Y of a discordant same-row connection spanning `x2` px.
const dipY = (x2: number) =>
  controlYs(
    bezierConnectorPath({
      x1: 0,
      y1: 100,
      x2,
      y2: 100,
      s1: 1,
      s2: 1,
      dip: true,
    }),
  )[0]

// "view as pairs" / "link supplementary alignments" puts every qname on one
// row, so dipping to a shared row (previously the track's bottom edge) bottomed
// every discordant curve out at the same depth and they collapsed into
// spaghetti. Depth has to come from the connection's own span instead.
test('dip depth scales with span, so same-row connections do not all bottom out together', () => {
  expect(dipY(60)).toBeLessThan(dipY(300))
  expect(dipY(300)).toBeLessThan(dipY(1200))
})

test('dip depth keeps separating even the widest connections, and stays bounded', () => {
  // a hard cap would bottom every wide connection out at the same depth, which
  // is the spaghetti this is meant to avoid
  expect(dipY(300)).toBeLessThan(dipY(1200))
  expect(dipY(1200)).toBeLessThan(dipY(5000))
  expect(dipY(1e6)).toBeLessThan(100 + 110)
})

test('dip depth does not depend on the endpoints rows', () => {
  // the old dip reached for the track's bottom edge, so its depth changed with
  // track height and scroll position rather than with the event
  const depthFrom = (y: number) =>
    controlYs(
      bezierConnectorPath({
        x1: 0,
        y1: y,
        x2: 300,
        y2: y,
        s1: 1,
        s2: 1,
        dip: true,
      }),
    )[0] - y
  expect(depthFrom(20)).toBe(depthFrom(500))
})

// SPAN_FACTOR's contract: no shaping term may exceed 0.3x the distance the
// curve has to cover, or the cubic overshoots its far endpoint and has to curl
// back to arrive — the squiggle on tightly-spaced reads. The bow clamps to that
// budget explicitly; the dip's saturating curve happens to resolve under it at
// the current tuning, so nothing would catch a retune (MAX_DIP_PX >= ~145, or a
// smaller DIP_HALF_SPAN_PX) quietly reintroducing the squiggle.
test('the dip never outgrows its shaping budget', () => {
  // tightest spans bind: the dip approaches MAX_DIP_PX/DIP_HALF_SPAN_PX of the
  // span as it shrinks, while the budget stays a flat fraction of it
  for (const span of [1, 5, 20, 60, 150, 300, 800, 2000, 10_000]) {
    expect(dipY(span) - 100).toBeLessThanOrEqual(0.3 * span)
  }
})

test('an inversion folds back at its leading end', () => {
  // fwd->rev split junction: the second handle flips, so the curve arrives
  // flowing into the next segment rather than cutting straight across
  const [, cx2] = controlXs(
    bezierConnectorPath({
      x1: 0,
      y1: 100,
      x2: 300,
      y2: 100,
      s1: 1,
      s2: -1,
      leadingEnd2: true,
    }),
  )
  // the control point sits past the endpoint, which is what draws the hook
  expect(cx2).toBeGreaterThan(300)
})

test('a cross-row connection stays within its endpoints rows', () => {
  // past the bow fade, so nothing lifts the curve out of the band between the
  // two reads and onto unrelated pileup rows
  const path = bezierConnectorPath({
    x1: 0,
    y1: 100,
    x2: 200,
    y2: 400,
    s1: 1,
    s2: 1,
    leadingEnd2: true,
  })
  for (let t = 0; t <= 1; t += 0.05) {
    expect(cubicYAt(path, t)).toBeGreaterThanOrEqual(100)
    expect(cubicYAt(path, t)).toBeLessThanOrEqual(400)
  }
})
