import fs from 'fs'
import puppeteer from 'puppeteer'

const testType = process.argv[2] || 'shortread'
const coverage = process.argv[3] || '200x'
const buildFolder = process.argv[4] || 'port3000'

const testURL = `http://localhost/jb2/${buildFolder}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`

console.log('🔬 Chrome DevTools Performance Profiling (Including Workers)')
console.log(`   Test: ${coverage} ${testType}`)
console.log(`   URL: ${testURL}`)
console.log('')

async function captureProfile() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()

  // Track all worker targets
  const workerProfiles = []
  const workerSessions = new Map()

  console.log('📊 Starting profiler on main thread...')

  // Get CDP session for main page
  const mainClient = await page.target().createCDPSession()
  await mainClient.send('Profiler.enable')
  await mainClient.send('Profiler.start')

  // Listen for new worker targets
  browser.on('targetcreated', async target => {
    if (target.type() === 'service_worker' || target.type() === 'worker') {
      console.log(`🔧 Detected worker: ${target.url()}`)

      try {
        const workerClient = await target.createCDPSession()
        await workerClient.send('Profiler.enable')
        await workerClient.send('Profiler.start')
        workerSessions.set(target, workerClient)
        console.log(`   ✓ Started profiling worker`)
      } catch (error) {
        console.log(`   ⚠️  Could not profile worker: ${error.message}`)
      }
    }
  })

  const startTime = Date.now()
  console.log('🌐 Navigating to page...')
  await page.goto(testURL, { waitUntil: 'networkidle0', timeout: 120000 })

  // Give workers time to spawn
  await new Promise(resolve => setTimeout(resolve, 2000))

  console.log(`📋 Active workers: ${workerSessions.size}`)

  console.log('⏳ Waiting for rendering to complete...')

  const params = new URL(testURL).searchParams
  const tracks = params.get('tracks')
  const n = tracks.split(',').length
  const nblocks = 2 * n

  try {
    await page.waitForFunction(
      nblocks =>
        document.querySelectorAll('[data-testid="pileup-overlay-normal"]').length === nblocks &&
        document.querySelectorAll('[data-testid="wiggle-rendering-test"]').length == nblocks,
      { timeout: 300000 },
      nblocks,
    )

    await page.waitForFunction(
      () => {
        const loadingTexts = Array.from(document.querySelectorAll('*')).filter(el => {
          const text = el.textContent || ''
          return (
            text.includes('Processing alignments') ||
            text.includes('Downloading alignments') ||
            text.includes('Loading')
          )
        })
        return loadingTexts.length === 0
      },
      { timeout: 120000 },
    ).catch(() => {})

    await new Promise(resolve => setTimeout(resolve, 2000))

    const totalTime = Date.now() - startTime
    console.log(`✅ Rendering completed in ${totalTime}ms`)

  } catch (error) {
    console.log('⚠️  Timeout waiting for rendering, stopping profiles anyway...')
  }

  console.log('🛑 Stopping profilers and collecting data...')
  console.log('')

  // Stop main thread profiler
  const { profile: mainProfile } = await mainClient.send('Profiler.stop')
  await mainClient.send('Profiler.disable')

  const mainProfilePath = `results/profile_${buildFolder}_${coverage}_${testType}_main.cpuprofile.json`
  fs.writeFileSync(mainProfilePath, JSON.stringify(mainProfile, null, 2))
  console.log(`💾 Main thread profile: ${mainProfilePath}`)

  // Stop worker profilers
  let workerIndex = 0
  for (const [target, client] of workerSessions.entries()) {
    try {
      const { profile: workerProfile } = await client.send('Profiler.stop')
      await client.send('Profiler.disable')

      const workerUrl = target.url()
      const workerName = workerUrl.split('/').pop().replace('.js', '') || `worker${workerIndex}`
      const workerProfilePath = `results/profile_${buildFolder}_${coverage}_${testType}_worker_${workerName}.cpuprofile.json`

      fs.writeFileSync(workerProfilePath, JSON.stringify(workerProfile, null, 2))
      console.log(`💾 Worker profile: ${workerProfilePath}`)

      workerIndex++
    } catch (error) {
      console.log(`⚠️  Could not stop worker profiler: ${error.message}`)
    }
  }

  const endTime = Date.now()
  const totalTime = endTime - startTime

  console.log('')
  console.log(`⏱️  Total time: ${totalTime}ms`)
  console.log('')

  // Analyze all profiles
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📈 ANALYSIS')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  analyzeProfile('Main Thread', mainProfile)

  workerIndex = 0
  for (const [target, client] of workerSessions.entries()) {
    try {
      const { profile: workerProfile } = await client.send('Profiler.stop').catch(() => ({ profile: null }))
      if (workerProfile) {
        const workerUrl = target.url()
        const workerName = workerUrl.split('/').pop().replace('.js', '') || `Worker ${workerIndex}`
        analyzeProfile(workerName, workerProfile)
      }
    } catch (error) {
      // Already stopped, skip
    }
    workerIndex++
  }

  await browser.close()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 HOW TO VIEW DETAILED PROFILES:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('Load each profile in Chrome DevTools:')
  console.log('1. Open Chrome DevTools (F12)')
  console.log('2. Go to "Performance" tab')
  console.log('3. Click upload icon (⬆)')
  console.log('4. Load main thread profile first, then worker profiles')
  console.log('')
  console.log('Files:')
  console.log(`   ${mainProfilePath}`)
  for (let i = 0; i < workerSessions.size; i++) {
    console.log(`   results/profile_${buildFolder}_${coverage}_${testType}_worker_*.cpuprofile.json`)
  }
  console.log('')
  console.log('💡 The WORKER profiles will show your parsing code!')
  console.log('   Look for: processDepth, processMismatches, generateCoverageBins')
  console.log('')

  return {
    totalTime,
    mainProfilePath,
    workerCount: workerSessions.size,
  }
}

