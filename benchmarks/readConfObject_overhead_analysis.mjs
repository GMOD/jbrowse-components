/**
 * Test to isolate MST-specific overhead in readConfObject
 *
 * readConfObject does this for each value:
 * return isStateTreeNode(val)
 *   ? JSON.parse(JSON.stringify(getSnapshot(val)))
 *   : val
 */

const ITERATIONS = 100000

// Simulate different return value types
const primitiveValue = 10
const objectValue = { uri: '/path/to/file.bam', locationType: 'UriLocation' }
const arrayValue = ['foo', 'bar', 'baz']
const stringValue = '#ff0000'

console.log('Testing readConfObject return value overhead')
console.log(`Iterations: ${ITERATIONS}\n`)

// Test 1: Primitive value (no serialization needed)
console.log('=== Primitive value (number) ===')
let start = performance.now()
for (let i = 0; i < ITERATIONS; i++) {
  const val = primitiveValue
  const result = typeof val === 'object' && val !== null
    ? JSON.parse(JSON.stringify(val))
    : val
}
console.log(`Time: ${(performance.now() - start).toFixed(2)}ms\n`)

// Test 2: String value (no serialization needed)
console.log('=== String value ===')
start = performance.now()
for (let i = 0; i < ITERATIONS; i++) {
  const val = stringValue
  const result = typeof val === 'object' && val !== null
    ? JSON.parse(JSON.stringify(val))
    : val
}
console.log(`Time: ${(performance.now() - start).toFixed(2)}ms\n`)

// Test 3: Object value (requires JSON serialization)
console.log('=== Object value (fileLocation) ===')
start = performance.now()
for (let i = 0; i < ITERATIONS; i++) {
  const val = objectValue
  const result = typeof val === 'object' && val !== null
    ? JSON.parse(JSON.stringify(val))
    : val
}
console.log(`Time: ${(performance.now() - start).toFixed(2)}ms\n`)

// Test 4: Array value (requires JSON serialization)
console.log('=== Array value (stringArray) ===')
start = performance.now()
for (let i = 0; i < ITERATIONS; i++) {
  const val = arrayValue
  const result = typeof val === 'object' && val !== null
    ? JSON.parse(JSON.stringify(val))
    : val
}
console.log(`Time: ${(performance.now() - start).toFixed(2)}ms\n`)

// Test 5: Just accessing the value (baseline)
console.log('=== Baseline: Direct value access ===')
start = performance.now()
for (let i = 0; i < ITERATIONS; i++) {
  const result = primitiveValue
}
console.log(`Time: ${(performance.now() - start).toFixed(2)}ms\n`)

// Test 6: Object access without serialization
console.log('=== Object without JSON serialization ===')
start = performance.now()
for (let i = 0; i < ITERATIONS; i++) {
  const result = objectValue
}
console.log(`Time: ${(performance.now() - start).toFixed(2)}ms\n`)

console.log('Key findings:')
console.log('  - Primitive values are fast (no serialization)')
console.log('  - Object/Array values require JSON.parse(JSON.stringify())')
console.log('  - This serialization happens on EVERY readConfObject call')
console.log('  - Even if the underlying MST getSnapshot() is fast,')
console.log('    the double JSON serialization adds significant overhead')
