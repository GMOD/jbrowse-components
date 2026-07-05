import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './AllVsAllPAFAdapter.ts'
import configSchema from './configSchema.ts'

const paf = () => ({
  localPath: require.resolve('./test_data/all_vs_all.paf'),
  locationType: 'LocalPathLocation' as const,
})

function makeAdapter(
  assemblyNames: string[],
  assemblyNameToPanSN: Record<string, string> = {},
  pafLocation = paf(),
) {
  return new Adapter(
    configSchema.create({
      pafLocation,
      assemblyNames,
      assemblyNameToPanSN,
    }),
  )
}

// the real fixture the browser suite drives (volvox_ins/volvox/volvox_del
// pangenome), for a realistic end-to-end check with CIGAR + de:f: tags
const volvoxPaf = () => ({
  localPath:
    require.resolve('../../../../test_data/volvox/volvox_all_vs_all.paf'),
  locationType: 'LocalPathLocation' as const,
})

const feats = (
  adapter: Adapter,
  region: Record<string, unknown>,
  opts: Record<string, unknown> = {},
) =>
  firstValueFrom(
    adapter.getFeatures(region as never, opts as never).pipe(toArray()),
  )

// one-vs-all in a plain LGV (no targetAssemblyName): the queried assembly draws
// against every OTHER sample in the file, dropping only same-sample (grape-grape)
// records. `assemblyNames` need not list a mate for it to draw.
const byMateRef = (fa: Awaited<ReturnType<typeof feats>>) =>
  Object.fromEntries(
    fa.map(f => [
      (f.get('mate') as { refName: string }).refName,
      f.get('mate') as { refName: string; assemblyName: string },
    ]),
  )

test('one-vs-all: grape draws against peach AND cacao, dropping grape-grape', async () => {
  const fa = await feats(makeAdapter(['grape', 'peach']), {
    refName: 'chr1',
    start: 0,
    end: 2000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(2)
  expect(fa.every(f => f.get('refName') === 'chr1')).toBe(true)
  const mates = byMateRef(fa)
  // peach is listed so it gets its assembly label
  expect(mates.G1).toMatchObject({ assemblyName: 'peach' })
  // cacao is NOT in assemblyNames, so the mate is labelled by its PanSN prefix
  expect(mates.I).toMatchObject({ assemblyName: 'cacao' })
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
  // grape (grapeJB) draws against peach (mapped to peachJB) and cacao (unlisted)
  expect(mates.G1).toMatchObject({ assemblyName: 'peachJB' })
  expect(mates.I).toMatchObject({ assemblyName: 'cacao' })
})

test('one full-list track, targetAssemblyName isolates the band (grape query, peach target keeps only grape-peach, not grape-cacao)', async () => {
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

test('one full-list track, switching targetAssemblyName redraws a different band (grape query, cacao target)', async () => {
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

test('getRefNames on a full-list track scopes to the target pair', async () => {
  const names = await makeAdapter(['grape', 'peach', 'cacao']).getRefNames({
    assemblyName: 'grape',
    targetAssemblyName: 'peach',
  })
  expect([...names].sort()).toEqual(['chr1'])
})

test('getRefNames strips PanSN prefix and scopes to the pair (chr2 only has a grape-grape self-alignment, so it is not data for grape-vs-peach)', async () => {
  const names = await makeAdapter(['grape', 'peach']).getRefNames({
    assemblyName: 'grape',
  })
  expect([...names].sort()).toEqual(['chr1'])
})

// realistic fixture: volvox is aligned to both volvox_ins and volvox_del; a
// plain LGV (no targetAssemblyName) on volvox is exactly the one-vs-all case.
test('real all-vs-all fixture: volvox LGV draws against both other samples', async () => {
  const fa = await feats(
    makeAdapter(['volvox_ins', 'volvox', 'volvox_del'], {}, volvoxPaf()),
    { refName: 'ctgA', start: 0, end: 60000, assemblyName: 'volvox' },
  )
  expect(fa.length).toBe(2)
  expect(fa.every(f => f.get('refName') === 'ctgA')).toBe(true)
  const mateAsms = fa
    .map(f => (f.get('mate') as { assemblyName: string }).assemblyName)
    .sort()
  expect(mateAsms).toEqual(['volvox_del', 'volvox_ins'])
  // CIGAR survives the real parse (orientAlignment ran without throwing)
  expect(fa.every(f => typeof f.get('CIGAR') === 'string')).toBe(true)
})

// the payoff: a mate that is NOT in assemblyNames still draws (labelled by its
// PanSN prefix), so you need only load the assembly you're viewing
test('real all-vs-all fixture: draws against an assembly missing from assemblyNames', async () => {
  const fa = await feats(
    makeAdapter(['volvox', 'volvox_ins'], {}, volvoxPaf()),
    { refName: 'ctgA', start: 0, end: 60000, assemblyName: 'volvox' },
  )
  expect(fa.length).toBe(2)
  const mateAsms = fa
    .map(f => (f.get('mate') as { assemblyName: string }).assemblyName)
    .sort()
  // volvox_del is absent from assemblyNames yet is still drawn, prefix-labelled
  expect(mateAsms).toEqual(['volvox_del', 'volvox_ins'])
})
