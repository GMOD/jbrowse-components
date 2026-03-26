import fs from 'fs'

import Adapter from './GfaTabixAdapter.ts'
import MyConfigSchema from './configSchema.ts'
import { parseSegmentsBinary } from './gfaBinaryIO.ts'

function makeAdapter(
  prefix: string,
  opts?: { assemblyNameMap?: Record<string, string> },
) {
  const hasEdges = fs.existsSync(`${prefix}.edges.bin`)
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
      segmentsLocation: {
        localPath: `${prefix}.segments.bin`,
        locationType: 'LocalPathLocation',
      },
      segmentsIdxLocation: {
        localPath: `${prefix}.segments.idx`,
        locationType: 'LocalPathLocation',
      },
      ...(hasEdges
        ? {
            edgesLocation: {
              localPath: `${prefix}.edges.bin`,
              locationType: 'LocalPathLocation',
            },
            edgesIdxLocation: {
              localPath: `${prefix}.edges.idx`,
              locationType: 'LocalPathLocation',
            },
          }
        : {}),
      ...(opts?.assemblyNameMap
        ? { assemblyNameMap: opts.assemblyNameMap }
        : {}),
    }),
  )
}

const prefix = require
  .resolve('../../../../test_data/volvox/synthetic_4genome.pos.bed.gz')
  .replace('.pos.bed.gz', '')

