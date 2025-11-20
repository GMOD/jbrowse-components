import fs from 'fs'

const traceFile = process.argv[2] || 'results/trace_port3000_200x_shortread.json'

console.log('🔍 Detailed Chrome Trace Analysis')
console.log(`📁 File: ${traceFile}`)
console.log('')

const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'))
const events = trace.traceEvents || []

// Find the DedicatedWorker thread
let workerTid = null
let workerPid = null

for (const event of events) {
  if (event.ph === 'M' && event.name === 'thread_name' &&
      (event.args?.name || '').includes('DedicatedWorker')) {
    workerTid = event.tid
    workerPid = event.pid
    console.log(`✓ Found DedicatedWorker: Process ${workerPid}, Thread ${workerTid}`)
    break
  }
}

if (!workerTid) {
  console.log('❌ No DedicatedWorker thread found')
  process.exit(1)
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('👷 WORKER THREAD ACTIVITY ANALYSIS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// Collect all worker events
const workerEvents = events.filter(e => e.pid === workerPid && e.tid === workerTid)
console.log(`Total worker events: ${workerEvents.length}`)
console.log('')

// Look for ProfileChunk events which contain V8 CPU profile data
const profileChunks = events.filter(e =>
  e.name === 'ProfileChunk' && e.pid === workerPid && e.tid === workerTid
)

console.log(`Profile chunks found: ${profileChunks.length}`)
console.log('')

if (profileChunks.length > 0) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 V8 CPU PROFILE DATA (Worker Thread)')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  // Process profile data
  const functionSamples = new Map()

  for (const chunk of profileChunks) {
    const cpuProfile = chunk.args?.data?.cpuProfile
    if (cpuProfile) {
      const nodes = cpuProfile.nodes || []
      const samples = cpuProfile.samples || []

      // Count samples per function
      for (const sampleNodeId of samples) {
        const node = nodes.find(n => n.id === sampleNodeId)
        if (node && node.callFrame) {
          const funcName = node.callFrame.functionName || '(anonymous)'
          const url = node.callFrame.url || ''
          const lineNumber = node.callFrame.lineNumber

          const key = `${funcName}@${url}:${lineNumber}`

          if (!functionSamples.has(key)) {
            functionSamples.set(key, {
              name: funcName,
              url,
              lineNumber,
              samples: 0,
            })
          }

          functionSamples.get(key).samples++
        }
      }
    }
  }

  // Sort by sample count
  const sortedFunctions = Array.from(functionSamples.values())
    .sort((a, b) => b.samples - a.samples)

  console.log(`Unique functions profiled: ${sortedFunctions.length}`)
  console.log('')
  console.log('🔥 Top 30 Functions in Worker Thread (by CPU samples):\n')

  for (let i = 0; i < Math.min(30, sortedFunctions.length); i++) {
    const func = sortedFunctions[i]
    const fileName = func.url.split('/').pop() || func.url

    console.log(`${i + 1}. ${func.name}`)
    console.log(`   ${fileName}${func.lineNumber >= 0 ? ':' + func.lineNumber : ''}`)
    console.log(`   Samples: ${func.samples}`)
    console.log('')
  }
}

// Analyze HandlePostMessage events to understand worker communication
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📬 WORKER COMMUNICATION (PostMessage)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const postMessages = workerEvents.filter(e =>
  e.name === 'HandlePostMessage' && e.ph === 'X'
)

console.log(`Total PostMessage handlers: ${postMessages.length}`)

if (postMessages.length > 0) {
  const totalTime = postMessages.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000
  const avgTime = totalTime / postMessages.length
  const maxTime = Math.max(...postMessages.map(e => (e.dur || 0) / 1000))

  console.log(`Total time in PostMessage: ${totalTime.toFixed(2)}ms`)
  console.log(`Average per message: ${avgTime.toFixed(2)}ms`)
  console.log(`Max message time: ${maxTime.toFixed(2)}ms`)
  console.log('')

  // Show longest messages
  const sorted = postMessages
    .map(e => ({ ts: e.ts, dur: (e.dur || 0) / 1000 }))
    .sort((a, b) => b.dur - a.dur)

  console.log('Longest PostMessage handlers:')
  for (let i = 0; i < Math.min(10, sorted.length); i++) {
    const msg = sorted[i]
    const timeFromStart = ((msg.ts - postMessages[0].ts) / 1000000).toFixed(2)
    console.log(`  ${i + 1}. ${msg.dur.toFixed(2)}ms (at +${timeFromStart}s)`)
  }
  console.log('')
}

// Analyze EvaluateScript in worker
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📜 SCRIPT EVALUATION (Worker Thread)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const evalScripts = workerEvents.filter(e =>
  e.name === 'EvaluateScript' && e.ph === 'X'
)

console.log(`Script evaluations: ${evalScripts.length}`)

if (evalScripts.length > 0) {
  const totalTime = evalScripts.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000
  console.log(`Total evaluation time: ${totalTime.toFixed(2)}ms`)
  console.log('')

  for (let i = 0; i < Math.min(10, evalScripts.length); i++) {
    const script = evalScripts[i]
    const url = script.args?.data?.url || '(unknown)'
    const fileName = url.split('/').pop() || url
    const duration = (script.dur || 0) / 1000

    console.log(`  ${i + 1}. ${fileName}: ${duration.toFixed(2)}ms`)
  }
  console.log('')
}

// Analyze GC in worker
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🗑️  GARBAGE COLLECTION (Worker Thread)')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const gcEvents = workerEvents.filter(e =>
  (e.name === 'MinorGC' || e.name === 'MajorGC') && e.ph === 'X'
)

