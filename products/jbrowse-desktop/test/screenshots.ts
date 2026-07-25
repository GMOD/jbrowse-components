import { ChildProcess } from 'child_process'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import http from 'http'
import { tmpdir } from 'os'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

import { By, WebDriver, until } from 'selenium-webdriver'

import {
  APP_BINARY,
  REPO_ROOT,
  cleanupUI,
  clearInput,
  clickButton,
  createDriver,
  delay,
  findByText,
  flushBrowserLogs,
  isHeadless,
  killProcesses,
  openMenuItem,
  openVolvoxGenome,
  startChromedriver,
  startStaticServer,
  waitForStartScreen,
} from './harness.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = resolve(__dirname, '../../../website/static/img')
const DATA_PORT = 9444
const BLAT_PORT = 9445

// `--only <substring>` still walks the whole flow but writes only the matching
// figures, so regenerating one image can't churn the others with re-encoded
// pixels (unlike the web generator, this harness has no content-stable gate).
const onlyIndex = process.argv.indexOf('--only')
const ONLY = onlyIndex === -1 ? '' : process.argv[onlyIndex + 1]!

let chromedriverProcess: ChildProcess | null = null
let dataServer: http.Server | null = null
let blatServer: http.Server | null = null
let driver: WebDriver | null = null

