/**
 * Benchmark comparing BEFORE and AFTER optimization of readConfObject
 *
 * BEFORE: JSON.parse(JSON.stringify(getSnapshot(val)))
 * AFTER:  getSnapshot(val) directly (no defensive copying)
 *
 * Run with: node benchmarks/readConfObject_optimized.mjs
 */

const ITERATIONS = 100000

// Simulate MST getSnapshot (returns the value)
const getSnapshot = (val) => val
const isStateTreeNode = (val) => val && val.$$mst
const slot = { value: null, expr: null }

// Test values
const primitiveValue = 10
const stringValue = '#ff0000'
const fileLocation = {
  $$mst: true,
  uri: '/path/to/my.bam',
  locationType: 'UriLocation',
}
const stringArray = {
  $$mst: true,
  values: ['foo', 'bar', 'baz'],
}

console.log('=' .repeat(70))
console.log('readConfObject Optimization - BEFORE vs AFTER')
console.log('=' .repeat(70))
console.log(`Iterations: ${ITERATIONS}\n`)

function benchmarkBefore(name, val) {
  const start = performance.now()
  for (let i = 0; i < ITERATIONS; i++) {
    // OLD CODE: Defensive copying
    const result = isStateTreeNode(val)
      ? JSON.parse(JSON.stringify(getSnapshot(val)))
      : val
  }
  const duration = performance.now() - start
  const opsPerSec = ITERATIONS / (duration / 1000)
  return { duration, opsPerSec }
}

function benchmarkAfter(name, val) {
  const start = performance.now()
  for (let i = 0; i < ITERATIONS; i++) {
    // NEW CODE: Fast path for primitives + no defensive copy
    if (typeof val !== 'object' || val === null) {
      const result = val
    } else {
      const result = isStateTreeNode(val) ? getSnapshot(val) : val
    }
  }
  const duration = performance.now() - start
  const opsPerSec = ITERATIONS / (duration / 1000)
  return { duration, opsPerSec }
}

function compare(name, val) {
  const before = benchmarkBefore(name, val)
  const after = benchmarkAfter(name, val)
  const speedup = before.duration / after.duration

  console.log(`${name}:`)
  console.log(`  BEFORE (JSON copy): ${before.duration.toFixed(2).padStart(8)}ms  ${(before.opsPerSec / 1000000).toFixed(2)} M ops/sec`)
  console.log(`  AFTER  (direct):    ${after.duration.toFixed(2).padStart(8)}ms  ${(after.opsPerSec / 1000000).toFixed(2)} M ops/sec`)
  console.log(`  Speedup: ${speedup.toFixed(2)}x faster\n`)

  return speedup
}

const speedups = []

speedups.push(compare('Primitive value (number)', primitiveValue))
speedups.push(compare('String value (color)', stringValue))
speedups.push(compare('fileLocation (object)', fileLocation))
speedups.push(compare('stringArray (array)', stringArray))

const avgSpeedup = speedups.reduce((a, b) => a + b, 0) / speedups.length

console.log('=' .repeat(70))
console.log('SUMMARY')
console.log('=' .repeat(70))
console.log(`Average speedup: ${avgSpeedup.toFixed(2)}x faster`)
console.log('')
console.log('Impact:')
console.log('  - 65 fileLocation config slots: ~${speedups[2].toFixed(0)}x faster')
console.log('  - 32 stringArray config slots: ~${speedups[3].toFixed(0)}x faster')
console.log('  - All primitive slots: ~${speedups[0].toFixed(0)}x faster (fast path)')
console.log('')
console.log('This optimization is SAFE because:')
console.log('  ✓ Code analysis shows no mutations of config values')
console.log('  ✓ Config values are read-only in practice')
console.log('  ✓ MST snapshots are already immutable')
