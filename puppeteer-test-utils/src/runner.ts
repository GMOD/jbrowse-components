/* eslint-disable no-console */
import { launch } from 'puppeteer'

import { type ServerOptions, startServer } from './server.js'

import type { Page } from 'puppeteer'

export interface TestSuite {
  name: string
  tests: { name: string; fn: (page: Page) => Promise<void> }[]
}

export interface RunnerOptions {
  server: ServerOptions
  headed?: boolean
  slowMo?: number
  viewport?: { width: number; height: number }
}

export async function runTests(page: Page, testSuites: TestSuite[]) {
  let passed = 0
  let failed = 0

  for (const suite of testSuites) {
    console.log(`\n  ${suite.name}`)

    for (const test of suite.tests) {
      const start = performance.now()
      process.stdout.write(`    ⏳ ${test.name}...`)

      try {
        await page.goto('about:blank')
        await test.fn(page)

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

export async function createTestRunner(
  options: RunnerOptions,
  testSuites: TestSuite[],
) {
  const { server: serverOptions, headed, slowMo, viewport } = options

  console.log('Starting test server...')
  const server = await startServer(serverOptions)

  let browser: Awaited<ReturnType<typeof launch>> | undefined

  try {
    console.log(`Launching browser (headed: ${headed ?? false})...`)
    browser = await launch({
      headless: !headed,
      slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
      ],
      defaultViewport: viewport ?? { width: 1280, height: 800 },
    })

    const page = await browser.newPage()
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        console.error('  Browser:', msg.text())
      }
    })

    console.log('\nRunning browser tests...')
    const { passed, failed } = await runTests(page, testSuites)

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
  }
}

export function parseArgs(args: string[]) {
  const headed = args.includes('--headed')
  const slowMoArg = args.find(a => a.startsWith('--slow-mo='))
  const slowMo = slowMoArg ? parseInt(slowMoArg.split('=')[1]!, 10) : 0
  const updateSnapshots =
    args.includes('--update-snapshots') || args.includes('-u')

  return { headed, slowMo, updateSnapshots }
}
