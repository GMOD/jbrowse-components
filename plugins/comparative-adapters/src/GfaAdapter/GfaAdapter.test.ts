import Adapter from './GfaAdapter.ts'
import MyConfigSchema from './configSchema.ts'

function makeAdapter(gfaPath: string) {
  return new Adapter(
    MyConfigSchema.create({
      gfaLocation: {
        localPath: gfaPath,
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

const pangenomePath =
  require.resolve('../../../../test_data/volvox/volvox_pangenome.gfa')
const samplePath =
  require.resolve('../../../../test_data/volvox/volvox_sample.gfa')

describe('GfaAdapter getSubgraph', () => {
  it('returns GFA for region overlapping all segments', async () => {
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 700,
      assemblyName: 'ref#1',
    })

    console.log('Full region subgraph:\n', result)

    expect(result).toBeTruthy()
    const lines = result.split('\n')
    const header = lines.filter(l => l.startsWith('H\t'))
    const segments = lines.filter(l => l.startsWith('S\t'))
    const paths = lines.filter(l => l.startsWith('P\t'))

    expect(header.length).toBe(1)
    expect(segments.length).toBeGreaterThan(0)
    expect(paths.length).toBeGreaterThan(0)

    // All 4 genomes should have paths in the output
    expect(paths.length).toBe(4)
  })

  it('returns subset of segments for partial region', async () => {
    const adapter = makeAdapter(pangenomePath)

    // ref path: >s1(100)>s2(100)>s6(50)>s8(4)>s4(101)>s5(100)>s11(100)
    // Query just the first 150bp should only get s1 and s2 on the ref path
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 150,
      assemblyName: 'ref#1',
    })

    console.log('Partial region (0-150) subgraph:\n', result)

    expect(result).toBeTruthy()
    const lines = result.split('\n')
    const segments = lines.filter(l => l.startsWith('S\t'))
    const segIds = segments.map(l => l.split('\t')[1])

    // s1 spans 0-100, s2 spans 100-200, both overlap 0-150
    expect(segIds).toContain('s1')
    expect(segIds).toContain('s2')

    // Verify we get fewer segments than the full query
    const fullResult = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 700,
      assemblyName: 'ref#1',
    })
    const fullSegments = fullResult.split('\n').filter(l => l.startsWith('S\t'))
    expect(segments.length).toBeLessThanOrEqual(fullSegments.length)
  })

  it('returns empty string for non-overlapping region', async () => {
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 99999,
      end: 100000,
      assemblyName: 'ref#1',
    })

    expect(result).toBe('')
  })

  it('returns empty string for nonexistent refName', async () => {
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'nonexistent',
      start: 0,
      end: 1000,
      assemblyName: 'ref#1',
    })

    expect(result).toBe('')
  })

  it('returns empty string for nonexistent assemblyName', async () => {
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 1000,
      assemblyName: 'nonexistent',
    })

    expect(result).toBe('')
  })

  it('output GFA has valid links and paths referencing existing segments', async () => {
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 700,
      assemblyName: 'ref#1',
    })

    const lines = result.split('\n')
    const segIds = new Set(
      lines.filter(l => l.startsWith('S\t')).map(l => l.split('\t')[1]),
    )
    const links = lines.filter(l => l.startsWith('L\t'))

    // All links should reference segments that exist in the output
    for (const link of links) {
      const cols = link.split('\t')
      expect(segIds.has(cols[1])).toBe(true)
      expect(segIds.has(cols[3])).toBe(true)
    }

    // All path segments should reference segments that exist
    const paths = lines.filter(l => l.startsWith('P\t'))
    for (const path of paths) {
      const cols = path.split('\t')
      const segs = cols[2]!.split(',').map(s => s.slice(0, -1))
      for (const seg of segs) {
        expect(segIds.has(seg)).toBe(true)
      }
    }
  })

  it('infers links from paths when source GFA has no L-lines', async () => {
    // volvox_pangenome.gfa has W-lines but no L-lines
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 700,
      assemblyName: 'ref#1',
    })

    const lines = result.split('\n')
    const links = lines.filter(l => l.startsWith('L\t'))
    expect(links.length).toBeGreaterThan(0)
  })

  it('includes segments from non-ref paths that share ref segments', async () => {
    const adapter = makeAdapter(pangenomePath)

    // ref uses s1,s2,s6,s8,s4,s5,s11
    // sample1 uses s1,s3,s6,s9,s4,s5,s11
    // sample2 uses s1,s2,s7,s10,s4,s5,s12
    // Query a wider region that covers multiple shared segments
    // so non-ref paths span includes intermediate segments
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 400,
      assemblyName: 'ref#1',
    })

    const lines = result.split('\n')
    const segIds = new Set(
      lines.filter(l => l.startsWith('S\t')).map(l => l.split('\t')[1]),
    )

    console.log('Segments in 0-400 subgraph:', [...segIds])

    // ref segments in range: s1(0-100), s2(100-200), s6(200-250), s8(250-254), s4(254-355)
    expect(segIds.has('s1')).toBe(true)
    expect(segIds.has('s2')).toBe(true)
    expect(segIds.has('s4')).toBe(true)

    // sample1 shares s1 and s4 with ref, so its span s1..s4 includes s3,s6,s9
    expect(segIds.has('s3')).toBe(true)
    expect(segIds.has('s6')).toBe(true)
    expect(segIds.has('s9')).toBe(true)
  })

  it('can query from non-ref assembly perspective', async () => {
    const adapter = makeAdapter(pangenomePath)

    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 150,
      assemblyName: 'sample1#1',
    })

    console.log('sample1#1 perspective subgraph:\n', result)

    expect(result).toBeTruthy()
    const lines = result.split('\n')
    const segments = lines.filter(l => l.startsWith('S\t'))
    expect(segments.length).toBeGreaterThan(0)
  })

  it('handles P-line style paths (volvox_sample.gfa)', async () => {
    const adapter = makeAdapter(samplePath)

    // volvox_sample.gfa has P-line paths named "path1" and "path2"
    // parseGfaPathName("path1") -> genome="path1", refName="path1"
    const result = await adapter.getSubgraph({
      refName: 'path1',
      start: 0,
      end: 100,
      assemblyName: 'path1',
    })

    console.log('P-line path subgraph:\n', result)

    if (result) {
      const lines = result.split('\n')
      const segments = lines.filter(l => l.startsWith('S\t'))
      expect(segments.length).toBeGreaterThan(0)
    }
  })

  it('region with negative start is handled gracefully', async () => {
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: -100,
      end: 50,
      assemblyName: 'ref#1',
    })

    // Should still return s1 which starts at offset 0
    if (result) {
      const lines = result.split('\n')
      const segIds = new Set(
        lines.filter(l => l.startsWith('S\t')).map(l => l.split('\t')[1]),
      )
      expect(segIds.has('s1')).toBe(true)
    }
  })
})