describe('GfaTabixAdapter', () => {
  it('getMultiPairFeatures returns features for all genomes', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    expect(result.genomeRows.size).toBeGreaterThanOrEqual(1)

    for (const [genomeName, features] of result.genomeRows) {
      expect(features.length).toBeGreaterThan(0)
      for (const f of features) {
        expect(f.queryGenome).toBe(genomeName)
        expect(f.start).toBeGreaterThanOrEqual(0)
        expect(f.end).toBeGreaterThan(f.start)
        expect(f.mateStart).toBeGreaterThanOrEqual(0)
        expect(f.mateEnd).toBeGreaterThan(f.mateStart)
      }
    }
  })

  it('all genomes share the first segment starting at offset 0', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 50000,
      assemblyName: 'ref#1',
    })

    for (const features of result.genomeRows.values()) {
      const atZero = features.filter(f => f.start === 0)
      expect(atZero.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('returns empty for non-overlapping region', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 99999999,
      end: 100000000,
      assemblyName: 'ref#1',
    })

    expect(result.genomeRows.size).toBe(0)
  })

  it('returns empty for nonexistent refName', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getMultiPairFeatures({
      refName: 'nonexistent',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    expect(result.genomeRows.size).toBe(0)
  })

  it('features have unique featureIds', async () => {
    const adapter = makeAdapter(prefix)
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
    const adapter = makeAdapter(prefix)
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

  it('getAssemblyNamesFromHeader derives names from file header', async () => {
    const adapter = makeAdapter(prefix)
    const names = await adapter.getAssemblyNamesFromHeader()
    expect(names.sort()).toEqual(
      ['ref#1', 'sample1#1', 'sample2#1', 'sample3#1'].sort(),
    )
  })

  it('start/end are in reference coordinate space when querying from ref#1', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    // ref#1 chr1 = 5472117bp (from #sizes header)
    for (const [, features] of result.genomeRows) {
      for (const f of features) {
        expect(f.start).toBeGreaterThanOrEqual(0)
        expect(f.end).toBeLessThanOrEqual(5472117)
        expect(f.start).toBeLessThan(f.end)
        expect(f.mateStart).toBeLessThan(f.mateEnd)
      }
    }
  })

  it('start/end are in reference coordinate space when querying from sample1#1', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'sample1#1',
    })

    // sample1#1 chr1 = 5485194bp (from #sizes header)
    expect(result.genomeRows.size).toBeGreaterThanOrEqual(1)
    for (const [, features] of result.genomeRows) {
      for (const f of features) {
        expect(f.start).toBeGreaterThanOrEqual(0)
        expect(f.end).toBeLessThanOrEqual(5485194)
        expect(f.start).toBeLessThan(f.end)
        expect(f.mateStart).toBeLessThan(f.mateEnd)
      }
    }
  })

  it('coordinates are reciprocal between ref#1 and sample1#1', async () => {
    const adapter = makeAdapter(prefix)

    const fromRef = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 5500000,
      assemblyName: 'ref#1',
    })

    const fromSample = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 5500000,
      assemblyName: 'sample1#1',
    })

    const sample1FromRef = fromRef.genomeRows.get('sample1#1')
    const refFromSample = fromSample.genomeRows.get('ref#1')
    expect(sample1FromRef).toBeDefined()
    expect(refFromSample).toBeDefined()
    expect(sample1FromRef!.length).toBeGreaterThan(0)
    expect(refFromSample!.length).toBeGreaterThan(0)

    // Find the first feature (at start=0) from each perspective
    const firstFromRef = sample1FromRef!.find(f => f.start === 0)
    const firstFromSample = refFromSample!.find(f => f.start === 0)
    expect(firstFromRef).toBeDefined()
    expect(firstFromSample).toBeDefined()

    // Reciprocal: ref→sample1 start/end should match sample1→ref mate
    expect(firstFromRef!.start).toBe(firstFromSample!.mateStart)
    expect(firstFromRef!.end).toBe(firstFromSample!.mateEnd)
    expect(firstFromRef!.mateStart).toBe(firstFromSample!.start)
    expect(firstFromRef!.mateEnd).toBe(firstFromSample!.end)
  })

  it('features do not exceed reference chromosome length for any genome', async () => {
    const adapter = makeAdapter(prefix)
    const chromSizes = await adapter.getChromSizes()

    // Query from each genome and verify features stay within bounds
    for (const [genome, regions] of chromSizes) {
      const chr1Len = regions.find(r => r.refName === 'chr1')?.length
      if (!chr1Len) {
        continue
      }

      const result = await adapter.getMultiPairFeatures({
        refName: 'chr1',
        start: 0,
        end: chr1Len,
        assemblyName: genome,
      })

      for (const [, features] of result.genomeRows) {
        for (const f of features) {
          expect(f.start).toBeGreaterThanOrEqual(0)
          expect(f.end).toBeLessThanOrEqual(chr1Len)
        }
      }
    }
  })

  it('getChromSizes returns per-genome chromosome sizes from header', async () => {
    const adapter = makeAdapter(prefix)
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
    const adapter = makeAdapter(hprcPrefix)
    const result = await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    })

    expect(result.genomeRows.size).toBe(43)

    let totalFeatures = 0
    for (const features of result.genomeRows.values()) {
      expect(features.length).toBeGreaterThan(0)
      totalFeatures += features.length
    }
    expect(totalFeatures).toBeGreaterThanOrEqual(43)
  })

  it('getChromSizes returns sizes for all 44 genomes', async () => {
    const adapter = makeAdapter(hprcPrefix)
    const chromSizes = await adapter.getChromSizes()

    expect(chromSizes.size).toBe(44)
    const grch38 = chromSizes.get('GRCh38#0')
    expect(grch38).toBeDefined()
    expect(grch38![0]!.refName).toBe('chrM')
    expect(grch38![0]!.length).toBe(16569)
  })

  it('merges adjacent segments into larger blocks', async () => {
    const adapter = makeAdapter(hprcPrefix)
    const result = await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    })

    // With 1393 segments and 43 non-ref genomes, unmerged would give
    // ~hundreds of features per genome. Merged should be much fewer.
    for (const [, features] of result.genomeRows) {
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
    const adapter = makeAdapter(hprcPrefix)
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

  it('mid-region query returns subset of features', async () => {
    const adapter = makeAdapter(hprcPrefix)
    const full = await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    })
    const mid = await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 5000,
      end: 10000,
      assemblyName: 'GRCh38#0',
    })

    // Mid-region should return fewer or equal features per genome
    for (const [genome, midFeatures] of mid.genomeRows) {
      const fullFeatures = full.genomeRows.get(genome)!
      expect(midFeatures.length).toBeLessThanOrEqual(fullFeatures.length)

      // All mid features should be within the query bounds or overlap them
      for (const f of midFeatures) {
        expect(f.end).toBeGreaterThan(5000)
        expect(f.start).toBeLessThan(10000)
      }
    }
  })

  it('snapshot: features at chrM:8000-9000 are stable', async () => {
    const adapter = makeAdapter(hprcPrefix)
    const result = await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 8000,
      end: 9000,
      assemblyName: 'GRCh38#0',
    })

    expect(result.genomeRows.size).toBeGreaterThan(0)

    const chm13 = result.genomeRows.get('CHM13#0')
    expect(chm13).toBeDefined()
    expect(chm13!.length).toBeGreaterThan(0)

    // Snapshot first CHM13 feature's structure
    const f = chm13![0]!
    expect(f.start).toBeLessThanOrEqual(8000)
    expect(f.end).toBeGreaterThanOrEqual(9000)
    expect(f.strand).toBe(1)
    expect(f.mateRefName).toBe('chrM')
    expect(f.identity).toBeGreaterThan(0.9)
  })

  it('reciprocal query from non-reference genome', async () => {
    const adapter = makeAdapter(hprcPrefix)

    // Query from CHM13 instead of GRCh38
    const result = await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'CHM13#0',
    })

    // Should find GRCh38 as one of the query genomes
    expect(result.genomeRows.has('GRCh38#0')).toBe(true)
    const grch38Features = result.genomeRows.get('GRCh38#0')!
    expect(grch38Features.length).toBeGreaterThan(0)
  })
})

