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

test('zoomed out (bpPerPx over threshold) serves the coarse tier', async () => {
  const fa = await feats(
    makeAdapter(['grape', 'peach', 'cacao']),
    { refName: 'chr1', start: 0, end: 2000, assemblyName: 'grape' },
    { bpPerPx: 20000 },
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
