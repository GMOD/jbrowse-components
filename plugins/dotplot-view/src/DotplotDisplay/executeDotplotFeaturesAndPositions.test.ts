import {
  buildBpRegionIndex,
  bpToCumBpAndPad,
} from '@jbrowse/synteny-core'
import type { BpIndexViewSnap, BpRegionIndex } from '@jbrowse/synteny-core'

function makeViewSnap(
  regions: {
    refName: string
    start: number
    end: number
    reversed?: boolean
  }[],
  bpPerPx = 1,
): BpIndexViewSnap {
  return {
    bpPerPx,
    displayedRegions: regions.map(r => ({ assemblyName: 'test', ...r })),
    interRegionPaddingWidth: 2,
    minimumBlockWidth: 3,
  }
}

// Local adapters so existing test assertions keep working with the cumBp API.
function buildBpToPxIndex(self: BpIndexViewSnap) {
  return buildBpRegionIndex(self)
}

function bpToPxFromIndex(
  idx: BpRegionIndex,
  refName: string,
  coord: number,
) {
  const r = bpToCumBpAndPad(idx, refName, coord)
  if (!r) {
    return undefined
  }
  return r.cumBp / idx.bpPerPx + r.padPx
}

describe('buildBpRegionIndex / bpToCumBpAndPad (via adapter)', () => {
  it('returns correct pixel offset for first region', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap([
        { refName: 'chr1', start: 0, end: 1000 },
        { refName: 'chr2', start: 0, end: 1000 },
      ]),
    )
    expect(bpToPxFromIndex(idx, 'chr1', 500)).toBe(500)
  })

  it('includes inter-region padding for regions before the target', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap([
        { refName: 'chr1', start: 0, end: 1000 },
        { refName: 'chr2', start: 0, end: 1000 },
        { refName: 'chr3', start: 0, end: 1000 },
      ]),
    )
    // 2000bp + 2 padding regions × 2px padding = 2004
    expect(bpToPxFromIndex(idx, 'chr3', 0)).toBe(2000 + 2 * 2)
  })

  it('does not add padding for elided (sub-minimumBlockWidth) regions', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap([
        { refName: 'chr1', start: 0, end: 1000 },
        { refName: 'chr2', start: 0, end: 1 }, // 1bp < minimumBlockWidth=3 → elided
        { refName: 'chr3', start: 0, end: 1000 },
      ]),
    )
    // chr2 is elided so only 1 padding gap before chr3
    expect(bpToPxFromIndex(idx, 'chr3', 0)).toBe(1001 + 2)
  })

  it('returns undefined for unknown refName', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr1', start: 0, end: 1000 }]),
    )
    expect(bpToPxFromIndex(idx, 'chrX', 500)).toBeUndefined()
  })

  it('returns undefined for coord outside all regions of a refName', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr1', start: 0, end: 1000 }]),
    )
    expect(bpToPxFromIndex(idx, 'chr1', 5000)).toBeUndefined()
  })

  it('handles non-unit bpPerPx', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap(
        [
          { refName: 'chr1', start: 0, end: 10000 },
          { refName: 'chr2', start: 0, end: 10000 },
        ],
        10,
      ),
    )
    // chr2: 10000bp / 10 = 1000px offset, + 2px padding, + 5000bp / 10 = 500px
    expect(bpToPxFromIndex(idx, 'chr2', 5000)).toBe(1000 + 2 + 500)
  })

  it('accumulates padding across many regions', () => {
    const regions = Array.from({ length: 20 }, (_, i) => ({
      refName: `chr${i + 1}`,
      start: 0,
      end: 1000,
    }))
    const idx = buildBpToPxIndex(makeViewSnap(regions))
    expect(bpToPxFromIndex(idx, 'chr20', 0)).toBe(19 * 1000 + 19 * 2)
  })

  it('reversed region: start coord maps to far end', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr1', start: 0, end: 1000, reversed: true }]),
    )
    expect(bpToPxFromIndex(idx, 'chr1', 0)).toBe(1000)
    expect(bpToPxFromIndex(idx, 'chr1', 1000)).toBe(0)
    expect(bpToPxFromIndex(idx, 'chr1', 500)).toBe(500)
  })

  it('reversed region inverts coordinate direction', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr1', start: 0, end: 1000, reversed: true }]),
    )
    const left = bpToPxFromIndex(idx, 'chr1', 200)!
    const right = bpToPxFromIndex(idx, 'chr1', 800)!
    expect(left).toBeGreaterThan(right)
  })

  it('reversed region with preceding region includes offset and padding', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap([
        { refName: 'chr1', start: 0, end: 1000 },
        { refName: 'chr2', start: 0, end: 1000, reversed: true },
      ]),
    )
    // chr2 end (coord=0 reversed → px = 1000bp offset) + 1000bp chr1 + 2px padding
    expect(bpToPxFromIndex(idx, 'chr2', 0)).toBe(1000 + 2 + 1000)
    expect(bpToPxFromIndex(idx, 'chr2', 1000)).toBe(1000 + 2 + 0)
  })
})

describe('strand swap', () => {
  function computeEndpoints(
    strand: number,
    start: number,
    end: number,
    reversed = false,
  ) {
    const idx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr1', start: 0, end: 1000, reversed }]),
    )
    const f1s = strand === -1 ? end : start
    const f1e = strand === -1 ? start : end
    return {
      p11: bpToPxFromIndex(idx, 'chr1', f1s)!,
      p12: bpToPxFromIndex(idx, 'chr1', f1e)!,
    }
  }

  it('strand=+1 non-reversed: p11 < p12 (parallel)', () => {
    const { p11, p12 } = computeEndpoints(1, 200, 800)
    expect(p11).toBeLessThan(p12)
  })

  it('strand=-1 non-reversed: p11 > p12 (crossed)', () => {
    const { p11, p12 } = computeEndpoints(-1, 200, 800)
    expect(p11).toBeGreaterThan(p12)
  })

  it('strand=+1 reversed: p11 > p12 (region flip inverts)', () => {
    const { p11, p12 } = computeEndpoints(1, 200, 800, true)
    expect(p11).toBeGreaterThan(p12)
  })

  it('strand=-1 reversed: p11 < p12 (two flips cancel)', () => {
    const { p11, p12 } = computeEndpoints(-1, 200, 800, true)
    expect(p11).toBeLessThan(p12)
  })
})

describe('refName precull via entries.has', () => {
  it('returns false for refName absent in hIndex', () => {
    const hIdx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr1', start: 0, end: 1000 }]),
    )
    expect(hIdx.entries.has('chrX')).toBe(false)
  })

  it('returns false for mateRefName absent in vIndex', () => {
    const vIdx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr2', start: 0, end: 1000 }]),
    )
    expect(vIdx.entries.has('chr1')).toBe(false)
  })

  it('both present: precull passes', () => {
    const hIdx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr1', start: 0, end: 1000 }]),
    )
    const vIdx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr2', start: 0, end: 1000 }]),
    )
    expect(hIdx.entries.has('chr1') && vIdx.entries.has('chr2')).toBe(true)
  })

  it('precull is a strict subset: refName present but coord out of range still returns undefined', () => {
    const idx = buildBpToPxIndex(
      makeViewSnap([{ refName: 'chr1', start: 0, end: 1000 }]),
    )
    expect(idx.entries.has('chr1')).toBe(true)
    expect(bpToPxFromIndex(idx, 'chr1', 5000)).toBeUndefined()
  })
})
