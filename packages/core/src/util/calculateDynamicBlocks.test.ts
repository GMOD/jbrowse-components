import calculateDynamicBlocks from './calculateDynamicBlocks.ts'
import calculateStaticBlocks from './calculateStaticBlocks.ts'

const ctgA = { assemblyName: 'test', refName: 'ctgA', start: 0, end: 50000 }

test('one', () => {
  expect(
    calculateDynamicBlocks({
      offsetPx: 0,
      width: 200,
      displayedRegions: [ctgA],
      bpPerPx: 1,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('two', () => {
  expect(
    calculateDynamicBlocks({
      offsetPx: 0,
      width: 200,
      displayedRegions: [{ ...ctgA, reversed: true }],
      bpPerPx: 1,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('three', () => {
  expect(
    calculateDynamicBlocks({
      offsetPx: -100,
      width: 200,
      displayedRegions: [{ ...ctgA, reversed: true }],
      bpPerPx: 1,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('four', () => {
  expect(
    calculateDynamicBlocks({
      offsetPx: -100,
      width: 350,
      displayedRegions: [ctgA],
      bpPerPx: 1,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})
test('five', () => {
  expect(
    calculateDynamicBlocks({
      offsetPx: 521,
      width: 927,
      displayedRegions: [{ ...ctgA, reversed: false }],
      bpPerPx: 0.05,
      minimumBlockWidth: 20,
      interRegionPaddingWidth: 2,
    }).getBlocks(),
  ).toMatchSnapshot()
})

test('off-screen regions contribute padding to block positions', () => {
  const regions = [
    { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
    { assemblyName: 'test', refName: 'chr2', start: 0, end: 1000 },
    { assemblyName: 'test', refName: 'chr3', start: 0, end: 1000 },
  ]
  const blockSet = calculateDynamicBlocks({
    offsetPx: 2004,
    width: 800,
    displayedRegions: regions,
    bpPerPx: 1,
    minimumBlockWidth: 3,
    interRegionPaddingWidth: 2,
  })
  const chr3Blocks = blockSet.contentBlocks.filter(b => b.refName === 'chr3')
  expect(chr3Blocks.length).toBeGreaterThan(0)
  expect(chr3Blocks[0]!.offsetPx).toBe(2004)
})

function makeParams(
  regions: {
    assemblyName: string
    refName: string
    start: number
    end: number
  }[],
  opts: {
    offsetPx?: number
    width?: number
    bpPerPx?: number
    minimumBlockWidth?: number
    interRegionPaddingWidth?: number
  } = {},
) {
  return {
    displayedRegions: regions,
    offsetPx: opts.offsetPx ?? 0,
    width: opts.width ?? 800,
    bpPerPx: opts.bpPerPx ?? 1,
    minimumBlockWidth: opts.minimumBlockWidth ?? 3,
    interRegionPaddingWidth: opts.interRegionPaddingWidth ?? 2,
  }
}

function makeRegions(count: number, size = 1000) {
  return Array.from({ length: count }, (_, i) => ({
    assemblyName: 'test',
    refName: `chr${i + 1}`,
    start: 0,
    end: size,
  }))
}

describe('static and dynamic blocks produce equivalent positions', () => {
  it('single region fully visible', () => {
    const params = makeParams(makeRegions(1))
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const sc = staticBlocks.contentBlocks
    const dc = dynamicBlocks.contentBlocks
    expect(sc.length).toBeGreaterThan(0)
    expect(dc.length).toBe(1)
    expect(dc[0]!.offsetPx).toBe(sc[0]!.offsetPx)
    expect(dc[0]!.refName).toBe(sc[0]!.refName)
  })

  it('3 regions all visible', () => {
    const params = makeParams(makeRegions(3), { width: 4000 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    for (const dc of dynamicBlocks.contentBlocks) {
      const matchingStatic = staticBlocks.contentBlocks.find(
        sc =>
          sc.refName === dc.refName &&
          sc.start <= dc.start &&
          sc.end >= dc.start,
      )
      expect(matchingStatic).toBeDefined()
      const expectedOffset =
        matchingStatic!.offsetPx +
        (dc.start - matchingStatic!.start) / params.bpPerPx
      expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
    }
  })

  it('5 regions scrolled to show last region', () => {
    const regions = makeRegions(5)
    const offsetPx = 4008
    const params = makeParams(regions, { offsetPx })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticChr5 = staticBlocks.contentBlocks.filter(
      b => b.refName === 'chr5',
    )
    const dynamicChr5 = dynamicBlocks.contentBlocks.filter(
      b => b.refName === 'chr5',
    )

    expect(staticChr5.length).toBeGreaterThan(0)
    expect(dynamicChr5.length).toBeGreaterThan(0)
    expect(dynamicChr5[0]!.offsetPx).toBe(staticChr5[0]!.offsetPx)
  })

  it('10 regions scrolled to middle', () => {
    const regions = makeRegions(10)
    const offsetPx = 5010
    const params = makeParams(regions, { offsetPx })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    for (const dc of dynamicBlocks.contentBlocks) {
      const matchingStatic = staticBlocks.contentBlocks.find(
        sc => sc.refName === dc.refName && sc.start <= dc.start + 0.001,
      )
      expect(matchingStatic).toBeDefined()
      const expectedOffset =
        matchingStatic!.offsetPx +
        (dc.start - matchingStatic!.start) / params.bpPerPx
      expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
    }
  })

  it('20 regions scrolled to the end', () => {
    const regions = makeRegions(20)
    const totalPx = 20 * 1000 + 19 * 2
    const offsetPx = totalPx - 800
    const params = makeParams(regions, { offsetPx })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const lastDynamic = dynamicBlocks.contentBlocks.at(-1)!
    const lastStatic = staticBlocks.contentBlocks.at(-1)!
    expect(lastDynamic.refName).toBe('chr20')
    expect(lastStatic.refName).toBe('chr20')

    const dynamicEndPx = lastDynamic.offsetPx + lastDynamic.widthPx
    const staticEndPx = lastStatic.offsetPx + lastStatic.widthPx
    expect(Math.abs(dynamicEndPx - staticEndPx)).toBeLessThan(0.001)
  })

  it('many regions with elided blocks mixed in', () => {
    const regions = []
    for (let i = 0; i < 15; i++) {
      regions.push({
        assemblyName: 'test',
        refName: `chr${i + 1}`,
        start: 0,
        end: i % 3 === 1 ? 1 : 1000,
      })
    }
    const offsetPx = 6000
    const params = makeParams(regions, { offsetPx })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    for (const dc of dynamicBlocks.contentBlocks) {
      const matchingStatic = staticBlocks.contentBlocks.find(
        sc =>
          sc.refName === dc.refName && Math.abs(sc.start - dc.start) < 0.001,
      )
      if (matchingStatic) {
        const expectedOffset =
          matchingStatic.offsetPx +
          (dc.start - matchingStatic.start) / params.bpPerPx
        expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
      }
    }
  })

  it('inter-region padding blocks are at same positions', () => {
    const regions = makeRegions(5)
    const params = makeParams(regions, { width: 6000 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticPadding = staticBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )
    const dynamicPadding = dynamicBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )

    expect(staticPadding.length).toBe(dynamicPadding.length)
    for (const [i, element] of staticPadding.entries()) {
      expect(
        Math.abs(element.offsetPx - dynamicPadding[i]!.offsetPx),
      ).toBeLessThan(0.001)
    }
  })

  it('region start offsetPx matches across all scroll positions', () => {
    const regions = makeRegions(8)
    const scrollPositions = [0, 500, 1002, 2004, 4008, 6012, 7014]

    for (const offsetPx of scrollPositions) {
      const params = makeParams(regions, { offsetPx })
      const staticBlocks = calculateStaticBlocks(params)
      const dynamicBlocks = calculateDynamicBlocks(params)

      for (const dc of dynamicBlocks.contentBlocks) {
        const matchingStatic = staticBlocks.contentBlocks.find(
          sc =>
            sc.refName === dc.refName &&
            sc.start <= dc.start + 0.001 &&
            sc.end >= dc.start - 0.001,
        )
        if (matchingStatic) {
          const expectedOffset =
            matchingStatic.offsetPx +
            (dc.start - matchingStatic.start) / params.bpPerPx
          expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
        }
      }
    }
  })

  it('varying region sizes with non-zero starts', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 100, end: 2000 },
      { assemblyName: 'test', refName: 'chr2', start: 500, end: 800 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 5000 },
      { assemblyName: 'test', refName: 'chr4', start: 1000, end: 1500 },
      { assemblyName: 'test', refName: 'chr5', start: 0, end: 3000 },
    ]
    const scrollPositions = [0, 2000, 4000, 6000, 8000]

    for (const offsetPx of scrollPositions) {
      const params = makeParams(regions, { offsetPx })
      const staticBlocks = calculateStaticBlocks(params)
      const dynamicBlocks = calculateDynamicBlocks(params)

      for (const dc of dynamicBlocks.contentBlocks) {
        const matchingStatic = staticBlocks.contentBlocks.find(
          sc =>
            sc.refName === dc.refName &&
            sc.start <= dc.start + 0.001 &&
            sc.end >= dc.start - 0.001,
        )
        if (matchingStatic) {
          const expectedOffset =
            matchingStatic.offsetPx +
            (dc.start - matchingStatic.start) / params.bpPerPx
          expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
        }
      }
    }
  })

  it('fractional bpPerPx with many regions', () => {
    const regions = makeRegions(10, 5000)
    const params = makeParams(regions, { bpPerPx: 0.5, offsetPx: 50000 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    for (const dc of dynamicBlocks.contentBlocks) {
      const matchingStatic = staticBlocks.contentBlocks.find(
        sc => sc.refName === dc.refName && sc.start <= dc.start + 0.001,
      )
      expect(matchingStatic).toBeDefined()
      const expectedOffset =
        matchingStatic!.offsetPx +
        (dc.start - matchingStatic!.start) / params.bpPerPx
      expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
    }
  })

  it('high bpPerPx with many small regions', () => {
    const regions = makeRegions(20, 500)
    const params = makeParams(regions, { bpPerPx: 5, offsetPx: 1000 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    for (const dc of dynamicBlocks.contentBlocks) {
      const matchingStatic = staticBlocks.contentBlocks.find(
        sc => sc.refName === dc.refName && sc.start <= dc.start + 0.001,
      )
      if (matchingStatic) {
        const expectedOffset =
          matchingStatic.offsetPx +
          (dc.start - matchingStatic.start) / params.bpPerPx
        expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
      }
    }
  })

  it('zoomed out so some regions become elided', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 100000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 50 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 100000 },
      { assemblyName: 'test', refName: 'chr4', start: 0, end: 20 },
      { assemblyName: 'test', refName: 'chr5', start: 0, end: 30 },
      { assemblyName: 'test', refName: 'chr6', start: 0, end: 100000 },
    ]
    const bpPerPx = 50
    const params = makeParams(regions, { bpPerPx, width: 8000 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticElided = staticBlocks.blocks.filter(
      b => b.type === 'ElidedBlock',
    )
    const dynamicElided = dynamicBlocks.blocks.filter(
      b => b.type === 'ElidedBlock',
    )
    expect(staticElided.length).toBeGreaterThan(0)
    expect(dynamicElided.length).toBeGreaterThan(0)

    for (const dc of dynamicBlocks.contentBlocks) {
      const matchingStatic = staticBlocks.contentBlocks.find(
        sc =>
          sc.refName === dc.refName &&
          sc.start <= dc.start + 0.001 &&
          sc.end >= dc.start - 0.001,
      )
      expect(matchingStatic).toBeDefined()
      const expectedOffset =
        matchingStatic!.offsetPx + (dc.start - matchingStatic!.start) / bpPerPx
      expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
    }

    for (
      let i = 0;
      i < Math.min(staticElided.length, dynamicElided.length);
      i++
    ) {
      expect(
        Math.abs(staticElided[i]!.offsetPx - dynamicElided[i]!.offsetPx),
      ).toBeLessThan(0.001)
    }
  })

  it('zoomed out with regions scrolled past elided blocks', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 100000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 50 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 30 },
      { assemblyName: 'test', refName: 'chr4', start: 0, end: 100000 },
      { assemblyName: 'test', refName: 'chr5', start: 0, end: 20 },
      { assemblyName: 'test', refName: 'chr6', start: 0, end: 100000 },
    ]
    const bpPerPx = 50
    const chr1Px = 100000 / bpPerPx
    const paddingAfterChr1 = 2
    const offsetPx = chr1Px + paddingAfterChr1 + 100
    const params = makeParams(regions, { bpPerPx, offsetPx })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    for (const dc of dynamicBlocks.contentBlocks) {
      const matchingStatic = staticBlocks.contentBlocks.find(
        sc =>
          sc.refName === dc.refName &&
          sc.start <= dc.start + 0.001 &&
          sc.end >= dc.start - 0.001,
      )
      if (matchingStatic) {
        const expectedOffset =
          matchingStatic.offsetPx + (dc.start - matchingStatic.start) / bpPerPx
        expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
      }
    }
  })
})

describe('elided block handling', () => {
  it('elided region between two non-elided has no padding after it', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 1000 },
    ]
    const params = makeParams(regions, { width: 2100 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticPadding = staticBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )
    const dynamicPadding = dynamicBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )

    expect(staticPadding.length).toBe(1)
    expect(dynamicPadding.length).toBe(1)
    expect(staticPadding[0]!.offsetPx).toBe(1000)
    expect(dynamicPadding[0]!.offsetPx).toBe(1000)
  })

  it('elided blocks appear in blocks but not contentBlocks', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 1000 },
    ]
    const params = makeParams(regions, { width: 2100 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticElided = staticBlocks.blocks.filter(
      b => b.type === 'ElidedBlock',
    )
    const dynamicElided = dynamicBlocks.blocks.filter(
      b => b.type === 'ElidedBlock',
    )

    expect(staticElided.length).toBe(1)
    expect(dynamicElided.length).toBe(1)
    expect(
      staticBlocks.contentBlocks.every(b => b.type === 'ContentBlock'),
    ).toBe(true)
    expect(
      dynamicBlocks.contentBlocks.every(b => b.type === 'ContentBlock'),
    ).toBe(true)
  })

  it('elided block offsetPx matches between static and dynamic', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 1000 },
    ]
    const params = makeParams(regions, { width: 2100 })
    const staticElided = calculateStaticBlocks(params).blocks.filter(
      b => b.type === 'ElidedBlock',
    )
    const dynamicElided = calculateDynamicBlocks(params).blocks.filter(
      b => b.type === 'ElidedBlock',
    )

    expect(staticElided.length).toBe(1)
    expect(dynamicElided.length).toBe(1)
    expect(dynamicElided[0]!.offsetPx).toBe(staticElided[0]!.offsetPx)
  })

  it('content block after elided region has correct offsetPx', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 1000 },
    ]
    const params = makeParams(regions, { width: 2100 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticChr3 = staticBlocks.contentBlocks.filter(
      b => b.refName === 'chr3',
    )
    const dynamicChr3 = dynamicBlocks.contentBlocks.filter(
      b => b.refName === 'chr3',
    )

    expect(staticChr3.length).toBeGreaterThan(0)
    expect(dynamicChr3.length).toBeGreaterThan(0)

    expect(dynamicChr3[0]!.offsetPx).toBe(staticChr3[0]!.offsetPx)
    expect(dynamicChr3[0]!.offsetPx).toBe(1003)
  })

  it('consecutive elided regions are merged', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 2 },
      { assemblyName: 'test', refName: 'chr4', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr5', start: 0, end: 1000 },
    ]
    const params = makeParams(regions, { width: 2100 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticElided = staticBlocks.blocks.filter(
      b => b.type === 'ElidedBlock',
    )
    const dynamicElided = dynamicBlocks.blocks.filter(
      b => b.type === 'ElidedBlock',
    )

    expect(staticElided.length).toBe(1)
    expect(dynamicElided.length).toBe(1)
    expect((staticElided[0] as any).elidedBlockCount).toBe(2)
    expect((dynamicElided[0] as any).elidedBlockCount).toBe(2)
  })

  it('no padding between consecutive elided regions', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 2 },
      { assemblyName: 'test', refName: 'chr4', start: 0, end: 1000 },
    ]
    const params = makeParams(regions, { width: 2100 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticPadding = staticBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )
    const dynamicPadding = dynamicBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )

    expect(staticPadding.length).toBe(1)
    expect(dynamicPadding.length).toBe(1)
  })

  it('elided region at start has no padding before it', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 1000 },
    ]
    const params = makeParams(regions, { width: 1100 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticPadding = staticBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )
    const dynamicPadding = dynamicBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )

    expect(staticPadding.length).toBe(0)
    expect(dynamicPadding.length).toBe(0)

    const staticChr2 = staticBlocks.contentBlocks.find(
      b => b.refName === 'chr2',
    )
    const dynamicChr2 = dynamicBlocks.contentBlocks.find(
      b => b.refName === 'chr2',
    )
    expect(staticChr2!.offsetPx).toBe(dynamicChr2!.offsetPx)
    expect(staticChr2!.offsetPx).toBe(1)
  })

  it('elided region at end has no padding after it', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 1 },
    ]
    const params = makeParams(regions, { width: 1100 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticPadding = staticBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )
    const dynamicPadding = dynamicBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )

    expect(staticPadding.length).toBe(1)
    expect(dynamicPadding.length).toBe(1)
  })

  it('all regions elided produces no padding', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 2 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 1 },
    ]
    const params = makeParams(regions)
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticPadding = staticBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )
    const dynamicPadding = dynamicBlocks.blocks.filter(
      b => b.type === 'InterRegionPaddingBlock' && b.variant !== 'boundary',
    )

    expect(staticPadding.length).toBe(0)
    expect(dynamicPadding.length).toBe(0)
    expect(staticBlocks.contentBlocks.length).toBe(0)
    expect(dynamicBlocks.contentBlocks.length).toBe(0)
  })

  it('elided blocks off-screen do not affect content block positions', () => {
    const regions = [
      { assemblyName: 'test', refName: 'chr1', start: 0, end: 1000 },
      { assemblyName: 'test', refName: 'chr2', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr3', start: 0, end: 2 },
      { assemblyName: 'test', refName: 'chr4', start: 0, end: 1 },
      { assemblyName: 'test', refName: 'chr5', start: 0, end: 1000 },
    ]
    const params = makeParams(regions, { offsetPx: 1006 })
    const staticBlocks = calculateStaticBlocks(params)
    const dynamicBlocks = calculateDynamicBlocks(params)

    const staticChr5 = staticBlocks.contentBlocks.filter(
      b => b.refName === 'chr5',
    )
    const dynamicChr5 = dynamicBlocks.contentBlocks.filter(
      b => b.refName === 'chr5',
    )

    expect(staticChr5.length).toBeGreaterThan(0)
    expect(dynamicChr5.length).toBeGreaterThan(0)
    expect(dynamicChr5[0]!.offsetPx).toBe(staticChr5[0]!.offsetPx)
  })

  it('alternating elided and non-elided with many regions scrolled right', () => {
    const regions = []
    for (let i = 0; i < 20; i++) {
      regions.push({
        assemblyName: 'test',
        refName: `chr${i + 1}`,
        start: 0,
        end: i % 2 === 0 ? 1000 : 1,
      })
    }

    const scrollPositions = [0, 3000, 6000, 9000]
    for (const offsetPx of scrollPositions) {
      const params = makeParams(regions, { offsetPx })
      const staticBlocks = calculateStaticBlocks(params)
      const dynamicBlocks = calculateDynamicBlocks(params)

      for (const dc of dynamicBlocks.contentBlocks) {
        const matchingStatic = staticBlocks.contentBlocks.find(
          sc =>
            sc.refName === dc.refName &&
            sc.start <= dc.start + 0.001 &&
            sc.end >= dc.start - 0.001,
        )
        if (matchingStatic) {
          const expectedOffset =
            matchingStatic.offsetPx +
            (dc.start - matchingStatic.start) / params.bpPerPx
          expect(Math.abs(dc.offsetPx - expectedOffset)).toBeLessThan(0.001)
        }
      }

      const staticElided = staticBlocks.blocks.filter(
        b => b.type === 'ElidedBlock',
      )
      const dynamicElided = dynamicBlocks.blocks.filter(
        b => b.type === 'ElidedBlock',
      )
      for (
        let i = 0;
        i < Math.min(staticElided.length, dynamicElided.length);
        i++
      ) {
        expect(
          Math.abs(staticElided[i]!.offsetPx - dynamicElided[i]!.offsetPx),
        ).toBeLessThan(0.001)
      }
    }
  })
})
