import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './MCScanBlocksAdapter.ts'
import configSchema from './configSchema.ts'

const bed = (f: string) => ({
  localPath: require.resolve(`./test_data/${f}`),
  locationType: 'LocalPathLocation' as const,
})

function makeAdapter(assemblyNames: string[]) {
  return new Adapter(
    configSchema.create({
      mcscanBlocksLocation: bed('grape.blocks'),
      blockAssemblies: ['grape', 'peach', 'cacao'],
      bedLocations: [bed('grape.bed'), bed('peach.bed'), bed('cacao.bed')],
      assemblyNames,
    }),
  )
}

async function feats(
  assemblyNames: string[],
  region: Record<string, unknown>,
  opts: Record<string, unknown> = {},
) {
  const obs = makeAdapter(assemblyNames).getFeatures(region as never, opts)
  return firstValueFrom(obs.pipe(toArray()))
}

test('reference-to-genome pair (grape vs peach)', async () => {
  // g1/g2/g4 have a peach ortholog, g3 does not
  const fa = await feats(['grape', 'peach'], {
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(3)
})

test('reference-to-genome pair (grape vs cacao)', async () => {
  // g1/g3/g4 have a cacao ortholog, g2 does not
  const fa = await feats(['grape', 'cacao'], {
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(3)
})

test('transitive pair through the reference (peach vs cacao)', async () => {
  // only rows where BOTH peach and cacao are present: g1 and g4
  const fa = await feats(['peach', 'cacao'], {
    refName: 'Pp1',
    start: 0,
    end: 2000,
    assemblyName: 'peach',
  })
  expect(fa.length).toBe(2)
  expect(fa[0]!.get('mate')).toMatchObject({
    assemblyName: 'cacao',
    refName: 'Tc1',
  })
})

// One track lists all genomes; the view passes each band's target assembly, so
// the same track backs every band instead of needing one track per pair.
test('full-list track, target picks the band (grape query, peach target)', async () => {
  const fa = await feats(
    ['grape', 'peach', 'cacao'],
    { refName: 'chr1', start: 0, end: 1000, assemblyName: 'grape' },
    { targetAssemblyName: 'peach' },
  )
  expect(fa.length).toBe(3)
  expect(fa[0]!.get('mate')).toMatchObject({ assemblyName: 'peach' })
})

test('full-list track, switching target redraws a different band (grape/cacao)', async () => {
  const fa = await feats(
    ['grape', 'peach', 'cacao'],
    { refName: 'chr1', start: 0, end: 1000, assemblyName: 'grape' },
    { targetAssemblyName: 'cacao' },
  )
  expect(fa.length).toBe(3)
  expect(fa[0]!.get('mate')).toMatchObject({ assemblyName: 'cacao' })
})

test('full-list track, transitive band (peach query, cacao target)', async () => {
  const fa = await feats(
    ['grape', 'peach', 'cacao'],
    { refName: 'Pp1', start: 0, end: 2000, assemblyName: 'peach' },
    { targetAssemblyName: 'cacao' },
  )
  expect(fa.length).toBe(2)
  expect(fa[0]!.get('mate')).toMatchObject({
    assemblyName: 'cacao',
    refName: 'Tc1',
  })
})

// No target is "what aligns here at all" — what an LGVSyntenyDisplay and the
// region-launch mate discovery ask. Answering with one arbitrary column left a
// three-genome table drawing only grape/peach, with nothing saying cacao was in
// the file.
test('full-list track with no target draws every pair', async () => {
  const fa = await feats(['grape', 'peach', 'cacao'], {
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  })
  expect(
    [
      ...new Set(
        fa.map(f => (f.get('mate') as { assemblyName: string }).assemblyName),
      ),
    ].sort(),
  ).toEqual(['cacao', 'peach'])
  // 3 grape/peach links + 3 grape/cacao links, kept apart by id
  expect(fa.length).toBe(6)
  expect(new Set(fa.map(f => f.id())).size).toBe(6)
})

test('a pair-pinned track is unaffected by the no-target fan-out', async () => {
  const fa = await feats(['grape', 'peach'], {
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  })
  expect(
    fa.map(f => (f.get('mate') as { assemblyName: string }).assemblyName),
  ).toEqual(['peach', 'peach', 'peach'])
})

test('getRefNames scopes to the target pair on a full-list track', async () => {
  const names = await makeAdapter(['grape', 'peach', 'cacao']).getRefNames({
    assemblyName: 'grape',
    targetAssemblyName: 'peach',
  })
  expect(names.length).toBeGreaterThan(0)
})

test('throws a clear error when a column has no BED', async () => {
  const adapter = new Adapter(
    configSchema.create({
      mcscanBlocksLocation: bed('grape.blocks'),
      blockAssemblies: ['grape', 'peach', 'cacao'],
      bedLocations: [bed('grape.bed'), bed('cacao.bed')],
      assemblyNames: ['grape', 'peach', 'cacao'],
    }),
  )
  const obs = adapter.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  })
  await expect(firstValueFrom(obs.pipe(toArray()))).rejects.toThrow(
    /one BED per column/,
  )
})

// The silent failure this adapter used to have: blockAssemblies/bedLocations
// are positional against the file's columns, so permuting them looks every gene
// up in the wrong genome's BED. Nothing resolves, and an empty track reads as a
// region with no orthologs rather than as a broken config.
test('throws when the BEDs are permuted against the file columns', async () => {
  const permuted = new Adapter(
    configSchema.create({
      mcscanBlocksLocation: bed('grape.blocks'),
      blockAssemblies: ['grape', 'peach', 'cacao'],
      bedLocations: [bed('peach.bed'), bed('cacao.bed'), bed('grape.bed')],
      assemblyNames: ['grape', 'peach', 'cacao'],
    }),
  )
  const obs = permuted.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  })
  await expect(firstValueFrom(obs.pipe(toArray()))).rejects.toThrow(
    /have to be in the file's own column order/,
  )
  // and the reordering that fixes it, which the reader would otherwise have to
  // work out against a column order they may never have looked at
  await expect(firstValueFrom(obs.pipe(toArray()))).rejects.toThrow(
    /column 0 in bedLocations\[2\], column 1 in bedLocations\[0\], column 2 in bedLocations\[1\]/,
  )
})

