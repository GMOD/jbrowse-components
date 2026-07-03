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

async function feats(assemblyNames: string[], region: Record<string, unknown>) {
  const obs = makeAdapter(assemblyNames).getFeatures(region as never)
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
