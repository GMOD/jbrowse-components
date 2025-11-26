import fs from 'fs'

const profileFile = process.argv[2] || fs.readdirSync('.').find(f => f.endsWith('.cpuprofile'))

if (!profileFile) {
  console.error('No .cpuprofile file found')
  process.exit(1)
}

console.log(`Analyzing: ${profileFile}\n`)

const profile = JSON.parse(fs.readFileSync(profileFile, 'utf8'))

// Build a map of node ID to node
const nodes = new Map()
for (const node of profile.nodes) {
  nodes.set(node.id, node)
}

// Calculate self time for each node
const selfTime = new Map()
const totalTime = new Map()

for (const sample of profile.samples) {
  const nodeId = sample
  if (!selfTime.has(nodeId)) {
    selfTime.set(nodeId, 0)
  }
  selfTime.set(nodeId, selfTime.get(nodeId) + 1)
}

// Get function names
function getFunctionName(node) {
  if (!node || !node.callFrame) return 'unknown'
  const funcName = node.callFrame.functionName || '(anonymous)'
  const url = node.callFrame.url || ''
  const fileName = url.split('/').pop() || url
  const location = fileName ? `${fileName}:${node.callFrame.lineNumber}` : 'native'
  return `${funcName} [${location}]`
}

// Build summary
const summary = []
for (const [nodeId, time] of selfTime.entries()) {
  const node = nodes.get(nodeId)
  if (!node) continue

  const funcName = getFunctionName(node)

  // Skip Node.js internals unless significant
  if (funcName.includes('internal/') && time < 50) continue

  summary.push({
    name: funcName,
    selfTime: time,
    percentage: (time / profile.samples.length) * 100
  })
}

// Sort by self time
summary.sort((a, b) => b.selfTime - a.selfTime)

console.log('Top time-consuming functions (by self time):\n')
console.log('Rank | Self Time | % Total | Function')
console.log('-----|-----------|---------|----------')

const top30 = summary.slice(0, 30)
for (let i = 0; i < top30.length; i++) {
  const item = top30[i]
  console.log(
    `${String(i + 1).padStart(4)} | ${String(item.selfTime).padStart(9)} | ${item.percentage.toFixed(2).padStart(6)}% | ${item.name}`
  )
}

console.log(`\nTotal samples: ${profile.samples.length}`)
console.log(`Duration: ${(profile.endTime - profile.startTime) / 1000000}ms`)
