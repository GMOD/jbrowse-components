/* eslint-disable no-console */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { launch } from 'puppeteer'

import { BASICAUTH_PORT, OAUTH_PORT, PORT } from './helpers.ts'
import { buildPath, startServer } from './server.ts'
import { setUpdateSnapshots } from './snapshot.ts'
import { startBasicAuthServer, startOAuthServer } from './servers.ts'

import type { Browser, Page } from 'puppeteer'
import type { TestSuite } from './types.ts'

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

setUpdateSnapshots(updateSnapshots)

async function discoverSuites(): Promise<TestSuite[]> {
  const suitesDir = path.resolve(__dirname, 'suites')
  const files = fs.readdirSync(suitesDir).filter(f => f.endsWith('.ts')).sort()
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

async function main() {
  if (!fs.existsSync(buildPath)) {
    console.error(
      'Error: Build directory not found. Run `yarn build` in products/jbrowse-web first.',
    )
    process.exit(1)
  }

  console.log('Starting test server...')
  const server = await startServer(PORT)

  let browser: Browser | undefined
  let oauthServer: import('http').Server | undefined
  let basicAuthServer: import('http').Server | undefined

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

    console.log(`Launching browser (headed: ${headed})...`)
    browser = await launch({
      headless: !headed,
      slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-popup-blocking',
      ],
      defaultViewport: { width: 1280, height: 800 },
    })

    const page = await browser.newPage()
    page.on('console', msg => {
      const text = msg.text()
      if (msg.type() === 'error' && !text.includes('favicon')) {
        console.error('  Browser:', text)
      }
    })

    console.log('\nRunning browser tests...')
    if (runAuthTests) {
      console.log('(including auth tests)')
    }
    if (filter) {
      console.log(`(filtering by: ${filter})`)
    }
    const { passed, failed } = await runTests(
      page,
      browser,
      suites,
      runAuthTests,
    )

    console.log(`\n${'─'.repeat(50)}`)
    console.log(`  Tests: ${passed} passed, ${failed} failed`)
    console.log(`${'─'.repeat(50)}\n`)

    process.exit(failed > 0 ? 1 : 0)
  } catch (e) {
    console.error('Fatal error:', e)
    process.exit(1)
  } finally {
    await browser?.close()
    server.close()
    oauthServer?.close()
    basicAuthServer?.close()
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main()
