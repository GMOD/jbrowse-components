import fs from 'fs'

const traceFile = process.argv[2] || 'results/trace_port3000_200x_shortread.json'

console.log('🔍 CPU Profile Analysis from Chrome Trace')
console.log(`📁 File: ${traceFile}`)
console.log('')

const trace = JSON.parse(fs.readFileSync(traceFile, 'utf8'))
const events = trace.traceEvents || []

// Find ProfileChunk events which contain the actual CPU profiling data
const profileChunks = events.filter(e => e.name === 'ProfileChunk')

console.log(`Found ${profileChunks.length} ProfileChunk events`)
console.log('')

// Aggregate all function samples
const functionStats = new Map()

for (const chunk of profileChunks) {
  const cpuProfile = chunk.args?.data?.cpuProfile
  if (!cpuProfile) continue

  const nodes = cpuProfile.nodes || []
  const samples = cpuProfile.samples || []
  const timeDeltas = cpuProfile.timeDeltas || []

  // Build a node map for quick lookup
  const nodeMap = new Map()
  for (const node of nodes) {
    nodeMap.set(node.id, node)
  }

  // Process each sample
  for (let i = 0; i < samples.length; i++) {
    const nodeId = samples[i]
    const timeDelta = timeDeltas[i] || 0 // microseconds
    const node = nodeMap.get(nodeId)

    if (!node) continue

    const funcName = node.callFrame.functionName || '(anonymous)'
    const url = node.callFrame.url || ''
    const lineNumber = node.callFrame.lineNumber || 0
    const fileName = url.split('/').pop() || url

    const key = `${funcName}|${fileName}|${lineNumber}`

    if (!functionStats.has(key)) {
      functionStats.set(key, {
        name: funcName,
        fileName,
        url,
        lineNumber,
        samples: 0,
        totalTime: 0,
      })
    }

    const stats = functionStats.get(key)
    stats.samples++
    stats.totalTime += timeDelta
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🔥 TOP FUNCTIONS BY CPU TIME')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const sortedFunctions = Array.from(functionStats.values())
  .sort((a, b) => b.totalTime - a.totalTime)

console.log('Top 50 functions by total CPU time:\n')

for (let i = 0; i < Math.min(50, sortedFunctions.length); i++) {
  const func = sortedFunctions[i]
  const totalMs = (func.totalTime / 1000).toFixed(2)
  const avgMs = (func.totalTime / func.samples / 1000).toFixed(3)

  console.log(`${(i + 1).toString().padStart(2)}. ${func.name}`)
  console.log(`    ${func.fileName}:${func.lineNumber}`)
  console.log(`    Total: ${totalMs}ms | Samples: ${func.samples} | Avg: ${avgMs}ms/sample`)
  console.log('')
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎯 JBROWSE TARGET FUNCTIONS')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

const targetPatterns = [
  'processDepth',
  'processMismatches',
  'generateCoverage',
  'readFeaturesToMismatches',
  'parseItf8',
  'cramEncoding',
  'mismatches',
  'parse',
  'getPairOrientation',
  'coverage',
]

for (const pattern of targetPatterns) {
  const matches = sortedFunctions.filter(f =>
    f.name.toLowerCase().includes(pattern.toLowerCase())
  )

  if (matches.length === 0) continue

  console.log(`\n📌 Functions matching "${pattern}":\n`)

  for (const func of matches.slice(0, 10)) {
    const totalMs = (func.totalTime / 1000).toFixed(2)
    const avgMs = (func.totalTime / func.samples / 1000).toFixed(3)

    console.log(`   ${func.name}`)
    console.log(`   ${func.fileName}:${func.lineNumber}`)
    console.log(`   Total: ${totalMs}ms | Samples: ${func.samples} | Avg: ${avgMs}ms/sample`)
    console.log('')
  }
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📊 FUNCTIONS BY FILE')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// Group by file
const fileStats = new Map()

for (const func of sortedFunctions) {
  const fileName = func.fileName
  if (!fileStats.has(fileName)) {
    fileStats.set(fileName, {
      fileName,
      totalTime: 0,
      functions: [],
    })
  }

  const fileData = fileStats.get(fileName)
  fileData.totalTime += func.totalTime
  fileData.functions.push(func)
}

const sortedFiles = Array.from(fileStats.values())
  .sort((a, b) => b.totalTime - a.totalTime)

console.log('Top 20 files by CPU time:\n')

for (let i = 0; i < Math.min(20, sortedFiles.length); i++) {
  const file = sortedFiles[i]
  const totalMs = (file.totalTime / 1000).toFixed(2)
  const funcCount = file.functions.length

  console.log(`${(i + 1).toString().padStart(2)}. ${file.fileName}`)
  console.log(`    Total: ${totalMs}ms across ${funcCount} functions`)

  // Show top 3 functions in this file
  const topFuncs = file.functions.sort((a, b) => b.totalTime - a.totalTime).slice(0, 3)
  for (const func of topFuncs) {
    const funcMs = (func.totalTime / 1000).toFixed(2)
    console.log(`       - ${func.name}: ${funcMs}ms`)
  }
  console.log('')
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('💾 EXPORTING DETAILED DATA')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')

// Export top functions to JSON for further analysis
const exportData = {
  topFunctions: sortedFunctions.slice(0, 100).map(f => ({
    name: f.name,
    file: f.fileName,
    line: f.lineNumber,
    totalTimeMs: (f.totalTime / 1000).toFixed(2),
    samples: f.samples,
  })),
  topFiles: sortedFiles.slice(0, 20).map(f => ({
    file: f.fileName,
    totalTimeMs: (f.totalTime / 1000).toFixed(2),
    functionCount: f.functions.length,
  })),
}

const exportPath = traceFile.replace('.json', '_analysis.json')
fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2))

console.log(`✓ Exported detailed analysis to: ${exportPath}`)
console.log('')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('✅ Analysis Complete')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
