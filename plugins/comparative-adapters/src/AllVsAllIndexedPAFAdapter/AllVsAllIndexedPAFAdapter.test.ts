import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './AllVsAllIndexedPAFAdapter.ts'
import configSchema from './configSchema.ts'

// all_vs_all.pif.gz is `jbrowse make-pif` run on the AllVsAllPAFAdapter fixture
// (grape/peach/cacao all-vs-all), so the two adapters answer the same queries.
const loc = (uri: string) => ({
  localPath: require.resolve(uri),
  locationType: 'LocalPathLocation' as const,
})

function makeAdapter(
  assemblyNames: string[],
  assemblyNameToPanSN: Record<string, string> = {},
) {
  return new Adapter(
    configSchema.create({
      pifGzLocation: loc('./test_data/all_vs_all.pif.gz'),
      index: { location: loc('./test_data/all_vs_all.pif.gz.tbi') },
      assemblyNames,
      assemblyNameToPanSN,
    }),
  )
}

// the real browser-suite fixture (volvox_ins/volvox/volvox_del pangenome),
// make-pif'd, for a realistic end-to-end check with CIGAR + de:f: tags
function makeVolvoxAdapter(assemblyNames: string[]) {
  const base = '../../../../test_data/volvox/volvox_all_vs_all.pif.gz'
  return new Adapter(
    configSchema.create({
      pifGzLocation: loc(base),
      index: { location: loc(`${base}.tbi`) },
      assemblyNames,
    }),
  )
}

// diploid.pif.gz holds a hap1-vs-hap2 block at identical coords, a true
// self-diagonal, and one cross-sample block, all anchored on grape chr1
function makeDiploidAdapter(
  assemblyNames = ['grape', 'peach'],
  assemblyNameToPanSN: Record<string, string> = {},
) {
  return new Adapter(
    configSchema.create({
      pifGzLocation: loc('./test_data/diploid.pif.gz'),
      index: { location: loc('./test_data/diploid.pif.gz.tbi') },
      assemblyNames,
      assemblyNameToPanSN,
    }),
  )
}

// reciprocal.pif.gz is `jbrowse make-pif` over reciprocal.paf beside it: one
// homology stated from either end — the E. coli K12/CFT073 pair, with the two chainings STAGGERED rather
// than nested (4362432-4496063 against 4362436-4496576, 4 bp and 513 bp apart at
// the two ends) so a block boundary can fall between their starts and another
// between their ends. That is the shape the per-query dedupe drew twice.
function makeReciprocalAdapter() {
  return new Adapter(
    configSchema.create({
      pifGzLocation: loc('./test_data/reciprocal.pif.gz'),
      index: { location: loc('./test_data/reciprocal.pif.gz.tbi') },
      assemblyNames: ['K12', 'CFT073'],
      assemblyNameToPanSN: { K12: 'K12#1', CFT073: 'CFT073#1' },
    }),
  )
}

// the same diploid file read as a haplotype-resolved pangenome: each haplotype
// is its own JBrowse assembly, mapped to a `sample#haplotype` PanSN prefix
const HAP_ASSEMBLIES = ['grapeHap1', 'grapeHap2', 'peach']
const HAP_TO_PANSN = { grapeHap1: 'grape#1', grapeHap2: 'grape#2' }

const feats = (
  adapter: Adapter,
  region: Record<string, unknown>,
  opts: Record<string, unknown> = {},
) =>
  firstValueFrom(
    adapter.getFeatures(region as never, opts as never).pipe(toArray()),
  )

const byMateRef = (fa: Awaited<ReturnType<typeof feats>>) =>
  Object.fromEntries(
    fa.map(f => [
      (f.get('mate') as { refName: string }).refName,
      f.get('mate') as { refName: string; assemblyName: string },
    ]),
  )