// The quieter half of the same failure, and the one nothing downstream could
// report: only ONE column's BED is keyed on other ids (peach's slot points at
// cacao.bed here). Grape and cacao still resolve, so the track used to load and
// draw, with every band touching peach silently empty — which reads as a genome
// with no orthologs in view rather than as a broken config.
test('throws when one column resolves nothing while the others do', async () => {
  const oneDead = new Adapter(
    configSchema.create({
      mcscanBlocksLocation: bed('grape.blocks'),
      blockAssemblies: ['grape', 'peach', 'cacao'],
      bedLocations: [bed('grape.bed'), bed('cacao.bed'), bed('cacao.bed')],
      assemblyNames: ['grape', 'peach', 'cacao'],
    }),
  )
  const obs = oneDead.getFeatures({
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  })
  // named, not just "something is wrong": the column is the whole fix
  await expect(firstValueFrom(obs.pipe(toArray()))).rejects.toThrow(
    /peach \(column 1, 3 gene ids\) names no gene present/,
  )
})

// The joined rows are built once per ordered pair and shared by every region
// and band that asks for that pair, so a consumer mutating or draining them
// would corrupt the next fetch rather than its own.
test('a pair joined once still answers a second, different region', async () => {
  const adapter = makeAdapter(['grape', 'peach'])
  const region = (start: number, end: number) => ({
    refName: 'chr1',
    start,
    end,
    assemblyName: 'grape',
  })
  const wide = await firstValueFrom(
    adapter.getFeatures(region(0, 1000) as never).pipe(toArray()),
  )
  const narrow = await firstValueFrom(
    adapter.getFeatures(region(0, 450) as never).pipe(toArray()),
  )
  const again = await firstValueFrom(
    adapter.getFeatures(region(0, 1000) as never).pipe(toArray()),
  )
  expect([wide.length, narrow.length, again.length]).toEqual([3, 2, 3])
})

// One genome pair sharing no row is not the same failure, and must not throw:
// only two of the four rows fill both peach and cacao, and a table where some
// pair happens to fill none is a legitimate table.
test('a single empty pair is not treated as a broken config', async () => {
  const fa = await feats(['grape', 'peach', 'cacao'], {
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  })
  expect(fa.length).toBe(6)
})

test('throws when the pair is not present in blockAssemblies', async () => {
  const obs = makeAdapter(['grape', 'rice']).getFeatures({
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  })
  await expect(firstValueFrom(obs.pipe(toArray()))).rejects.toThrow(
    /must contain both/,
  )
})

// A real grape/peach/cacao blocks table (jcvi mcscan+join, Ensembl Plants
// release-58), subset to grape chromosome 1. Exercises the adapter on genuine
// multi-species ortholog data including the transitive (peach vs cacao) pair.
describe('real grape/peach/cacao blocks (chr1 subset)', () => {
  const realLoc = (f: string) => ({
    localPath: require.resolve(`./test_data/real/${f}`),
    locationType: 'LocalPathLocation' as const,
  })
  const realAdapter = (assemblyNames: string[]) =>
    new Adapter(
      configSchema.create({
        mcscanBlocksLocation: realLoc('grape.blocks.gz'),
        blockAssemblies: ['grape', 'peach', 'cacao'],
        bedLocations: [
          realLoc('grape.bed.gz'),
          realLoc('peach.bed.gz'),
          realLoc('cacao.bed.gz'),
        ],
        assemblyNames,
      }),
    )
  const realFeats = (
    assemblyNames: string[],
    region: Record<string, unknown>,
  ) =>
    firstValueFrom(
      realAdapter(assemblyNames)
        .getFeatures(region as never)
        .pipe(toArray()),
    )

  test('grape vs peach (direct, reference on top)', async () => {
    const fa = await realFeats(['grape', 'peach'], {
      refName: '1',
      start: 0,
      end: 100_000_000,
      assemblyName: 'grape',
    })
    expect(fa.length).toBe(1183)
    expect(fa[0]!.get('mate')).toMatchObject({ assemblyName: 'peach' })
  })

  test('grape vs cacao (direct)', async () => {
    const fa = await realFeats(['grape', 'cacao'], {
      refName: '1',
      start: 0,
      end: 100_000_000,
      assemblyName: 'grape',
    })
    expect(fa.length).toBe(1045)
  })

  test('peach vs cacao (transitive through grape)', async () => {
    const fa = await realFeats(['peach', 'cacao'], {
      refName: 'G1',
      start: 0,
      end: 100_000_000,
      assemblyName: 'peach',
    })
    expect(fa.length).toBe(924)
    expect(fa[0]!.get('mate')).toMatchObject({ assemblyName: 'cacao' })
  })
})
