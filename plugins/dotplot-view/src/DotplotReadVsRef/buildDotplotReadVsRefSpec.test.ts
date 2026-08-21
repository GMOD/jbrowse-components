import { SimpleFeature } from '@jbrowse/core/util'

import { buildDotplotReadVsRefSpec } from './buildDotplotReadVsRefSpec.ts'

// The synthesized config rides on the track that draws it rather than in any
// session or view-level list, so it goes out with the view.
function syntenyConf(viewSpec: { tracks: unknown[] }) {
  return (viewSpec.tracks[0] as { configuration: unknown }).configuration
}

function makeFeature(
  data: Record<string, unknown> & {
    start: number
    end: number
    refName: string
  },
) {
  return new SimpleFeature({ uniqueId: 'test-feat', ...data })
}

function constNow() {
  return 1700000000000
}

const baseArgs = {
  windowSize: 0,
  trackAssembly: 'hg38',
  plotWidth: 750,
  plotHeight: 550,
  getCanonicalRefName: (r: string) => r,
  now: constNow,
}

describe('buildDotplotReadVsRefSpec', () => {
  it('puts the read on the vertical axis and the reference on the horizontal', () => {
    const spec = buildDotplotReadVsRefSpec({
      ...baseArgs,
      feature: makeFeature({
        refName: 'chr1',
        start: 1000,
        end: 1100,
        strand: 1,
        CIGAR: '10S100M',
        flags: 0,
        name: 'read1',
        seq: 'ACGT',
        tags: {},
      }),
    })
    const { hview, vview } = spec.viewSpec as {
      hview: { bpPerPx: number; displayedRegions: { refName: string }[] }
      vview: { bpPerPx: number; displayedRegions: { refName: string }[] }
    }
    expect(hview.displayedRegions).toEqual([
      { refName: 'chr1', start: 1000, end: 1100, assemblyName: 'hg38' },
    ])
    expect(vview.displayedRegions[0]!.refName).toBe('read1')
    // 100bp of reference over the plot width, 110bp of read over its height
    expect(hview.bpPerPx).toBeCloseTo(100 / 750)
    expect(vview.bpPerPx).toBeCloseTo(110 / 550)
  })

  it('registers a temporary assembly the read axis resolves against, with no bases', () => {
    const spec = buildDotplotReadVsRefSpec({
      ...baseArgs,
      feature: makeFeature({
        refName: 'chr1',
        start: 0,
        end: 8,
        strand: 1,
        CIGAR: '8M',
        flags: 0,
        name: 'read1',
        seq: 'ACGTACGT',
        tags: {},
      }),
    })
    const readAssembly = 'read1_assembly_1700000000000'
    expect(spec.temporaryAssembly.name).toBe(readAssembly)
    expect(spec.viewSpec.assemblyNames).toEqual(['hg38', readAssembly])
    // a dotplot draws no sequence track; the region still spans the read
    const seqFeature = spec.temporaryAssembly.sequence.adapter.features[0]!
    expect(seqFeature.seq).toBe('')
    expect(seqFeature).toMatchObject({ start: 0, end: 8, refName: 'read1' })
  })

  it('canonicalizes refNames so the horizontal axis resolves against the fasta', () => {
    // A BAM header saying chr1/chr2 against a fasta whose refNames are 1/2
    // otherwise yields displayedRegions no assembly can map, and an empty plot.
    const remap: Record<string, string> = { chr1: '1', chr2: '2' }
    const spec = buildDotplotReadVsRefSpec({
      ...baseArgs,
      getCanonicalRefName: r => remap[r],
      feature: makeFeature({
        refName: 'chr1',
        start: 2000,
        end: 2050,
        strand: 1,
        CIGAR: '50S50M',
        flags: 0,
        name: 'read42',
        seq: 'N',
        tags: { SA: 'chr2,3001,+,50M50S,60,0;' },
      }),
    })
    const { hview } = spec.viewSpec as {
      hview: { displayedRegions: { refName: string }[] }
    }
    expect(hview.displayedRegions.map(r => r.refName).sort()).toEqual([
      '1',
      '2',
    ])
    const cfg = syntenyConf(spec.viewSpec) as {
      adapter: { features: { refName: string }[] }
    }
    expect(cfg.adapter.features.map(f => f.refName)).toEqual(['2', '1'])
  })

  it('merges overlapping alignment regions before sizing the horizontal axis', () => {
    // Two segments landing on the same locus: gatherOverlaps collapses them, so
    // bpPerPx must be sized off the merged span, not the sum of both.
    const spec = buildDotplotReadVsRefSpec({
      ...baseArgs,
      feature: makeFeature({
        refName: 'chr1',
        start: 1000,
        end: 1050,
        strand: 1,
        CIGAR: '50S50M',
        flags: 0,
        name: 'read42',
        seq: 'N',
        tags: { SA: 'chr1,1026,+,50M50S,60,0;' },
      }),
    })
    const { hview } = spec.viewSpec as {
      hview: { bpPerPx: number; displayedRegions: { start: number }[] }
    }
    expect(hview.displayedRegions).toHaveLength(1)
    // chr1:1000-1050 and chr1:1025-1075 merge to 1000..1075 = 75bp
    expect(hview.bpPerPx).toBeCloseTo(75 / 750)
  })

  it('windowSize pads each aligned segment, clamped at zero', () => {
    // the same genomic-context option the linear launcher offers; the dotplot
    // had no way to ask for it before the two shared a dialog
    const spec = buildDotplotReadVsRefSpec({
      ...baseArgs,
      windowSize: 500,
      feature: makeFeature({
        refName: 'chr1',
        start: 10,
        end: 100,
        strand: 1,
        CIGAR: '90M',
        flags: 0,
        name: 'r',
        tags: {},
      }),
    })
    const { hview } = spec.viewSpec as {
      hview: { displayedRegions: { start: number; end: number }[] }
    }
    expect(hview.displayedRegions[0]).toMatchObject({ start: 0, end: 600 })
  })
})
