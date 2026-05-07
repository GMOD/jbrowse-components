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
    }),
  )
}

const region = {
  refName: 'ctgA',
  start: 0,
  end: 50000,
  assemblyName: 'ref#0',
}

test('adapter_no_ordinals', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(region)
  for (const [, features] of genomeRows) {
    for (const f of features) {
      expect(f.segOrd).toBeUndefined()
      expect(f.ordinal).toBeUndefined()
    }
  }
})

test('adapter_identity_range', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(region)
  for (const [, features] of genomeRows) {
    for (const f of features) {
      expect(f.identity).toBeGreaterThanOrEqual(0)
      expect(f.identity).toBeLessThanOrEqual(1)
    }
  }
})

test('adapter_grouping', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(region)
  for (const [genomeName, features] of genomeRows) {
    for (const f of features) {
      expect(f.queryGenome).toBe(genomeName)
    }
  }
})

test('adapter_returns_features', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(region)
  expect(genomeRows.size).toBeGreaterThan(0)
  let total = 0
  for (const [, features] of genomeRows) {
    total += features.length
  }
  expect(total).toBeGreaterThan(0)
})

test('adapter_coarse_fewer_rows', async () => {
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

test('getSources returns haplotype names', async () => {
  const adapter = makeAdapter()
  const sources = await adapter.getSources()
  expect(sources.length).toBeGreaterThan(0)
  expect(sources.every(s => typeof s.name === 'string')).toBe(true)
})

test('synteny_coverage_spans_chromosome', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(region)

  const intervals: { start: number; end: number }[] = []
  for (const [, features] of genomeRows) {
    for (const f of features) {
      intervals.push({ start: f.start, end: f.end })
    }
  }
  intervals.sort((a, b) => a.start - b.start)

  let covered = 0
  let mergeStart = -1
  let mergeEnd = -1
  for (const { start, end } of intervals) {
    if (start > mergeEnd) {
      if (mergeEnd >= 0) {
        covered += mergeEnd - mergeStart
      }
      mergeStart = start
      mergeEnd = end
    } else if (end > mergeEnd) {
      mergeEnd = end
    }
  }
  if (mergeEnd >= 0) {
    covered += mergeEnd - mergeStart
  }

  expect(covered).toBeGreaterThan(50000 * 0.9)
})

test('feature_coordinates_valid', async () => {
  const adapter = makeAdapter()
  const { genomeRows } = await adapter.getMultiPairFeatures(region)
  for (const [, features] of genomeRows) {
    for (const f of features) {
      expect(f.start).toBeLessThanOrEqual(f.end)
      expect(f.mateStart).toBeLessThanOrEqual(f.mateEnd)
      expect(f.start).toBeLessThan(region.end)
      expect(f.end).toBeGreaterThan(region.start)
    }
  }
})
