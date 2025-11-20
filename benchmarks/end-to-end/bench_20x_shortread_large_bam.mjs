import { runLargeRegionBenchmark } from './benchmark-helpers.mjs'

const CONFIG = {
  name: '20x shortread BAM - large region',
  track: '20x.shortread.bam',
  region: 'chr22_mask:25,101..184,844',
}

const LABEL = process.env.BENCHMARK_LABEL || process.argv[2] || 'test'

console.log(`Testing ${CONFIG.name} on ${LABEL}...`)

try {
  const results = await runLargeRegionBenchmark(CONFIG, LABEL)
  console.log(`MEMORY_MB=${results.memory.toFixed(2)}`)
  process.exit(0)
} catch (error) {
  console.error(`Error running benchmark: ${error.message}`)
  process.exit(1)
}
