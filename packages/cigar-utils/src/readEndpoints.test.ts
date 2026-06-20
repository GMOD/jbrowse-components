import { readLeadingBp, readTrailingBp } from './readEndpoints.ts'

describe('readTrailingBp (3-prime / read-trailing edge)', () => {
  it('forward strand → end', () => {
    expect(readTrailingBp(1, 100, 200)).toBe(200)
  })
  it('reverse strand → start', () => {
    expect(readTrailingBp(-1, 100, 200)).toBe(100)
  })
})

describe('readLeadingBp (5-prime / read-leading edge)', () => {
  it('forward strand → start', () => {
    expect(readLeadingBp(1, 100, 200)).toBe(100)
  })
  it('reverse strand → end', () => {
    expect(readLeadingBp(-1, 100, 200)).toBe(200)
  })
})
