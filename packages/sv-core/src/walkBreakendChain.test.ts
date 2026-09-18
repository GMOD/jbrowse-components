import { SimpleFeature } from '@jbrowse/core/util'
import { jexlFeatureProxy } from '@jbrowse/core/util/simpleFeature'

import { getBreakendCoveringRegions } from './util.ts'
import {
  junctionFromFeature,
  nextJunctionFrom,
  walkBreakendChain,
} from './walkBreakendChain.ts'

import type { Junction } from './walkBreakendChain.ts'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

// The COLO829 der(3), verbatim from the nanomonsv calls the cancer_sv demo
// serves (`COLO829.somatic-sv.vcf.gz`, INFO reduced to SVTYPE/MATEID):
//
//   chr3   25359111  r_24_1  GTGATGGATTCA[CHR12:72273112[   MATEID=r_24_0
//   chr3   25359568  r_12_1  G[CHR10:58717464[              MATEID=r_12_0
//   chr10  58717464  r_12_0  ]CHR3:25359568]G               MATEID=r_12_1
//   chr10  58717662  r_13_0  GC]CHR12:72273294]             MATEID=r_13_1
//   chr12  72273112  r_24_0  ]CHR3:25359111]TGAATCCATCAG    MATEID=r_24_1
//   chr12  72273294  r_13_1  GG]CHR10:58717662]             MATEID=r_13_0
//
// Three junctions, and they close a triangle: chr3-chr10, chr10-chr12,
// chr12-chr3. The pair of breakends at each corner is 198 bp apart on chr10,
// 182 bp on chr12 and 457 bp on chr3, which is what BREAKEND_COLOCATION_BP is
// sized for. There is no EVENT tag anywhere in this callset -- nanomonsv emits
// SVTYPE and MATEID and nothing grouping records -- so the co-location is the
// only thing that relates them, and following it is what this module does.
//
// Built through junctionFromFeature, so each end carries the side of its
// breakend it keeps, read off the bracket.
const lowerCase = { getCanonicalRefName2: (r: string) => r.toLowerCase() }

function bnd(
  id: string,
  mateId: string,
  refName: string,
  vcfPos: number,
  alt: string,
) {
  return junctionFromFeature(
    new SimpleFeature({
      uniqueId: id,
      name: id,
      refName,
      start: vcfPos - 1,
      end: vcfPos,
      ALT: [alt],
      INFO: { SVTYPE: ['BND'], MATEID: [mateId] },
    }),
    lowerCase as unknown as Assembly,
  )!
}

// Junctions with no kept side, for the walks that are about loci alone.
// Positions are 0-based; the mate's is given 1-based like a VCF ALT.
function j(
  id: string,
  mateId: string,
  refName: string,
  pos: number,
  mateRefName: string,
  matePos: number,
): Junction {
  return { id, mateId, refName, pos, mateRefName, matePos: matePos - 1 }
}

const R12 = bnd('r_12_1', 'r_12_0', 'chr3', 25_359_568, 'G[CHR10:58717464[')
const R12_MATE = bnd(
  'r_12_0',
  'r_12_1',
  'chr10',
  58_717_464,
  ']CHR3:25359568]G',
)
const R13 = bnd('r_13_0', 'r_13_1', 'chr10', 58_717_662, 'GC]CHR12:72273294]')
const R13_MATE = bnd(
  'r_13_1',
  'r_13_0',
  'chr12',
  72_273_294,
  'GG]CHR10:58717662]',
)
const R24 = bnd(
  'r_24_0',
  'r_24_1',
  'chr12',
  72_273_112,
  ']CHR3:25359111]TGAATCCATCAG',
)
const R24_MATE = bnd(
  'r_24_1',
  'r_24_0',
  'chr3',
  25_359_111,
  'GTGATGGATTCA[CHR12:72273112[',
)

const COLO829 = [R12, R12_MATE, R13, R13_MATE, R24, R24_MATE]

