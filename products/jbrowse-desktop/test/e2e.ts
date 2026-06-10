import { join } from 'path'
import { ChildProcess } from 'child_process'

import { WebDriver, By, until, Key } from 'selenium-webdriver'

import {
  TEST_DATA_DIR,
  APP_BINARY,
  isHeadless,
  delay,
  startChromedriver,
  createDriver,
  flushBrowserLogs,
  findByText,
  clickButton,
  clearInput,
  waitForStartScreen,
  waitForBackdropsToDisappear,
  cleanupUI,
  openMenuItem,
  killProcesses,
} from './harness.ts'

let chromedriverProcess: ChildProcess | null = null
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
  console.log('    DEBUG: Pressing Escape multiple times to close dialogs...')
  // Ensure any dialogs are closed - press Escape multiple times
  await driver.actions().sendKeys(Key.ESCAPE).perform()
  await delay(300)
  await driver.actions().sendKeys(Key.ESCAPE).perform()
  await delay(300)
  await driver.actions().sendKeys(Key.ESCAPE).perform()
  await delay(500)

  // Check if we're already in a session with a genome loaded (from hg19 test)
  const zoomButtons = await driver.findElements(
    By.css('[data-testid="zoom_in"]'),
  )
  if (zoomButtons.length > 0) {
    console.log(
      '    DEBUG: Already in a session, returning to start screen via File menu...',
    )
    await openMenuItem(driver, 'File', 'Return to start screen')
    await delay(1500)
  }

  console.log('    DEBUG: Waiting for start screen...')
  await waitForStartScreen(driver)
  console.log('    DEBUG: Clicking Open new genome...')
  await clickButton(driver, 'Open new genome')
  await delay(1000)

  // Find and fill assembly name input (first visible text input)
  console.log('    DEBUG: Looking for assembly name input...')
  const assemblyInput = await driver.wait(
    until.elementLocated(By.css('input[type="text"]')),
    10000,
  )
  console.log('    DEBUG: Found input, typing volvox...')
  await assemblyInput.sendKeys('volvox')

  // Click URL toggle buttons to switch from file to URL mode
  // MUI ToggleButton value prop doesn't render as HTML attribute, so find by text
  console.log('    DEBUG: Looking for URL toggle buttons...')
  const urlToggleButtons = await driver.findElements(
    By.xpath("//button[contains(., 'URL')]"),
  )
  console.log(`    DEBUG: Found ${urlToggleButtons.length} URL toggle buttons`)

  // Click first URL toggle (for FASTA file)
  if (urlToggleButtons.length >= 1) {
    console.log('    DEBUG: Clicking first URL toggle...')
    await urlToggleButtons[0]!.click()
    await delay(500)
  }

  // Find URL inputs by data-testid
  let urlInputs = await driver.findElements(By.css('[data-testid="urlInput"]'))
  console.log(
    `    DEBUG: Found ${urlInputs.length} URL inputs after first toggle`,
  )

  if (urlInputs.length >= 1) {
    console.log(
      `    DEBUG: Entering FASTA URL: file://${join(TEST_DATA_DIR, 'volvox.fa')}`,
    )
    await urlInputs[0]!.sendKeys(`file://${join(TEST_DATA_DIR, 'volvox.fa')}`)
  }

  // Click second URL toggle (for FAI file) if there is one
  if (urlToggleButtons.length >= 2) {
    console.log('    DEBUG: Clicking second URL toggle...')
    await urlToggleButtons[1]!.click()
    await delay(500)
  }

  // Find URL inputs again after second toggle
  urlInputs = await driver.findElements(By.css('[data-testid="urlInput"]'))
  console.log(
    `    DEBUG: Found ${urlInputs.length} URL inputs after second toggle`,
  )

  if (urlInputs.length >= 2) {
    console.log(
      `    DEBUG: Entering FAI URL: file://${join(TEST_DATA_DIR, 'volvox.fa.fai')}`,
    )
    await urlInputs[1]!.sendKeys(
      `file://${join(TEST_DATA_DIR, 'volvox.fa.fai')}`,
    )
  }

  console.log('    DEBUG: Looking for Submit button...')
  // Try data-testid first (if app is rebuilt), fall back to XPath
  let submitButton = await driver.findElements(
    By.css('[data-testid="open-sequence-submit"]'),
  )
  if (submitButton.length === 0) {
    console.log('    DEBUG: data-testid not found, using XPath...')
    submitButton = [
      await driver.wait(
        until.elementLocated(By.xpath("//button[contains(., 'Submit')]")),
        10000,
      ),
    ]
  }
  const submitBtn = submitButton[0]!
  console.log('    DEBUG: Found Submit button, scrolling into view...')
  await driver.executeScript('arguments[0].scrollIntoView(true);', submitBtn)
  await delay(500)
  console.log('    DEBUG: Clicking Submit via JavaScript...')
  await driver.executeScript('arguments[0].click();', submitBtn)

  // Wait for dialog to close and session to be created
  console.log('    DEBUG: Waiting for dialog to close...')
  await delay(3000)

  // Check if there's an error message visible
  const errorElements = await driver.findElements(
    By.css('.MuiAlert-standardError, [class*="error"]'),
  )
  if (errorElements.length > 0) {
    console.log(`    DEBUG: Found ${errorElements.length} error elements`)
  }

  // Check if dialog is still open
  const dialogs = await driver.findElements(By.css('.MuiDialog-root'))
  console.log(`    DEBUG: ${dialogs.length} dialogs still open after Submit`)

  if (dialogs.length > 0) {
    // Try pressing Escape to close any remaining dialogs
    console.log('    DEBUG: Pressing Escape to close remaining dialogs...')
    await driver.actions().sendKeys(Key.ESCAPE).perform()
    await delay(1000)
  }

  // Launch the linear genome view
  console.log('    DEBUG: Looking for Launch view button...')
  const launchButtons = await driver.findElements(
    By.xpath("//button[contains(., 'Launch view')]"),
  )
  console.log(`    DEBUG: Found ${launchButtons.length} Launch view buttons`)

  if (launchButtons.length > 0) {
    console.log('    DEBUG: Clicking Launch view...')
    await launchButtons[0]!.click()
    await delay(2000)
  } else {
    console.log('    DEBUG: No Launch view button found, view may auto-launch')
    await delay(2000)
  }

  // Wait for location search input
  console.log('    DEBUG: Waiting for location search input...')
  const searchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search for location"]')),
    30000,
  )

  // Navigate to a specific region so the view fully loads
  console.log('    DEBUG: Navigating to ctgA:1-10000...')
  await clearInput(driver, searchInput)
  await searchInput.sendKeys('ctgA:1-10000')
  await searchInput.sendKeys(Key.ENTER)
  await delay(2000)

  // Wait for zoom controls to appear (indicates view is fully loaded)
  console.log('    DEBUG: Waiting for zoom controls...')
  await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_in"]')),
    10000,
  )
  console.log('    DEBUG: Volvox genome loaded successfully!')
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
    const gffPath = `file://${join(TEST_DATA_DIR, 'volvox.sort.gff3.gz')}`
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
    const indexPath = `file://${join(TEST_DATA_DIR, 'volvox.sort.gff3.gz.tbi')}`
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
  await killProcesses()
  process.exit(1)
})
