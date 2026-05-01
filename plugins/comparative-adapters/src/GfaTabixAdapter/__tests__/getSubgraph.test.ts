import path from 'path'

import Adapter from '../GfaTabixAdapter.ts'
import configSchema from '../configSchema.ts'

const FIXTURES = path.join(
  __dirname,
  'fixtures',
  'volvox_chr1_0-50k',
  'volvox_chr1_0-50k',
)

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

const region = {
  refName: 'ctgA',
  start: 0,
  end: 50000,
  assemblyName: 'ref#0',
}

test('returns_gfa_string', async () => {
  const adapter = makeAdapter()
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
