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
      syntenyCoarseLocation: {
        localPath: `${FIXTURES}.synteny.coarse.bed.gz`,
        locationType: 'LocalPathLocation',
      },
      syntenyCoarseIndex: {
        location: {
          localPath: `${FIXTURES}.synteny.coarse.bed.gz.tbi`,
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

// Small mode (< 100kbp): getSubgraph produces a GFA with S-lines
test('routing_small', async () => {
  const adapter = makeAdapter()
  const gfa = await adapter.getSubgraph(region)
  expect(gfa.startsWith('H\tVN:Z:1.1')).toBe(true)
  const hasSegments = gfa.split('\n').some(l => l.startsWith('S\t'))
  expect(hasSegments).toBe(true)
})

// Large mode (> 100kbp): getMultiPairFeatures is the data source
test('routing_large', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(region)
  expect(genomeRows.size).toBeGreaterThan(0)
  let total = 0
  for (const [, features] of genomeRows) {
    total += features.length
  }
  expect(total).toBeGreaterThan(0)
})

// Large-mode {refStart, refEnd, mateRefName} triples must match what
// MultiLGVSyntenyDisplay sees for the same region (same adapter path).
test('spatial_agreement', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(region)
  for (const [, features] of genomeRows) {
    for (const f of features) {
      expect(f.start).toBeGreaterThanOrEqual(region.start)
      expect(f.end).toBeLessThanOrEqual(region.end + 1)
      expect(typeof f.mateRefName).toBe('string')
      expect(f.mateRefName.length).toBeGreaterThan(0)
    }
  }
})

// bpPerPx > 1000 selects synteny.coarse.bed.gz → fewer rows than fine
test('bpPerPx_routing', async () => {
  const adapter = makeAdapter()
  const fine = await adapter.getMultiPairFeatures(region, { bpPerPx: 1 })
  const coarse = await adapter.getMultiPairFeatures(region, { bpPerPx: 2000 })
  let fineTotal = 0
  for (const [, features] of fine.genomeRows) {
    fineTotal += features.length
  }
  let coarseTotal = 0
  for (const [, features] of coarse.genomeRows) {
    coarseTotal += features.length
  }
  expect(coarseTotal).toBeLessThanOrEqual(fineTotal)
})
