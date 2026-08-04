import { computeDerivativePaths, derivativeLocString } from './computePaths.ts'

import type { SegAln } from '../arcs/compute.ts'

function seg(
  refName: string,
  start: number,
  end: number,
  strand: number,
  clipAtStart: number,
  onScreen = true,
): SegAln {
  return { refName, start, end, strand, clipAtStart, onScreen }
}

// The COLO829 der(3) chain the multi-hop tutorial is built on: chr3 runs out at
// 25,359,568, 199 bp of chr10 follows, then 183 bp of chr12 inverted, then chr3
// resumes inverted. Coordinates are the ones sv_multihop.py reports, so a
// regression here is visible against a published figure.
function der3Chain(clipJitter = 0): SegAln[] {
  return [
    seg('chr3', 25_326_821, 25_359_568, 1, 0 + clipJitter),
    seg('chr10', 58_717_463, 58_717_662, 1, 32_732 + clipJitter),
    seg('chr12', 72_273_111, 72_273_294, -1, 32_932 + clipJitter),
    seg('chr3', 25_352_683, 25_359_111, -1, 33_126 + clipJitter),
  ]
}

describe('computeDerivativePaths', () => {
  it('groups reads describing one path and counts them as its support', () => {
    const candidates = computeDerivativePaths({
      chains: [der3Chain(), der3Chain(3), der3Chain(-2)],
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.readCount).toBe(3)
    expect(candidates[0]!.segments).toHaveLength(4)
    expect(candidates[0]!.refNames).toEqual(['chr3', 'chr10', 'chr12'])
  })

  it('carries orientation into the locstring, flipping only reversed segments', () => {
    const [candidate] = computeDerivativePaths({
      chains: [der3Chain(), der3Chain()],
      flank: 0,
    })
    // 0-based half-open in, 1-based inclusive out, `[rev]` on the two reversed
    // segments and on neither of the forward ones
    expect(candidate!.locString).toBe(
      'chr3:25326822..25359568 ' +
        'chr10:58717464..58717662 ' +
        'chr12:72273112..72273294[rev] ' +
        'chr3:25352684..25359111[rev]',
    )
  })

  it('does not let a read’s own start and end split one event into many', () => {
    // Same junctions, different outer edges — which is every real read set,
    // since reads begin and end wherever they happen to. Signature is built
    // from junctions alone, so these stay one candidate.
    //
    // WHICH edge is the arbitrary one depends on orientation. The first segment
    // is forward, so the read enters at its low edge and that is what varies.
    // The last segment is REVERSED: the read enters at its high edge (the
    // junction) and runs down, so its arbitrary edge is `start`. Moving `end`
    // there would be moving the junction, i.e. a different event.
    const a = der3Chain()
    const b = der3Chain()
    a[0] = seg('chr3', 25_330_000, 25_359_568, 1, 0)
    b[3] = seg('chr3', 25_355_000, 25_359_111, -1, 33_126)
    expect(computeDerivativePaths({ chains: [a, b] })).toHaveLength(1)
  })

  it('treats a moved junction as a different path, reversed segment included', () => {
    // The converse of the case above, and the reason it is worth stating: on the
    // reversed last segment it is `end` that pins the junction, so shifting it
    // past the tolerance must NOT merge.
    const a = der3Chain()
    const b = der3Chain()
    b[3] = seg('chr3', 25_352_683, 25_359_111 + 5000, -1, 33_126)
    expect(
      computeDerivativePaths({ chains: [a, b], minReads: 1 }),
    ).toHaveLength(2)
  })

  it('folds a chain and its reverse complement into one candidate', () => {
    // A read crossing the molecule from its other end describes the same allele
    // backwards: segments in reverse order, every strand flipped. Counting the
    // two separately reported COLO829's der(3) as two 13-read candidates rather
    // than one 26-read one.
    const reversed = [...der3Chain()]
      .reverse()
      .map(seg => ({ ...seg, strand: -seg.strand }))
    const candidates = computeDerivativePaths({
      chains: [der3Chain(), reversed, der3Chain(), reversed],
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.readCount).toBe(4)
  })

  it('picks the same orientation whichever direction is more common', () => {
    const reversed = [...der3Chain()]
      .reverse()
      .map(seg => ({ ...seg, strand: -seg.strand }))
    const mostlyForward = computeDerivativePaths({
      chains: [der3Chain(), der3Chain(), der3Chain(), reversed],
    })
    const mostlyReverse = computeDerivativePaths({
      chains: [reversed, reversed, reversed, der3Chain()],
    })
    expect(mostlyForward[0]!.locString).toBe(mostlyReverse[0]!.locString)
  })

  it('separates two genuinely different paths', () => {
    const other = [
      seg('chr3', 25_326_821, 25_359_568, 1, 0),
      seg('chr7', 1_000_000, 1_002_000, 1, 32_732),
    ]
    const candidates = computeDerivativePaths({
      chains: [der3Chain(), der3Chain(), other, other],
    })
    expect(candidates).toHaveLength(2)
    // more hops breaks the tie at equal support
    expect(candidates[0]!.segments).toHaveLength(4)
    expect(candidates[1]!.segments).toHaveLength(2)
  })

  it('ranks by supporting read count', () => {
    const other = [
      seg('chr3', 25_326_821, 25_359_568, 1, 0),
      seg('chr7', 1_000_000, 1_002_000, 1, 32_732),
    ]
    const candidates = computeDerivativePaths({
      chains: [der3Chain(), der3Chain(), other, other, other],
    })
    expect(candidates.map(c => c.readCount)).toEqual([3, 2])
    expect(candidates[0]!.refNames).toContain('chr7')
  })

  it('drops paths below minReads, so a single mismapped read is not a candidate', () => {
    const lone = [
      seg('chr3', 25_326_821, 25_359_568, 1, 0),
      seg('chr7', 1_000_000, 1_002_000, 1, 32_732),
    ]
    const candidates = computeDerivativePaths({
      chains: [der3Chain(), der3Chain(), lone],
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.refNames).not.toContain('chr7')
  })

  it('merges junctions that agree within the tolerance but not beyond it', () => {
    const shifted = der3Chain()
    shifted[1] = seg('chr10', 58_717_463, 58_717_662 + 5, 1, 32_732)
    expect(
      computeDerivativePaths({ chains: [der3Chain(), shifted], tolerance: 20 }),
    ).toHaveLength(1)
    expect(
      computeDerivativePaths({ chains: [der3Chain(), shifted], tolerance: 1 }),
    ).toHaveLength(0)
  })

  it('ignores a read with no junction', () => {
    expect(
      computeDerivativePaths({
        chains: [[seg('chr3', 25_326_821, 25_359_568, 1, 0)]],
        minReads: 1,
      }),
    ).toEqual([])
  })

  it('grows the outer segments away from their junctions, never through them', () => {
    const [candidate] = computeDerivativePaths({
      chains: [der3Chain(), der3Chain()],
      flank: 1000,
    })
    const segs = candidate!.segments
    // first segment is forward: the read enters at its low edge, so that is the
    // edge that grows, and the junction at its high edge is untouched
    expect(segs[0]!.start).toBe(25_326_821 - 1000)
    expect(segs[0]!.end).toBe(25_359_568)
    // last segment is reversed: the read exits at its LOW edge, so the flank
    // goes there and the junction at the high edge holds
    expect(segs[3]!.start).toBe(25_352_683 - 1000)
    expect(segs[3]!.end).toBe(25_359_111)
    // interior segments are pinned on both sides
    expect(segs[1]!.start).toBe(58_717_463)
    expect(segs[1]!.end).toBe(58_717_662)
  })

  it('never emits a negative coordinate near the start of a chromosome', () => {
    const chain = [
      seg('chr1', 100, 500, 1, 0),
      seg('chr2', 900_000, 901_000, 1, 400),
    ]
    const [candidate] = computeDerivativePaths({
      chains: [chain, chain],
      flank: 5000,
    })
    expect(candidate!.segments[0]!.start).toBe(0)
    expect(candidate!.locString.startsWith('chr1:1..')).toBe(true)
  })

  it('reports when the path leaves what is on screen', () => {
    const offScreen = der3Chain()
    offScreen[2] = seg('chr12', 72_273_111, 72_273_294, -1, 32_932, false)
    expect(
      computeDerivativePaths({ chains: [offScreen, offScreen] })[0]!
        .extendsOffScreen,
    ).toBe(true)
    expect(
      computeDerivativePaths({ chains: [der3Chain(), der3Chain()] })[0]!
        .extendsOffScreen,
    ).toBe(false)
  })
})

describe('derivativeLocString', () => {
  it('round-trips through the location box unformatted', () => {
    // no thousand separators: this string is parsed, not read, and the
    // formatted spelling moves with the numberGrouping preference
    expect(
      derivativeLocString([
        { refName: 'chr3', start: 1_000_000, end: 2_000_000, strand: 1 },
      ]),
    ).toBe('chr3:1000001..2000000')
  })
})
