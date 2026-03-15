/* eslint-disable no-console */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { launch } from 'puppeteer'

import { BASICAUTH_PORT, OAUTH_PORT, PORT } from './helpers.ts'
import { buildPath, startServer } from './server.ts'
import { startBasicAuthServer, startOAuthServer } from './servers.ts'
import { snapshotConfig } from './snapshot.ts'

import type { TestSuite } from './types.ts'
import type { Server } from 'http'
import type { Browser, Page } from 'puppeteer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const volvoxDataPath = path.resolve(__dirname, '../test_data/volvox')

const args = process.argv.slice(2)
const headed = args.includes('--headed')
const slowMoArg = args.find(a => a.startsWith('--slow-mo='))
const slowMo = slowMoArg ? parseInt(slowMoArg.split('=')[1]!, 10) : 0
const updateSnapshots =
  args.includes('--update-snapshots') || args.includes('-u')
const runAuthTests = args.includes('--auth')
const filterArg = args.find(a => a.startsWith('--filter='))
const filter = filterArg ? filterArg.split('=')[1]!.toLowerCase() : ''
const includeRemote = args.includes('--include-remote')
const backendArg = args.find(a => a.startsWith('--backend='))
const backendValue = backendArg ? backendArg.split('=')[1]! : undefined

snapshotConfig.updateSnapshots = updateSnapshots

type Backend = 'webgl' | 'webgpu' | 'canvas2d'

function chromeArgsForBackend(backend?: Backend) {
  const chromeArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-popup-blocking',
  ]
  if (backend === 'webgl') {
    chromeArgs.push('--use-gl=angle', '--use-angle=swiftshader')
  } else if (backend === 'webgpu') {
    chromeArgs.push('--enable-unsafe-webgpu', '--enable-features=Vulkan')
  } else if (backend === 'canvas2d') {
    chromeArgs.push('--disable-gpu')
  }
  return chromeArgs
}

async function discoverSuites(): Promise<TestSuite[]> {
  const suitesDir = path.resolve(__dirname, 'suites')
  const files = fs
    .readdirSync(suitesDir)
    .filter(f => f.endsWith('.ts'))
    .sort()
  const suites: TestSuite[] = []

  for (const file of files) {
    const mod = await import(path.join(suitesDir, file))
    const exported = mod.default
    if (Array.isArray(exported)) {
      for (const s of exported) {
        suites.push(s)
      }
    } else {
      suites.push(exported)
    }
  }

  return suites
}

async function runTests(
  page: Page,
  browser: Browser,
  suites: TestSuite[],
  includeAuth: boolean,
) {
  let passed = 0
  let failed = 0

  const suitesToRun = suites.filter(suite => {
    if (suite.requiresAuth && !includeAuth) {
      return false
    }
    if (suite.requiresRemote && !includeRemote) {
      return false
    }
    if (filter && !suite.name.toLowerCase().includes(filter)) {
      return false
    }
    return true
  })

  for (const suite of suitesToRun) {
    console.log(`\n  ${suite.name}`)

    for (const test of suite.tests) {
      const start = performance.now()
      process.stdout.write(`    ⏳ ${test.name}...`)

      try {
        await page.goto(`http://localhost:${PORT}/test_data/volvox/config.json`)
        await page.evaluate(() => {
          localStorage.clear()
          sessionStorage.clear()
        })
        await page.goto('about:blank')
        await test.fn(page, browser)

        const duration = performance.now() - start
        passed++

        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
        }
        console.log(`    ✓ ${test.name} (${Math.round(duration)}ms)`)
      } catch (e) {
        failed++
        const error = e instanceof Error ? e.message : String(e)

        if (process.stdout.isTTY) {
          process.stdout.clearLine(0)
          process.stdout.cursorTo(0)
        }
        console.log(`    ✗ ${test.name}`)
        console.log(`      Error: ${error}`)
      }
    }
  }

  return { passed, failed }
}

async function runWithBackend(
  suites: TestSuite[],
  backend: Backend | undefined,
) {
  snapshotConfig.backend = backend ?? ''

  const chromeArgs = chromeArgsForBackend(backend)
  const browser = await launch({
    headless: !headed,
    slowMo,
    args: chromeArgs,
    defaultViewport: { width: 1280, height: 800 },
  })

  const page = await browser.newPage()
  page.on('console', msg => {
    const text = msg.text()
    if (text.includes('favicon')) {
      return
    }
    const type = msg.type()
    if (type === 'error') {
      console.error('  Browser:', text)
    } else if (type === 'warning') {
      console.warn('  Browser:', text)
    } else {
      console.log('  Browser:', text)
    }
  })

  try {
    return await runTests(page, browser, suites, runAuthTests)
  } finally {
    await browser.close()
  }
}

async function main() {
  if (!fs.existsSync(buildPath)) {
    console.error(
      'Error: Build directory not found. Run `yarn build` in products/jbrowse-web first.',
    )
    process.exit(1)
  }

  console.log('Starting test server...')
  const server = await startServer(PORT)

  let oauthServer: Server | undefined
  let basicAuthServer: Server | undefined

  try {
    if (runAuthTests) {
      console.log('Starting auth servers...')
      oauthServer = await startOAuthServer({
        port: OAUTH_PORT,
        redirectPort: PORT,
        dataPath: volvoxDataPath,
      })
      basicAuthServer = await startBasicAuthServer({
        port: BASICAUTH_PORT,
        dataPath: volvoxDataPath,
      })
    }

    console.log('Discovering test suites...')
    const suites = await discoverSuites()
    console.log(`Found ${suites.length} test suites`)

    const backends: (Backend | undefined)[] =
      backendValue === 'all'
        ? ['canvas2d', 'webgl']
        : [backendValue as Backend | undefined]

    let totalPassed = 0
    let totalFailed = 0

    for (const backend of backends) {
      console.log(`\nLaunching browser (headed: ${headed})...`)
      if (runAuthTests) {
        console.log('(including auth tests)')
      }
      if (filter) {
        console.log(`(filtering by: ${filter})`)
      }
      console.log(`(backend: ${backend ?? 'default'})`)

      const { passed, failed } = await runWithBackend(suites, backend)
      totalPassed += passed
      totalFailed += failed
    }

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`  Tests: ${totalPassed} passed, ${totalFailed} failed`)
    if (backends.length > 1) {
      console.log(`  Backends tested: ${backends.join(', ')}`)
    }
    console.log(`${'─'.repeat(50)}\n`)

    process.exit(totalFailed > 0 ? 1 : 0)
  } catch (e) {
    console.error('Fatal error:', e)
    process.exit(1)
  } finally {
    server.close()
    oauthServer?.close()
    basicAuthServer?.close()
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
