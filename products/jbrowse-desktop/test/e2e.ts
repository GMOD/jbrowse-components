import { ChildProcess } from 'child_process'
import http from 'http'

import { By, Key, WebDriver, until } from 'selenium-webdriver'

import {
  APP_BINARY,
  REPO_ROOT,
  assertNoErrorBanners,
  cleanupUI,
  clearInput,
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
  waitForBackdropsToDisappear,
  assertJobBarWentDeterminate,
  startJobBarRecorder,
  waitForIndexingToFinish,
} from './harness.ts'

const DATA_PORT = 9444

let chromedriverProcess: ChildProcess | null = null
let dataServer: http.Server | null = null
let driver: WebDriver | null = null

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

const results: TestResult[] = []

// A chromedriver call can block forever rather than erroring — `driver.actions()`
// did exactly that on Windows against a dialog that would not dismiss, and with
// nothing bounding the await the job ran to GitHub's 6-hour limit instead of
// reporting. Every test gets a ceiling so a hang fails one test, not the run.
const TEST_TIMEOUT_MS = 300_000
// The post-failure diagnostics and the final quit talk to the same driver that
// just hung, so they get a short ceiling of their own.
const CLEANUP_TIMEOUT_MS = 30_000

function withTimeout<T>(
  promise: Promise<T>,
  name: string,
  ms = TEST_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const ceiling = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${name} timed out after ${ms} ms`))
    }, ms)
  })
  return Promise.race([promise, ceiling]).finally(() => {
    clearTimeout(timer)
  })
}

async function runTest(
  name: string,
  fn: (driver: WebDriver) => Promise<void>,
  d: WebDriver,
): Promise<void> {
  const start = Date.now()
  process.stdout.write(`  ⏳ ${name}...`)

  try {
    await withTimeout(
      (async () => {
        await cleanupUI(d) // Cleanup before each test
        await delay(500) // Wait for any backdrop animations to complete (MUI uses 225ms transitions)
        await fn(d)
      })(),
      name,
    )
    const duration = Date.now() - start
    results.push({ name, passed: true, duration })
    console.log(`\r  ✓ ${name} (${duration}ms)`)
    await flushBrowserLogs(d)
  } catch (e) {
    const duration = Date.now() - start
    const error = e instanceof Error ? e.message : String(e)
    results.push({ name, passed: false, error, duration })
    console.log(`\r  ✗ ${name}`)
    console.log(`    Error: ${error}`)

    // Flush browser logs and capture debug info on failure. Both bounded: the
    // driver may be the thing that failed.
    try {
      await withTimeout(
        (async () => {
          await flushBrowserLogs(d)
          const title = await d.getTitle()
          const url = await d.getCurrentUrl()
          console.log(`    DEBUG: Page title: ${title}`)
          console.log(`    DEBUG: Page URL: ${url}`)

          const dialogs = await d.findElements(By.css('.MuiDialog-root'))
          console.log(`    DEBUG: Number of open dialogs: ${dialogs.length}`)
          for (const dialog of dialogs) {
            console.log(`    DEBUG: dialog text: ${await dialog.getText()}`)
          }
        })(),
        `${name} diagnostics`,
        CLEANUP_TIMEOUT_MS,
      )
    } catch {
      console.log('    DEBUG: Could not capture additional debug info')
    }
  }
}

async function testOpenVolvoxGenome(driver: WebDriver): Promise<void> {
  // The FASTA and its index, which is the pair a real user brings and the one
  // the dialog has the most to get wrong about: two urls to classify, a sidecar
  // to place, and a format to infer from neither of them alone. It reaches
  // IndexedFastaAdapter directly, so it never touches the indexFasta handler
  // whose hang (roughly one run in two, unattended, per agent-docs/reference/
  // DESKTOP_SCREENSHOTS.md) is why this used to send a 2bit instead. That is a
  // property of the pair, not luck: a `.fai` in the set is exactly what stops
  // classifyAssemblyFiles falling back to the self-indexing FastaAdapter.
  //
  // The screenshot flow still sends the 2bit — it wants the shortest path to a
  // painted view, not coverage of this one.
  await openVolvoxGenome(driver, [
    `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.fa`,
    `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.fa.fai`,
  ])
}

async function testAddGff3TrackAndSearch(driver: WebDriver): Promise<void> {
  console.log('    DEBUG: Adding GFF3 track and searching for EDEN.1...')

  // Add track via File > Open track... menu
  await openMenuItem(driver, 'File', 'Open track...')

  // Wait for menu backdrop to disappear before interacting with dialog
  console.log('    DEBUG: Waiting for menu backdrop to disappear...')
  await waitForBackdropsToDisappear(driver)
  await delay(1000)

  // The "Add a track" dialog should appear
  console.log('    DEBUG: Waiting for Add track dialog...')
  await findByText(driver, 'Add a track', 10000)
  console.log('    DEBUG: Add track dialog is open, pausing for observation...')
  await delay(3000)

  // Click URL toggles to switch from file to URL mode
  console.log('    DEBUG: Looking for URL toggle buttons...')
  const urlToggleButtons = await driver.findElements(
    By.xpath("//button[contains(., 'URL')]"),
  )
  console.log(`    DEBUG: Found ${urlToggleButtons.length} URL toggle buttons`)

  // Click first URL toggle (for GFF file) - use JavaScript click to bypass any backdrop issues
  if (urlToggleButtons.length >= 1) {
    console.log('    DEBUG: Clicking first URL toggle...')
    await driver.executeScript('arguments[0].click();', urlToggleButtons[0])
    await delay(1000)
  }

  // Find URL inputs
  const urlInputs = await driver.findElements(
    By.css('[data-testid="urlInput"]'),
  )
  console.log(`    DEBUG: Found ${urlInputs.length} URL inputs after toggle`)

  if (urlInputs.length >= 1) {
    const gffPath = `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.sort.gff3.gz`
    console.log(`    DEBUG: Entering GFF URL: ${gffPath}`)
    await urlInputs[0]!.sendKeys(gffPath)
    await delay(1000)
  }

  // The index is NOT typed. The widget probes for the sibling index and fills
  // the field in itself, and UrlChooser is uncontrolled (`defaultValue`), so
  // `sendKeys` APPENDS to what it found: the track went in pointing at
  // `...gff3.gz.tbi` concatenated with itself, 404'd, and this test still passed
  // because the only thing it asserted was that the search worked. Leaving the
  // field alone is both the correct input and coverage of the probe.
  console.log('    DEBUG: Leaving the index field to the widget probe')

  console.log('    DEBUG: Pausing before Next to observe dialog state...')
  await delay(3000)

  // Click Next button to go to step 2 (uses data-testid="addTrackNextButton")
  console.log('    DEBUG: Looking for Next button...')
  const nextButton = await driver.wait(
    until.elementLocated(By.css('[data-testid="addTrackNextButton"]')),
    5000,
  )
  await driver.executeScript('arguments[0].scrollIntoView(true);', nextButton)
  await delay(500)
  console.log('    DEBUG: Clicking Next...')
  await driver.executeScript('arguments[0].click();', nextButton)

  await delay(2000)

  // Check what assembly is selected on step 2
  const assemblySelects = await driver.findElements(
    By.css(
      '[data-testid="annotationTrackAssembly"], select, [role="combobox"]',
    ),
  )
  console.log(
    `    DEBUG: Found ${assemblySelects.length} potential assembly selectors`,
  )

  console.log('    DEBUG: Pausing to observe step 2...')
  await delay(3000)

  // Click Add button to finish the wizard (same data-testid, now shows "Add")
  console.log('    DEBUG: Looking for Add button...')
  const addButton = await driver.wait(
    until.elementLocated(By.css('[data-testid="addTrackNextButton"]')),
    5000,
  )
  await driver.executeScript('arguments[0].scrollIntoView(true);', addButton)
  await delay(500)
  // Armed before the click for the same reason the wait below is placed here:
  // the job is queued synchronously on it, and a volvox index is short enough
  // that anything sampling afterwards can miss the whole determinate stretch.
  await startJobBarRecorder(driver)
  console.log('    DEBUG: Clicking Add...')
  await driver.executeScript('arguments[0].click();', addButton)

  // Here, not further down: doSubmit queues the name-indexing job synchronously
  // on this click, so this is the only point at which there is reliably
  // something to synchronise on. Ten seconds later the queue has usually
  // drained already and the wait degrades into a sleep.
  console.log('    DEBUG: Waiting for name indexing to finish...')
  await waitForIndexingToFinish(driver)
  await assertJobBarWentDeterminate(driver)

  console.log('    DEBUG: Waiting after Submit...')
  await delay(5000)

  // Check for any error messages
  const errors = await driver.findElements(By.css('.MuiAlert-standardError'))
  console.log(`    DEBUG: Found ${errors.length} error alerts`)
  for (const error of errors) {
    const text = await error.getText()
    console.log(`    DEBUG: Error alert text: ${text}`)
  }

  // Check if dialog is still open
  const dialogs = await driver.findElements(By.css('.MuiDialog-root'))
  console.log(`    DEBUG: ${dialogs.length} dialogs still open after Submit`)

  // Close any remaining dialogs
  if (dialogs.length > 0) {
    console.log('    DEBUG: Pressing Escape to close dialogs...')
    await driver.actions().sendKeys(Key.ESCAPE).perform()
    await delay(1000)
  }

  console.log('    DEBUG: Pausing to observe track list...')
  await delay(5000)

  // Flush browser logs to see any track loading errors
  console.log('    DEBUG: Browser logs after track add:')
  await flushBrowserLogs(driver)

  // EDEN.1 is a feature name, so this can only be answered out of the track's
  // name index — which adding the track is what builds. See the wait above.
  console.log('    DEBUG: Looking for location search input...')
  const searchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search for location"]')),
    10000,
  )

  // Flush browser logs to see any errors from the app
  console.log('    DEBUG: Browser logs before EDEN.1 search:')
  await flushBrowserLogs(driver)

  // Ask more than once, rather than watching one empty dropdown for longer.
  // The autocomplete does not re-run a query it has already answered, so if the
  // index was not ready for the first attempt the suggestions stay empty for as
  // long as the query text is unchanged — a `driver.wait` on the option simply
  // burns its timeout. Retyping is what asks the question again.
  const EDEN_XPATH =
    "//*[contains(@class, 'MuiAutocomplete') or contains(@class, 'MuiPopper')]//*[contains(text(), 'EDEN')]"
  let found = 0
  for (let attempt = 1; attempt <= 3 && !found; attempt++) {
    console.log(`    DEBUG: Typing EDEN.1 (attempt ${attempt})...`)
    await clearInput(driver, searchInput)
    await searchInput.sendKeys('EDEN.1')
    await delay(4000) // let the search run and the dropdown render
    // via executeScript, not findElements: a findElements that matches nothing
    // waits out the 30s implicit timeout, which is most of this loop's budget
    found = await driver.executeScript<number>(
      `return document.evaluate(arguments[0], document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null).snapshotLength`,
      EDEN_XPATH,
    )
    console.log(`    DEBUG: ${found} EDEN suggestion(s)`)
  }
  if (!found) {
    throw new Error('EDEN.1 never appeared in the autocomplete suggestions')
  }

  console.log('    DEBUG: Found EDEN.1 suggestion, clicking...')
  const edenOption = await driver.findElement(By.xpath(EDEN_XPATH))
  await edenOption.click()
  await delay(2000)

  // Verify navigation happened - the view should have updated
  console.log('    DEBUG: Verifying navigation to EDEN.1...')
  await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_in"]')),
    5000,
  )
  // The track has had a whole search-and-navigate to load by now, so a banner
  // here is a real failure rather than a mid-load race.
  await assertNoErrorBanners(driver, 'after adding the GFF3 track')

  console.log(
    '    DEBUG: Successfully added GFF3 track and searched for EDEN.1!',
  )
}

async function main(): Promise<void> {
  console.log(`Running in ${isHeadless ? 'headless' : 'headed'} mode`)
  console.log(`Platform: ${process.platform}`)
  console.log(`App binary: ${APP_BINARY}`)

  // Verify app binary exists
  const { existsSync } = await import('fs')
  if (!existsSync(APP_BINARY)) {
    console.error(`ERROR: App binary not found at ${APP_BINARY}`)
    process.exit(1)
  }
  console.log('App binary exists: yes')

  // Clean up any leftover processes from previous runs
  console.log('Cleaning up leftover processes...')
  await killProcesses()

  console.log(`Serving ${REPO_ROOT} on http://localhost:${DATA_PORT}...`)
  dataServer = await startStaticServer(REPO_ROOT, DATA_PORT)

  console.log('Starting ChromeDriver...')
  chromedriverProcess = await startChromedriver()

  console.log('Creating WebDriver and launching Electron app...')
  console.log('This may take a while on first run...')
  try {
    driver = await createDriver()
    console.log('WebDriver created successfully')
  } catch (e) {
    console.error('Failed to create WebDriver:', e)
    throw e
  }

  console.log('\nRunning tests...\n')

  console.log('Open Genome with Local Files:')
  await runTest('should open volvox genome', testOpenVolvoxGenome, driver)
  await runTest(
    'should add GFF3 track and search for EDEN.1',
    testAddGff3TrackAndSearch,
    driver,
  )

  // Summary
  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log(`\n${'─'.repeat(50)}`)
  console.log(`  Tests: ${passed} passed, ${failed} failed`)
  console.log(`${'─'.repeat(50)}\n`)

  // Cleanup
  console.log('\nCleaning up...')
  if (driver) {
    try {
      await withTimeout(driver.quit(), 'driver.quit', CLEANUP_TIMEOUT_MS)
    } catch (e) {
      console.warn('WARN: driver.quit() failed during cleanup:', e)
    }
  }
  if (chromedriverProcess) {
    chromedriverProcess.kill('SIGKILL')
  }
  dataServer?.close()
  await killProcesses()

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async e => {
  console.error('Fatal error:', e)
  if (driver) {
    try {
      await withTimeout(driver.quit(), 'driver.quit', CLEANUP_TIMEOUT_MS)
    } catch (err) {
      console.warn('WARN: driver.quit() failed after fatal error:', err)
    }
  }
  if (chromedriverProcess) {
    chromedriverProcess.kill('SIGKILL')
  }
  dataServer?.close()
  await killProcesses()
  process.exit(1)
})
