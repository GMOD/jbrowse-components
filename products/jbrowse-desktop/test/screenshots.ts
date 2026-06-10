import { writeFileSync, existsSync, mkdirSync } from 'fs'
import http from 'http'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { ChildProcess } from 'child_process'

import { WebDriver } from 'selenium-webdriver'

import {
  APP_BINARY,
  REPO_ROOT,
  isHeadless,
  delay,
  startChromedriver,
  startStaticServer,
  createDriver,
  waitForStartScreen,
  openVolvoxGenome,
  flushBrowserLogs,
  killProcesses,
} from './harness.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../../website/static/img')
const DATA_PORT = 9444

let chromedriverProcess: ChildProcess | null = null
let dataServer: http.Server | null = null
let driver: WebDriver | null = null

async function capture(
  driver: WebDriver,
  name: string,
  dir = OUT_DIR,
): Promise<void> {
  const png = await driver.takeScreenshot()
  const out = resolve(dir, name)
  writeFileSync(out, Buffer.from(png, 'base64'))
  console.log(`  ✓ wrote ${out}`)
}

async function main(): Promise<void> {
  console.log(`Running in ${isHeadless ? 'headless' : 'headed'} mode`)
  console.log(`App binary: ${APP_BINARY}`)

  if (!existsSync(APP_BINARY)) {
    console.error(`ERROR: App binary not found at ${APP_BINARY}`)
    console.error('Build it first with: pnpm package:linux:no-installer')
    process.exit(1)
  }
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true })
  }

  console.log('Cleaning up leftover processes...')
  await killProcesses()

  console.log(`Serving ${REPO_ROOT} on http://localhost:${DATA_PORT}...`)
  dataServer = await startStaticServer(REPO_ROOT, DATA_PORT)

  console.log('Starting ChromeDriver...')
  chromedriverProcess = await startChromedriver()

  console.log('Launching Electron app...')
  driver = await createDriver()

  // Start screen
  console.log('Capturing start screen...')
  await waitForStartScreen(driver)
  await delay(1500) // let panels settle
  await capture(driver, 'desktop-landing.png')

  // Loaded session with the bundled volvox assembly, served over http
  console.log('Opening volvox genome...')
  await openVolvoxGenome(
    driver,
    `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.fa`,
  )
  await delay(2000) // let the view fully paint
  await capture(driver, 'desktop-session.png')

  console.log('\nCleaning up...')
  try {
    await driver.quit()
  } catch (e) {
    console.warn('WARN: driver.quit() failed during cleanup:', e)
  }
  if (chromedriverProcess) {
    chromedriverProcess.kill('SIGKILL')
  }
  dataServer.close()
  await killProcesses()
  console.log('Done.')
  process.exit(0)
}

main().catch(async e => {
  console.error('Fatal error:', e)
  if (driver) {
    try {
      await flushBrowserLogs(driver)
    } catch (err) {
      console.warn('WARN: could not flush browser logs:', err)
    }
    try {
      await capture(driver, 'desktop-debug-failure.png', tmpdir())
    } catch (err) {
      console.warn('WARN: could not capture debug screenshot:', err)
    }
    try {
      await driver.quit()
    } catch (err) {
      console.warn('WARN: driver.quit() failed after fatal error:', err)
    }
  }
  if (chromedriverProcess) {
    chromedriverProcess.kill('SIGKILL')
  }
  if (dataServer) {
    dataServer.close()
  }
  await killProcesses()
  process.exit(1)
})