if (gcEvents.length > 0) {
  const minorGC = gcEvents.filter(e => e.name === 'MinorGC')
  const majorGC = gcEvents.filter(e => e.name === 'MajorGC')

  const minorTime = minorGC.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000
  const majorTime = majorGC.reduce((sum, e) => sum + (e.dur || 0), 0) / 1000

  console.log(`Minor GC events: ${minorGC.length} (${minorTime.toFixed(2)}ms total)`)
  console.log(`Major GC events: ${majorGC.length} (${majorTime.toFixed(2)}ms total)`)
  console.log(`Total GC time: ${(minorTime + majorTime).toFixed(2)}ms`)
  console.log('')
}

// Timeline analysis
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('⏱️  WORKER TIMELINE')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// Get start and end times
const workerCompleteEvents = workerEvents.filter(e => e.ph === 'X' && e.dur)
if (workerCompleteEvents.length > 0) {
  const startTime = Math.min(...workerCompleteEvents.map(e => e.ts))
  const endTime = Math.max(...workerCompleteEvents.map(e => e.ts + (e.dur || 0)))
  const totalDuration = (endTime - startTime) / 1000

  console.log(`Worker active duration: ${totalDuration.toFixed(2)}ms`)
  console.log('')

  // Create timeline buckets (100ms each)
  const bucketSize = 100000 // 100ms in microseconds
  const numBuckets = Math.ceil((endTime - startTime) / bucketSize)
  const buckets = new Array(numBuckets).fill(0).map(() => ({
    postMessage: 0,
    eval: 0,
    gc: 0,
    other: 0,
  }))

  for (const event of workerCompleteEvents) {
    const bucketIndex = Math.floor((event.ts - startTime) / bucketSize)
    if (bucketIndex >= 0 && bucketIndex < numBuckets) {
      const duration = event.dur || 0

      if (event.name === 'HandlePostMessage') {
        buckets[bucketIndex].postMessage += duration
      } else if (event.name === 'EvaluateScript') {
        buckets[bucketIndex].eval += duration
      } else if (event.name.includes('GC')) {
        buckets[bucketIndex].gc += duration
      } else {
        buckets[bucketIndex].other += duration
      }
    }
  }

  console.log('Activity over time (100ms buckets):')
  console.log('Legend: █ = 10ms+, ▓ = 5-10ms, ▒ = 1-5ms, ░ = <1ms')
  console.log('')

  for (let i = 0; i < Math.min(50, numBuckets); i++) {
    const bucket = buckets[i]
    const total = (bucket.postMessage + bucket.eval + bucket.gc + bucket.other) / 1000
    const timeLabel = `${(i * 100).toString().padStart(5)}ms`

    let bar = ''
    if (total >= 10) bar = '█'.repeat(Math.min(50, Math.floor(total / 2)))
    else if (total >= 5) bar = '▓'.repeat(Math.min(50, Math.floor(total)))
    else if (total >= 1) bar = '▒'.repeat(Math.min(50, Math.floor(total * 2)))
    else if (total > 0) bar = '░'.repeat(Math.min(50, Math.floor(total * 10)))

    if (bar.length > 0) {
      console.log(`${timeLabel}: ${bar} (${total.toFixed(1)}ms)`)
    }
  }
}

console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ Detailed Analysis Complete')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