describe('assemblyNameMap remapping', () => {
  it('remaps genome names in feature results', async () => {
    const adapter = makeAdapter(prefix, {
      assemblyNameMap: { 'sample1#1': 'sampleOne' },
    })
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    expect(result.genomeRows.has('sampleOne')).toBe(true)
    expect(result.genomeRows.has('sample1#1')).toBe(false)

    // Unmapped genomes keep original names
    expect(result.genomeRows.has('sample2#1')).toBe(true)
  })

  it('remaps genome names in chromSizes', async () => {
    const adapter = makeAdapter(prefix, {
      assemblyNameMap: { 'ref#1': 'myRef' },
    })
    const chromSizes = await adapter.getChromSizes()
    expect(chromSizes.has('myRef')).toBe(true)
    expect(chromSizes.has('ref#1')).toBe(false)
  })

  it('remaps genome names in getAssemblyNamesFromHeader', async () => {
    const adapter = makeAdapter(prefix, {
      assemblyNameMap: {
        'ref#1': 'refGenome',
        'sample1#1': 'sOne',
      },
    })
    const names = await adapter.getAssemblyNamesFromHeader()
    expect(names).toContain('refGenome')
    expect(names).toContain('sOne')
    expect(names).not.toContain('ref#1')
    expect(names).not.toContain('sample1#1')
    // Unmapped stay as-is
    expect(names).toContain('sample2#1')
  })
})

