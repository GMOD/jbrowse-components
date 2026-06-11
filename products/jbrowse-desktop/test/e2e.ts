import { ChildProcess } from 'child_process'
import http from 'http'

import { WebDriver, By, until, Key } from 'selenium-webdriver'

import {
  APP_BINARY,
  REPO_ROOT,
  isHeadless,
  delay,
  startChromedriver,
  startStaticServer,
  createDriver,
  flushBrowserLogs,
  findByText,
  clearInput,
  waitForBackdropsToDisappear,
  openVolvoxGenome,
  cleanupUI,
  openMenuItem,
  killProcesses,
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

async function runTest(
  name: string,
  fn: (driver: WebDriver) => Promise<void>,
  d: WebDriver,
): Promise<void> {
  const start = Date.now()
  process.stdout.write(`  ⏳ ${name}...`)

  try {
    await cleanupUI(d) // Cleanup before each test
    await delay(500) // Wait for any backdrop animations to complete (MUI uses 225ms transitions)
    await fn(d)
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

    // Flush browser logs on failure for debugging
    await flushBrowserLogs(d)

    // Capture debug info on failure
    try {
      const title = await d.getTitle()
      const url = await d.getCurrentUrl()
      console.log(`    DEBUG: Page title: ${title}`)
      console.log(`    DEBUG: Page URL: ${url}`)

      // Try to find any visible dialogs
      const dialogs = await d.findElements(By.css('.MuiDialog-root'))
      console.log(`    DEBUG: Number of open dialogs: ${dialogs.length}`)
    } catch {
      console.log('    DEBUG: Could not capture additional debug info')
    }
  }
}

async function testOpenVolvoxGenome(driver: WebDriver): Promise<void> {
  await openVolvoxGenome(
    driver,
    `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.fa`,
  )
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
  let urlInputs = await driver.findElements(By.css('[data-testid="urlInput"]'))
  console.log(`    DEBUG: Found ${urlInputs.length} URL inputs after toggle`)

  if (urlInputs.length >= 1) {
    const gffPath = `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.sort.gff3.gz`
    console.log(`    DEBUG: Entering GFF URL: ${gffPath}`)
    await urlInputs[0]!.sendKeys(gffPath)
    await delay(1000)
  }

  // Click second URL toggle for index file if available - use JavaScript click
  if (urlToggleButtons.length >= 2) {
    console.log('    DEBUG: Clicking second URL toggle...')
    await driver.executeScript('arguments[0].click();', urlToggleButtons[1])
    await delay(1000)
  }

  // Find URL inputs again
  urlInputs = await driver.findElements(By.css('[data-testid="urlInput"]'))
  console.log(
    `    DEBUG: Found ${urlInputs.length} URL inputs after second toggle`,
  )

  if (urlInputs.length >= 2) {
    const indexPath = `http://127.0.0.1:${DATA_PORT}/test_data/volvox/volvox.sort.gff3.gz.tbi`
    console.log(`    DEBUG: Entering index URL: ${indexPath}`)
    await urlInputs[1]!.sendKeys(indexPath)
    await delay(1000)
  }

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
  console.log('    DEBUG: Clicking Add...')
  await driver.executeScript('arguments[0].click();', addButton)

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

  // Now search for EDEN.1 in the refname autocomplete
  console.log('    DEBUG: Looking for location search input...')
  const searchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search for location"]')),
    10000,
  )

  console.log('    DEBUG: Clearing and typing EDEN.1...')
  await clearInput(driver, searchInput)
  await searchInput.sendKeys('EDEN.1')
  console.log('    DEBUG: Waiting for autocomplete suggestions...')
  await delay(3000) // Wait for autocomplete suggestions

  // Flush browser logs to see any errors from the app
  console.log('    DEBUG: Browser logs before EDEN.1 search:')
  await flushBrowserLogs(driver)

  // Look for EDEN.1 in the autocomplete dropdown and click it
  console.log('    DEBUG: Looking for EDEN.1 in autocomplete suggestions...')
  const edenOption = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//*[contains(@class, 'MuiAutocomplete') or contains(@class, 'MuiPopper')]//*[contains(text(), 'EDEN')]",
      ),
    ),
    10000,
  )
  console.log('    DEBUG: Found EDEN.1 suggestion, clicking...')
  await edenOption.click()
  await delay(2000)

  // Verify navigation happened - the view should have updated
  console.log('    DEBUG: Verifying navigation to EDEN.1...')
  await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_in"]')),
    5000,
  )
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
      await driver.quit()
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
      await driver.quit()
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
