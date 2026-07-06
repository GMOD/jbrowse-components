import {
  connectionEndpointBps,
  readLeadingBp,
  readTrailingBp,
} from './readEndpoints.ts'

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

describe('connectionEndpointBps', () => {
  it('pair: both endpoints are read-trailing 3-prime edges', () => {
    expect(
      connectionEndpointBps({
        s1: 1,
        start1: 100,
        end1: 200,
        s2: -1,
        start2: 500,
        end2: 600,
        isSplit: false,
      }),
    ).toEqual({ bp1: 200, bp2: 500 })
  })
  it('split: endpoint 2 folds back to the next segment read-leading 5-prime edge', () => {
    // fwd→rev inversion: endpoint 2 lands on the reverse segment's end (the
    // breakpoint side), not its start.
    expect(
      connectionEndpointBps({
        s1: 1,
        start1: 100,
        end1: 200,
        s2: -1,
        start2: 500,
        end2: 600,
        isSplit: true,
      }),
    ).toEqual({ bp1: 200, bp2: 600 })
  })
})
