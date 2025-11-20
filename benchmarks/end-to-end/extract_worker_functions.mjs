import fs from 'fs'

const traceFile = process.argv[2] || 'results/trace_port3000_200x_shortread.json'

console.log('🔍 Extracting Worker Function Calls')
console.log(`📁 File: ${traceFile}`)
console.log('')

const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'))
const events = trace.traceEvents || []

// Find worker thread
let workerTid = null
let workerPid = null

for (const event of events) {
  if (event.ph === 'M' && event.name === 'thread_name' &&
      (event.args?.name || '').includes('DedicatedWorker')) {
    workerTid = event.tid
    workerPid = event.pid
    break
  }
}

if (!workerTid) {
  console.log('❌ No DedicatedWorker found')
  process.exit(1)
}

console.log(`✓ Worker: Process ${workerPid}, Thread ${workerTid}`)
console.log('')

// Get worker events
const workerEvents = events.filter(e =>
  e.pid === workerPid &&
  e.tid === workerTid &&
  e.ph === 'X' &&
  e.dur > 0
)

console.log(`Total timed events: ${workerEvents.length}`)
console.log('')

// Group by event name
const eventGroups = new Map()

for (const event of workerEvents) {
  const name = event.name
  if (!eventGroups.has(name)) {
    eventGroups.set(name, [])
  }
  eventGroups.get(name).push(event)
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📊 ALL EVENT TYPES IN WORKER')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const sortedGroups = Array.from(eventGroups.entries())
  .map(([name, events]) => ({
    name,
    count: events.length,
    totalTime: events.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000,
  }))
  .sort((a, b) => b.totalTime - a.totalTime)

for (const group of sortedGroups.slice(0, 30)) {
  console.log(`${group.name}: ${group.totalTime.toFixed(2)}ms (${group.count} calls)`)
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎯 FUNCTION CALL EVENTS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// Look for FunctionCall events which have data about what was called
const functionCalls = workerEvents.filter(e => e.name === 'FunctionCall')

console.log(`FunctionCall events: ${functionCalls.length}`)

if (functionCalls.length > 0) {
  // Analyze function call data
  for (let i = 0; i < Math.min(20, functionCalls.length); i++) {
    const call = functionCalls[i]
    const data = call.args?.data || {}
    const duration = (call.dur || 0) / 1000

    console.log(`\n${i + 1}. Duration: ${duration.toFixed(2)}ms`)
    console.log(`   Timestamp: ${((call.ts - functionCalls[0].ts) / 1000000).toFixed(2)}s`)
    if (Object.keys(data).length > 0) {
      console.log(`   Data:`, JSON.stringify(data, null, 2).split('\n').slice(0, 10).join('\n   '))
    }
  }
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📝 EVALUATE SCRIPT DETAILS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const evalScripts = workerEvents.filter(e => e.name === 'EvaluateScript')

for (const script of evalScripts) {
  const url = script.args?.data?.url || 'unknown'
  const duration = (script.dur || 0) / 1000
  const fileName = url.split('/').pop()

  console.log(`\n${fileName}`)
  console.log(`  Duration: ${duration.toFixed(2)}ms`)
  console.log(`  Time: ${((script.ts - evalScripts[0].ts) / 1000000).toFixed(2)}s from start`)
  console.log(`  Full URL: ${url}`)
}

console.log('')
console.log('✅ Extraction complete')
