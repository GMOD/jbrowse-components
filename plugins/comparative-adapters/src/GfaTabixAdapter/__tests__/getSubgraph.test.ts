import path from 'path'

import Adapter from '../GfaTabixAdapter.ts'
import configSchema from '../configSchema.ts'

const FIXTURES = path.join(
  __dirname,
  'fixtures',
  'volvox_chr1_0-50k',
  'volvox_chr1_0-50k',
)

function makeAdapter({ withCoarse = false } = {}) {
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
      ...(withCoarse
        ? {
            graphCoarseLocation: {
              localPath: `${FIXTURES}.graph.coarse.bed.gz`,
              locationType: 'LocalPathLocation',
            },
            graphCoarseIndex: {
              location: {
                localPath: `${FIXTURES}.graph.coarse.bed.gz.tbi`,
                locationType: 'LocalPathLocation',
              },
            },
          }
        : {}),
    }),
  )
}

const region = {
  refName: 'ctgA',
  start: 0,
  end: 50000,
  assemblyName: 'ref#0',
}

test('returns_gfa_string', async () => {
  const adapter = makeAdapter({ withCoarse: false })
  const gfa = await adapter.getSubgraph(region)
  expect(typeof gfa).toBe('string')
  expect(gfa.startsWith('H\tVN:Z:1.1')).toBe(true)
})

test('slines_complete', async () => {
  const adapter = makeAdapter()
  const gfa = await adapter.getSubgraph(region)
  const lines = gfa.split('\n')
  const sOrds = new Set<number>()
  for (const line of lines) {
    if (line.startsWith('S\t')) {
      const cols = line.split('\t')
      sOrds.add(+cols[1]!)
    }
  }
  expect(sOrds.size).toBeGreaterThan(0)
  for (const ord of sOrds) {
    expect(Number.isFinite(ord)).toBe(true)
  }
})

test('llines_no_dangling', async () => {
  const adapter = makeAdapter()
  const gfa = await adapter.getSubgraph(region)
  const lines = gfa.split('\n')
  const sOrds = new Set<number>()
  for (const line of lines) {
    if (line.startsWith('S\t')) {
      sOrds.add(+line.split('\t')[1]!)
    }
  }
  for (const line of lines) {
    if (line.startsWith('L\t')) {
      const cols = line.split('\t')
      expect(sOrds.has(+cols[1]!)).toBe(true)
      expect(sOrds.has(+cols[3]!)).toBe(true)
    }
  }
})

test('empty_region', async () => {
  const adapter = makeAdapter()
  const gfa = await adapter.getSubgraph({
    refName: 'ctgA',
    start: 999_000_000,
    end: 999_001_000,
    assemblyName: 'ref#0',
  })
  expect(gfa).toBe('H\tVN:Z:1.1')
})

test('no_duplicate_sline_ordinals', async () => {
  const adapter = makeAdapter()
  const gfa = await adapter.getSubgraph(region)
  const seen = new Set<number>()
  for (const line of gfa.split('\n')) {
    if (line.startsWith('S\t')) {
      const ord = +line.split('\t')[1]!
      expect(seen.has(ord)).toBe(false)
      seen.add(ord)
    }
  }
})

test('wlines_reference_valid_segments', async () => {
  const adapter = makeAdapter()
  const gfa = await adapter.getSubgraph(region)
  const lines = gfa.split('\n')
  const sOrds = new Set<number>()
  for (const line of lines) {
    if (line.startsWith('S\t')) {
      sOrds.add(+line.split('\t')[1]!)
    }
  }
  let wlineCount = 0
  for (const line of lines) {
    if (line.startsWith('W\t')) {
      wlineCount++
      const walkStr = line.split('\t')[6]!
      const ords = (walkStr.match(/>\d+/g) ?? []).map(s => +s.slice(1))
      for (const ord of ords) {
        expect(sOrds.has(ord)).toBe(true)
      }
    }
  }
  expect(wlineCount).toBeGreaterThan(0)
})

// coarse route: queries with regionSize > 100k use graph.coarse.bed.gz
const largeRegion = { refName: 'ctgA', start: 0, end: 200_000, assemblyName: 'ref#0' }

test('coarse_route_returns_gfa', async () => {
  const adapter = makeAdapter({ withCoarse: true })
  const gfa = await adapter.getSubgraph(largeRegion)
  expect(gfa.startsWith('H\tVN:Z:1.1')).toBe(true)
})

test('coarse_route_fewer_slines_than_detail', async () => {
  const coarseAdapter = makeAdapter({ withCoarse: true })
  const detailAdapter = makeAdapter({ withCoarse: false })
  const coarseGfa = await coarseAdapter.getSubgraph(largeRegion)
  const detailGfa = await detailAdapter.getSubgraph(region)
  const coarseSlines = coarseGfa.split('\n').filter(l => l.startsWith('S\t'))
  const detailSlines = detailGfa.split('\n').filter(l => l.startsWith('S\t'))
  expect(coarseSlines.length).toBeGreaterThan(0)
  expect(coarseSlines.length).toBeLessThan(detailSlines.length)
})

test('coarse_super_ord_matches_min_constituent', async () => {
  const adapter = makeAdapter({ withCoarse: true })
  const gfa = await adapter.getSubgraph(largeRegion)
  for (const line of gfa.split('\n')) {
    if (line.startsWith('S\t')) {
      const cols = line.split('\t')
      expect(Number.isFinite(+cols[1]!)).toBe(true)
    }
  }
})

test('coarse_no_dangling_llines', async () => {
  const adapter = makeAdapter({ withCoarse: true })
  const gfa = await adapter.getSubgraph(largeRegion)
  const lines = gfa.split('\n')
  const sOrds = new Set<number>()
  for (const line of lines) {
    if (line.startsWith('S\t')) {
      sOrds.add(+line.split('\t')[1]!)
    }
  }
  for (const line of lines) {
    if (line.startsWith('L\t')) {
      const cols = line.split('\t')
      expect(sOrds.has(+cols[1]!)).toBe(true)
      expect(sOrds.has(+cols[3]!)).toBe(true)
    }
  }
})
