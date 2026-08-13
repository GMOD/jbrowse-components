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

// `jcvi mcscan` writes a column per chain of synteny blocks rather than per
// genome, so at --iter=2 a grape gene syntenic to two peach regions has a peach
// id in each of two columns. grape_peach_iter2.blocks is that shape: the first
// chain pairs g1/g2/g4, the second pairs g1 and g2 with the copy one over.
describe('a genome in several columns (mcscan --iter=2)', () => {
  const iterAdapter = (assemblyNames: string[]) =>
    new Adapter(
      configSchema.create({
        mcscanBlocksLocation: bed('grape_peach_iter2.blocks'),
        blockAssemblies: ['grape', 'peach', 'peach'],
        bedLocations: [bed('grape.bed'), bed('peach.bed'), bed('peach.bed')],
        assemblyNames,
      }),
    )
  const iterFeats = (
    assemblyNames: string[],
    region: Record<string, unknown>,
  ) =>
    firstValueFrom(
      iterAdapter(assemblyNames)
        .getFeatures(region as never)
        .pipe(toArray()),
    )
  const grapeRegion = {
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  }

  test('every copy column is drawn, not just the first', async () => {
    const fa = await iterFeats(['grape', 'peach'], grapeRegion)
    // 3 links from column 1, 2 more from column 2
    expect(fa.length).toBe(5)
    expect(new Set(fa.map(f => f.id())).size).toBe(5)
    expect(
      new Set(
        fa.map(f => (f.get('mate') as { assemblyName: string }).assemblyName),
      ),
    ).toEqual(new Set(['peach']))
  })

  // What the extra column means: one grape gene, two peach copies, so the band
  // draws a ribbon to each rather than picking one
  test('a duplicated gene draws a ribbon to each copy', async () => {
    const fa = await iterFeats(['grape', 'peach'], grapeRegion)
    const g1 = fa.filter(f => f.get('name') === 'g1')
    expect(
      g1.map(f => (f.get('mate') as { name: string }).name).sort(),
    ).toEqual(['p1', 'p2'])
  })

  // The copy columns are on the mate side of a grape query and on the QUERY
  // side of a peach one, so resolving only the query's first column would make
  // the same band draw a different number of links from each row.
  test('the pair reads the same from the other side', async () => {
    const fa = await iterFeats(['grape', 'peach'], {
      refName: 'Pp1',
      start: 0,
      end: 2000,
      assemblyName: 'peach',
    })
    expect(fa.length).toBe(5)
    expect(new Set(fa.map(f => f.id())).size).toBe(5)
  })

  // assemblyNames is free to name the genome once per column it holds, and that
  // must not draw every link twice
  test('naming the mate once per column does not double the links', async () => {
    const fa = await iterFeats(['grape', 'peach', 'peach'], grapeRegion)
    expect(fa.length).toBe(5)
  })

  test('getRefNames covers the copy columns too', async () => {
    const names = await iterAdapter(['grape', 'peach']).getRefNames({
      assemblyName: 'peach',
      targetAssemblyName: 'grape',
    })
    expect(names).toEqual(['Pp1'])
  })
})

// One assembly in two columns: wheat's homoeologs against each other, or an
// MCScanX whole-genome-duplication run. `indexOf` answers the same column twice
// there, which paired every gene with itself and, with no "other" assembly to
// mate against, threw before drawing anything.
test('a self-comparison draws the two columns, not one against itself', async () => {
  const selfAdapter = new Adapter(
    configSchema.create({
      mcscanBlocksLocation: bed('grape_self.blocks'),
      blockAssemblies: ['grape', 'grape'],
      bedLocations: [bed('grape.bed'), bed('grape.bed')],
      assemblyNames: ['grape', 'grape'],
    }),
  )
  const region = {
    refName: 'chr1',
    start: 0,
    end: 1000,
    assemblyName: 'grape',
  }
  const targeted = await firstValueFrom(
    selfAdapter
      .getFeatures(region as never, { targetAssemblyName: 'grape' })
      .pipe(toArray()),
  )
  // column 1 of grape.blocks holds peach ids, which grape.bed does not have, so
  // the join is empty — but it is the (0,1) join, and it neither throws nor
  // pairs a gene with itself
  expect(
    targeted.every(
      f => f.get('name') !== (f.get('mate') as { name: string }).name,
    ),
  ).toBe(true)

  // and with no target at all, a self track still answers rather than finding
  // no mate assembly to draw against
  await expect(
    firstValueFrom(selfAdapter.getFeatures(region as never).pipe(toArray())),
  ).resolves.toBeDefined()
})
