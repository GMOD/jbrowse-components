import { AUTO_BIN_TARGET_PX, autoBinStep, rungFloorBpPerPx } from './autoBin.ts'

test('the rung floor is the finest zoom the rung serves, inside the same rung', () => {
  let bpPerPx = 0.25
  for (let i = 0; i < 80; i++) {
    const floor = rungFloorBpPerPx(bpPerPx)
    expect(floor).toBeLessThanOrEqual(bpPerPx)
    expect(autoBinStep(floor * 1.0001)).toBe(autoBinStep(bpPerPx))
    bpPerPx *= 1.125
  }
})

test('every zoom inside a rung shares one floor', () => {
  expect(rungFloorBpPerPx(2.6)).toBe(rungFloorBpPerPx(4.9))
  expect(rungFloorBpPerPx(5.1)).toBe(rungFloorBpPerPx(9.9))
  expect(rungFloorBpPerPx(5.1)).not.toBe(rungFloorBpPerPx(4.9))
})

test('the floor is the rung below over the target width', () => {
  expect(rungFloorBpPerPx(3)).toBe(10 / AUTO_BIN_TARGET_PX)
  expect(rungFloorBpPerPx(1000)).toBe(2000 / AUTO_BIN_TARGET_PX)
  expect(rungFloorBpPerPx(0.3)).toBe(1 / AUTO_BIN_TARGET_PX)
})
