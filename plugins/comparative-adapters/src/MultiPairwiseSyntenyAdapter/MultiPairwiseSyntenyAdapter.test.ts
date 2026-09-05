import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import PAFAdapter from '../PAFAdapter/PAFAdapter.ts'
import PAFConfigSchema from '../PAFAdapter/configSchema.ts'
import PairwiseIndexedPAFAdapter from '../PairwiseIndexedPAFAdapter/PairwiseIndexedPAFAdapter.ts'
import PairwiseIndexedConfigSchema from '../PairwiseIndexedPAFAdapter/configSchema.ts'
import Adapter, {
  childrenFor,
  commonAssembly,
} from './MultiPairwiseSyntenyAdapter.ts'
import configSchema from './configSchema.ts'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'

interface Mate {
  refName: string
  assemblyName: string
  start: number
  end: number
}

// The fixtures beside this test are `jbrowse make-pif --coarse 1000` over the
// two-row PAFs next to them, except d_vs_anchor which is `--no-coarse`. The
// three files put the anchor on the target side twice and the query side once,
// which is what makes the star's perspective handling worth testing.
const loc = (uri: string) => ({
  localPath: require.resolve(uri),
  locationType: 'LocalPathLocation' as const,
})

function pif(stem: string, assemblyNames: string[]) {
  return {
    type: 'PairwiseIndexedPAFAdapter',
    pifGzLocation: loc(`./test_data/${stem}.pif.gz`),
    index: { location: loc(`./test_data/${stem}.pif.gz.tbi`) },
    assemblyNames,
  }
}

function paf(stem: string, assemblyNames: string[]) {
  return {
    type: 'PAFAdapter',
    pafLocation: loc(`./test_data/${stem}.paf`),
    assemblyNames,
  }
}

function makeAdapter(adapters: Record<string, unknown>[]) {
  return new Adapter(configSchema.create({ adapters }), conf =>
    Promise.resolve({
      dataAdapter: (conf?.type === 'PAFAdapter'
        ? new PAFAdapter(PAFConfigSchema.create(conf))
        : new PairwiseIndexedPAFAdapter(
            PairwiseIndexedConfigSchema.create(conf),
          )) as BaseFeatureDataAdapter,
      sessionIds: new Set<string>(),
    }),
  )
}

const STAR = [
  pif('b_vs_anchor', ['genomeB', 'anchor']),
  pif('anchor_vs_c', ['anchor', 'genomeC']),
  pif('d_vs_anchor', ['genomeD', 'anchor']),
]

function fetch(
  adapter: Adapter,
  region: { assemblyName: string; refName: string; start: number; end: number },
  targetAssemblyName?: string,
) {
  return firstValueFrom(
    adapter.getFeatures(region, { targetAssemblyName }).pipe(toArray()),
  )
}

function mateOf(f: Feature) {
  return f.get('mate') as Mate
}

describe('commonAssembly', () => {
  it('finds the one assembly every child names, on either side', () => {
    expect(
      commonAssembly([
        ['genomeB', 'anchor'],
        ['anchor', 'genomeC'],
        ['genomeD', 'anchor'],
      ]),
    ).toBe('anchor')
  })

  it('refuses children with no shared assembly, naming every pair', () => {
    expect(() =>
      commonAssembly([
        ['a', 'b'],
        ['c', 'd'],
      ]),
    ).toThrow(/share no assembly.*\[a, b\] \[c, d\]/)
  })

  it('refuses children sharing more than one assembly', () => {
    expect(() =>
      commonAssembly([
        ['a', 'b'],
        ['a', 'b'],
      ]),
    ).toThrow(/share 2 assemblies \(a, b\)/)
  })
})

describe('childrenFor', () => {
  const star = {
    anchor: 'anchor',
    children: [
      { index: 0, assemblyNames: ['genomeB', 'anchor'], adapter: 'b' },
      { index: 1, assemblyNames: ['anchor', 'genomeC'], adapter: 'c' },
    ],
  }
  const picked = (assemblyName: string, target?: string) =>
    childrenFor(star, assemblyName, target).map(child => child.adapter)

  it('fans an anchor query with no target out to every child', () => {
    expect(picked('anchor')).toEqual(['b', 'c'])
  })

  it('narrows an anchor query with a target to the child holding the pair', () => {
    expect(picked('anchor', 'genomeC')).toEqual(['c'])
  })

  it('answers a mate query from its own child', () => {
    expect(picked('genomeB')).toEqual(['b'])
    expect(picked('genomeB', 'anchor')).toEqual(['b'])
  })

  it('answers a mate pair no child holds with nothing rather than an error', () => {
    expect(picked('genomeB', 'genomeC')).toEqual([])
  })

  it('refuses an assembly no child names', () => {
    expect(() => picked('mouse')).toThrow(
      /assembly mouse is not one this adapter aligns \(anchor, genomeB, genomeC\)/,
    )
  })
})