test('hap1 vs hap2 of one sample at identical coords is not dropped as a self-diagonal', async () => {
  const fa = await feats(makeDiploidAdapter(), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  // hap1#chr1 and hap2#chr1 both resolve to the one `grape` assembly's chr1, so
  // the hap1-vs-hap2 block draws at each locus; the peach block draws once; the
  // sequence-against-itself self-diagonal is dropped from both perspectives
  expect(fa.length).toBe(3)
  expect(fa.map(f => f.get('start')).sort((a, b) => a - b)).toEqual([
    100, 100, 700,
  ])
})

// A haplotype-resolved pangenome loads each haplotype as its own assembly, so
// the anchor prefix names a `sample#haplotype`, not a sample. Every seqid is
// indexed under both depths, so the same file serves either configuration.
test('haplotype-level assemblies resolve to one haplotype each', async () => {
  const fa = await feats(makeDiploidAdapter(HAP_ASSEMBLIES, HAP_TO_PANSN), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grapeHap1',
  })
  // only the hap1 side anchors now, so the hap1-vs-hap2 block draws once (not
  // once per locus as it does when both haplotypes collapse into one assembly)
  expect(fa.map(f => f.get('start')).sort((a, b) => a - b)).toEqual([100, 700])
  const mates = byMateRef(fa)
  // the sibling haplotype is a listed assembly, so it is labelled as one rather
  // than collapsing into a `grape` self-mate
  expect(mates.chr1).toMatchObject({ assemblyName: 'grapeHap2' })
  expect(mates.G1).toMatchObject({ assemblyName: 'peach' })
})

test('haplotype-level: the hap2 assembly anchors its own side of the same block', async () => {
  const fa = await feats(makeDiploidAdapter(HAP_ASSEMBLIES, HAP_TO_PANSN), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grapeHap2',
  })
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate')).toMatchObject({
    refName: 'chr1',
    assemblyName: 'grapeHap1',
  })
})

test('haplotype-level: targetAssemblyName isolates the hap1-vs-hap2 band', async () => {
  const fa = await feats(
    makeDiploidAdapter(HAP_ASSEMBLIES, HAP_TO_PANSN),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grapeHap1' },
    { targetAssemblyName: 'grapeHap2' },
  )
  // the peach block is excluded by the target, leaving the inter-haplotype one
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('start')).toBe(100)
})

test('haplotype-level getRefNames scopes to that haplotype', async () => {
  const names = await makeDiploidAdapter(
    HAP_ASSEMBLIES,
    HAP_TO_PANSN,
  ).getRefNames({ assemblyName: 'grapeHap2' })
  expect([...names].sort()).toEqual(['chr1'])
})

