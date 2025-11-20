import fs from 'fs'

const traceFile = process.argv[2] || 'results/trace_port3000_200x_shortread.json'

console.log('🔍 Analyzing Chrome Trace File')
console.log(`📁 File: ${traceFile}`)
console.log('')

const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'))

// Chrome trace format has events in traceEvents array
const events = trace.traceEvents || []

console.log(`📊 Total events: ${events.length.toLocaleString()}`)
console.log('')

// Group events by process and thread
const processes = new Map()
const threads = new Map()

for (const event of events) {
  const pid = event.pid
  const tid = event.tid

  if (!processes.has(pid)) {
    processes.set(pid, { pid, threads: new Map(), name: '' })
  }

  const process = processes.get(pid)

  if (!process.threads.has(tid)) {
    process.threads.set(tid, {
      tid,
      name: '',
      events: [],
      functions: new Map(),
    })
  }

  const thread = process.threads.get(tid)
  thread.events.push(event)

  // Capture thread names
  if (event.ph === 'M' && event.name === 'thread_name') {
    thread.name = event.args?.name || ''
  }

  // Capture process names
  if (event.ph === 'M' && event.name === 'process_name') {
    process.name = event.args?.name || ''
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📋 PROCESSES AND THREADS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const workerThreads = []

for (const [pid, process] of processes) {
  console.log(`Process ${pid}: ${process.name || '(unnamed)'}`)

  for (const [tid, thread] of process.threads) {
    const threadName = thread.name || '(unnamed)'
    console.log(`  Thread ${tid}: ${threadName} (${thread.events.length.toLocaleString()} events)`)

    if (threadName.includes('Worker') || threadName.includes('worker')) {
      workerThreads.push({ pid, tid, thread, process })
    }
  }
  console.log('')
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('👷 WORKER THREAD ANALYSIS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

if (workerThreads.length === 0) {
  console.log('⚠️  No worker threads found in trace')
  console.log('')
  console.log('Possible reasons:')
  console.log('  - Workers might be using a different naming convention')
  console.log('  - The trace might not have captured worker events')
  console.log('  - Workers might be in a different process')
  console.log('')
  console.log('Analyzing all threads for function activity...')
  console.log('')
}

// Analyze function calls across all threads
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('⚡ FUNCTION TIMING ANALYSIS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// Look for specific functions we're interested in
const targetFunctions = [
  'processDepth',
  'processMismatches',
  'generateCoverageBins',
  'parseCram',
  'parseBam',
  'processCoverageData',
  'calculateCoverage',
]

// Collect all function executions
const functionStats = new Map()

for (const [pid, process] of processes) {
  for (const [tid, thread] of process.threads) {
    for (const event of thread.events) {
      // Look for complete events (ph: 'X') or begin/end events (ph: 'B'/'E')
      if (event.ph === 'X' && event.name) {
        const funcName = event.name
        const duration = event.dur || 0 // Duration in microseconds

        if (!functionStats.has(funcName)) {
          functionStats.set(funcName, {
            name: funcName,
            count: 0,
            totalDuration: 0,
            minDuration: Infinity,
            maxDuration: 0,
            threadInfo: new Map(),
          })
        }

        const stats = functionStats.get(funcName)
        stats.count++
        stats.totalDuration += duration
        stats.minDuration = Math.min(stats.minDuration, duration)
        stats.maxDuration = Math.max(stats.maxDuration, duration)

        const threadKey = `${pid}:${tid}:${thread.name || 'unnamed'}`
        if (!stats.threadInfo.has(threadKey)) {
          stats.threadInfo.set(threadKey, { count: 0, totalDuration: 0 })
        }
        const threadStats = stats.threadInfo.get(threadKey)
        threadStats.count++
        threadStats.totalDuration += duration
      }
    }
  }
}

// Sort by total duration
const sortedFunctions = Array.from(functionStats.values())
  .sort((a, b) => b.totalDuration - a.totalDuration)

console.log('🔥 Top 20 Functions by Total Time:\n')
for (let i = 0; i < Math.min(20, sortedFunctions.length); i++) {
  const func = sortedFunctions[i]
  const avgMs = (func.totalDuration / func.count / 1000).toFixed(2)
  const totalMs = (func.totalDuration / 1000).toFixed(2)
  const maxMs = (func.maxDuration / 1000).toFixed(2)

  console.log(`${i + 1}. ${func.name}`)
  console.log(`   Total: ${totalMs}ms | Calls: ${func.count} | Avg: ${avgMs}ms | Max: ${maxMs}ms`)

  // Show which threads executed this function
  if (func.threadInfo.size > 1 || Array.from(func.threadInfo.keys()).some(k => k.includes('Worker'))) {
    for (const [threadKey, threadStats] of func.threadInfo) {
      const pct = (threadStats.totalDuration / func.totalDuration * 100).toFixed(1)
      const threadTotalMs = (threadStats.totalDuration / 1000).toFixed(2)
      console.log(`     ↳ ${threadKey}: ${threadTotalMs}ms (${pct}%) - ${threadStats.count} calls`)
    }
  }
  console.log('')
}

// Look for target functions specifically
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎯 TARGET FUNCTIONS (JBrowse Parsing/Processing)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

let foundTargetFunctions = false
for (const targetFunc of targetFunctions) {
  const matches = Array.from(functionStats.values())
    .filter(f => f.name.toLowerCase().includes(targetFunc.toLowerCase()))

  if (matches.length > 0) {
    foundTargetFunctions = true
    for (const func of matches) {
      const avgMs = (func.totalDuration / func.count / 1000).toFixed(2)
      const totalMs = (func.totalDuration / 1000).toFixed(2)

      console.log(`✓ ${func.name}`)
      console.log(`  Total: ${totalMs}ms | Calls: ${func.count} | Avg: ${avgMs}ms`)

      for (const [threadKey, threadStats] of func.threadInfo) {
        const threadTotalMs = (threadStats.totalDuration / 1000).toFixed(2)
        console.log(`    ↳ ${threadKey}: ${threadTotalMs}ms - ${threadStats.count} calls`)
      }
      console.log('')
    }
  }
}

if (!foundTargetFunctions) {
  console.log('⚠️  No target functions found in trace')
  console.log('')
  console.log('This might mean:')
  console.log('  - Function names are minified/mangled in production build')
  console.log('  - Functions are executed with different names')
  console.log('  - Need to search for patterns in the top functions list above')
  console.log('')
}

// Analyze timing categories
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📊 TIMING BY CATEGORY')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const categories = new Map()

for (const event of events) {
  if (event.ph === 'X' && event.cat) {
    const cat = event.cat
    if (!categories.has(cat)) {
      categories.set(cat, { count: 0, totalDuration: 0 })
    }
    const catStats = categories.get(cat)
    catStats.count++
    catStats.totalDuration += event.dur || 0
  }
}

const sortedCategories = Array.from(categories.entries())
  .sort((a, b) => b[1].totalDuration - a[1].totalDuration)

for (const [cat, stats] of sortedCategories.slice(0, 10)) {
  const totalMs = (stats.totalDuration / 1000).toFixed(2)
  console.log(`${cat}: ${totalMs}ms (${stats.count.toLocaleString()} events)`)
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ Analysis Complete')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
