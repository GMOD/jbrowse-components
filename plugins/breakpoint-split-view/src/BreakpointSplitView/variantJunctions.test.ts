import { getVariantJunctions } from './variantJunctions.ts'

import type { Feature } from '@jbrowse/core/util'

function fakeFeature(id: string, type: string) {
  return {
    id: () => id,
    get: (k: string) => (k === 'type' ? type : undefined),
  } as unknown as Feature
}

// BND features carry refName, start (0-based), and ALT with a breakend string
// parseable by @gmod/vcf's parseBreakend, e.g. "N]chr2:200]"
function fakeBnd(
  id: string,
  refName: string,
  start: number,
  mateRef: string,
  matePos1Based: number,
) {
  const fields: Record<string, unknown> = {
    type: 'breakend',
    refName,
    start,
    ALT: [`N]${mateRef}:${matePos1Based}]`],
  }
  return {
    id: () => id,
    get: (k: string) => fields[k],
  } as unknown as Feature
}

function mapOf(...feats: Feature[]) {
  return new Map(feats.map(f => [f.id(), f] as const))
}

describe('getVariantJunctions', () => {
  // A at chr1:100 (0-based) = position 101 (1-based) pointing to chr2:200
  // B at chr2:199 (0-based) = position 200 (1-based) pointing to chr1:101
  const A = fakeBnd('a', 'chr1', 100, 'chr2', 200)
  const B = fakeBnd('b', 'chr2', 199, 'chr1', 101)

  test('pairs two mutually-referencing BND features', () => {
    const result = getVariantJunctions(mapOf(A, B))
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(2)
  })

  test('result is the same regardless of iteration order', () => {
    expect(getVariantJunctions(mapOf(A, B))).toHaveLength(1)
    expect(getVariantJunctions(mapOf(B, A))).toHaveLength(1)
  })

  // The overlay draws the curve from the record's ALT, so one half is enough:
  // a single-ended BND, or a reciprocal pair whose other record fell to a
  // filter, still gets its junction.
  test('a BND whose mate record is absent is a chunk of one', () => {
    const result = getVariantJunctions(mapOf(A))
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(1)
  })

  test('two independent BND pairs produce two groups', () => {
    const C = fakeBnd('c', 'chr3', 0, 'chr4', 500)
    const D = fakeBnd('d', 'chr4', 499, 'chr3', 1)
    expect(getVariantJunctions(mapOf(A, B, C, D))).toHaveLength(2)
  })

  // Verbatim from the COLO829 nanomonsv callset the cancer_sv demo serves: the
  // CHROM column is `chr3`/`chr10` and the ALT bracket spells the same contigs
  // `CHR3`/`CHR10`. All 66 BND records in that file do it, so every reciprocal
  // pair got two keys, multi() dropped both, and the split view the reader
  // opened on one of them drew two panels with no curve between them.
  test('pairs a reciprocal pair whose ALT spells the contig in another case', () => {
    const up1 = fakeBnd('r_12_1', 'chr3', 25_359_567, 'CHR10', 58_717_464)
    const up2 = fakeBnd('r_12_0', 'chr10', 58_717_463, 'CHR3', 25_359_568)
    const result = getVariantJunctions(mapOf(up1, up2))
    expect(result).toHaveLength(1)
    expect(result[0]).toHaveLength(2)
  })

  test('two BNDs sharing the same MatePosition are not merged', () => {
    // E and F both point to chr2:200, but are not mates of each other
    const E = fakeBnd('e', 'chr5', 0, 'chr2', 200)
    const F = fakeBnd('f', 'chr6', 0, 'chr2', 200)
    const result = getVariantJunctions(mapOf(A, B, E, F))
    // the real A-B pair, plus E and F each alone
    expect(result).toHaveLength(3)
    expect(result.filter(chunk => chunk.length === 2)).toHaveLength(1)
  })

  test('a record naming no other end is dropped', () => {
    expect(getVariantJunctions(mapOf(fakeFeature('snv', 'SNV')))).toHaveLength(
      0,
    )
  })

  const fakeSymbolic = (
    id: string,
    alt: string | undefined,
    info?: Record<string, unknown>,
  ) => {
    const fields: Record<string, unknown> = {
      refName: 'chr1',
      start: 100,
      end: 101,
      ALT: alt ? [alt] : undefined,
      INFO: info,
    }
    return {
      id: () => id,
      get: (k: string) => fields[k],
    } as unknown as Feature
  }

  test('a TRA states its far end in INFO.CHR2/END', () => {
    const t = fakeSymbolic('t', '<TRA>', { CHR2: ['chr7'], END: [900] })
    expect(getVariantJunctions(mapOf(t))).toHaveLength(1)
  })

  // Symbolic SVs drew nothing at all before: the per-track classification read
  // them as breakends and the breakend matcher found no parseable ALT.
  test('a symbolic DEL with an END is a junction', () => {
    const d = fakeSymbolic('d', '<DEL>', { END: [900] })
    expect(getVariantJunctions(mapOf(d))).toHaveLength(1)
  })

  test('a symbolic allele naming no END is dropped', () => {
    expect(getVariantJunctions(mapOf(fakeSymbolic('t', '<TRA>')))).toHaveLength(
      0,
    )
  })

  test('ALT undefined does not throw', () => {
    const t = fakeSymbolic('t', undefined)
    expect(() => getVariantJunctions(mapOf(t))).not.toThrow()
    expect(getVariantJunctions(mapOf(t))).toHaveLength(0)
  })

  describe('paired adapter records', () => {
    interface Endpoint {
      refName: string
      start: number
      end: number
    }

    // Mirrors BedpeAdapter: one half per endpoint, each anchored at its own end
    // with `mate` pointing at the other, and a uniqueId whose `-r1`/`-r2`
    // suffix sits on top of a per-refName index (so the two halves disagree on
    // the prefix as well as the suffix).
    const half = (
      id: string,
      self: Endpoint,
      mate: Endpoint,
      type = 'paired_feature',
    ) => {
      const fields: Record<string, unknown> = { ...self, type, mate }
      return {
        id: () => id,
        get: (k: string) => fields[k],
      } as unknown as Feature
    }

    const sv1a = { refName: 'chr1', start: 1000, end: 2000 }
    const sv1b = { refName: 'chr2', start: 3000, end: 4000 }
    const sv2a = { refName: 'chr1', start: 5000, end: 6000 }
    const sv2b = { refName: 'chr1', start: 8000, end: 9000 }

    test('groups the two halves of an interchromosomal pair', () => {
      const result = getVariantJunctions(
        mapOf(
          half('test-chr1-0-r1', sv1a, sv1b),
          half('test-chr2-0-r2', sv1b, sv1a),
        ),
      )
      expect(result).toHaveLength(1)
      expect(result[0]).toHaveLength(2)
    })

    test('groups the two halves of an intrachromosomal pair', () => {
      const result = getVariantJunctions(
        mapOf(
          half('test-chr1-1-r1', sv2a, sv2b),
          half('test-chr1-0-r2', sv2b, sv2a),
        ),
      )
      expect(result).toHaveLength(1)
    })

    test('does not join halves of different records that collide on base id', () => {
      // test-chr1-0-r1 (SV1) and test-chr1-0-r2 (SV2) share the base id
      // `test-chr1-0` despite belonging to unrelated records
      const result = getVariantJunctions(
        mapOf(
          half('test-chr1-0-r1', sv1a, sv1b),
          half('test-chr1-0-r2', sv2b, sv2a),
        ),
      )
      expect(result).toHaveLength(2)
      expect(result.every(chunk => chunk.length === 1)).toBe(true)
    })

    // What the `mate` field says, not what the `type` string says: the matcher
    // used to carry an allowlist of two type strings, so an adapter emitting
    // the same shape under a third name drew nothing.
    test('rejoins halves whatever the adapter calls the type', () => {
      const result = getVariantJunctions(
        mapOf(
          half('test-chr1-0-r1', sv1a, sv1b, 'fusion'),
          half('test-chr2-0-r2', sv1b, sv1a, 'contact'),
        ),
      )
      expect(result).toHaveLength(1)
      expect(result[0]).toHaveLength(2)
    })

    test('a lone half is a chunk of one', () => {
      const result = getVariantJunctions(
        mapOf(half('test-chr1-0-r1', sv1a, sv1b)),
      )
      expect(result).toHaveLength(1)
      expect(result[0]).toHaveLength(1)
    })

    test('a paired_feature without a mate is skipped', () => {
      const noMate = {
        id: () => 'test-chr1-0-r1',
        get: (k: string) => (k === 'type' ? 'paired_feature' : undefined),
      } as unknown as Feature
      expect(getVariantJunctions(mapOf(noMate))).toHaveLength(0)
    })
  })
})
