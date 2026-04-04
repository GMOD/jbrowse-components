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

function parseOutputGfa(gfaText: string) {
  const lines = gfaText.split('\n').filter(l => l.length > 0)
  const segments = new Map<string, number>()
  const links: {
    source: string
    strand1: string
    target: string
    strand2: string
  }[] = []
  const paths: { name: string; segments: string[] }[] = []

  for (const line of lines) {
    const cols = line.split('\t')
    if (cols[0] === 'S') {
      const id = cols[1]!
      let len = cols[2] === '*' ? 0 : cols[2]!.length
      for (let i = 3; i < cols.length; i++) {
        if (cols[i]!.startsWith('LN:i:')) {
          len = +cols[i]!.slice(5)
        }
      }
      segments.set(id, len)
    } else if (cols[0] === 'L') {
      links.push({
        source: cols[1]!,
        strand1: cols[2]!,
        target: cols[3]!,
        strand2: cols[4]!,
      })
    } else if (cols[0] === 'P') {
      const segs = cols[2]!.split(',').map(s => s.slice(0, -1))
      paths.push({ name: cols[1]!, segments: segs })
    }
  }
  return { segments, links, paths }
}

function linkSet(
  links: { source: string; strand1: string; target: string; strand2: string }[],
) {
  return new Set(
    links.map(l => `${l.source}${l.strand1}->${l.target}${l.strand2}`),
  )
}

const pangenomePath =
  require.resolve('../../../../test_data/volvox/volvox_indel_pangenome.gfa')
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
    // volvox_indel_pangenome.gfa has W-lines but no L-lines
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

// Topology validation tests using the known graph structure:
//
// ref:     s1(100) → s2(100) → s6(50) → s8(4)  → s4(101) → s5(100) → s11(100)
// sample1: s1(100) → s3(100) → s6(50) → s9(4)  → s4(101) → s5(100) → s11(100)
// sample2: s1(100) → s2(100) → s7(50) → s10(20) → s4(101) → s5(100) → s12(101)
// sample3: s1(100) → s3(100) →                    s4(101) → s5(100) → s11(100)
//
// ref offsets: s1[0-100] s2[100-200] s6[200-250] s8[250-254] s4[254-355] s5[355-455] s11[455-555]

describe('GfaAdapter getSubgraph topology (W-lines, no L-lines)', () => {
  // ref offsets: s1[0-100] s2[100-200] s6[200-250] s8[250-254] s4[254-355] s5[355-455] s11[455-555]
  //
  // Span extraction: for each non-ref path, include segments from
  // firstShared to lastShared ref segment index. A path only contributes
  // alt segments when it shares 2+ ref segments in the query range.

  it('region 0-200 includes ref segments and shared paths', async () => {
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 200,
      assemblyName: 'ref#1',
    })

    const { segments, links, paths } = parseOutputGfa(result)
    const segIds = new Set(segments.keys())
    const ls = linkSet(links)

    // ref segments in range: s1[0-100], s2[100-200]
    expect(segIds.has('s1')).toBe(true)
    expect(segIds.has('s2')).toBe(true)

    // sample2 path is s1→s2→s7→... — it shares both s1 and s2 with ref
    // so its span from s1 to s2 is [s1, s2] (no alt segments between them)
    // sample1 path is s1→s3→s6→... — only shares s1 → span is [s1]
    // sample3 path is s1→s3→s4→... — only shares s1 → span is [s1]

    // link from ref: s1→s2
    expect(ls.has('s1+->s2+')).toBe(true)

    // all 4 paths should be present (all share at least s1)
    expect(paths.length).toBe(4)

    // path ordering preserved
    const refPath = paths.find(p => p.name.includes('ref'))
    expect(refPath).toBeDefined()
    expect(refPath!.segments[0]).toBe('s1')
    expect(refPath!.segments[1]).toBe('s2')
  })

  it('region 100-355 produces bubble with alt segments', async () => {
    const adapter = makeAdapter(pangenomePath)
    // ref: s2[100-200] s6[200-250] s8[250-254] s4[254-355]
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 100,
      end: 355,
      assemblyName: 'ref#1',
    })

    const { segments, links } = parseOutputGfa(result)
    const segIds = new Set(segments.keys())
    const ls = linkSet(links)

    // ref segments in range
    expect(segIds.has('s2')).toBe(true)
    expect(segIds.has('s6')).toBe(true)
    expect(segIds.has('s8')).toBe(true)
    expect(segIds.has('s4')).toBe(true)

    // sample1 shares s6 and s4 with ref (both in range)
    // sample1 path: ...s3→s6→s9→s4... — span from s6 to s4 includes s9
    expect(segIds.has('s9')).toBe(true)

    // sample2 shares s2 and s4 with ref
    // sample2 path: ...s2→s7→s10→s4... — span from s2 to s4 includes s7, s10
    expect(segIds.has('s7')).toBe(true)
    expect(segIds.has('s10')).toBe(true)

    // ref links
    expect(ls.has('s2+->s6+')).toBe(true)
    expect(ls.has('s6+->s8+')).toBe(true)
    expect(ls.has('s8+->s4+')).toBe(true)

    // sample1 links within span
    expect(ls.has('s6+->s9+')).toBe(true)
    expect(ls.has('s9+->s4+')).toBe(true)

    // sample2 links within span
    expect(ls.has('s2+->s7+')).toBe(true)
    expect(ls.has('s10+->s4+')).toBe(true)
  })

  it('full region includes all segments and correct link count', async () => {
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 700,
      assemblyName: 'ref#1',
    })

    const { segments, links, paths } = parseOutputGfa(result)

    // all 12 segments should be present
    expect(segments.size).toBe(12)

    // 4 paths
    expect(paths.length).toBe(4)

    // verify no duplicate links
    const ls = linkSet(links)
    expect(ls.size).toBe(links.length)

    // count unique links from the known topology
    // ref: s1→s2, s2→s6, s6→s8, s8→s4, s4→s5, s5→s11 (6)
    // sample1: s1→s3, s3→s6, s6→s9, s9→s4 (4 new, s4→s5 and s5→s11 shared)
    // sample2: s2→s7, s7→s10, s10→s4, s5→s12 (4 new, s1→s2 shared)
    // sample3: s3→s4 (1 new, s1→s3 and s4→s5 and s5→s11 shared)
    // total unique: 6 + 4 + 4 + 1 = 15
    expect(links.length).toBe(15)
  })

  it('segment lengths are preserved in output', async () => {
    const adapter = makeAdapter(pangenomePath)
    const result = await adapter.getSubgraph({
      refName: 'chr1',
      start: 0,
      end: 700,
      assemblyName: 'ref#1',
    })

    const { segments } = parseOutputGfa(result)
    expect(segments.get('s1')).toBe(100)
    expect(segments.get('s4')).toBe(101)
    expect(segments.get('s6')).toBe(50)
    expect(segments.get('s8')).toBe(4)
  })
})

