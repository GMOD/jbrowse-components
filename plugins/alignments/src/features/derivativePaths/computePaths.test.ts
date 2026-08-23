import { computeDerivativePaths, derivativeLocString } from './computePaths.ts'

import type { SegAln } from '../arcs/arcTypes.ts'

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
    // two separately reported COLO829's der(3) as a 16-read and a 10-read
    // candidate rather than one 26-read one.
    const reversed = [...der3Chain()]
      .reverse()
      .map(seg => ({ ...seg, strand: -seg.strand }))
    const candidates = computeDerivativePaths({
      chains: [der3Chain(), reversed, der3Chain(), reversed],
    })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.readCount).toBe(4)
  })

  it('groups one allele however far each read runs into its outer arms', () => {
    // Both reads cross the same three junctions; they differ only in how much
    // of the first and last chr3 arm they reach, which is what varies read to
    // read. `deep` covers a long stretch of the first arm, `shallow` clips
    // early there and instead runs far down the last one — so the two disagree
    // about which of their own readings starts at the lower coordinate. Any
    // orientation rule that asks THAT question puts them in different groups
    // and reports one allele twice, which is what COLO829's der(3) did
    // (realReads.colo829.test.ts holds the records).
    const deep = der3Chain()
    const shallow = der3Chain()
    shallow[0] = seg('chr3', 25_358_000, 25_359_568, 1, 0)
    shallow[3] = seg('chr3', 25_340_000, 25_359_111, -1, 33_126)
    expect(deep[0]!.start < deep[3]!.start).toBe(true)
    expect(shallow[0].start > shallow[3].start).toBe(true)

    const candidates = computeDerivativePaths({ chains: [deep, shallow] })
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.readCount).toBe(2)
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

  it('drops paths below minReads, so a row is always a route reads AGREE on', () => {
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

  // The three checks below are one property in three shapes, and the property is
  // that the tolerance is a DISTANCE. It was a grid — `Math.round(bp/tolerance)`
  // — which asks which fixed cell a coordinate falls in, so two endpoints merged
  // or not depending on where the locus sat rather than on how far apart they
  // were. A single hard-coded pair cannot see that (the old code passed the case
  // above), so each of these sweeps the offset instead.

  it('merges a within-tolerance pair wherever the locus sits', () => {
    // Half the default tolerance apart, swept across one whole bucket width. The
    // grid split exactly half of these; every one has to merge.
    for (let offset = 0; offset < 40; offset++) {
      const a = der3Chain()
      const b = der3Chain()
      a[1] = seg('chr10', 58_717_463, 58_717_600 + offset, 1, 32_732)
      b[1] = seg('chr10', 58_717_463, 58_717_610 + offset, 1, 32_732)
      expect(computeDerivativePaths({ chains: [a, b] })).toHaveLength(1)
    }
  })

  it('reports the same support wherever the whole event sits', () => {
    // Translation invariance, which is what the property amounts to for a
    // caller: the same reads at a different absolute coordinate are the same
    // answer. On the real COLO829 records the grid reported anything from 24 to
    // 28 reads across these 20 offsets, and grew a spurious second candidate at
    // 14 of them.
    for (let offset = 0; offset < 20; offset++) {
      const chains = [0, 3, -2].map(jitter =>
        der3Chain(jitter).map(s => ({
          ...s,
          start: s.start + offset,
          end: s.end + offset,
        })),
      )
      const candidates = computeDerivativePaths({ chains })
      expect(candidates).toHaveLength(1)
      expect(candidates[0]!.readCount).toBe(3)
    }
  })

  it('keeps two junctions further apart than the tolerance apart', () => {
    // The converse, and the reason a cluster claims only what lies within the
    // tolerance of its own seed rather than single-linking: linking each
    // endpoint to the PREVIOUS one lets a run of jittered reads chain two
    // distinct junctions into one cluster. COLO829's chr9 fold-back has exactly
    // that shape, two junctions 28 bp apart, and single linkage merged its two
    // alleles into one candidate.
    const chains = []
    for (const at of [58_717_662, 58_717_690]) {
      for (let jitter = 0; jitter < 12; jitter += 4) {
        const chain = der3Chain()
        chain[1] = seg('chr10', 58_717_463, at + jitter, 1, 32_732)
        chains.push(chain)
      }
    }
    expect(computeDerivativePaths({ chains })).toHaveLength(2)
  })

  it('does not let one stray endpoint split a stacked junction, wherever it lands', () => {
    // Most reads stack a junction's endpoint on one exact coordinate, one read
    // places it a few bp higher, and an unrelated 1-read chain drops a jittered
    // endpoint just below the stack. The old leader sweep anchored the cluster
    // on that lowest endpoint, so whenever the stray landed more than the
    // tolerance below the HIGHEST placement it cut the upper one off into its
    // own cluster — one allele as two candidates, its support divided by a
    // chain the minReads floor was about to discard anyway. Swept across the
    // whole tolerance because that is the property: where the stray lands must
    // not move the answer.
    for (let strayOffset = 0; strayOffset <= 20; strayOffset++) {
      const stacked = [0, 0, 0].map(() => der3Chain())
      const higher = der3Chain()
      higher[1] = seg('chr10', 58_717_463, 58_717_672, 1, 32_732)
      const stray = [
        seg('chr10', 58_717_400, 58_717_662 - strayOffset, 1, 0),
        seg('chr5', 1_000_000, 1_000_400, 1, 246),
      ]
      const candidates = computeDerivativePaths({
        chains: [...stacked, higher, stray],
      })
      expect(candidates).toHaveLength(1)
      expect(candidates[0]!.readCount).toBe(4)
    }
  })

  it('returns every supported path, so a caller can say how many there were', () => {
    // How many paths a window produces is evidence about all of them: one or two
    // is an event, forty is a repeat. Truncating here would hand the picker a
    // list it could not describe, which is how a wall of mapping noise ends up
    // looking like a tidy top ten.
    const many = Array.from({ length: 25 }, (_, i) => {
      const chain = der3Chain()
      chain[1] = seg(
        'chr10',
        58_717_463 + i * 5000,
        58_717_662 + i * 5000,
        1,
        32_732,
      )
      return chain
    }).flatMap(chain => [chain, chain])
    expect(computeDerivativePaths({ chains: many })).toHaveLength(25)
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

  // The picker is an observer over a live getter, opened on a pileup that is
  // usually still streaming, and it holds the user's chosen route by `pathId`.
  // So what a wider read must not do is rename the route it joins.
  it('keeps one route’s pathId while its own reads widen it', () => {
    // Same junctions throughout; only how far the first read runs into the
    // outer arm differs, which is what a read arriving later routinely changes.
    const narrow = der3Chain()
    narrow[0] = seg('chr3', 25_340_000, 25_359_568, 1, 0)
    const wide = der3Chain()

    const before = computeDerivativePaths({ chains: [narrow, narrow] })
    const after = computeDerivativePaths({ chains: [narrow, narrow, wide] })

    expect(before).toHaveLength(1)
    expect(after).toHaveLength(1)
    expect(after[0]!.pathId).toBe(before[0]!.pathId)
    // ...and this is why it cannot be locString: the representative is the
    // widest chain, so the outer edge — and every string built from it — moves.
    expect(after[0]!.locString).not.toBe(before[0]!.locString)
    expect(after[0]!.segments[0]!.start).toBeLessThan(
      before[0]!.segments[0]!.start,
    )
  })

  it('keeps one route’s pathId when a later read places a junction lower', () => {
    // The other way a read changes a group it joins, and the one the widening
    // case above cannot see: not a wider outer edge but a junction a few bp to
    // the LEFT. A cluster used to be labelled by its lowest endpoint, so such a
    // read renamed the cluster, and with it every signature built from it — the
    // picker's held selection missed and the radio dropped back to row 0, which
    // is what holding a `pathId` rather than a row index exists to prevent.
    //
    // On the real COLO829 tumour records this fired in 37 of 40 arrival orders.
    // The label is the coordinate most reads agree on, so the two below outvote
    // the newcomer.
    const at = (exit: number, entry: number) => [
      seg('chr3', 25_326_821, exit, 1, 0),
      seg('chr10', entry, 58_717_662, 1, 32_732),
    ]
    const agreed = at(25_359_568, 58_717_463)
    const lower = at(25_359_563, 58_717_458)

    const before = computeDerivativePaths({ chains: [agreed, agreed] })
    const after = computeDerivativePaths({ chains: [agreed, agreed, lower] })
    expect(after[0]!.readCount).toBe(3)
    expect(after[0]!.pathId).toBe(before[0]!.pathId)
  })

  it('gives two genuinely different routes two pathIds', () => {
    const other = der3Chain()
    other[3] = seg('chr3', 25_352_683, 25_359_111, 1, 33_126)
    const candidates = computeDerivativePaths({
      chains: [der3Chain(), der3Chain(), other, other],
    })
    expect(candidates).toHaveLength(2)
    expect(candidates[0]!.pathId).not.toBe(candidates[1]!.pathId)
  })

  // A candidate and the same candidate read from the other end are one allele,
  // and the grouping already folds them together — so the id it hands out has
  // to be the folded one rather than the direction this particular read set
  // happened to be dominated by.
  it('gives one pathId to an allele read from either end', () => {
    const forward = der3Chain()
    const reverse = [...der3Chain()]
      .reverse()
      .map(s => ({ ...s, strand: -s.strand }))
    const a = computeDerivativePaths({ chains: [forward, forward] })
    const b = computeDerivativePaths({ chains: [reverse, reverse] })
    expect(a[0]!.pathId).toBe(b[0]!.pathId)
  })

  // Support and segment count are not a total order — two routes can agree on
  // both, which is the ordinary shape of a window holding several two-segment,
  // two-read candidates. What separated them was `groups`' insertion order,
  // i.e. the order the reads were walked, so the same window ranked the same
  // two alleles either way round on different runs. The picker shows only the
  // first `MAX_SHOWN` rows, so that decided which candidates a person was
  // offered at all.
  it('ranks equal candidates the same way whatever order the reads arrive in', () => {
    const routeA = (j = 0) => [
      seg('chr1', 1000, 5000 + j, 1, 0),
      seg('chr7', 20_000 + j, 24_000, 1, 4000),
    ]
    const routeB = (j = 0) => [
      seg('chr2', 8000, 9000 + j, 1, 0),
      seg('chr9', 40_000 + j, 41_000, 1, 1000),
    ]
    const ids = (chains: SegAln[][]) =>
      computeDerivativePaths({ chains }).map(c => c.pathId)

    const forwards = ids([routeA(), routeA(2), routeB(), routeB(2)])
    expect(forwards).toHaveLength(2)
    expect(ids([routeB(), routeB(2), routeA(), routeA(2)])).toEqual(forwards)
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
