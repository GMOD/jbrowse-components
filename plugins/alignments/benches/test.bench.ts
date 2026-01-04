import { bench, describe } from 'vitest'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

import BamAdapter from '../dist_branch1/BamAdapter/BamAdapter.js'
import configSchema from '../dist_branch1/BamAdapter/configSchema.js'
import { generateCoverageBinsPrefixSum as generateCoverageBinsPrefixSum1 } from '../dist_branch1/SNPCoverageAdapter/generateCoverageBinsPrefixSum.js'
import { generateCoverageBinsPrefixSum as generateCoverageBinsPrefixSum2 } from '../dist_branch2/SNPCoverageAdapter/generateCoverageBinsPrefixSum.js'
import SNPCoverageAdapter1 from '../dist_branch1/SNPCoverageAdapter/SNPCoverageAdapter.js'
import SNPCoverageAdapter2 from '../dist_branch2/SNPCoverageAdapter/SNPCoverageAdapter.js'
import snpConfigSchema1 from '../dist_branch1/SNPCoverageAdapter/configSchema.js'
import snpConfigSchema2 from '../dist_branch2/SNPCoverageAdapter/configSchema.js'
import type { FeatureWithMismatchIterator } from '../shared/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BAM_FILE = {
  bam: resolve(__dirname, 'pacbio_hg002.bam'),
  bai: resolve(__dirname, 'pacbio_hg002.bam.bai'),
}

async function loadFeatures(
  region: { refName: string; start: number; end: number },
  bamFile: { bam: string; bai: string },
) {
  const adapter = new BamAdapter(
    configSchema.create({
      bamLocation: {
        localPath: bamFile.bam,
        locationType: 'LocalPathLocation',
      },
      index: {
        location: { localPath: bamFile.bai, locationType: 'LocalPathLocation' },
      },
    }),
  )
  return firstValueFrom(
    adapter.getFeatures({ assemblyName: 'test', ...region }).pipe(toArray()),
  )
}

const region = { refName: '9', start: 130000000, end: 130500000 }

const features = (await loadFeatures(
  region,
  BAM_FILE,
)) as FeatureWithMismatchIterator[]
console.log(`Loaded ${features.length} features`)

describe('generateCoverageBinsPrefixSum', () => {
  bench(
    'branch1',
    async () => {
      await generateCoverageBinsPrefixSum1({
        features,
        region: { ...region, assemblyName: 'test' },
        opts: {},
      })
    },
    { warmupIterations: 10, iterations: 100 },
  )

  bench(
    'branch2',
    async () => {
      await generateCoverageBinsPrefixSum2({
        features,
        region: { ...region, assemblyName: 'test' },
        opts: {},
      })
    },
    { warmupIterations: 10, iterations: 100 },
  )
})

// Create SNPCoverageAdapters that wrap a mock subadapter
function createSNPCoverageAdapter1() {
  const bamAdapter = new BamAdapter(
    configSchema.create({
      bamLocation: { localPath: BAM_FILE.bam, locationType: 'LocalPathLocation' },
      index: { location: { localPath: BAM_FILE.bai, locationType: 'LocalPathLocation' } },
    }),
  )
  const config = snpConfigSchema1.create({
    subadapter: {
      type: 'BamAdapter',
      bamLocation: { localPath: BAM_FILE.bam, locationType: 'LocalPathLocation' },
      index: { location: { localPath: BAM_FILE.bai, locationType: 'LocalPathLocation' } },
    },
  })
  const adapter = new SNPCoverageAdapter1(config)
  // @ts-ignore - inject subadapter directly to avoid plugin manager
  adapter.configure = async () => ({ subadapter: bamAdapter })
  return adapter
}

function createSNPCoverageAdapter2() {
  const bamAdapter = new BamAdapter(
    configSchema.create({
      bamLocation: { localPath: BAM_FILE.bam, locationType: 'LocalPathLocation' },
      index: { location: { localPath: BAM_FILE.bai, locationType: 'LocalPathLocation' } },
    }),
  )
  const config = snpConfigSchema2.create({
    subadapter: {
      type: 'BamAdapter',
      bamLocation: { localPath: BAM_FILE.bam, locationType: 'LocalPathLocation' },
      index: { location: { localPath: BAM_FILE.bai, locationType: 'LocalPathLocation' } },
    },
  })
  const adapter = new SNPCoverageAdapter2(config)
  // @ts-ignore - inject subadapter directly to avoid plugin manager
  adapter.configure = async () => ({ subadapter: bamAdapter })
  return adapter
}

const snpAdapter1 = createSNPCoverageAdapter1()
const snpAdapter2 = createSNPCoverageAdapter2()

describe('SNPCoverageAdapter.getFeatures', () => {
  bench(
    'branch1',
    async () => {
      // Clear cache to measure fresh computation
      // @ts-ignore
      snpAdapter1.cache.clear()
      await firstValueFrom(
        snpAdapter1.getFeatures({ ...region, assemblyName: 'test' }).pipe(toArray()),
      )
    },
    { warmupIterations: 5, iterations: 50 },
  )

  bench(
    'branch2',
    async () => {
      // Clear cache to measure fresh computation
      // @ts-ignore
      snpAdapter2.cache.clear()
      await firstValueFrom(
        snpAdapter2.getFeatures({ ...region, assemblyName: 'test' }).pipe(toArray()),
      )
    },
    { warmupIterations: 5, iterations: 50 },
  )
})