function findJunctionsNear(region: {
  refName: string
  start: number
  end: number
}) {
  return Promise.resolve(
    COLO829.filter(
      x =>
        (x.refName === region.refName &&
          x.pos >= region.start &&
          x.pos <= region.end) ||
        (x.mateRefName === region.refName &&
          x.matePos >= region.start &&
          x.matePos <= region.end),
    ),
  )
}

describe('walkBreakendChain over the COLO829 der(3)', () => {
  it('reaches all three chromosomes from the chr3 record', async () => {
    const stops = await walkBreakendChain({
      start: R12,
      findJunctionsNear,
    })
    expect(stops.map(s => s.refName)).toEqual(['chr3', 'chr10', 'chr12'])
    expect(stops.map(s => s.pos)).toEqual([25_359_567, 58_717_463, 72_273_293])
    // and each stop after the first says which junction was crossed to get there
    expect(stops.map(s => s.viaId)).toEqual([undefined, 'r_12_1', 'r_13_0'])
  })

  it('stops at three rather than going round the triangle', async () => {
    // The third junction (r_24) leaves chr12 for chr3, where the chain started.
    // A fourth panel would be a second view of the first locus.
    const stops = await walkBreakendChain({ start: R12, findJunctionsNear })
    expect(stops).toHaveLength(3)
  })

  // The der(3) molecule runs chr3 -> chr10 -> chr12 -> chr3 inverted, so every
  // record reads out a run of that path, forwards or reverse-complemented. The
  // walk used to join loci by distance alone and read r_24_0 out as chr12 ->
  // chr3 -> chr10, a middle stop no molecule passes through: the chr3 ends of
  // r_24 and r_12 both keep the sequence to their left.
  it('walks a run of the molecule from any record in the chain', async () => {
    for (const [start, expected] of [
      [R13, ['chr10', 'chr12', 'chr3']],
      [R13_MATE, ['chr12', 'chr10', 'chr3']],
      [R24, ['chr10', 'chr12', 'chr3']],
      [R24_MATE, ['chr3', 'chr12', 'chr10']],
      [R12_MATE, ['chr12', 'chr10', 'chr3']],
    ] as const) {
      const stops = await walkBreakendChain({ start, findJunctionsNear })
      expect(stops.map(s => s.refName)).toEqual(expected)
    }
  })

  it('honors maxStops, since a panel count is a viewport division', async () => {
    const stops = await walkBreakendChain({
      start: R12,
      findJunctionsNear,
      maxStops: 2,
    })
    expect(stops.map(s => s.refName)).toEqual(['chr3', 'chr10'])
  })

  it('gives the record its own two ends when nothing else is co-located', async () => {
    const stops = await walkBreakendChain({
      start: R12,
      findJunctionsNear: () => Promise.resolve([]),
    })
    expect(stops.map(s => s.refName)).toEqual(['chr3', 'chr10'])
  })
})

