import { runSimpleBenchmark } from './benchmark-helpers.mjs'

const CONFIG = {
  name: '200x longread CRAM',
  track: '200x.longread.cram',
  region: 'chr22_mask:80,630..83,605',
}

const PORT = process.env.BENCHMARK_PORT || process.argv[2] || '3000'
const LABEL = process.env.BENCHMARK_LABEL || process.argv[3] || 'test'

console.log(`Testing ${CONFIG.name} on ${LABEL} (port ${PORT})...`)

try {
  const results = await runSimpleBenchmark(CONFIG, PORT, LABEL)
  console.log(`MEMORY_MB=${results.memory.toFixed(2)}`)
  process.exit(0)
} catch (error) {
  console.error(`Error running benchmark: ${error.message}`)
  process.exit(1)
}
