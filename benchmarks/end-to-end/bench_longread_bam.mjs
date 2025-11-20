import { runSimpleBenchmark } from './benchmark-helpers.mjs'

const CONFIG = {
  name: '200x longread BAM',
  track: '200x.longread.bam',
  region: 'chr22_mask:80,630..83,605',
}

const LABEL = process.env.BENCHMARK_LABEL || process.argv[2] || 'test'

console.log(`Testing ${CONFIG.name} on ${LABEL}...`)

try {
  const results = await runSimpleBenchmark(CONFIG, LABEL)
  console.log(`MEMORY_MB=${results.memory.toFixed(2)}`)
  process.exit(0)
} catch (error) {
  console.error(`Error running benchmark: ${error.message}`)
  process.exit(1)
}
