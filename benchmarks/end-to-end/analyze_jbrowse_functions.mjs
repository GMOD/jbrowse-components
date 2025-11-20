import fs from 'fs'

const traceFile = process.argv[2] || 'results/trace_port3000_200x_shortread.json'

console.log('🔍 JBrowse Function Analysis')
console.log(`📁 File: ${traceFile}`)
console.log('')

const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'))
const events = trace.traceEvents || []

// Find worker thread
let workerTid = null
let workerPid = null
let mainTid = null

for (const event of events) {
  if (event.ph === 'M' && event.name === 'thread_name') {
    const threadName = event.args?.name || ''
    if (threadName.includes('DedicatedWorker')) {
      workerTid = event.tid
      workerPid = event.pid
    } else if (threadName === 'CrRendererMain') {
      mainTid = event.tid
    }
  }
}

console.log(`✓ Main thread: ${mainTid}`)
console.log(`✓ Worker thread: ${workerTid}`)
console.log('')

// Target functions to analyze
const targetFunctions = [
  'processDepth',
  'processMismatches',
  'generateCoverageBins',
  'readFeaturesToMismatches',
  'parseItf8',
  'cramEncodingSub',
  'get mismatches',
  'renderMismatches',
  'parse',
]

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎯 TARGET JBROWSE FUNCTIONS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

for (const targetFunc of targetFunctions) {
  // Find all events with this function name
  const matches = events.filter(e =>
    e.args?.data?.functionName === targetFunc &&
    e.dur
  )

  if (matches.length === 0) continue

  console.log(`\n📌 ${targetFunc}`)
  console.log('─'.repeat(50))

  // Separate by thread
  const workerCalls = matches.filter(e => e.tid === workerTid)
  const mainCalls = matches.filter(e => e.tid === mainTid)

  if (workerCalls.length > 0) {
    const totalTime = workerCalls.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000
    const avgTime = totalTime / workerCalls.length
    const maxTime = Math.max(...workerCalls.map(e => (e.dur || 0) / 1000))
    const minTime = Math.min(...workerCalls.map(e => (e.dur || 0) / 1000))

    console.log(`\n  🔧 Worker Thread:`)
    console.log(`     Calls: ${workerCalls.length}`)
    console.log(`     Total: ${totalTime.toFixed(2)}ms`)
    console.log(`     Avg:   ${avgTime.toFixed(2)}ms`)
    console.log(`     Min:   ${minTime.toFixed(2)}ms`)
    console.log(`     Max:   ${maxTime.toFixed(2)}ms`)

    // Show top 5 longest calls
    const sorted = workerCalls
      .map(e => ({
        ts: e.ts,
        dur: (e.dur || 0) / 1000,
        url: e.args?.data?.url || '',
        lineNumber: e.args?.data?.lineNumber,
      }))
      .sort((a, b) => b.dur - a.dur)

    console.log(`\n     Top ${Math.min(5, sorted.length)} longest calls:`)
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
      const call = sorted[i]
      const fileName = call.url.split('/').pop() || call.url
      const location = fileName ? `${fileName}:${call.lineNumber || '?'}` : 'unknown'
      const timeOffset = ((call.ts - workerCalls[0].ts) / 1000000).toFixed(2)
      console.log(`       ${i + 1}. ${call.dur.toFixed(2)}ms at +${timeOffset}s - ${location}`)
    }
  }

  if (mainCalls.length > 0) {
    const totalTime = mainCalls.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000
    const avgTime = totalTime / mainCalls.length

    console.log(`\n  🖥️  Main Thread:`)
    console.log(`     Calls: ${mainCalls.length}`)
    console.log(`     Total: ${totalTime.toFixed(2)}ms`)
    console.log(`     Avg:   ${avgTime.toFixed(2)}ms`)
  }
}

console.log('\n')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📊 ALL FUNCTIONS BY EXECUTION TIME')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// Collect all functions with timing data
const functionStats = new Map()

for (const event of events) {
  const funcName = event.args?.data?.functionName
  if (!funcName || !event.dur) continue

  const tid = event.tid
  const threadType = tid === workerTid ? 'worker' : tid === mainTid ? 'main' : 'other'

  if (threadType === 'other') continue

  const key = `${funcName}|${threadType}`

  if (!functionStats.has(key)) {
    functionStats.set(key, {
      name: funcName,
      thread: threadType,
      count: 0,
      totalDuration: 0,
      maxDuration: 0,
    })
  }

  const stats = functionStats.get(key)
  stats.count++
  stats.totalDuration += event.dur || 0
  stats.maxDuration = Math.max(stats.maxDuration, event.dur || 0)
}

// Sort by total duration
const sortedFunctions = Array.from(functionStats.values())
  .sort((a, b) => b.totalDuration - a.totalDuration)

console.log('Top 30 functions in Worker thread:\n')

const workerFunctions = sortedFunctions.filter(f => f.thread === 'worker')
for (let i = 0; i < Math.min(30, workerFunctions.length); i++) {
  const func = workerFunctions[i]
  const totalMs = (func.totalDuration / 1000).toFixed(2)
  const avgMs = (func.totalDuration / func.count / 1000).toFixed(2)
  const maxMs = (func.maxDuration / 1000).toFixed(2)

  console.log(`${i + 1}. ${func.name}`)
  console.log(`   Total: ${totalMs}ms | Calls: ${func.count} | Avg: ${avgMs}ms | Max: ${maxMs}ms`)
}

console.log('\n')
console.log('Top 30 functions in Main thread:\n')

const mainFunctions = sortedFunctions.filter(f => f.thread === 'main')
for (let i = 0; i < Math.min(30, mainFunctions.length); i++) {
  const func = mainFunctions[i]
  const totalMs = (func.totalDuration / 1000).toFixed(2)
  const avgMs = (func.totalDuration / func.count / 1000).toFixed(2)

  console.log(`${i + 1}. ${func.name}`)
  console.log(`   Total: ${totalMs}ms | Calls: ${func.count} | Avg: ${avgMs}ms`)
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ Analysis Complete')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