describe('nextJunctionFrom', () => {
  const stop = { refName: 'chr10', pos: 58_717_463 }
  const visited = [{ refName: 'chr3', pos: 25_359_567 }, stop]

  it('does not read the arrival junction as a way onward', () => {
    // Only the record we came in on is here, under both of its ids.
    expect(
      nextJunctionFrom({
        stop,
        arrivedBy: R12,
        candidates: [R12, R12_MATE],
        visited,
      }),
    ).toBeUndefined()
  })

  it('takes the one other junction at the locus', () => {
    const hop = nextJunctionFrom({
      stop,
      arrivedBy: R12,
      candidates: [R12, R12_MATE, R13],
      visited,
    })
    expect(hop?.junction.id).toBe('r_13_0')
    expect(hop?.next).toEqual({ refName: 'chr12', pos: 72_273_293 })
  })

  it('turns a junction around when the locus is its MATE end', () => {
    // R13_MATE is filed on chr12 and its mate end is the chr10 stop, so leaving
    // by it means going to chr12. A walk that only looked at `refName`/`pos`
    // would not see it at all, and a callset without reciprocal records is
    // exactly the case where only one of the two spellings exists.
    const hop = nextJunctionFrom({
      stop,
      arrivedBy: R12,
      candidates: [R13_MATE],
      visited,
    })
    expect(hop?.next).toEqual({ refName: 'chr12', pos: 72_273_293 })
  })

  it('refuses two open continuations rather than choosing one', () => {
    const other = j('x_0', 'x_1', 'chr10', 58_717_600, 'chr7', 1_000_000)
    expect(
      nextJunctionFrom({
        stop,
        arrivedBy: R12,
        candidates: [R12_MATE, R13, other],
        visited,
      }),
    ).toBeUndefined()
  })

  // GRIDSS `BEID` / Esvee `ASMID`: the caller assembled one contig across two
  // junctions, which is the phasing the walk refuses to guess at.
  describe('with assembly ids', () => {
    const other = j('x_0', 'x_1', 'chr10', 58_717_600, 'chr7', 1_000_000)
    const on = (junction: Junction, ...assemblyIds: string[]) => ({
      ...junction,
      assemblyIds,
    })

    it('takes the continuation assembled with the arrival junction', () => {
      const hop = nextJunctionFrom({
        stop,
        arrivedBy: on(R12, 'asm7'),
        candidates: [R12_MATE, on(R13, 'asm7', 'asm9'), on(other, 'asm2')],
        visited,
      })
      expect(hop?.junction.id).toBe('r_13_0')
    })

    it('reads the shared contig off either spelling of a reciprocal pair', () => {
      // the mate record carries the id, the record at the stop does not
      const hop = nextJunctionFrom({
        stop,
        arrivedBy: on(R12, 'asm7'),
        candidates: [R12_MATE, R13, on(R13_MATE, 'asm7'), other],
        visited,
      })
      expect(hop?.next).toEqual({ refName: 'chr12', pos: 72_273_293 })
    })

    it('still refuses when both continuations share the contig, or neither', () => {
      for (const candidates of [
        [R12_MATE, on(R13, 'asm7'), on(other, 'asm7')],
        [R12_MATE, on(R13, 'asm1'), on(other, 'asm2')],
        [R12_MATE, R13, other],
      ]) {
        expect(
          nextJunctionFrom({
            stop,
            arrivedBy: on(R12, 'asm7'),
            candidates,
            visited,
          }),
        ).toBeUndefined()
      }
    })

    it('cannot make a lone continuation ambiguous', () => {
      const hop = nextJunctionFrom({
        stop,
        arrivedBy: on(R12, 'asm7'),
        candidates: [R12_MATE, on(R13, 'asm2')],
        visited,
      })
      expect(hop?.junction.id).toBe('r_13_0')
    })
  })

  it('is not made ambiguous by a branch that only closes the chain', () => {
    // The closing junction of a triangle sits at the last stop alongside the one
    // genuine continuation. Counting it as a second answer would stop the walk a
    // panel early, which is how the COLO829 chain lost chr12.
    const closesBack = j('c_0', 'c_1', 'chr10', 58_717_500, 'chr3', 25_359_600)
    const hop = nextJunctionFrom({
      stop,
      arrivedBy: R12,
      candidates: [R12_MATE, R13, closesBack],
      visited,
    })
    expect(hop?.junction.id).toBe('r_13_0')
  })

  it('drops the way back whichever end of the arrival junction it came in on', () => {
    // The same duplicate as below, on a hop taken through the arrival
    // junction's MATE end rather than its first — which is the ordinary case
    // whenever a callset files the mate spelling of a pair first.
    //
    // The two ends of one junction are `tolerance` apart at most from the
    // coordinate the previous hop recorded as a stop, so a duplicate can be
    // twice that from the stop and still be the same way back. This one is:
    // 1.6 kb from the recorded chr3 stop, so `visited` does not see it, and
    // 833 bp from the end of the junction the walk actually crossed. Compared
    // against the arrival record's FIRST end — which on this hop is the chr10
    // stop itself — nothing matched, and the walk turned round and added a
    // panel 800 bp from one it already had.
    const arrivedBy = j(
      'r_12_0',
      'r_12_1',
      'chr10',
      58_717_463,
      'chr3',
      25_359_568,
    )
    const duplicate = j(
      'other_0',
      'other_1',
      'chr10',
      58_717_470,
      'chr3',
      25_360_401,
    )
    expect(
      nextJunctionFrom({
        stop,
        arrivedBy,
        candidates: [duplicate],
        visited: [{ refName: 'chr3', pos: 25_358_800 }, stop],
      }),
    ).toBeUndefined()
  })

  it('drops a second copy of the arrival junction with unrelated ids', () => {
    // Two callers merged, or one that writes no MATEID: the same junction is
    // present again under names the arrival ids cannot match, and only its
    // POSITION says it is the way back.
    const duplicate = j(
      'other_1',
      'other_0',
      'chr10',
      58_717_470,
      'chr3',
      25_359_560,
    )
    expect(
      nextJunctionFrom({
        stop,
        arrivedBy: R12,
        candidates: [duplicate],
        visited,
      }),
    ).toBeUndefined()
  })
})