async function capture(
  driver: WebDriver,
  name: string,
  dir = OUT_DIR,
): Promise<void> {
  if (ONLY && !name.includes(ONLY)) {
    console.log(`  ≈ skipped ${name} (--only ${ONLY})`)
  } else {
    const png = await driver.takeScreenshot()
    const out = resolve(dir, name)
    writeFileSync(out, Buffer.from(png, 'base64'))
    console.log(`  ✓ wrote ${out}`)
  }
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

// Kill CSS transitions/animations so a capture can't land on a half-faded
// dialog or menu (the desktop harness, unlike the web generator, drives a live
// app with MUI Grow/Fade transitions running).
async function freezeAnimations(driver: WebDriver): Promise<void> {
  await driver.executeScript(`
    const s = document.createElement('style')
    s.textContent =
      '*,*::before,*::after{transition:none !important;animation:none !important;}'
    document.head.appendChild(s)
  `)
}

const SAMPLE_SEQ = 'CACGTGACTGAGGCTTGATCCGGATTACAGTGCCATTGACCTGAAGTTCAGG'

// A stand-in hgBlat. Public UCSC BLAT sits behind a Cloudflare CAPTCHA and
// needs an account apiKey, so a result figure can't be captured against it;
// pointing the dialog's "BLAT server URL" field here instead exercises the real
// request → parse → on-the-fly track → navigate path with only UCSC's server
// substituted. The body is a genuine hgBlat output=json response shape: a
// strong 147bp hit over hg19 TP53 and a weaker partial hit on chr6.
const MOCK_BLAT_RESPONSE = JSON.stringify({
  track: 'blat',
  genome: 'hg19',
  fields: [
    'matches',
    'misMatches',
    'repMatches',
    'nCount',
    'qNumInsert',
    'qBaseInsert',
    'tNumInsert',
    'tBaseInsert',
    'strand',
    'qName',
    'qSize',
    'qStart',
    'qEnd',
    'tName',
    'tSize',
    'tStart',
    'tEnd',
    'blockCount',
    'blockSizes',
    'qStarts',
    'tStarts',
  ],
  blat: [
    // prettier-ignore
    [145, 2, 0, 0, 0, 0, 0, 0, '+', 'YourSeq', 147, 0, 147, 'chr17', 81195210, 7579838, 7579985, 1, '147', '0', '7579838'],
    // prettier-ignore
    [61, 9, 0, 0, 1, 3, 1, 12, '-', 'YourSeq', 147, 20, 90, 'chr6', 171115067, 36646200, 36646282, 2, '40,30', '20,63', '36646200,36646252'],
  ],
})

async function startMockBlatServer(port: number): Promise<http.Server> {
  const server = http.createServer((_req, res) => {
    // hgBlat serves its JSON body under a text/html content-type
    res.setHeader('Content-Type', 'text/html')
    res.end(MOCK_BLAT_RESPONSE)
  })
  await new Promise<void>((done, fail) => {
    server.on('error', fail)
    server.listen(port, '127.0.0.1', () => {
      done()
    })
  })
  return server
}

// BLAT and in-silico PCR (blat plugin, a desktop core plugin) query UCSC by
// assembly, so demonstrate them on a real UCSC assembly: launch the seeded hg19
// favorite from the start screen, capture both Tools-menu dialogs in their
// default (collapsed) state — which fits the window and keeps hg19 prominent;
// the guide prose covers the "advanced settings" apiKey/CAPTCHA path the toggle
// reveals — then hand the run back a clean start screen for the remaining shots.
async function captureBlatDialogs(driver: WebDriver): Promise<void> {
  console.log('Launching hg19 for BLAT/in-silico PCR dialogs...')
  const hg19Link = await driver.wait(
    until.elementLocated(By.xpath("//a[contains(., 'GRCh37/hg19')]")),
    30000,
  )
  await driver.executeScript('arguments[0].click();', hg19Link)
  // the app bar (where the blat plugin's Tools items live) appears once the
  // session opens; the hg19 config is fetched from jbrowse.org, so allow time
  await findByText(driver, 'Tools')
  await delay(3000)
  await freezeAnimations(driver)

  // Tools -> BLAT search: paste a sample sequence so the figure shows a query
  // being set up against hg19.
  console.log('Capturing BLAT search dialog...')
  await openMenuItem(driver, 'Tools', 'BLAT search')
  await findByText(driver, 'BLAT search (UCSC)')
  await delay(500)
  const blatSeqInput = await driver.wait(
    until.elementLocated(By.css('textarea:not([aria-hidden="true"])')),
    10000,
  )
  await blatSeqInput.click()
  await blatSeqInput.sendKeys(SAMPLE_SEQ)
  await delay(500)
  await capture(driver, 'desktop-blat-search.png')
  await cleanupUI(driver)

  // Tools -> In-silico PCR: the hgPcr primer-pair dialog. Its forward/reverse
  // primer fields carry their own example placeholders.
  console.log('Capturing In-silico PCR dialog...')
  await openMenuItem(driver, 'Tools', 'In-silico PCR')
  await findByText(driver, 'In-silico PCR (UCSC)')
  await delay(500)
  await capture(driver, 'desktop-ispcr.png')
  await cleanupUI(driver)

  // The result of a search is a track plus a navigation, so capture the state
  // after submitting: the hits as an on-the-fly track with the view sitting on
  // the best one. Submitted against the stand-in server (see MOCK_BLAT_RESPONSE).
  console.log('Capturing BLAT results...')
  await openMenuItem(driver, 'Tools', 'BLAT search')
  await findByText(driver, 'BLAT search (UCSC)')
  await delay(500)
  const resultSeqInput = await driver.wait(
    until.elementLocated(By.css('textarea:not([aria-hidden="true"])')),
    10000,
  )
  await resultSeqInput.click()
  await resultSeqInput.sendKeys(SAMPLE_SEQ)
  await clickButton(driver, 'Show advanced settings')
  const urlField = await driver.wait(
    until.elementLocated(
      By.xpath("//label[contains(., 'BLAT server URL')]/following::input[1]"),
    ),
    10000,
  )
  await clearInput(driver, urlField)
  await urlField.sendKeys(`http://127.0.0.1:${BLAT_PORT}/hgBlat`)
  await clickButton(driver, 'Submit')

  // done when the view has navigated to the best hit, which is also what the
  // figure is meant to show — no fixed-timeout guess at when the query landed
  await driver.wait(async () => {
    const box = await driver.findElement(
      By.css('input[placeholder="Search for location"]'),
    )
    const locstring = await box.getAttribute('value')
    return !!locstring?.includes('chr17')
  }, 30000)
  await delay(3000) // let the track paint
  await capture(driver, 'desktop-blat-results.png')

  console.log('Returning to start screen...')
  await openMenuItem(driver, 'File', 'Return to start screen')
  await waitForStartScreen(driver)
  await delay(1000)
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

  console.log(`Serving stand-in hgBlat on http://127.0.0.1:${BLAT_PORT}...`)
  blatServer = await startMockBlatServer(BLAT_PORT)

  console.log('Starting ChromeDriver...')
  chromedriverProcess = await startChromedriver()

  console.log('Launching Electron app...')
  driver = await createDriver()

  // Start screen
  console.log('Capturing start screen...')
  await waitForStartScreen(driver)
  await delay(1500) // let panels settle
  await capture(driver, 'desktop-landing.png')

  // BLAT / in-silico PCR dialogs on hg19, then back to the start screen
  await captureBlatDialogs(driver)

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
  blatServer.close()
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
  if (blatServer) {
    blatServer.close()
  }
  await killProcesses()
  process.exit(1)
})
