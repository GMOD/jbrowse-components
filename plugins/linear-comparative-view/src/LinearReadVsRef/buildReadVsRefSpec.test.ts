import { SimpleFeature } from '@jbrowse/core/util'

import { buildReadVsRefSpec } from './buildReadVsRefSpec.ts'

function makeFeature(
  data: Record<string, unknown> & {
    start: number
    end: number
    refName: string
  },
) {
  return new SimpleFeature({
    uniqueId: 'test-feat',
    ...data,
  })
}

// Stable mocks so the output is fully deterministic per test.
function constNow() {
  return 1700000000000
}
let randIdx = 0
function seqRand() {
  randIdx++
  return 0.1 + randIdx * 0.0001
}

beforeEach(() => {
  randIdx = 0
})

describe('buildReadVsRefSpec', () => {
  it('primary alignment with no SA tag: single feature, no supplementary', () => {
    const feature = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 1100,
      strand: 1,
      CIGAR: '10S100M',
      flags: 0,
      name: 'read1',
      seq: 'AAAA',
      tags: {},
    })
    const spec = buildReadVsRefSpec({
      primaryFeature: feature,
      windowSize: 0,
      viewWidth: 800,
      trackAssembly: 'hg38',
      getCanonicalRefName: r => r,
      sequenceTrackConf: { trackId: 'seq' },
      now: constNow,
      rand: seqRand,
    })

    expect(spec.viewSpec.displayName).toBe('read1 vs hg38')
    expect(spec.temporaryAssembly.name).toBe('read1_assembly_1700000000000')
    // Two LGVs: top is the ref-assembly side, bottom is the synthetic read
    expect(spec.viewSpec.views).toHaveLength(2)
    // No SA → only the primary in the synteny feature store. The store also
    // contains its mate, so total = 1 feat + 1 mate = 2
    const cfg = spec.viewSpec.viewTrackConfigs[0] as {
      adapter: { features: { uniqueId: string }[] }
    }
    expect(cfg.adapter.features).toHaveLength(2)
  })

  it('supplementary alignment expands SA into syntenyId-ordered features', () => {
    // SA tag: refName, pos(1-based), strand, CIGAR, mapq, NM
    const feature = makeFeature({
      refName: 'chr1',
      start: 2000,
      end: 2050,
      strand: 1,
      CIGAR: '50M50S',
      flags: 0,
      name: 'read42',
      seq: 'NNN',
      tags: {
        SA: 'chr2,3001,+,50S50M,60,0;',
      },
    })
    const spec = buildReadVsRefSpec({
      primaryFeature: feature,
      windowSize: 0,
      viewWidth: 800,
      trackAssembly: 'hg38',
      getCanonicalRefName: r => r,
      sequenceTrackConf: { trackId: 'seq' },
      now: constNow,
      rand: seqRand,
    })

    const cfg = spec.viewSpec.viewTrackConfigs[0] as {
      adapter: {
        features: { syntenyId: number; mate: { syntenyId: number } }[]
      }
    }
    // primary + 1 supp = 2 features, plus 2 mates
    expect(cfg.adapter.features).toHaveLength(4)
    // syntenyId reflects sort order by clipLengthAtStartOfRead
    const featuresOnly = cfg.adapter.features.slice(0, 2)
    expect(featuresOnly.map(f => f.syntenyId).sort()).toEqual([0, 1])
  })

  it('canonical refname remap applies to all features', () => {
    const feature = makeFeature({
      refName: 'chr1',
      start: 100,
      end: 200,
      strand: 1,
      CIGAR: '100M',
      flags: 0,
      name: 'r',
      seq: 'A',
      tags: {},
    })
    const remap: Record<string, string> = { chr1: '1' }
    const spec = buildReadVsRefSpec({
      primaryFeature: feature,
      windowSize: 0,
      viewWidth: 800,
      trackAssembly: 'hg38',
      getCanonicalRefName: r => remap[r] ?? r,
      sequenceTrackConf: { trackId: 'seq' },
      now: constNow,
      rand: seqRand,
    })
    const cfg = spec.viewSpec.viewTrackConfigs[0] as {
      adapter: { features: { refName: string }[] }
    }
    // The primary feature's refName got canonicalized
    expect(cfg.adapter.features[0]!.refName).toBe('1')
  })

  it('windowSize expands LGV regions on both sides', () => {
    const feature = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 1100,
      strand: 1,
      CIGAR: '100M',
      flags: 0,
      name: 'r',
      seq: 'A',
      tags: {},
    })
    const spec = buildReadVsRefSpec({
      primaryFeature: feature,
      windowSize: 50,
      viewWidth: 800,
      trackAssembly: 'hg38',
      getCanonicalRefName: r => r,
      sequenceTrackConf: { trackId: 'seq' },
      now: constNow,
      rand: seqRand,
    })
    const topView = spec.viewSpec.views[0] as {
      displayedRegions: { start: number; end: number }[]
    }
    // 1000 - 50 = 950, 1100 + 50 = 1150
    expect(topView.displayedRegions[0]).toMatchObject({
      start: 950,
      end: 1150,
    })
  })

  it('windowSize never produces negative LGV region start', () => {
    const feature = makeFeature({
      refName: 'chr1',
      start: 10,
      end: 100,
      strand: 1,
      CIGAR: '90M',
      flags: 0,
      name: 'r',
      seq: 'A',
      tags: {},
    })
    const spec = buildReadVsRefSpec({
      primaryFeature: feature,
      windowSize: 500,
      viewWidth: 800,
      trackAssembly: 'hg38',
      getCanonicalRefName: r => r,
      sequenceTrackConf: { trackId: 'seq' },
      now: constNow,
      rand: seqRand,
    })
    const topView = spec.viewSpec.views[0] as {
      displayedRegions: { start: number; end: number }[]
    }
    expect(topView.displayedRegions[0]!.start).toBeGreaterThanOrEqual(0)
  })

  it('mate refName points to the synthetic read assembly', () => {
    const feature = makeFeature({
      refName: 'chr1',
      start: 1000,
      end: 1100,
      strand: 1,
      CIGAR: '100M',
      flags: 0,
      name: 'myRead',
      seq: 'A',
      tags: {},
    })
    const spec = buildReadVsRefSpec({
      primaryFeature: feature,
      windowSize: 0,
      viewWidth: 800,
      trackAssembly: 'hg38',
      getCanonicalRefName: r => r,
      sequenceTrackConf: { trackId: 'seq' },
      now: constNow,
      rand: seqRand,
    })
    const cfg = spec.viewSpec.viewTrackConfigs[0] as {
      adapter: { features: { mate: { refName?: string } }[] }
    }
    expect(cfg.adapter.features[0]!.mate.refName).toBe('myRead')
  })

  it('temporary assembly carries the read sequence', () => {
    const feature = makeFeature({
      refName: 'chr1',
      start: 0,
      end: 50,
      strand: 1,
      CIGAR: '50M',
      flags: 0,
      name: 'r',
      seq: 'ACGTACGT',
      tags: {},
    })
    const spec = buildReadVsRefSpec({
      primaryFeature: feature,
      windowSize: 0,
      viewWidth: 800,
      trackAssembly: 'hg38',
      getCanonicalRefName: r => r,
      sequenceTrackConf: { trackId: 'seq' },
      now: constNow,
      rand: seqRand,
    })
    expect(spec.temporaryAssembly.sequence.adapter.features[0]!.seq).toBe(
      'ACGTACGT',
    )
  })

  it('missing seq field falls back to empty string (secondary alignments)', () => {
    const feature = makeFeature({
      refName: 'chr1',
      start: 0,
      end: 50,
      strand: 1,
      CIGAR: '50M',
      flags: 0,
      name: 'r',
      // no seq
      tags: {},
    })
    const spec = buildReadVsRefSpec({
      primaryFeature: feature,
      windowSize: 0,
      viewWidth: 800,
      trackAssembly: 'hg38',
      getCanonicalRefName: r => r,
      sequenceTrackConf: { trackId: 'seq' },
      now: constNow,
      rand: seqRand,
    })
    expect(spec.temporaryAssembly.sequence.adapter.features[0]!.seq).toBe('')
  })
})
