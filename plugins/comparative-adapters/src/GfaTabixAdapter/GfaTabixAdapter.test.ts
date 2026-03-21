import Adapter from './GfaTabixAdapter.ts'
import MyConfigSchema from './configSchema.ts'

function makeAdapter(prefix: string, assemblyNames: string[]) {
  return new Adapter(
    MyConfigSchema.create({
      posLocation: {
        localPath: `${prefix}.pos.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      posIndex: {
        location: {
          localPath: `${prefix}.pos.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      segsLocation: {
        localPath: `${prefix}.segs.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      segsIndex: {
        location: {
          localPath: `${prefix}.segs.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      assemblyNames,
    }),
  )
}

const prefix = require.resolve(
  '../../../../test_data/volvox/synthetic_4genome.pos.bed.gz',
).replace('.pos.bed.gz', '')

describe('GfaTabixAdapter', () => {
  it('getMultiPairFeatures returns features for all genomes', async () => {
    const adapter = makeAdapter(prefix, [
      'ref#1',
      'sample1#1',
      'sample2#1',
      'sample3#1',
    ])
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    expect(result.genomeNames.length).toBeGreaterThanOrEqual(1)
    expect(result.genomeRows.size).toBeGreaterThanOrEqual(1)

    for (const [genomeName, features] of result.genomeRows) {
      expect(features.length).toBeGreaterThan(0)
      for (const f of features) {
        expect(f.queryGenome).toBe(genomeName)
        expect(f.start).toBeGreaterThanOrEqual(0)
        expect(f.end).toBeGreaterThan(f.start)
        expect(f.mateStart).toBeGreaterThanOrEqual(0)
        expect(f.mateEnd).toBeGreaterThan(f.mateStart)
        expect(f.segmentId).toBeDefined()
      }
    }
  })

  it('returns shared segments with correct segmentId', async () => {
    const adapter = makeAdapter(prefix, [
      'ref#1',
      'sample1#1',
      'sample2#1',
      'sample3#1',
    ])
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 50000,
      assemblyName: 'ref#1',
    })

    // All genomes should share the first segment (s0)
    for (const features of result.genomeRows.values()) {
      const s0Features = features.filter(f => f.segmentId === 's0')
      expect(s0Features.length).toBeGreaterThanOrEqual(1)
      expect(s0Features[0]!.start).toBe(0)
    }
  })

  it('returns empty for non-overlapping region', async () => {
    const adapter = makeAdapter(prefix, ['ref#1', 'sample1#1'])
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 99999999,
      end: 100000000,
      assemblyName: 'ref#1',
    })

    expect(result.genomeNames.length).toBe(0)
  })

  it('returns empty for nonexistent refName', async () => {
    const adapter = makeAdapter(prefix, ['ref#1', 'sample1#1'])
    const result = await adapter.getMultiPairFeatures({
      refName: 'nonexistent',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    expect(result.genomeNames.length).toBe(0)
  })

  it('features have unique featureIds', async () => {
    const adapter = makeAdapter(prefix, [
      'ref#1',
      'sample1#1',
      'sample2#1',
      'sample3#1',
    ])
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    const ids = new Set<string>()
    for (const features of result.genomeRows.values()) {
      for (const f of features) {
        expect(ids.has(f.featureId)).toBe(false)
        ids.add(f.featureId)
      }
    }
  })

  it('strand is correct for same-orientation segments', async () => {
    const adapter = makeAdapter(prefix, ['ref#1', 'sample1#1'])
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 50000,
      assemblyName: 'ref#1',
    })

    const features = result.genomeRows.get('sample1#1') ?? []
    // Synthetic GFA has all forward-oriented segments
    for (const f of features) {
      expect(f.strand).toBe(1)
    }
  })

  it('getAssemblyNames returns configured names', () => {
    const adapter = makeAdapter(prefix, ['ref#1', 'sample1#1'])
    expect(adapter.getAssemblyNames()).toEqual(['ref#1', 'sample1#1'])
  })

  it('getChromSizes returns per-genome chromosome sizes from header', async () => {
    const adapter = makeAdapter(prefix, [
      'ref#1',
      'sample1#1',
      'sample2#1',
      'sample3#1',
    ])
    const chromSizes = await adapter.getChromSizes()

    // Regenerated test data should have sizes header
    expect(chromSizes.size).toBe(4)
    for (const [genome, regions] of chromSizes) {
      expect(genome).toBeTruthy()
      expect(regions.length).toBeGreaterThan(0)
      for (const r of regions) {
        expect(r.refName).toBe('chr1')
        expect(r.length).toBeGreaterThan(5000000)
      }
    }
  })
})

const hprcPrefix = require
  .resolve(
    '../../../../test/data/synteny-demo/hprc/hprc-v1.1-mc-grch38-chrM.pos.bed.gz',
  )
  .replace('.pos.bed.gz', '')

describe('GfaTabixAdapter with HPRC chrM (44 haplotypes)', () => {
  it('returns features for all 43 non-ref genomes', async () => {
    const adapter = makeAdapter(hprcPrefix, ['GRCh38#0'])
    const result = await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    })

    expect(result.genomeNames.length).toBe(43)
    expect(result.genomeRows.size).toBe(43)

    let totalFeatures = 0
    for (const features of result.genomeRows.values()) {
      expect(features.length).toBeGreaterThan(0)
      totalFeatures += features.length
    }
    expect(totalFeatures).toBeGreaterThan(100)
  })

  it('getChromSizes returns sizes for all 44 genomes', async () => {
    const adapter = makeAdapter(hprcPrefix, ['GRCh38#0'])
    const chromSizes = await adapter.getChromSizes()

    expect(chromSizes.size).toBe(44)
    const grch38 = chromSizes.get('GRCh38#0')
    expect(grch38).toBeDefined()
    expect(grch38![0]!.refName).toBe('chrM')
    expect(grch38![0]!.length).toBe(16569)
  })

  it('merges adjacent segments into larger blocks', async () => {
    const adapter = makeAdapter(hprcPrefix, ['GRCh38#0'])
    const result = await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    })

    // With 1393 segments and 43 non-ref genomes, unmerged would give
    // ~hundreds of features per genome. Merged should be much fewer.
    for (const [_genome, features] of result.genomeRows) {
      // CHM13 and most HPRC samples share most of chrM
      // so merged features should be significantly fewer than raw segments
      expect(features.length).toBeLessThan(200)

      // Verify merged features don't overlap on ref axis
      const sorted = [...features].sort((a, b) => a.start - b.start)
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]!.start).toBeGreaterThanOrEqual(sorted[i - 1]!.end)
      }
    }
  })

  it('completes full-chromosome query in under 500ms', async () => {
    const adapter = makeAdapter(hprcPrefix, ['GRCh38#0'])
    const t0 = Date.now()
    await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    })
    const elapsed = Date.now() - t0
    expect(elapsed).toBeLessThan(500)
  })
})

