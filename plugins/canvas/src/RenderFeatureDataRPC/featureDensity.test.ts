// Tests the density-based feature limit check used in executeRenderFeatureData.
// This replaced the old absolute maxFeatureCount=5000 check.
//
// The check computes: featureDensity = featureCount / regionWidthPx
// where regionWidthPx = (region.end - region.start) / bpPerPx
// and triggers regionTooLarge when featureDensity > maxFeatureDensity.

function shouldBlockByDensity({
  featureCount,
  regionStart,
  regionEnd,
  bpPerPx,
  maxFeatureDensity,
}: {
  featureCount: number
  regionStart: number
  regionEnd: number
  bpPerPx: number
  maxFeatureDensity: number
}) {
  const regionWidthPx = (regionEnd - regionStart) / bpPerPx
  const featureDensity = featureCount / regionWidthPx
  return featureDensity > maxFeatureDensity
}

describe('density-based feature limit', () => {
  it('allows sparse features (below density limit)', () => {
    expect(
      shouldBlockByDensity({
        featureCount: 100,
        regionStart: 0,
        regionEnd: 10_000,
        bpPerPx: 10,
        maxFeatureDensity: 20,
      }),
    ).toBe(false)
    // 100 features / (10000 / 10 = 1000px) = 0.1 features/px
  })

  it('blocks dense features (above density limit)', () => {
    expect(
      shouldBlockByDensity({
        featureCount: 50_000,
        regionStart: 0,
        regionEnd: 10_000,
        bpPerPx: 10,
        maxFeatureDensity: 20,
      }),
    ).toBe(true)
    // 50000 features / 1000px = 50 features/px > 20
  })

  it('same feature count passes when zoomed out (wider region)', () => {
    expect(
      shouldBlockByDensity({
        featureCount: 5000,
        regionStart: 0,
        regionEnd: 100_000,
        bpPerPx: 100,
        maxFeatureDensity: 20,
      }),
    ).toBe(false)
    // 5000 features / (100000 / 100 = 1000px) = 5 features/px
  })

  it('same feature count blocks when zoomed in (narrower region in px)', () => {
    expect(
      shouldBlockByDensity({
        featureCount: 5000,
        regionStart: 0,
        regionEnd: 1000,
        bpPerPx: 0.1,
        maxFeatureDensity: 20,
      }),
    ).toBe(false)
    // 5000 features / (1000 / 0.1 = 10000px) = 0.5 features/px
  })

  it('exactly at the boundary does not block', () => {
    expect(
      shouldBlockByDensity({
        featureCount: 20_000,
        regionStart: 0,
        regionEnd: 10_000,
        bpPerPx: 10,
        maxFeatureDensity: 20,
      }),
    ).toBe(false)
    // 20000 features / 1000px = 20 features/px, equals limit but not greater
  })

  it('force-load triples the limit', () => {
    const baseLimit = 20
    const forcedLimit = Math.ceil(baseLimit * 3)
    expect(
      shouldBlockByDensity({
        featureCount: 50_000,
        regionStart: 0,
        regionEnd: 10_000,
        bpPerPx: 10,
        maxFeatureDensity: forcedLimit,
      }),
    ).toBe(false)
    // 50000 / 1000 = 50, forced limit = 60, so it passes
  })

  it('handles the 1000 Genomes human case: many genes over wide region', () => {
    // This is the scenario that motivated the switch from absolute count
    // to density. With maxFeatureCount=5000, this would always block.
    // With density, it only blocks if the screen is too dense.
    expect(
      shouldBlockByDensity({
        featureCount: 8000,
        regionStart: 0,
        regionEnd: 10_000_000,
        bpPerPx: 5000,
        maxFeatureDensity: 20,
      }),
    ).toBe(false)
    // 8000 / (10M / 5000 = 2000px) = 4 features/px — fine
  })
})
