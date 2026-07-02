import { bezierConnectorHandlePx, bezierConnectorPath } from './bezierConnector.ts'

// Parse the two cubic control-point Ys out of an "M .. C cx1 cy1 cx2 cy2 x y" path.
function controlYs(path: string) {
  const m = /C ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)/.exec(path)!
  return [Number(m[2]), Number(m[4])] as const
}

test('handle length floors at MIN_HANDLE_PX, else scales with separation', () => {
  expect(bezierConnectorHandlePx(0, 10)).toBe(15)
  expect(bezierConnectorHandlePx(0, 1000)).toBe(300)
})

test('same-row connection bows the control points up so it is not a flat line', () => {
  const path = bezierConnectorPath({
    x1: 0,
    y1: 100,
    x2: 50,
    y2: 100,
    s1: 1,
    s2: 1,
    handlePx: 15,
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
      handlePx: 15,
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
      handlePx: 15,
    }),
  )
  // near rows still get a partial bow off their endpoint Y
  expect(near[0]).toBeLessThan(100)
  // rows farther apart than the max bow get no artificial lift
  expect(far[0]).toBe(100)
  expect(far[1]).toBe(400)
})

test('control-point Y override (abnormal dip) suppresses the bow', () => {
  const path = bezierConnectorPath({
    x1: 0,
    y1: 100,
    x2: 50,
    y2: 100,
    s1: 1,
    s2: 1,
    handlePx: 15,
    cy1: 200,
    cy2: 200,
  })
  const [cy1, cy2] = controlYs(path)
  expect(cy1).toBe(200)
  expect(cy2).toBe(200)
})