// COLO829's chain is a closed triangle, so every record of it reaches the same
// three loci going one way round. A LINEAR chain is the case that separates a
// walk that goes outward from one that only goes forward: chr1 -j1- chr2 -j2-
// chr3 -j3- chr4, where the reader may click any of the three records and every
// one of them is equally the event.
describe('walkBreakendChain over a linear chain', () => {
  const J1 = j('j1', 'j1_m', 'chr1', 1000, 'chr2', 2001)
  const J2 = j('j2', 'j2_m', 'chr2', 2100, 'chr3', 3001)
  const J3 = j('j3', 'j3_m', 'chr3', 3100, 'chr4', 4001)
  const CHAIN = [J1, J2, J3]

  function nearby(region: { refName: string; start: number; end: number }) {
    return Promise.resolve(
      CHAIN.filter(
        x =>
          (x.refName === region.refName &&
            x.pos >= region.start &&
            x.pos <= region.end) ||
          (x.mateRefName === region.refName &&
            x.matePos >= region.start &&
            x.matePos <= region.end),
      ),
    )
  }

  it('shows the whole chain from any of its records', async () => {
    for (const start of CHAIN) {
      const stops = await walkBreakendChain({
        start,
        findJunctionsNear: nearby,
      })
      expect(stops.map(s => s.refName)).toEqual([
        'chr1',
        'chr2',
        'chr3',
        'chr4',
      ])
    }
  })

  it('names the junction crossed INTO each stop, prepended ones included', async () => {
    // Reading the list top to bottom, a stop added at the front takes the
    // arrival from the stop it displaced, and the new head has nothing above it.
    const stops = await walkBreakendChain({
      start: J3,
      findJunctionsNear: nearby,
    })
    expect(stops.map(s => s.viaId)).toEqual([undefined, 'j1', 'j2', 'j3'])
  })

  it('spends the panel budget forward first', async () => {
    // What the walk always did, unchanged: the backward half only gets a turn
    // once the forward one has stopped on its own.
    const stops = await walkBreakendChain({
      start: J2,
      findJunctionsNear: nearby,
      maxStops: 3,
    })
    expect(stops.map(s => s.refName)).toEqual(['chr2', 'chr3', 'chr4'])
  })

  // `nearby` above answers on EITHER end, which is more than a region query can
  // do: a tabix index knows one coordinate per record, so a query about chr2
  // returns the records filed AT chr2 and nothing that merely points there.
  // Modelled honestly, a chain written one record per junction shows how much of
  // itself depends on which record was clicked.
  function ownLocusOnly(region: {
    refName: string
    start: number
    end: number
  }) {
    return Promise.resolve(
      CHAIN.filter(
        x =>
          x.refName === region.refName &&
          x.pos >= region.start &&
          x.pos <= region.end,
      ),
    )
  }

  it('reaches only the loci it has records at when the query is own-locus', async () => {
    // Each record here is filed at the LEFT end of its junction, so the forward
    // walk always finds the next one and the backward walk never finds the
    // previous one. 4 stops, then 3, then 2, with nothing saying the short
    // answers were short. A filtered VCF missing one mate reads like this, and
    // so does a `<TRA>` callset naming CHR2 on a single record.
    const counts = []
    for (const start of CHAIN) {
      const stops = await walkBreakendChain({
        start,
        findJunctionsNear: ownLocusOnly,
      })
      counts.push(stops.length)
    }
    expect(counts).toEqual([4, 3, 2])
  })
})

