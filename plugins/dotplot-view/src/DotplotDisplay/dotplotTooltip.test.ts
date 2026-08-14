import { Dotplot1DView } from '../DotplotView/1dview.ts'
import { getDotplotTooltipLines } from './dotplotTooltip.ts'
import { fakeDotplotRpcData } from './testUtils.ts'

import type { DotplotRpcData } from './types.ts'

function axis({
  assemblyName,
  refName,
  reversed = false,
  offsetPx = 0,
  end = 1000,
  bpPerPx = 1,
}: {
  assemblyName: string
  refName: string
  reversed?: boolean
  offsetPx?: number
  end?: number
  bpPerPx?: number
}) {
  const view = Dotplot1DView.create({
    bpPerPx,
    offsetPx,
    displayedRegions: [{ assemblyName, refName, start: 0, end, reversed }],
  })
  view.setVolatileWidth(500)
  return view
}

// One feature: h axis 100..200, v axis 300..450, forward strand. The refName
// dictionaries deliberately hold the ADAPTER's names, which a PAF spells `1` and
// `5` where the assemblies are canonicalized `chr1`/`chr5`.
function fakeRpcData(overrides: Partial<DotplotRpcData> = {}): DotplotRpcData {
  return fakeDotplotRpcData({
    p11: new Float64Array([100]),
    p12: new Float64Array([200]),
    p21: new Float64Array([300]),
    p22: new Float64Array([450]),
    attributes: {
      identity: new Float32Array([0.9876]),
      meanIdentity: new Float32Array([-1]),
      mappingQual: new Float32Array([60]),
      dnds: new Float32Array([-1]),
    },
    refNameDict: ['1'],
    mateRefNameDict: ['5'],
    ...overrides,
  })
}

function lines(
  rpcData = fakeRpcData(),
  hview = axis({ assemblyName: 'hg38', refName: 'chr1' }),
  vview = axis({ assemblyName: 'mm10', refName: 'chr5' }),
) {
  return getDotplotTooltipLines({ rpcData, featureIdx: 0, hview, vview })
}

test('names both axes and their spans', () => {
  expect(lines().slice(0, 5)).toEqual([
    'x - {hg38}chr1:100-200',
    'y - {mm10}chr5:300-450',
    'Inverted: false',
    'x len: 100',
    'y len: 150',
  ])
})

test('reports reverse strand as inverted', () => {
  // The worker swaps the h endpoints on a reverse-strand feature, so the span
  // still has to read low-to-high.
  const data = fakeRpcData({
    strands: new Int8Array([-1]),
    p11: new Float64Array([200]),
    p12: new Float64Array([100]),
  })
  expect(lines(data).slice(0, 4)).toEqual([
    'x - {hg38}chr1:100-200',
    'y - {mm10}chr5:300-450',
    'Inverted: true',
    'x len: 100',
  ])
})

// The dictionary holds the ADAPTER's names — the PAF here calls the contigs `1`
// and `5` — while the axis holds the assembly's canonical `chr1`/`chr5`. Reading
// the dictionary would print the file's spelling at the user on every aliased
// track.
test('the refName comes off the axis, not the fetch dictionary', () => {
  expect(lines()[0]).toContain('chr1')
  expect(lines()[0]).not.toContain('{hg38}1:')
})

// pxToBp's coord0 applies the reflection; both dotplot axes routinely carry
// reversed regions, since auto-diagonalize flips query regions on the v axis.
test('a reversed region reports the mirrored coordinates', () => {
  const vview = axis({
    assemblyName: 'mm10',
    refName: 'chr5',
    reversed: true,
  })
  // cumBp 300..450 measured leftward from the right-hand edge of a 0..1000
  // region, in the same 0-based `coord0` the coordinate tooltip prints
  expect(lines(fakeRpcData(), undefined, vview)[1]).toBe(
    'y - {mm10}chr5:550-700',
  )
})

// The span is where it is on the axis, not where the axis is scrolled to.
test('a pan does not move the reported span', () => {
  const hview = axis({ assemblyName: 'hg38', refName: 'chr1', offsetPx: 137 })
  expect(lines(fakeRpcData(), hview)[0]).toBe('x - {hg38}chr1:100-200')
})

// A feature endpoint is an exact integer bp, and the round trip out to px and
// back cancels `offsetPx` against itself, landing a hair either side of the
// integer. `coord0` floors, so on a panned axis some endpoints came back one bp
// short — and WHICH ones depended on the zoom, so the same alignment reported two
// different lengths at two zoom levels (the probe caught 593 vs 592). Every
// zoom/pan pair must read it identically.
//
// The four pairs are not arbitrary: each is one that reproduced the off-by-one,
// found by scanning the round trip. offsetPx=0 never does — the cancellation is
// the mechanism — which is why the first spelling of this test passed on the
// broken code.
test.each([
  [137, 1_234_567],
  [3971, 99_999],
  [3971, 1_234_567],
  [40_000, 4321],
])('the span is exact at %s bp/px panned to %s px', (bpPerPx, offsetPx) => {
  const hview = axis({
    assemblyName: 'hg38',
    refName: 'chr1',
    end: 200_000_000,
    bpPerPx,
    offsetPx,
  })
  const data = fakeRpcData({
    p11: new Float64Array([10_182_444]),
    p12: new Float64Array([10_182_970]),
  })
  expect(lines(data, hview)[0]).toBe('x - {hg38}chr1:10,182,444-10,182,970')
  expect(lines(data, hview)[3]).toBe('x len: 526')
})

describe('the lines a track may not have', () => {
  test('names the feature when the track gives names', () => {
    const data = fakeRpcData({
      nameDict: ['BRCA1'],
      nameIds: new Uint32Array([0]),
    })
    expect(lines(data)).toContain('Name: BRCA1')
  })

  // A PAF sets no name on any feature, so the dictionary the worker ships holds
  // one empty string — which is not a name and gets no line.
  test('says nothing when the name is empty', () => {
    expect(lines().join()).not.toContain('Name:')
  })

  test('names the CIGAR operator under the cursor', () => {
    const withOp = getDotplotTooltipLines({
      rpcData: fakeRpcData(),
      featureIdx: 0,
      hview: axis({ assemblyName: 'hg38', refName: 'chr1' }),
      vview: axis({ assemblyName: 'mm10', refName: 'chr5' }),
      cigarOp: { op: 'D', length: 1200 },
    })
    expect(withOp).toContain('CIGAR operator: 1,200D')
  })

  test('says nothing about CIGAR when the segment is not an indel', () => {
    expect(lines().join()).not.toContain('CIGAR')
  })
})

describe('attributes', () => {
  test('lists every channel that has a value', () => {
    expect(lines().slice(5)).toEqual(['identity: 0.988', 'mappingQual: 60'])
  })

  // -1 is the worker's missing sentinel, so meanIdentity and dnds above are
  // absent rather than reported as -1.
  test('omits the missing sentinel', () => {
    expect(lines().join()).not.toContain('meanIdentity')
    expect(lines().join()).not.toContain('dnds')
  })

  test('keeps a declared column under its own name', () => {
    const data = fakeRpcData()
    data.attributes.ka_ks = new Float32Array([1.5])
    expect(lines(data)).toContain('ka_ks: 1.5')
  })
})
