import { writeFileSync, existsSync, mkdirSync } from 'fs'
import http from 'http'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { ChildProcess } from 'child_process'

import { WebDriver, By, until } from 'selenium-webdriver'

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
  clickButton,
  findByText,
  cleanupUI,
  openMenuItem,
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

// The Add-track stepper renders one button (testid addTrackNextButton) per step,
// but only the active step's button is displayed. Click the visible, enabled one
// to advance ("Next" on the source step, "Add" on the confirm step).
async function clickActiveAddTrackButton(driver: WebDriver): Promise<void> {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const buttons = await driver.findElements(
      By.css('[data-testid="addTrackNextButton"]'),
    )
    for (const button of buttons) {
      if ((await button.isDisplayed()) && (await button.isEnabled())) {
        await driver.executeScript('arguments[0].click();', button)
        return
      }
    }
    await delay(300)
  }
  throw new Error('no enabled addTrackNextButton found')
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

  // "Open genome(s)" dialog (custom genome from files/URLs)
  console.log('Capturing open-genome dialog...')
  await clickButton(driver, 'Open new genome')
  await findByText(driver, 'Open genome(s)')
  await delay(1000)
  await capture(driver, 'desktop-open-genome.png')
  await cleanupUI(driver)

  // "Available genomes" dialog (searchable table of public assemblies, fetched
  // from jbrowse.org/hubs — wait for real rows, not the skeleton loader)
  console.log('Capturing available-genomes dialog...')
  await clickButton(driver, 'Show all available genomes')
  await findByText(driver, 'Available genomes')
  await driver.wait(until.elementLocated(By.css('table tbody tr')), 30000)
  await delay(2000) // let rows/network settle
  await capture(driver, 'desktop-available-genomes.png')
  await cleanupUI(driver)

  // Loaded session with the bundled volvox assembly, served over http
  console.log('Opening volvox genome...')
  await openVolvoxGenome(
    driver,
    `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.fa`,
  )
  await delay(2000) // let the view fully paint

  // Add the bundled volvox GFF3 genes track over http so the session screenshot
  // shows annotated genes instead of a bare sequence. An hg38 demo with NCBI
  // RefSeq + ClinVar is not viable here: the harness serves only local
  // test_data and the repo has no hg38 FASTA, and those tracks need remote
  // fetches that are unreliable/blocked in headless Electron.
  console.log('Adding volvox GFF3 genes track...')
  await openMenuItem(driver, 'File', 'Open track...')
  await findByText(driver, 'Add a track')
  await delay(1000)
  // The Main-file FileSelector defaults to URL mode (no location yet), so the
  // urlInput is already present; the index url auto-infers as <main>.tbi.
  const trackUrlInput = await driver.wait(
    until.elementLocated(By.css('[data-testid="urlInput"]')),
    10000,
  )
  await trackUrlInput.sendKeys(
    `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.sort.gff3.gz`,
  )
  await delay(500)
  await clickActiveAddTrackButton(driver) // Next: source -> confirm track type
  await delay(1500)
  await clickActiveAddTrackButton(driver) // Add: shows track + closes widget
  await delay(3000) // let the GFF3 track fetch + paint

  await capture(driver, 'desktop-session.png')

  // "Add a track" form (File -> Open track...)
  console.log('Capturing add-track form...')
  await openMenuItem(driver, 'File', 'Open track...')
  await findByText(driver, 'Add a track')
  await delay(1500)
  await capture(driver, 'desktop-add-track.png')
  await cleanupUI(driver)

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