// A bedpe or STAR-Fusion row is ONE record per junction -- there is no
// reciprocal spelling in the file, which is what the fixtures above cannot
// express. The adapters make up for it: each files a row under both of its
// contigs and hands back a feature anchored at whichever end was queried, with
// `mate` naming the other. That is exactly the both-ends answer the walk needs,
// and junctionFromFeature dropped every one of them for having no parseable ALT
// -- so the chain walk was not merely one-directional on these callsets, it
// never found a single junction.
describe('walkBreakendChain over a paired-feature chain', () => {
  const assembly = { getCanonicalRefName2: (r: string) => r } as Assembly

  // chr1 -row1- chr2 -row2- chr3 -row3- chr4, one row per junction
  const ROWS = [
    ['chr1', 1000, 'chr2', 2000],
    ['chr2', 2100, 'chr3', 3000],
    ['chr3', 3100, 'chr4', 4000],
  ] as const

  // what buildPairedIntervalTree inserts: two features per row, one per contig
  const FEATURES = ROWS.flatMap(([r1, p1, r2, p2], i) =>
    [
      [r1, p1, r2, p2, 'r1'],
      [r2, p2, r1, p1, 'r2'],
    ].map(
      ([refName, start, mateRef, matePos, half]) =>
        new SimpleFeature({
          uniqueId: `row${i}-${half}`,
          refName: refName as string,
          start: start as number,
          end: (start as number) + 1,
          type: 'paired_feature',
          mate: {
            refName: mateRef as string,
            start: matePos as number,
            end: (matePos as number) + 1,
          },
        }),
    ),
  )

  // and a region query answers with the features filed AT the window, nothing
  // more -- the same own-locus rule an RPC region query obeys
  function nearby(region: { refName: string; start: number; end: number }) {
    return Promise.resolve(
      FEATURES.filter(
        f =>
          f.get('refName') === region.refName &&
          f.get('start') >= region.start &&
          f.get('start') <= region.end,
      )
        .map(f => junctionFromFeature(f, assembly))
        .filter((x): x is Junction => x !== undefined),
    )
  }

  it('shows the whole chain from either half of any row', async () => {
    for (const f of FEATURES) {
      const start = junctionFromFeature(f, assembly)
      expect(start).toBeDefined()
      const stops = await walkBreakendChain({
        start: start!,
        findJunctionsNear: nearby,
      })
      expect(new Set(stops.map(s => s.refName))).toEqual(
        new Set(['chr1', 'chr2', 'chr3', 'chr4']),
      )
    }
  })
})

