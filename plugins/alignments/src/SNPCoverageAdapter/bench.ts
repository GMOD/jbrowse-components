import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

import BamAdapter from '../BamAdapter/BamAdapter'
import configSchema from '../BamAdapter/configSchema'
import { generateCoverageBinsPrefixSum } from './generateCoverageBinsPrefixSum'
import type { FeatureWithMismatchIterator } from '../shared/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const BAM_FILES = {
  pacbio: {
    bam: resolve(__dirname, '../../test_data/pacbio_hg002.bam'),
    bai: resolve(__dirname, '../../test_data/pacbio_hg002.bam.bai'),
  },
}

async function loadFeatures(
  region: { refName: string; start: number; end: number },
  bamFile: { bam: string; bai: string },
) {
  const adapter = new BamAdapter(
    configSchema.create({
      bamLocation: { localPath: bamFile.bam, locationType: 'LocalPathLocation' },
      index: { location: { localPath: bamFile.bai, locationType: 'LocalPathLocation' } },
    }),
  )
  return firstValueFrom(
    adapter.getFeatures({ assemblyName: 'test', ...region }).pipe(toArray()),
  )
}

function stats(times: number[]) {
  times.sort((a, b) => a - b)
  const sum = times.reduce((a, b) => a + b, 0)
  const mean = sum / times.length
  const p50 = times[Math.floor(times.length * 0.5)]!
  const p75 = times[Math.floor(times.length * 0.75)]!
  const p99 = times[Math.floor(times.length * 0.99)]!
  return { mean, p50, p75, p99, min: times[0]!, max: times.at(-1)! }
}

async function bench(
  name: string,
  fn: () => Promise<void>,
  warmup = 3,
  runs = 15,
) {
  // Warmup
  for (let i = 0; i < warmup; i++) {
    await fn()
  }
  // Force GC if available
  if (global.gc) {
    global.gc()
  }

  const times: number[] = []
  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }

  const s = stats(times)
  console.log(`${name}:`)
  console.log(`  mean: ${s.mean.toFixed(1)}ms | p50: ${s.p50.toFixed(1)}ms | p75: ${s.p75.toFixed(1)}ms | p99: ${s.p99.toFixed(1)}ms`)
  console.log(`  min: ${s.min.toFixed(1)}ms | max: ${s.max.toFixed(1)}ms | runs: ${runs}`)
  return s.mean
}

async function main() {
  const region = { refName: '9', start: 130000000, end: 130500000 }

  console.log('Loading PacBio 500kb features...')
  const features = (await loadFeatures(region, BAM_FILES.pacbio)) as FeatureWithMismatchIterator[]
  console.log(`Loaded ${features.length} features\n`)

  const mean = await bench('generateCoverageBinsPrefixSum', async () => {
    await generateCoverageBinsPrefixSum({
      features,
      region: { ...region, assemblyName: 'test' },
      opts: {},
    })
  })

  console.log(`\n=> Mean time: ${mean.toFixed(1)}ms`)
}

main().catch(console.error)