describe('MultiPairwiseSyntenyAdapter', () => {
  it('concatenates every child from the anchor perspective, ids distinct per child', async () => {
    const features = await fetch(makeAdapter(STAR), {
      assemblyName: 'anchor',
      refName: 'ctgA',
      start: 0,
      end: 30000,
    })
    const byMate = new Map(
      features.map(f => [mateOf(f).assemblyName, f] as const),
    )
    expect([...byMate.keys()].sort()).toEqual(['genomeB', 'genomeC', 'genomeD'])
    expect(new Set(features.map(f => f.id())).size).toBe(3)
    expect(new Set(features.map(f => f.get('syntenyId'))).size).toBe(3)

    const b = byMate.get('genomeB')!
    expect(b.get('assemblyName')).toBe('anchor')
    expect([b.get('start'), b.get('end')]).toEqual([5000, 15000])
    expect(mateOf(b)).toEqual({
      assemblyName: 'genomeB',
      refName: 'bctg1',
      start: 0,
      end: 10000,
    })
    const c = byMate.get('genomeC')!
    expect([c.get('start'), c.get('end')]).toEqual([8000, 20000])
    expect(mateOf(c).refName).toBe('cctg1')
    expect(b.get('CIGAR')).toBe('10000M')
  })

  it('narrows an anchor query to the target pair', async () => {
    const features = await fetch(
      makeAdapter(STAR),
      { assemblyName: 'anchor', refName: 'ctgA', start: 0, end: 30000 },
      'genomeC',
    )
    expect(features.map(f => mateOf(f).assemblyName)).toEqual(['genomeC'])
  })

  it('answers a mate query from the mate side with the anchor as mate, strand kept', async () => {
    const features = await fetch(makeAdapter(STAR), {
      assemblyName: 'genomeB',
      refName: 'bctg2',
      start: 0,
      end: 20000,
    })
    expect(features.length).toBe(1)
    const f = features[0]!
    expect(f.get('assemblyName')).toBe('genomeB')
    expect([f.get('start'), f.get('end'), f.get('strand')]).toEqual([
      2000, 8000, -1,
    ])
    expect(mateOf(f)).toEqual({
      assemblyName: 'anchor',
      refName: 'ctgB',
      start: 10000,
      end: 16000,
    })
  })

  it('answers a mate pair no child holds with nothing', async () => {
    expect(
      await fetch(
        makeAdapter(STAR),
        { assemblyName: 'genomeB', refName: 'bctg1', start: 0, end: 20000 },
        'genomeC',
      ),
    ).toEqual([])
  })

  it('refuses a query on an assembly no child names', async () => {
    await expect(
      fetch(makeAdapter(STAR), {
        assemblyName: 'mouse',
        refName: 'chr1',
        start: 0,
        end: 100,
      }),
    ).rejects.toThrow(/assembly mouse is not one this adapter aligns/)
  })

  it('refuses a star with no common assembly at the first query', async () => {
    await expect(
      fetch(
        makeAdapter([
          pif('b_vs_anchor', ['genomeB', 'anchor']),
          pif('anchor_vs_c', ['other', 'genomeC']),
        ]),
        { assemblyName: 'anchor', refName: 'ctgA', start: 0, end: 100 },
      ),
    ).rejects.toThrow(/share no assembly/)
  })

  it('refuses an empty adapters list', async () => {
    await expect(
      fetch(makeAdapter([]), {
        assemblyName: 'anchor',
        refName: 'ctgA',
        start: 0,
        end: 100,
      }),
    ).rejects.toThrow(/needs `adapters`/)
  })

  it('reports refNames per assembly as the union over the children naming it', async () => {
    const adapter = makeAdapter(STAR)
    expect(
      (await adapter.getRefNames({ assemblyName: 'anchor' })).sort(),
    ).toEqual(['ctgA', 'ctgB', 'ctgC'])
    expect(
      (await adapter.getRefNames({ assemblyName: 'genomeB' })).sort(),
    ).toEqual(['bctg1', 'bctg2'])
    expect(await adapter.getRefNames({ assemblyName: 'genomeD' })).toEqual([
      'dctg1',
    ])
    expect(await adapter.getRefNames({})).toEqual([])
  })

  it('serves the coarse tier only when every child carries one', async () => {
    const tiered = makeAdapter([
      pif('b_vs_anchor', ['genomeB', 'anchor']),
      pif('anchor_vs_c', ['anchor', 'genomeC']),
    ])
    expect(await tiered.getHeader()).toEqual({
      hasCoarseTier: true,
      coarseGap: 1000,
      anchorAssemblyName: 'anchor',
      assemblyNames: ['anchor', 'genomeB', 'genomeC'],
    })
    const coarse = await firstValueFrom(
      tiered
        .getFeatures(
          { assemblyName: 'anchor', refName: 'ctgA', start: 0, end: 30000 },
          { lodMode: 'coarse' },
        )
        .pipe(toArray()),
    )
    expect(coarse.map(f => f.get('CIGAR'))).toEqual([undefined, undefined])
    expect(coarse.map(f => f.get('coarseCigar')).sort()).toEqual([
      '10000M',
      '12000M',
    ])

    const mixed = makeAdapter(STAR)
    expect((await mixed.getHeader()).hasCoarseTier).toBe(false)

    const withPaf = makeAdapter([
      pif('b_vs_anchor', ['genomeB', 'anchor']),
      paf('anchor_vs_c', ['anchor', 'genomeC']),
    ])
    expect((await withPaf.getHeader()).hasCoarseTier).toBe(false)
    const features = await fetch(withPaf, {
      assemblyName: 'anchor',
      refName: 'ctgA',
      start: 0,
      end: 30000,
    })
    expect(features.map(f => mateOf(f).assemblyName).sort()).toEqual([
      'genomeB',
      'genomeC',
    ])
  })
})
