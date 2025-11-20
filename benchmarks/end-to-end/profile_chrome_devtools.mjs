import fs from 'fs'
import puppeteer from 'puppeteer'

const testType = process.argv[2] || 'shortread' // 'longread' or 'shortread'
const coverage = process.argv[3] || '200x'
const buildFolder = process.argv[4] || 'port3000' // folder name in /var/www/html/jb2/

const testURL = `http://localhost/jb2/${buildFolder}/?config=test_data%2Fhg19mod.json&assembly=hg19mod&loc=chr22_mask:80,630..83,605&tracks=${coverage}.${testType}.cram`

console.log('🔬 Chrome DevTools Performance Profiling')
console.log(`   Test: ${coverage} ${testType}`)
console.log(`   URL: ${testURL}`)
console.log('')

async function captureProfile() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()

  // Get CDP session for profiling
  const client = await page.target().createCDPSession()

  console.log('📊 Starting Chrome DevTools profiler...')

  // Start profiling BEFORE navigation
  await client.send('Profiler.enable')
  await client.send('Profiler.start')

  const startTime = Date.now()
  console.log('🌐 Navigating to page...')
  await page.goto(testURL, { waitUntil: 'networkidle0', timeout: 120000 })

  console.log('⏳ Waiting for rendering to complete...')

  // Wait for the tracks to render
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

    // Wait for loading indicators to disappear
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

    // Let it stabilize
    await new Promise(resolve => setTimeout(resolve, 2000))

    const totalTime = Date.now() - startTime
    console.log(`✅ Rendering completed in ${totalTime}ms`)

  } catch (error) {
    console.log('⚠️  Timeout waiting for rendering, stopping profile anyway...')
  }

  console.log('🛑 Stopping profiler and collecting data...')

  // Stop profiling and get the profile
  const { profile } = await client.send('Profiler.stop')
  await client.send('Profiler.disable')

  const endTime = Date.now()
  const totalTime = endTime - startTime

  console.log(`⏱️  Total time: ${totalTime}ms`)
  console.log('')

  // Save the CPU profile
  const profilePath = `results/profile_${buildFolder}_${coverage}_${testType}_cpuprofile.json`
  fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2))
  console.log(`💾 CPU profile saved to: ${profilePath}`)
  console.log('')

  // Analyze the profile to find top functions
  console.log('📈 Analyzing profile...')
  console.log('')

  const nodes = profile.nodes || []
  const samples = profile.samples || []
  const timeDeltas = profile.timeDeltas || []

  // Count samples per function
  const sampleCounts = {}
  for (const sampleNodeId of samples) {
    sampleCounts[sampleNodeId] = (sampleCounts[sampleNodeId] || 0) + 1
  }

  // Calculate total time
  const totalSamples = samples.length
  const totalSamplingTime = timeDeltas.reduce((sum, delta) => sum + delta, 0)

  // Get top functions by sample count
  const functionStats = []
  for (const node of nodes) {
    const count = sampleCounts[node.id] || 0
    if (count > 0) {
      const percentage = (count / totalSamples) * 100
      const timeMs = (count / totalSamples) * totalSamplingTime / 1000 // Convert to ms

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

  // Sort by sample count (descending)
  functionStats.sort((a, b) => b.sampleCount - a.sampleCount)

  // Display top 20 functions
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔥 TOP 20 FUNCTIONS BY CPU TIME')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')

  for (let i = 0; i < Math.min(20, functionStats.length); i++) {
    const stat = functionStats[i]
    const fileName = stat.url.split('/').pop() || stat.url

    console.log(`${i + 1}. ${stat.functionName}`)
    console.log(`   File: ${fileName}${stat.lineNumber >= 0 ? `:${stat.lineNumber}` : ''}`)
    console.log(`   Time: ~${stat.estimatedTimeMs.toFixed(2)}ms (${stat.percentage.toFixed(1)}% of samples)`)
    console.log('')
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 HOW TO VIEW DETAILED FLAME GRAPH:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('1. Open Chrome DevTools (F12)')
  console.log('2. Go to the "Performance" tab')
  console.log('3. Click the "⬆" (upload) icon')
  console.log(`4. Select: ${profilePath}`)
  console.log('5. Explore the flame graph to see the call stack and timing')
  console.log('')
  console.log('Look for:')
  console.log('  - CRAM/BAM decompression functions')
  console.log('  - File fetching/reading')
  console.log('  - Your parsing functions (processDepth, processMismatches, etc.)')
  console.log('  - Worker thread activity')
  console.log('')

  await browser.close()

  return {
    totalTime,
    profilePath,
    topFunctions: functionStats.slice(0, 20),
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
