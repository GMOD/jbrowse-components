import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import Adapter from './TabixPAFAdapter.ts'
import MyConfigSchema from './configSchema.ts'

const pafPath = require.resolve(
  '../../../../test_data/volvox/volvox.untangle.paf.gz',
)

function makeAdapter(jaccardFilter = 0, assemblyNames: string[] = []) {
  return new Adapter(
    MyConfigSchema.create({
      pafGzLocation: {
        localPath: pafPath,
        locationType: 'LocalPathLocation',
      },
      index: {
        indexType: 'TBI',
        location: {
          localPath: `${pafPath}.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      jaccardFilter,
      assemblyNames,
    }),
  )
}

const ctgA = { refName: 'ctgA', assemblyName: 'volvox' }

describe('TabixPAFAdapter', () => {
  it('getSources reads the #genomes= header', async () => {
    const adapter = makeAdapter()
    expect(await adapter.getSources()).toEqual([
      { name: 'hap1#1' },
      { name: 'hap2#1' },
    ])
  })

  it('getSources prefers the assemblyNames config override', async () => {
    const adapter = makeAdapter(0, ['hapA', 'hapB'])
    expect(await adapter.getSources()).toEqual([
      { name: 'hapA' },
      { name: 'hapB' },
    ])
  })

  it('getRefNames returns bare PanSN refNames of the indexed targets', async () => {
    const adapter = makeAdapter()
    expect((await adapter.getRefNames()).sort()).toEqual(['ctgA', 'ctgB'])
  })

  it('getMultiPairFeatures groups blocks by PanSN genome', async () => {
    const adapter = makeAdapter()
    const { genomeRows } = await adapter.getMultiPairFeatures({
      ...ctgA,
      start: 0,
      end: 5000,
    })
    expect([...genomeRows.keys()].sort()).toEqual(['hap1#1', 'hap2#1'])
    expect(genomeRows.get('hap1#1')!.length).toBe(2)
    expect(genomeRows.get('hap2#1')!.length).toBe(2)
  })

  it('resolves a bare refName to the PanSN-qualified tabix name', async () => {
    const adapter = makeAdapter()
    const { genomeRows } = await adapter.getMultiPairFeatures({
      ...ctgA,
      start: 0,
      end: 600,
    })
    // ctgA -> volvox#0#ctgA; only the first block of each haplotype overlaps
    expect(genomeRows.get('hap1#1')!.length).toBe(1)
    expect(genomeRows.get('hap2#1')!.length).toBe(1)
  })

  it('feature coordinates: target=reference, query=mate', async () => {
    const adapter = makeAdapter()
    const { genomeRows } = await adapter.getMultiPairFeatures({
      ...ctgA,
      start: 0,
      end: 5000,
    })
    const f = genomeRows.get('hap1#1')![0]!
    expect(f.start).toBe(0)
    expect(f.end).toBe(500)
    expect(f.mateStart).toBe(0)
    expect(f.mateEnd).toBe(500)
    expect(f.mateRefName).toBe('hap1#1#ctg1')
    expect(f.origRefName).toBe('ctgA')
    expect(f.strand).toBe(1)
    expect(f.identity).toBeCloseTo(0.96)
  })

  it('parses reverse-strand blocks', async () => {
    const adapter = makeAdapter()
    const { genomeRows } = await adapter.getMultiPairFeatures({
      ...ctgA,
      start: 0,
      end: 5000,
    })
    const rev = genomeRows.get('hap2#1')!.find(f => f.strand === -1)
    expect(rev).toBeDefined()
    expect(rev!.start).toBe(2000)
    expect(rev!.end).toBe(2300)
  })

  it('jaccardFilter drops blocks below the jc:f: floor', async () => {
    const adapter = makeAdapter(0.5)
    const { genomeRows } = await adapter.getMultiPairFeatures({
      ...ctgA,
      start: 0,
      end: 5000,
    })
    // hap2#1's reverse block has jc:f:0.08 and is dropped
    expect(genomeRows.get('hap2#1')!.length).toBe(1)
    expect(genomeRows.get('hap2#1')!.every(f => f.strand === 1)).toBe(true)
  })

  it('region filtering only returns overlapping blocks', async () => {
    const adapter = makeAdapter()
    const { genomeRows } = await adapter.getMultiPairFeatures({
      ...ctgA,
      start: 1000,
      end: 1600,
    })
    expect(genomeRows.get('hap1#1')!.length).toBe(1)
    expect(genomeRows.get('hap1#1')![0]!.start).toBe(1000)
    expect(genomeRows.has('hap2#1')).toBe(false)
  })

  it('resolves a subwalk-suffixed PanSN target name (volvox#0#ctgB:0-6079)', async () => {
    // odgi untangle target names carry a subwalk suffix, e.g.
    // GRCh38#0#chr20:0-64444167 — the bare refName must still resolve.
    const adapter = makeAdapter()
    const { genomeRows } = await adapter.getMultiPairFeatures({
      refName: 'ctgB',
      assemblyName: 'volvox',
      start: 0,
      end: 5000,
    })
    expect([...genomeRows.keys()]).toEqual(['hap1#1'])
    expect(genomeRows.get('hap1#1')![0]!.identity).toBeCloseTo(1)
  })

  it('getMultiPairFeatures returns empty rows for a region with no blocks', async () => {
    const adapter = makeAdapter()
    const { genomeRows } = await adapter.getMultiPairFeatures({
      ...ctgA,
      start: 40000,
      end: 45000,
    })
    expect(genomeRows.size).toBe(0)
  })

  it('getFeatures emits reference-perspective SyntenyFeatures', async () => {
    const adapter = makeAdapter()
    const features = adapter.getFeatures({
      ...ctgA,
      start: 0,
      end: 600,
    })
    const arr = await firstValueFrom(features.pipe(toArray()))
    expect(arr.length).toBe(2)
    const f = arr[0]!
    expect(f.get('refName')).toBe('ctgA')
    expect(f.get('assemblyName')).toBe('volvox')
    expect(f.get('start')).toBe(0)
    expect(f.get('end')).toBe(500)
    const mate = f.get('mate')
    expect(mate.refName).toBe('hap1#1#ctg1')
    expect(mate.assemblyName).toBe('hap1#1')
  })
})