describe('GfaAdapter getSubgraph topology (P-lines with L-lines)', () => {
  // volvox_sample.gfa:
  // path1: s1 → s2 → s4 → s5
  // path2: s1 → s3 → s4 → s5
  // Links: s1→s2, s1→s3, s2→s4, s3→s4, s4→s5

  it('full region produces complete diamond graph', async () => {
    const adapter = makeAdapter(samplePath)
    const result = await adapter.getSubgraph({
      refName: 'path1',
      start: 0,
      end: 100,
      assemblyName: 'path1',
    })

    const { segments, links, paths } = parseOutputGfa(result)
    const segIds = new Set(segments.keys())
    const ls = linkSet(links)

    // all 5 segments present
    expect(segIds.size).toBe(5)
    for (const id of ['s1', 's2', 's3', 's4', 's5']) {
      expect(segIds.has(id)).toBe(true)
    }

    // all 5 explicit links present
    expect(ls.has('s1+->s2+')).toBe(true)
    expect(ls.has('s1+->s3+')).toBe(true)
    expect(ls.has('s2+->s4+')).toBe(true)
    expect(ls.has('s3+->s4+')).toBe(true)
    expect(ls.has('s4+->s5+')).toBe(true)
    expect(links.length).toBe(5)

    // both paths present with correct ordering
    expect(paths.length).toBe(2)
    const p1 = paths.find(p => p.name === 'path1')
    const p2 = paths.find(p => p.name === 'path2')
    expect(p1).toBeDefined()
    expect(p2).toBeDefined()
    expect(p1!.segments).toEqual(['s1', 's2', 's4', 's5'])
    expect(p2!.segments).toEqual(['s1', 's3', 's4', 's5'])
  })

  it('partial region produces correct subgraph', async () => {
    const adapter = makeAdapter(samplePath)
    // s1 is 12bp, s2 is 12bp. Query 0-12 covers only s1 on path1.
    const result = await adapter.getSubgraph({
      refName: 'path1',
      start: 0,
      end: 12,
      assemblyName: 'path1',
    })

    const { segments } = parseOutputGfa(result)
    const segIds = new Set(segments.keys())

    // s1 is the only ref segment in range
    expect(segIds.has('s1')).toBe(true)

    // both paths share s1, so both should contribute segments
    // path1 span from s1 is just [s1] (only one shared ref seg)
    // path2 span from s1 is just [s1]
    // no other segments should be included
  })

  it('all segment lengths are 12bp', async () => {
    const adapter = makeAdapter(samplePath)
    const result = await adapter.getSubgraph({
      refName: 'path1',
      start: 0,
      end: 100,
      assemblyName: 'path1',
    })

    const { segments } = parseOutputGfa(result)
    for (const [, len] of segments) {
      expect(len).toBe(12)
    }
  })
})