test('one-vs-all: grape draws against peach, cacao, and its own paralog', async () => {
  const fa = await feats(makeAdapter(['grape', 'peach']), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(3)
  expect(fa.every(f => f.get('refName') === 'chr1')).toBe(true)
  const mates = byMateRef(fa)
  // peach is listed so it gets its assembly label
  expect(mates.G1).toMatchObject({ assemblyName: 'peach' })
  // cacao is NOT in assemblyNames, so the mate is labelled by its PanSN prefix
  expect(mates.I).toMatchObject({ assemblyName: 'cacao' })
  // paralogy: make-pif's chr1-keyed row surfaces it, mate labelled grape
  expect(mates.chr2).toMatchObject({ assemblyName: 'grape' })
})

test('paralogy is per-locus: the chr2 copy draws when viewing chr2, mated to chr1', async () => {
  const fa = await feats(makeAdapter(['grape', 'peach']), {
    refName: 'chr2',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('refName')).toBe('chr2')
  expect(fa[0]!.get('mate')).toMatchObject({
    refName: 'chr1',
    assemblyName: 'grape',
  })
})

test('same-contig tandem paralogy double-emits both loci with distinct ids', async () => {
  // grape#1#chr3:100-200 vs grape#1#chr3:300-400: the q-row and t-row for the
  // one record both key on chr3, so a chr3 query returns both loci (distinct
  // fileOffsets => distinct ids)
  const fa = await feats(makeAdapter(['grape']), {
    refName: 'chr3',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(2)
  expect(new Set(fa.map(f => f.id())).size).toBe(2)
  const byStart = Object.fromEntries(
    fa.map(f => [f.get('start'), f.get('mate') as { start: number }]),
  )
  expect(byStart[100]).toMatchObject({ start: 300 })
  expect(byStart[300]).toMatchObject({ start: 100 })
})

test('one-vs-all: peach draws against cacao (listed) and grape (unlisted)', async () => {
  const fa = await feats(makeAdapter(['peach', 'cacao']), {
    refName: 'G1',
    start: 0,
    end: 2000,
    assemblyName: 'peach',
  })
  expect(fa.length).toBe(2)
  const mates = byMateRef(fa)
  expect(mates.I).toMatchObject({ assemblyName: 'cacao' })
  expect(mates.chr1).toMatchObject({ assemblyName: 'grape' })
})

test('assemblyNameToPanSN maps JBrowse names to PanSN sample prefixes', async () => {
  const fa = await feats(
    makeAdapter(['grapeJB', 'peachJB'], { grapeJB: 'grape', peachJB: 'peach' }),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grapeJB' },
  )
  const mates = byMateRef(fa)
  expect(mates.G1).toMatchObject({ assemblyName: 'peachJB' })
  expect(mates.I).toMatchObject({ assemblyName: 'cacao' })
})

test('targetAssemblyName isolates the band (grape query, peach target)', async () => {
  const fa = await feats(
    makeAdapter(['grape', 'peach', 'cacao']),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grape' },
    { targetAssemblyName: 'peach' },
  )
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate')).toMatchObject({
    refName: 'G1',
    assemblyName: 'peach',
  })
})

test('switching targetAssemblyName redraws a different band (grape query, cacao target)', async () => {
  const fa = await feats(
    makeAdapter(['grape', 'peach', 'cacao']),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grape' },
    { targetAssemblyName: 'cacao' },
  )
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate')).toMatchObject({
    refName: 'I',
    assemblyName: 'cacao',
  })
})