describe('getSources', () => {
  it('returns genome names from header', async () => {
    const adapter = makeAdapter(prefix)
    const sources = await adapter.getSources()
    expect(sources.map(s => s.name).sort()).toEqual(
      ['ref#1', 'sample1#1', 'sample2#1', 'sample3#1'].sort(),
    )
  })

  it('returns remapped names when assemblyNameMap is set', async () => {
    const adapter = makeAdapter(prefix, {
      assemblyNameMap: { 'ref#1': 'myRef', 'sample1#1': 'sOne' },
    })
    const sources = await adapter.getSources()
    const names = sources.map(s => s.name)
    expect(names).toContain('myRef')
    expect(names).toContain('sOne')
    expect(names).not.toContain('ref#1')
    expect(names).not.toContain('sample1#1')
    expect(names).toContain('sample2#1')
  })

  it('genomeRows keys match getSources names', async () => {
    const adapter = makeAdapter(prefix)
    const sources = await adapter.getSources()
    const sourceNames = new Set(sources.map(s => s.name))

    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    for (const genomeName of result.genomeRows.keys()) {
      expect(sourceNames.has(genomeName)).toBe(true)
    }
  })

  it('genomeRows keys match getSources names with assemblyNameMap', async () => {
    const adapter = makeAdapter(prefix, {
      assemblyNameMap: {
        'sample1#1': 'sOne',
        'sample2#1': 'sTwo',
        'sample3#1': 'sThree',
      },
    })
    const sources = await adapter.getSources()
    const sourceNames = new Set(sources.map(s => s.name))

    // Query uses the original assembly name (assemblyNameMap only remaps
    // output genome names, not the query assembly)
    const result = await adapter.getMultiPairFeatures({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    for (const genomeName of result.genomeRows.keys()) {
      expect(sourceNames.has(genomeName)).toBe(true)
    }
    expect(result.genomeRows.has('sOne')).toBe(true)
    expect(result.genomeRows.has('sample1#1')).toBe(false)
  })
})

describe('getSources HPRC chrM', () => {
  it('returns all 44 genomes', async () => {
    const adapter = makeAdapter(hprcPrefix)
    const sources = await adapter.getSources()
    expect(sources.length).toBe(44)
    expect(sources.map(s => s.name)).toContain('GRCh38#0')
    expect(sources.map(s => s.name)).toContain('CHM13#0')
  })

  it('genomeRows keys are a subset of getSources names', async () => {
    const adapter = makeAdapter(hprcPrefix)
    const sources = await adapter.getSources()
    const sourceNames = new Set(sources.map(s => s.name))

    const result = await adapter.getMultiPairFeatures({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    })

    for (const genomeName of result.genomeRows.keys()) {
      expect(sourceNames.has(genomeName)).toBe(true)
    }
  })
})

describe('parseSegmentsBinary', () => {
  it('parses binary records correctly', () => {
    // Build two 15-byte binary records
    const buf = new ArrayBuffer(30)
    const dv = new DataView(buf)
    const bytes = new Uint8Array(buf)

    // Record 0: segOrd=100, pathNameIdx=2, offset=5000, segLen=300, orient='+'
    dv.setUint32(0, 100, true)
    dv.setUint16(4, 2, true)
    dv.setUint32(6, 5000, true)
    dv.setUint32(10, 300, true)
    bytes[14] = 43 // '+'

    // Record 1: segOrd=200, pathNameIdx=0, offset=6000, segLen=400, orient='-'
    dv.setUint32(15, 200, true)
    dv.setUint16(19, 0, true)
    dv.setUint32(21, 6000, true)
    dv.setUint32(25, 400, true)
    bytes[29] = 45 // '-'

    const records = parseSegmentsBinary(bytes)

    expect(records.length).toBe(2)
    expect(records[0]).toEqual({
      segOrd: 100,
      pathNameIdx: 2,
      offset: 5000,
      segLen: 300,
      orient: 43,
    })
    expect(records[1]).toEqual({
      segOrd: 200,
      pathNameIdx: 0,
      offset: 6000,
      segLen: 400,
      orient: 45,
    })
  })

  it('handles empty input', () => {
    const bytes = new Uint8Array(0)
    const records = parseSegmentsBinary(bytes)
    expect(records.length).toBe(0)
  })
})

describe('GfaTabixAdapter getSubgraph', () => {
  it('returns GFA text for a valid region', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    expect(result).toBeTruthy()
    const lines = result.split('\n')
    const header = lines.filter(l => l.startsWith('H\t'))
    const segments = lines.filter(l => l.startsWith('S\t'))
    const links = lines.filter(l => l.startsWith('L\t'))

    expect(header.length).toBe(1)
    expect(segments.length).toBeGreaterThan(0)
    expect(links.length).toBeGreaterThan(0)
    // Edge-based approach emits S+L only (no P-lines)
  })

  it('returns empty for non-overlapping region', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 99999999,
      end: 100000000,
      assemblyName: 'ref#1',
    })

    expect(result).toBe('')
  })

  it('returns empty for nonexistent refName', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getSubgraph({
      refName: 'nonexistent',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    expect(result).toBe('')
  })

  it('output GFA has valid links referencing existing segments', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 50000,
      assemblyName: 'ref#1',
    })

    expect(result).toBeTruthy()
    const lines = result.split('\n')
    const segIds = new Set(
      lines.filter(l => l.startsWith('S\t')).map(l => l.split('\t')[1]),
    )
    const links = lines.filter(l => l.startsWith('L\t'))

    for (const link of links) {
      const cols = link.split('\t')
      expect(segIds.has(cols[1])).toBe(true)
      expect(segIds.has(cols[3])).toBe(true)
    }
  })

  it('output GFA paths reference existing segments', async () => {
    const adapter = makeAdapter(prefix)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 50000,
      assemblyName: 'ref#1',
    })

    expect(result).toBeTruthy()
    const lines = result.split('\n')
    const segIds = new Set(
      lines.filter(l => l.startsWith('S\t')).map(l => l.split('\t')[1]),
    )
    const paths = lines.filter(l => l.startsWith('P\t'))

    for (const path of paths) {
      const cols = path.split('\t')
      const segs = cols[2]!.split(',').map(s => s.slice(0, -1))
      for (const seg of segs) {
        expect(segIds.has(seg)).toBe(true)
      }
    }
  })

  it('larger region returns more segments than smaller region', async () => {
    const adapter = makeAdapter(prefix)
    const small = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 10000,
      assemblyName: 'ref#1',
    })
    const large = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 100000,
      assemblyName: 'ref#1',
    })

    const smallSegs = small.split('\n').filter(l => l.startsWith('S\t')).length
    const largeSegs = large.split('\n').filter(l => l.startsWith('S\t')).length

    expect(largeSegs).toBeGreaterThanOrEqual(smallSegs)
  })
})