function analyzeProfile(name, profile) {
  console.log(`\n🔍 ${name}`)
  console.log('─'.repeat(50))

  const nodes = profile.nodes || []
  const samples = profile.samples || []
  const timeDeltas = profile.timeDeltas || []

  if (samples.length === 0) {
    console.log('   No samples collected')
    return
  }

  const sampleCounts = {}
  for (const sampleNodeId of samples) {
    sampleCounts[sampleNodeId] = (sampleCounts[sampleNodeId] || 0) + 1
  }

  const totalSamples = samples.length
  const totalSamplingTime = timeDeltas.reduce((sum, delta) => sum + delta, 0)

  const functionStats = []
  for (const node of nodes) {
    const count = sampleCounts[node.id] || 0
    if (count > 0) {
      const percentage = (count / totalSamples) * 100
      const timeMs = (count / totalSamples) * totalSamplingTime / 1000

      functionStats.push({
        functionName: node.callFrame.functionName || '(anonymous)',
        url: node.callFrame.url || '(native)',
        lineNumber: node.callFrame.lineNumber,
        sampleCount: count,
        percentage: percentage,
        estimatedTimeMs: timeMs,
      })
    }
  }

  functionStats.sort((a, b) => b.sampleCount - a.sampleCount)

  console.log(`\nTop 10 functions by CPU time:\n`)
  for (let i = 0; i < Math.min(10, functionStats.length); i++) {
    const stat = functionStats[i]
    const fileName = stat.url.split('/').pop() || stat.url

    console.log(`${i + 1}. ${stat.functionName}`)
    console.log(`   ${fileName}${stat.lineNumber >= 0 ? ':' + stat.lineNumber : ''}`)
    console.log(`   ~${stat.estimatedTimeMs.toFixed(1)}ms (${stat.percentage.toFixed(1)}%)`)
  }
}

try {
  const result = await captureProfile()
  console.log('✅ Profiling complete!')
  process.exit(0)
} catch (error) {
  console.error('❌ Error:', error.message)
  console.error(error.stack)
  process.exit(1)
}
