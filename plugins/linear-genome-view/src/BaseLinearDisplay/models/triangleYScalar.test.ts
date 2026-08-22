import { computeTriangleYScalar } from './triangleYScalar.ts'

describe('computeTriangleYScalar', () => {
  test('squashToHeight off → identity regardless of dimensions', () => {
    expect(
      computeTriangleYScalar({
        squashToHeight: false,
        displayHeight: 100,
        triangleWidth: 800,
      }),
    ).toBe(1)
  })

  test('squash: display shorter than natural apex', () => {
    // natural apex = 800/2 = 400, squash into 100 → 0.25
    expect(
      computeTriangleYScalar({
        squashToHeight: true,
        displayHeight: 100,
        triangleWidth: 800,
      }),
    ).toBe(0.25)
  })

  test('stretch: display taller than natural apex', () => {
    // natural apex = 400, stretch into 600 → 1.5
    expect(
      computeTriangleYScalar({
        squashToHeight: true,
        displayHeight: 600,
        triangleWidth: 800,
      }),
    ).toBe(1.5)
  })

  test('zero-width triangle → identity, never divides by zero', () => {
    expect(
      computeTriangleYScalar({
        squashToHeight: true,
        displayHeight: 300,
        triangleWidth: 0,
      }),
    ).toBe(1)
  })
})