describe('GfaTabixAdapter HPRC getSubgraph', () => {
  it('returns GFA for chrM full region', async () => {
    const adapter = makeAdapter(hprcPrefix)
    const result = await adapter.getSubgraph({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    })

    expect(result).toBeTruthy()
    const lines = result.split('\n')
    const segments = lines.filter(l => l.startsWith('S\t'))
    const links = lines.filter(l => l.startsWith('L\t'))

    expect(segments.length).toBeGreaterThan(0)
    expect(links.length).toBeGreaterThan(0)
  })

  it('returns GFA for partial chrM region', async () => {
    const adapter = makeAdapter(hprcPrefix)
    const result = await adapter.getSubgraph({
      refName: 'chrM',
      start: 5000,
      end: 10000,
      assemblyName: 'GRCh38#0',
    })

    expect(result).toBeTruthy()
    const lines = result.split('\n')
    const segments = lines.filter(l => l.startsWith('S\t'))
    expect(segments.length).toBeGreaterThan(0)

    // Partial should have fewer segments than full
    const full = await adapter.getSubgraph({
      refName: 'chrM',
      start: 0,
      end: 16569,
      assemblyName: 'GRCh38#0',
    })
    const fullSegs = full.split('\n').filter(l => l.startsWith('S\t')).length
    expect(segments.length).toBeLessThanOrEqual(fullSegs)
  })
})

// Note: aln.bed.gz e2e tests removed — the Rust converter does not produce
// aln files. The adapter's aln code path is tested via pre-generated fixtures
// if available.
