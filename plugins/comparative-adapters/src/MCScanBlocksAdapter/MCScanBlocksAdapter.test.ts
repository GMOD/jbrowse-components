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

// A `.blocks` table is gene ids and nothing else, so a measurement that came
// with the orthology — Compara's per-pair identity, dN, dS, gene-order
// conservation — is discarded at the point the table is written. Named columns
// past the gene columns are where it rides in, and `identity` in particular
// lands on a colorBy mode the view already has.
describe('attributeColumns', () => {
  const attrAdapter = () =>
    new Adapter(
      configSchema.create({
        mcscanBlocksLocation: bed('grape_peach_attrs.blocks'),
        blockAssemblies: ['grape', 'peach'],
        bedLocations: [bed('grape.bed'), bed('peach.bed')],
        assemblyNames: ['grape', 'peach'],
        attributeColumns: ['identity', 'dn', 'ds', 'goc_score'],
      }),
    )
  const attrFeats = () =>
    firstValueFrom(
      attrAdapter()
        .getFeatures({
          refName: 'chr1',
          start: 0,
          end: 1000,
          assemblyName: 'grape',
        })
        .pipe(toArray()),
    )

  test('each named column lands on the feature as a number', async () => {
    const fa = await attrFeats()
    expect(fa.length).toBe(3)
    expect(fa[0]!.get('identity')).toBe(0.91)
    expect(fa[0]!.get('dn')).toBe(0.02)
    expect(fa[0]!.get('ds')).toBe(0.4)
    expect(fa[0]!.get('goc_score')).toBe(75)
  })

  // NULL is what Compara writes for a rate it could not estimate, and 0 there
  // is a dN/dS of zero — total purifying selection — rather than no answer.
  test('a NULL or . cell is absent rather than zero', async () => {
    const fa = await attrFeats()
    expect(fa[1]!.get('goc_score')).toBeUndefined()
    expect(fa[2]!.get('dn')).toBeUndefined()
    expect(fa[2]!.get('ds')).toBeUndefined()
    // the columns that did parse on those rows are unaffected
    expect(fa[1]!.get('dn')).toBe(0.3)
    expect(fa[2]!.get('identity')).toBe(0.8)
  })

  // The gene columns are read positionally, so an attribute column must not be
  // mistaken for one, and a table with no attributeColumns must be untouched.
  test('the gene join is unaffected, with or without the extra columns', async () => {
    const fa = await attrFeats()
    expect(fa.map(f => f.get('name'))).toEqual(['g1', 'g2', 'g4'])
    expect(fa[0]!.get('mate')).toMatchObject({ assemblyName: 'peach' })
    const plain = await feats(['grape', 'peach'], {
      refName: 'chr1',
      start: 0,
      end: 1000,
      assemblyName: 'grape',
    })
    expect(plain[0]!.get('identity')).toBeUndefined()
  })
})