describe('a hop has to be one a molecule can make', () => {
  // arrives at chr2:2000 by an end keeping the sequence to its right, so the
  // molecule runs right along chr2 from there
  const arrivedBy: Junction = {
    id: 'in',
    refName: 'chr1',
    pos: 1000,
    keeps: -1,
    mateRefName: 'chr2',
    matePos: 2000,
    mateKeeps: 1,
  }
  const stop = { refName: 'chr2', pos: 2000 }
  const leaving = (pos: number, keeps: number): Junction => ({
    id: `out-${pos}-${keeps}`,
    refName: 'chr2',
    pos,
    keeps,
    mateRefName: 'chr7',
    matePos: 7000,
    mateKeeps: 1,
  })
  const next = (candidate: Junction) =>
    nextJunctionFrom({
      stop,
      arrivedBy,
      candidates: [candidate],
      visited: [{ refName: 'chr1', pos: 1000 }, stop],
    })?.next

  it('leaves by an end facing back at the arrival, on its kept side', () => {
    expect(next(leaving(2200, -1))).toEqual({ refName: 'chr7', pos: 7000 })
  })

  it('refuses an end keeping the same side as the arrival', () => {
    expect(next(leaving(2200, 1))).toBeUndefined()
  })

  it('refuses an end behind the arrival by more than an overlap', () => {
    expect(next(leaving(1990, -1))).toBeDefined()
    expect(next(leaving(1800, -1))).toBeUndefined()
  })

  it('holds an end with no known side to neither rule', () => {
    expect(next(leaving(1800, 0))).toBeDefined()
  })

  // a junction the caller rejected is not evidence the molecule goes there,
  // and on COLO829 it took the walk through a 25 Mb Too_low_VAF deletion
  it('skips a record whose FILTER failed', () => {
    expect(next({ ...leaving(2200, -1), filtered: true })).toBeUndefined()
  })
})

describe('junctionFromFeature', () => {
  const identity = { getCanonicalRefName2: (r: string) => r } as Assembly

  it('marks a record failing FILTER and passes PASS and "."', () => {
    const at = (FILTER: unknown) =>
      junctionFromFeature(
        new SimpleFeature({
          uniqueId: 'x',
          refName: 'chr1',
          start: 99,
          end: 100,
          ALT: ['C[chr2:201['],
          FILTER,
        }),
        identity,
      )?.filtered
    expect(at('PASS')).toBeUndefined()
    expect(at('.')).toBeUndefined()
    expect(at(undefined)).toBeUndefined()
    expect(at(['Too_low_VAF'])).toBe(true)
  })

  // Two rows of one BEDPE left at `.`, or two STAR-Fusion rows of one gene
  // pair, share a name. Keyed on it, the second read as the record the walk
  // arrived on and the chain stopped with nothing said.
  it('keys a record without MATEID by its feature id, not its name', () => {
    const row = (uniqueId: string) =>
      junctionFromFeature(
        new SimpleFeature({
          uniqueId,
          name: '.',
          refName: 'chr1',
          start: 1000,
          end: 1001,
          mate: { refName: 'chr2', start: 2000, end: 2001 },
        }),
        identity,
      )!.id
    expect(row('row0')).not.toBe(row('row1'))
  })

  // A chord click reaches here through a jexl callback, so the feature is a
  // jexlFeatureProxy: every property resolves to a DATA field, and `id` is a
  // GFF3-style `ID=` rather than the method. Reading it as a method threw and
  // the SV inspector opened no view at all.
  it('keys a proxied feature the same way as the raw one', () => {
    const feature = new SimpleFeature({
      uniqueId: 'vcf-6',
      name: 'bnd_Y',
      refName: 'chr1',
      start: 1000,
      end: 1001,
      mate: { refName: 'chr2', start: 2000, end: 2001 },
    })
    const raw = junctionFromFeature(feature, identity)!
    expect(junctionFromFeature(jexlFeatureProxy(feature), identity)).toEqual(
      raw,
    )
    expect(raw.id).toBe('vcf-6')
  })

  // the walk used each block's START while the launch took the strand's edge,
  // so the same row opened 5000/50000 walked and 7999/52999 launched
  it('puts a stranded BEDPE row where the launch puts it', () => {
    const f = new SimpleFeature({
      uniqueId: 'r',
      refName: 'chr1',
      start: 5000,
      end: 8000,
      strand: 1,
      mate: { refName: 'chr5', start: 50000, end: 53000, strand: 1 },
    })
    const j = junctionFromFeature(f, identity)!
    const launched = getBreakendCoveringRegions({
      feature: f,
      assembly: identity,
    })
    expect([j.pos, j.matePos]).toEqual([launched.pos, launched.matePos])
    expect([j.pos, j.matePos]).toEqual([7999, 52999])
  })
})
