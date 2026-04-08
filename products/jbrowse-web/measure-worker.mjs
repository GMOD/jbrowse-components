import { spawn } from 'child_process'
import puppeteer from 'puppeteer'

const PORT = 9555

const server = spawn('npx', ['serve', 'build', '-l', String(PORT), '--no-clipboard'], {
  stdio: ['ignore', 'pipe', 'pipe'],
})

for (let i = 0; i < 20; i++) {
  try {
    await fetch(`http://localhost:${PORT}/`)
    break
  } catch {
    await new Promise(r => setTimeout(r, 500))
  }
}

try {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })
  const page = await browser.newPage()

  const allRequests = new Map()

  // Use Target.setAutoAttach to catch workers early
  const client = await page.createCDPSession()
  await client.send('Network.enable')
  await client.send('Target.setAutoAttach', {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: true,
  })

  // Track main thread requests
  client.on('Network.requestWillBeSent', event => {
    allRequests.set(`main-${event.requestId}`, {
      url: event.request.url,
      size: 0,
      thread: 'main',
    })
  })
  client.on('Network.loadingFinished', event => {
    const req = allRequests.get(`main-${event.requestId}`)
    if (req) {
      req.size = event.encodedDataLength
    }
  })

  // Handle attached targets (workers)
  client.on('Target.attachedToTarget', async event => {
    const { sessionId, targetInfo } = event
    if (targetInfo.type === 'worker') {
      // Send commands to the worker session
      await client.send('Network.enable', {}, sessionId)
      await client.send('Runtime.runIfWaitingForDebugger', {}, sessionId)
    }
  })

  // Worker network events come with sessionId
  client.on('Network.requestWillBeSent', event => {
    // This handler also catches worker requests via flattened sessions
  })

  // Alternative: use sessionId-prefixed events
  const origEmit = client.emit.bind(client)
  const workerSessions = new Set()

  client.on('Target.attachedToTarget', event => {
    if (event.targetInfo.type === 'worker') {
      workerSessions.add(event.sessionId)
    }
  })

  // Monkey-patch to intercept session-specific events
  const workerRequests = new Map()
  client.connection().on('message', rawMsg => {
    try {
      const msg = JSON.parse(rawMsg)
      if (msg.params?.sessionId && workerSessions.has(msg.params.sessionId)) {
        const params = msg.params
        if (msg.method === 'Network.requestWillBeSent') {
          workerRequests.set(params.requestId, {
            url: params.request.url,
            size: 0,
          })
        } else if (msg.method === 'Network.loadingFinished') {
          const req = workerRequests.get(params.requestId)
          if (req) {
            req.size = params.encodedDataLength
          }
        }
      }
    } catch {}
  })

  await page.goto(`http://localhost:${PORT}/?config=test_data/volvox/config.json`, {
    waitUntil: 'networkidle0',
    timeout: 60000,
  })

  await new Promise(r => setTimeout(r, 5000))

  // Collect results
  const workerJS = [...workerRequests.values()]
    .filter(r => r.url?.endsWith('.js'))
    .sort((a, b) => b.size - a.size)

  const mainJS = [...allRequests.values()]
    .filter(r => r.url?.endsWith('.js'))
    .sort((a, b) => b.size - a.size)

  console.log('\n=== Worker JS requests ===')
  let workerTotal = 0
  for (const r of workerJS) {
    const kb = (r.size / 1024).toFixed(1)
    const name = r.url.split('/').pop()
    workerTotal += r.size
    console.log(`  ${kb.padStart(8)} KB  ${name}`)
  }

  console.log('\n=== Main thread JS requests (top 15) ===')
  for (const r of mainJS.slice(0, 15)) {
    const kb = (r.size / 1024).toFixed(1)
    const name = r.url.split('/').pop()
    console.log(`  ${kb.padStart(8)} KB  ${name}`)
  }
  const mainTotal = mainJS.reduce((sum, r) => sum + r.size, 0)

  console.log(`\n=== Summary ===`)
  console.log(`Worker JS loaded:      ${(workerTotal / 1024).toFixed(1)} KB (${workerJS.length} files)`)
  console.log(`Main thread JS loaded: ${(mainTotal / 1024).toFixed(1)} KB (${mainJS.length} files)`)
  console.log(`Combined:              ${((workerTotal + mainTotal) / 1024).toFixed(1)} KB`)

  await browser.close()
} catch(e) {
  console.error(e)
} finally {
  server.kill()
}