test('a range query only returns overlapping records (tabix range scoping)', async () => {
  // grape#1#chr1 records: paralogy at 10-20, peach at 100-200, cacao at 500-600;
  // a 50-300 window must return only the peach hit.
  const fa = await feats(makeAdapter(['grape', 'peach', 'cacao']), {
    refName: 'chr1',
    start: 50,
    end: 300,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(1)
  expect(fa[0]!.get('mate')).toMatchObject({ assemblyName: 'peach' })
})

test('the anchor is found whether it is the PAF query or target side', async () => {
  // cacao#1#I is only ever a PAF target column in the fixture, so it is reached
  // via the `t`-prefixed rows.
  const fa = await feats(makeAdapter(['grape', 'peach', 'cacao']), {
    refName: 'I',
    start: 0,
    end: 2000,
    assemblyName: 'cacao',
  })
  const mates = byMateRef(fa)
  expect(mates.chr1).toMatchObject({ assemblyName: 'grape' })
  expect(mates.G1).toMatchObject({ assemblyName: 'peach' })
})

test('the coarse tier serves the same one-vs-all set without CIGARs', async () => {
  const fa = await feats(
    makeAdapter(['grape', 'peach', 'cacao']),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grape' },
    { lodMode: 'coarse' },
  )
  // same one-vs-all set as the fine tier (peach, cacao, paralog), but coarse
  // rows carry no CIGAR
  expect(fa.length).toBe(3)
  expect(fa.every(f => f.get('CIGAR') === undefined)).toBe(true)
  const mates = byMateRef(fa)
  expect(mates.G1).toMatchObject({ assemblyName: 'peach' })
  expect(mates.I).toMatchObject({ assemblyName: 'cacao' })
  expect(mates.chr2).toMatchObject({ assemblyName: 'grape' })
})

test('getRefNames strips PanSN prefix and scopes to the anchor sample', async () => {
  const names = await makeAdapter(['grape', 'peach', 'cacao']).getRefNames({
    assemblyName: 'grape',
  })
  // grape contigs in the index: chr1 (vs peach/cacao + a paralog), chr2 and chr3
  // (grape-grape paralogy). All are drawable one-vs-all.
  expect([...names].sort()).toEqual(['chr1', 'chr2', 'chr3'])
})

test('real all-vs-all fixture: volvox LGV draws against both other samples with CIGAR', async () => {
  const fa = await feats(
    makeVolvoxAdapter(['volvox_ins', 'volvox', 'volvox_del']),
    { refName: 'ctgA', start: 0, end: 60000, assemblyName: 'volvox' },
  )
  expect(fa.length).toBe(2)
  expect(fa.every(f => f.get('refName') === 'ctgA')).toBe(true)
  const mateAsms = fa
    .map(f => (f.get('mate') as { assemblyName: string }).assemblyName)
    .sort()
  expect(mateAsms).toEqual(['volvox_del', 'volvox_ins'])
  // fine tier carries the per-perspective CIGAR straight from the PIF row
  expect(fa.every(f => typeof f.get('CIGAR') === 'string')).toBe(true)
})

test('real all-vs-all fixture: draws against an assembly missing from assemblyNames', async () => {
  const fa = await feats(makeVolvoxAdapter(['volvox', 'volvox_ins']), {
    refName: 'ctgA',
    start: 0,
    end: 60000,
    assemblyName: 'volvox',
  })
  expect(fa.length).toBe(2)
  const mateAsms = fa
    .map(f => (f.get('mate') as { assemblyName: string }).assemblyName)
    .sort()
  // volvox_del is absent from assemblyNames yet is still drawn, prefix-labelled
  expect(mateAsms).toEqual(['volvox_del', 'volvox_ins'])
})

// The tier the reader serves. all_vs_all.pif.gz carries both (make-pif wrote
// uppercase Q/T rows alongside the lowercase q/t ones) and only the coarse rows
// carry a de:f: tag, so the tag says which prefix was actually read. An LGV
// The tier is always stated outright: it is resolved on the main thread by
// resolveLodTier so it can enter the fetch cache key, and the adapter's job is
// only to honor it (and to degrade when the file has no coarse tier).
const tiersOf = (fa: Awaited<ReturnType<typeof feats>>) =>
  new Set(fa.map(f => (f.get('de') === undefined ? 'fine' : 'coarse')))

const grapeChr1 = {
  refName: 'chr1',
  start: 0,
  end: 2000,
  assemblyName: 'grape',
}

test('an explicit coarse lodMode reads the coarse tier', async () => {
  const fa = await feats(makeAdapter(['grape', 'peach']), grapeChr1, {
    lodMode: 'coarse',
  })
  expect(fa.length).toBeGreaterThan(0)
  expect(tiersOf(fa)).toEqual(new Set(['coarse']))
})

test('an explicit fine lodMode holds the fine tier however far out the view is', async () => {
  const fa = await feats(makeAdapter(['grape', 'peach']), grapeChr1, {
    lodMode: 'fine',
    bpPerPx: 1e9,
  })

  expect(fa.length).toBeGreaterThan(0)
  expect(tiersOf(fa)).toEqual(new Set(['fine']))
})

// a direct getFeatures call (feature-by-id lookup, text search) states no tier
test('no stated lodMode stays on the fine tier', async () => {
  const fa = await feats(makeAdapter(['grape', 'peach']), grapeChr1)
  expect(fa.length).toBeGreaterThan(0)
  expect(tiersOf(fa)).toEqual(new Set(['fine']))
})

// diploid.pif.gz was made without a coarse tier, so asking for one must fall
// back rather than query T/Q prefixes that match nothing and return zero rows
test('asking for coarse on a file with no coarse tier still returns features', async () => {
  const fa = await feats(
    makeDiploidAdapter(),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grape' },
    { lodMode: 'coarse' },
  )
  expect(fa.length).toBeGreaterThan(0)
  expect(tiersOf(fa)).toEqual(new Set(['fine']))
})

// Same guard as the in-memory adapter, off the tabix contig list rather than a
// parse: a track configured with an assembly name that is not the PanSN sample
// prefix drew nothing and said nothing, and the prefixes it should have used are
// not visible anywhere in the UI.
describe('an assembly the file has never heard of', () => {
  test('names what the file does hold, and how to map onto it', async () => {
    await expect(
      feats(makeAdapter(['Vitis_vinifera', 'peach']), {
        refName: 'chr1',
        start: 0,
        end: 2000,
        assemblyName: 'Vitis_vinifera',
      }),
    ).rejects.toThrow(
      /No sequences in this file belong to assembly "Vitis_vinifera".*samples are: cacao, grape, peach.*assemblyNameToPanSN/s,
    )
  })

  // the tier letter (t/q/T/Q) prefixing every seqid is not part of the name, so
  // the reported samples must not come back as `tgrape`/`Tgrape`
  test('the reported samples are stripped of the tier letter', async () => {
    await expect(
      feats(makeAdapter(['nope', 'peach']), {
        refName: 'chr1',
        start: 0,
        end: 2000,
        assemblyName: 'nope',
      }),
    ).rejects.toThrow(/samples are: cacao, grape, peach\./)
  })

  test('a known assembly on a contig with no alignments is still empty, not an error', async () => {
    expect(
      await feats(makeAdapter(['grape', 'peach']), {
        refName: 'no_such_contig',
        start: 0,
        end: 2000,
        assemblyName: 'grape',
      }),
    ).toEqual([])
  })

  // The pair above is the whole point of the guard: emptiness has to mean "no
  // alignments here" and nothing else. A region reaches this adapter over RPC,
  // where `assemblyName` being typed `string` is a claim about the sender rather
  // than a fact, and an anchorless query resolved to no prefix and drew an empty
  // band that looked exactly like the contig case above.
  test('a query naming no assembly at all is an error, not an empty band', async () => {
    await expect(
      feats(makeAdapter(['grape', 'peach']), {
        refName: 'chr1',
        start: 0,
        end: 2000,
      }),
    ).rejects.toThrow(/must name the assembly it is anchored on/)
  })
})

describe('a reciprocal pair in an indexed all-vs-all file', () => {
  const region = (start: number, end: number) => ({
    refName: 'chr',
    start,
    end,
    assemblyName: 'K12',
  })

  test('draws once over the whole span', async () => {
    const fa = await feats(
      makeReciprocalAdapter(),
      region(4_000_000, 4_600_000),
    )
    expect(fa.length).toBe(1)
    // the longer chaining is the survivor, which is a property of the two rows
    expect(fa[0]!.get('start')).toBe(4_362_436)
  })

  // The dedupe ran over the rows ONE region query returned, so it never saw a
  // restatement partner the block missed: the first block below reaches only the
  // shorter member and the last only the longer, and both came back drawn. The
  // display's own `dedupe(r => r.id())` cannot collapse them — they are two file
  // offsets, two ids — so the ribbon was painted twice.
  test('stays deduped across block boundaries', async () => {
    const adapter = makeReciprocalAdapter()
    const blocks = [
      [4_000_000, 4_362_434],
      [4_362_434, 4_496_100],
      [4_496_100, 4_600_000],
    ] as const
    const ids = new Set<string>()
    for (const [start, end] of blocks) {
      for (const f of await feats(adapter, region(start, end))) {
        ids.add(f.id())
      }
    }
    expect(ids.size).toBe(1)
  })
})
