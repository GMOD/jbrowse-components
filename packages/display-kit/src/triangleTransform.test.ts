import { computeTriangleYScalar, triangleAxis } from './triangleTransform.ts'

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

// The axis is the concatenation of displayedRegions in display order — every
// region counts toward the cumulative offset (elided ones included, since the
// ruler still gives them their width), a block in a reversed region leads with
// its `end`, and offsets come back relative to the leftmost fetched block.
describe('triangleAxis', () => {
  const displayed = [
    { start: 0, end: 1000 },
    { start: 0, end: 2 },
    { start: 100, end: 600 },
    { start: 0, end: 400, reversed: true },
  ]

  test('a block at its region start sits at the cumulative bp offset', () => {
    const { originBp, axisBlocks } = triangleAxis(
      [
        {
          refName: 'a',
          start: 0,
          end: 1000,
          displayedRegionIndex: 0,
        },
        {
          refName: 'c',
          start: 100,
          end: 600,
          displayedRegionIndex: 2,
        },
      ],
      displayed,
    )
    expect(originBp).toBe(0)
    // region 2's axis start = 1000 + 2 (the elided middle region still counts)
    expect(axisBlocks.map(b => b.offsetBp)).toEqual([0, 1002])
  })

  test('offsets are relative to the leftmost fetched block', () => {
    const { originBp, axisBlocks } = triangleAxis(
      [
        {
          refName: 'c',
          start: 300,
          end: 600,
          displayedRegionIndex: 2,
        },
      ],
      displayed,
    )
    // axis start of region 2 (1002) + block lead within it (300 - 100)
    expect(originBp).toBe(1202)
    expect(axisBlocks[0]!.offsetBp).toBe(0)
  })

  test('a block in a reversed region leads with its end', () => {
    const { originBp, axisBlocks } = triangleAxis(
      [
        {
          refName: 'd',
          start: 0,
          end: 300,
          displayedRegionIndex: 3,
        },
      ],
      displayed,
    )
    // region 3's axis start = 1000 + 2 + 500 = 1502; reversed lead = 400 - 300
    expect(originBp).toBe(1602)
    expect(axisBlocks[0]!.offsetBp).toBe(0)
  })

  // the view's names, not the adapter's: the RPC framework renames
  // `regions[].refName` on the way out, so hover labels would otherwise read
  // the .hic file's chromosome names under a ruler showing the assembly's
  test('spans from the origin to the far edge of the last block', () => {
    const { spanBp } = triangleAxis(
      [
        { refName: 'a', start: 500, end: 1000, displayedRegionIndex: 0 },
        { refName: 'c', start: 100, end: 400, displayedRegionIndex: 2 },
      ],
      displayed,
    )
    // origin 500; the last block ends at 1002 + 300, elided region included
    expect(spanBp).toBe(802)
  })

  test('carries the refName the view displays', () => {
    const { axisBlocks } = triangleAxis(
      [{ refName: 'chr1', start: 0, end: 1000, displayedRegionIndex: 0 }],
      [{ start: 0, end: 1000 }],
    )
    expect(axisBlocks[0]!.refName).toBe('chr1')
  })
})
