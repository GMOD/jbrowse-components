import path from 'path'

import Adapter from '../GfaTabixAdapter.ts'
import configSchema from '../configSchema.ts'

const FIXTURES = path.join(__dirname, '../../../../../test_data/chr20_region')

function makeAdapter() {
  return new Adapter(
    configSchema.create({
      posLocation: {
        localPath: `${FIXTURES}.pos.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      posIndex: {
        location: {
          localPath: `${FIXTURES}.pos.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      syntenyLocation: {
        localPath: `${FIXTURES}.synteny.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      syntenyIndex: {
        location: {
          localPath: `${FIXTURES}.synteny.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      edgesLocation: {
        localPath: `${FIXTURES}.edges.spatial.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      edgesIndex: {
        location: {
          localPath: `${FIXTURES}.edges.spatial.bed.gz.tbi`,
          locationType: 'LocalPathLocation',
        },
      },
      seqlensLocation: {
        localPath: `${FIXTURES}.seglens.bin`,
        locationType: 'LocalPathLocation',
      },
    }),
  )
}

// Parse segment ordinals from a GFA string
function parseSegments(gfa: string): number[] {
  const segments = new Set<number>()
  for (const line of gfa.split('\n')) {
    if (line.startsWith('S\t')) {
      const ord = +line.split('\t')[1]!
      segments.add(ord)
    }
  }
  return [...segments].sort((a, b) => a - b)
}

// Parse edges from a GFA string - return edge count
function countEdges(gfa: string): number {
  let count = 0
  for (const line of gfa.split('\n')) {
    if (line.startsWith('L\t')) {
      count++
    }
  }
  return count
}

// Parse walks from a GFA string
function parseWalks(gfa: string): Map<string, number[]> {
  const walks = new Map<string, number[]>()
  for (const line of gfa.split('\n')) {
    if (line.startsWith('W\t')) {
      const cols = line.split('\t')
      const pathName = `${cols[1]}#${cols[3]}`
      const walkStr = cols[6]!
      // Extract ordinals from walk string (>123 format)
      const ordinals = (walkStr.match(/>\d+/g) ?? []).map(s => +s.slice(1))
      walks.set(pathName, ordinals)
    }
  }
  return walks
}

test('getSubgraph_chr20_small_region_produces_segments', async () => {
  const adapter = makeAdapter()
  const region = {
    refName: 'chr20',
    start: 0,
    end: 10000,
    assemblyName: 'CHM13#0',
  }

  const rpcGfa = await adapter.getSubgraph(region)
  const segs = parseSegments(rpcGfa)
  const edgeCount = countEdges(rpcGfa)

  expect(segs.length).toBeGreaterThan(0)
  expect(edgeCount).toBeGreaterThan(0)
  expect(rpcGfa.startsWith('H\tVN:Z:1.1')).toBe(true)
})

test('getSubgraph_chr20_medium_region_produces_graph_structure', async () => {
  const adapter = makeAdapter()
  const region = {
    refName: 'chr20',
    start: 10000,
    end: 50000,
    assemblyName: 'CHM13#0',
  }

  const rpcGfa = await adapter.getSubgraph(region)
  const segs = parseSegments(rpcGfa)

  // Should produce segments for this region
  expect(segs.length).toBeGreaterThan(0)
})

test('getSubgraph_chr20_edges_reference_valid_segments', async () => {
  const adapter = makeAdapter()
  const region = {
    refName: 'chr20',
    start: 0,
    end: 50000,
    assemblyName: 'CHM13#0',
  }

  const rpcGfa = await adapter.getSubgraph(region)
  const segs = parseSegments(rpcGfa)
  const segSet = new Set(segs.map(String))

  // Verify all edge endpoints are valid segments
  for (const line of rpcGfa.split('\n')) {
    if (line.startsWith('L\t')) {
      const cols = line.split('\t')
      const src = cols[1]!
      const tgt = cols[3]!
      expect(segSet.has(src)).toBe(true)
      expect(segSet.has(tgt)).toBe(true)
    }
  }
})

test('getSubgraph_chr20_walks_reference_valid_segments', async () => {
  const adapter = makeAdapter()
  const region = {
    refName: 'chr20',
    start: 0,
    end: 100000,
    assemblyName: 'CHM13#0',
  }

  const rpcGfa = await adapter.getSubgraph(region)
  const segs = parseSegments(rpcGfa)
  const segSet = new Set(segs)
  const walks = parseWalks(rpcGfa)

  // All walk ordinals should reference valid segments
  for (const [, ordinals] of walks) {
    for (const ord of ordinals) {
      expect(segSet.has(ord)).toBe(true)
    }
  }
})

test('getSubgraph_chr20_large_region_produces_many_segments', async () => {
  const adapter = makeAdapter()
  const region = {
    refName: 'chr20',
    start: 0,
    end: 200000,
    assemblyName: 'CHM13#0',
  }

  const rpcGfa = await adapter.getSubgraph(region)
  const segs = parseSegments(rpcGfa)

  // Large region should produce substantial subgraph
  expect(segs.length).toBeGreaterThan(50)
})

test('getSubgraph_chr20_empty_region_returns_header', async () => {
  const adapter = makeAdapter()
  const region = {
    refName: 'chr20',
    start: 999_000_000,
    end: 999_001_000,
    assemblyName: 'CHM13#0',
  }

  const rpcGfa = await adapter.getSubgraph(region)

  // Empty region should return just header
  expect(rpcGfa).toBe('H\tVN:Z:1.1')
})
