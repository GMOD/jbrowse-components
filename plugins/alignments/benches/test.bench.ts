import { bench, describe } from 'vitest'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

import BamAdapter from '../dist_branch1/BamAdapter/BamAdapter.js'
import configSchema from '../dist_branch1/BamAdapter/configSchema.js'
import { generateCoverageBinsPrefixSum as generateCoverageBinsPrefixSum1 } from '../dist_branch1/SNPCoverageAdapter/generateCoverageBinsPrefixSum.js'
import { generateCoverageBinsPrefixSum as generateCoverageBinsPrefixSum2 } from '../dist_branch2/SNPCoverageAdapter/generateCoverageBinsPrefixSum.js'
import type { FeatureWithMismatchIterator } from '../shared/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BAM_FILES = {
  pacbio: {
    bam: resolve(__dirname, 'pacbio_hg002.bam'),
    bai: resolve(__dirname, 'pacbio_hg002.bam.bai'),
  },
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
  BAM_FILES.pacbio,
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
