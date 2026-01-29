import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { createRequire } from 'module'
import { Builder, WebDriver, By, until, logging } from 'selenium-webdriver'

const require = createRequire(import.meta.url)

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEST_DATA_DIR = resolve(__dirname, '../../../test_data/volvox')
const isWindows = process.platform === 'win32'
const APP_BINARY = resolve(
  __dirname,
  isWindows
    ? '../dist/unpacked/jbrowse-desktop-win32-x64/jbrowse-desktop.exe'
    : '../dist/unpacked/jbrowse-desktop-linux-x64/jbrowse-desktop',
)
const CHROMEDRIVER_PORT = 9515

// Check for headless mode via CLI arg or environment variable
const isHeadless =
  process.argv.includes('--headless') || process.env.HEADLESS === 'true'

// Get chromedriver path by resolving the electron-chromedriver package location
const electronChromedriverDir = dirname(
  require.resolve('electron-chromedriver/package.json'),
)
const CHROMEDRIVER_PATH = join(
  electronChromedriverDir,
  'bin',
  isWindows ? 'chromedriver.exe' : 'chromedriver',
)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

let chromedriverProcess: ChildProcess | null = null
let driver: WebDriver | null = null

interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration: number
}

const results: TestResult[] = []

async function startChromedriver(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`  Launching: ${CHROMEDRIVER_PATH}`)
    chromedriverProcess = spawn(
      CHROMEDRIVER_PATH,
      [`--port=${CHROMEDRIVER_PORT}`],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )

    chromedriverProcess.on('error', err => {
      console.error('  ChromeDriver spawn error:', err)
      reject(err)
    })

    chromedriverProcess.stdout?.on('data', data => {
      const output = data.toString()
      console.log('  ChromeDriver stdout:', output.trim())
      if (output.includes('was started successfully')) {
        resolve()
      }
    })

    chromedriverProcess.stderr?.on('data', data => {
      console.log('  ChromeDriver stderr:', data.toString().trim())
    })

    // Fallback timeout - give it more time to start
    setTimeout(resolve, 5000)
  })
}

async function createDriver(): Promise<WebDriver> {
  const chromeArgs = ['--no-sandbox', '--disable-extensions']

  if (isHeadless) {
    chromeArgs.push(
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--force-device-scale-factor=1',
    )
  }

  // Enable browser logging to capture console output
  const prefs = new logging.Preferences()
  prefs.setLevel(logging.Type.BROWSER, logging.Level.ALL)

  const driver = await new Builder()
    .usingServer(`http://localhost:${CHROMEDRIVER_PORT}`)
    .withCapabilities({
      'goog:chromeOptions': {
        binary: APP_BINARY,
        args: chromeArgs,
      },
      'goog:loggingPrefs': {
        browser: 'ALL',
      },
    })
    .setLoggingPrefs(prefs)
    .forBrowser('chrome')
    .build()

  // Set longer timeouts for CI environments
  await driver.manage().setTimeouts({
    implicit: 30000,
    pageLoad: 120000,
    script: 60000,
  })

  return driver
}

// Flush browser console logs to stdout
async function flushBrowserLogs(driver: WebDriver): Promise<void> {
  try {
    const logs = await driver.manage().logs().get(logging.Type.BROWSER)
    for (const entry of logs) {
      const level = entry.level.name
      const message = entry.message
      console.log(`    [Browser ${level}] ${message}`)
    }
  } catch {
    // Ignore errors fetching logs
  }
}

// Utility for case-insensitive XPath text search
function textContainsXPath(text: string, elementType = '*') {
  const lowerText = text.toLowerCase()
  return `//${elementType}[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lowerText}')]`
}

async function findByText(driver: WebDriver, text: string, timeout = 30000) {
  return driver.wait(
    until.elementLocated(By.xpath(textContainsXPath(text))),
    timeout,
  )
}

async function clickButton(
  driver: WebDriver,
  text: string,
  timeout = 10000,
): Promise<void> {
  const button = await driver.wait(
    until.elementLocated(By.xpath(textContainsXPath(text, 'button'))),
    timeout,
  )
  await driver.wait(until.elementIsVisible(button), timeout)
  // Use JavaScript click to bypass any backdrop overlays
  await driver.executeScript('arguments[0].click();', button)
}

// Clear input field properly using keyboard shortcuts
async function clearInput(driver: WebDriver, element: any): Promise<void> {
  await element.click()
  // Select all and delete
  await driver
    .actions()
    .keyDown('\uE009')
    .sendKeys('a')
    .keyUp('\uE009')
    .perform() // Ctrl+A
  await driver.actions().sendKeys('\uE017').perform() // Delete
}

async function waitForStartScreen(
  driver: WebDriver,
  timeout = 30000,
): Promise<void> {
  await findByText(driver, 'Launch new session', timeout)
}

// Wait for all backdrops to disappear
async function waitForBackdropsToDisappear(
  driver: WebDriver,
  timeout = 5000,
): Promise<void> {
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    const backdrops = await driver.findElements(By.css('.MuiBackdrop-root'))
    if (backdrops.length === 0) {
      return
    }
    await delay(200)
  }
}

// Unified helper to clean up all UI overlays (dialogs, menus, backdrops)
async function cleanupUI(driver: WebDriver): Promise<void> {
  // Close dialogs
  for (let i = 0; i < 5; i++) {
    const dialogs = await driver.findElements(By.css('.MuiDialog-root'))
    if (dialogs.length === 0) {
      break
    }
    await driver.actions().sendKeys('\uE00C').perform()
    await delay(300)
  }

  // Dismiss backdrops by clicking on them
  const backdrops = await driver.findElements(By.css('.MuiBackdrop-root'))
  for (const backdrop of backdrops) {
    try {
      await driver.executeScript('arguments[0].click();', backdrop)
      await delay(200)
    } catch {
      // Ignore if backdrop is no longer present
    }
  }

  // Press Escape multiple times and click body to dismiss menus/popups
  for (let i = 0; i < 3; i++) {
    await driver.actions().sendKeys('\uE00C').perform()
    await delay(200)
  }
  try {
    const body = await driver.findElement(By.css('body'))
    await driver.executeScript('arguments[0].click();', body)
    await delay(300)
  } catch {
    // Ignore errors
  }
}

// Helper to open a menu and click an item
async function openMenuItem(
  driver: WebDriver,
  menuName: string,
  itemText: string,
): Promise<void> {
  await clickButton(driver, menuName)
  await delay(500)
  const menuItem = await driver.wait(
    until.elementLocated(By.xpath(`//*[contains(text(), '${itemText}')]`)),
    5000,
  )
  await driver.wait(until.elementIsVisible(menuItem), 3000)
  // Use JavaScript click to bypass any backdrop overlays
  await driver.executeScript('arguments[0].click();', menuItem)
  await delay(500)
}

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
    } catch (debugError) {
      console.log('    DEBUG: Could not capture additional debug info')
    }
  }
}

// Test definitions
async function testStartScreen(driver: WebDriver): Promise<void> {
  await delay(3000)
  const title = await driver.getTitle()

  if (title !== 'JBrowse') {
    throw new Error(`Expected title 'JBrowse', got '${title}'`)
  }
}

async function testStartScreenElements(driver: WebDriver): Promise<void> {
  await waitForStartScreen(driver)
  await findByText(driver, 'Open new genome')
  await findByText(driver, 'Show all available genomes')
  await findByText(driver, 'Recently opened sessions')
  await findByText(driver, 'Favorite genomes')
}

async function testOpenGenomeDialog(driver: WebDriver): Promise<void> {
  await waitForStartScreen(driver)
  await clickButton(driver, 'Open new genome')
  await delay(500)
  await findByText(driver, 'Open genome(s)')
  await findByText(driver, 'IndexedFastaAdapter')
  await findByText(driver, 'FASTA file')
}

async function testCancelGenomeDialog(driver: WebDriver): Promise<void> {
  // Wait a moment for any animations to settle
  await delay(1000)

  console.log('    DEBUG: Looking for Cancel button in dialog...')

  // Find and click the Cancel button - it's in the dialog actions
  const cancelButton = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//div[contains(@class, 'MuiDialogActions')]//button[contains(., 'Cancel')]",
      ),
    ),
    10000,
  )
  console.log('    DEBUG: Found Cancel button, waiting for visibility...')
  await driver.wait(until.elementIsVisible(cancelButton), 5000)
  console.log('    DEBUG: Cancel button is visible, clicking...')
  await cancelButton.click()

  // Wait for dialog to close
  await delay(1000)
  console.log('    DEBUG: Waiting for start screen...')
  await waitForStartScreen(driver)
}

async function testAvailableGenomesDialog(driver: WebDriver): Promise<void> {
  console.log('    DEBUG: Pressing Escape to close any open dialogs...')
  // Press Escape to close any open dialogs from previous tests
  await driver.actions().sendKeys('\uE00C').perform()
  await delay(500)

  console.log('    DEBUG: Waiting for start screen...')
  await waitForStartScreen(driver)
  console.log('    DEBUG: Clicking Show all available genomes...')
  await clickButton(driver, 'Show all available genomes')
  await delay(500)
  console.log('    DEBUG: Looking for Available genomes dialog...')
  await findByText(driver, 'Available genomes')
}

async function testCloseAvailableGenomesDialog(
  driver: WebDriver,
): Promise<void> {
  // Find the close button (IconButton in dialog title with CloseIcon)
  // It's the button in the dialog title area
  const closeButton = await driver.findElement(
    By.css('.MuiDialogTitle-root .MuiIconButton-root'),
  )
  await closeButton.click()
  await delay(500)
  await waitForStartScreen(driver)
}

async function testOpenHg19Genome(driver: WebDriver): Promise<void> {
  console.log('    DEBUG: Pressing Escape to close any dialogs...')
  // Ensure any dialogs are closed
  await driver.actions().sendKeys('\uE00C').perform()
  await delay(300)

  console.log('    DEBUG: Waiting for start screen...')
  await waitForStartScreen(driver)

  // Click "Show all available genomes"
  console.log('    DEBUG: Clicking Show all available genomes...')
  await clickButton(driver, 'Show all available genomes')
  await delay(2000)

  // Search for hg19 to filter the table (so the row is visible without scrolling)
  console.log('    DEBUG: Looking for search input...')
  const genomeSearchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search genomes..."]')),
    10000,
  )
  console.log('    DEBUG: Found search input, typing hg19...')
  await genomeSearchInput.sendKeys('hg19')

  // Wait for table rows to appear (network fetch may take time)
  console.log('    DEBUG: Waiting for table rows to load...')
  await driver.wait(until.elementLocated(By.css('table tbody tr')), 30000)
  await delay(1000) // Additional delay for filtering to complete

  // Find the row containing hg19 and click the (launch) link within it
  console.log('    DEBUG: Looking for hg19 launch link...')
  const launchLink = await driver.wait(
    until.elementLocated(
      By.xpath("//td[contains(., 'hg19')]//a[contains(text(), 'launch')]"),
    ),
    15000,
  )
  console.log('    DEBUG: Found launch link, scrolling into view...')
  await driver.executeScript('arguments[0].scrollIntoView(true);', launchLink)
  await delay(500)
  console.log('    DEBUG: Waiting for visibility...')
  await driver.wait(until.elementIsVisible(launchLink), 15000)
  console.log('    DEBUG: Clicking launch link...')
  await driver.executeScript('arguments[0].click();', launchLink)

  // View is launched automatically, wait for it to load
  console.log('    DEBUG: Waiting for view to load...')
  await delay(5000)

  // Wait for location search input
  console.log('    DEBUG: Waiting for location search input...')
  const searchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search for location"]')),
    30000,
  )

  // Navigate to a specific region so the view fully loads
  console.log('    DEBUG: Navigating to chr1:1-10000...')
  await clearInput(driver, searchInput)
  await searchInput.sendKeys('chr1:1-10000')
  await searchInput.sendKeys('\uE007') // Enter
  await delay(3000)

  // Wait for zoom controls to appear (indicates view is fully loaded)
  console.log('    DEBUG: Waiting for zoom controls...')
  await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_in"]')),
    15000,
  )
  console.log('    DEBUG: hg19 genome loaded successfully!')
}

async function testOpenVolvoxGenome(driver: WebDriver): Promise<void> {
  console.log('    DEBUG: Pressing Escape multiple times to close dialogs...')
  // Ensure any dialogs are closed - press Escape multiple times
  await driver.actions().sendKeys('\uE00C').perform()
  await delay(300)
  await driver.actions().sendKeys('\uE00C').perform()
  await delay(300)
  await driver.actions().sendKeys('\uE00C').perform()
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
    await urlToggleButtons[0].click()
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
    await urlInputs[0].sendKeys(`file://${join(TEST_DATA_DIR, 'volvox.fa')}`)
  }

  // Click second URL toggle (for FAI file) if there is one
  if (urlToggleButtons.length >= 2) {
    console.log('    DEBUG: Clicking second URL toggle...')
    await urlToggleButtons[1].click()
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
    await urlInputs[1].sendKeys(
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
    await driver.actions().sendKeys('\uE00C').perform()
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
    await launchButtons[0].click()
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
  await searchInput.sendKeys('\uE007') // Enter
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
    await urlInputs[0].sendKeys(gffPath)
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
    await urlInputs[1].sendKeys(indexPath)
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
    await driver.actions().sendKeys('\uE00C').perform()
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

async function testFileMenu(driver: WebDriver): Promise<void> {
  await findByText(driver, 'File', 10000)
}

async function testHelpAbout(driver: WebDriver): Promise<void> {
  // Check if we're in an active session (not on start screen)
  const startScreenElements = await driver.findElements(
    By.xpath("//*[contains(text(), 'Launch new session')]"),
  )
  if (startScreenElements.length > 0) {
    throw new Error(
      'No active session - previous genome loading test may have failed',
    )
  }

  await openMenuItem(driver, 'Help', 'About')

  console.log('    DEBUG: Looking for About dialog content...')
  await findByText(driver, 'The Evolutionary Software Foundation', 10000)
}

async function testZoom(driver: WebDriver): Promise<void> {
  const zoomIn = await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_in"]')),
    10000,
  )
  await zoomIn.click()
  await delay(500)

  const zoomOut = await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_out"]')),
    10000,
  )
  await zoomOut.click()
  await delay(500)
}

async function testLocationSearch(driver: WebDriver): Promise<void> {
  const searchInput = await driver.findElement(
    By.css('input[placeholder="Search for location"]'),
  )
  await clearInput(driver, searchInput)
  // Use volvox location since volvox is the last genome loaded
  await searchInput.sendKeys('ctgA:5000..15000')
  await searchInput.sendKeys('\uE007') // Enter
  await delay(1000)
}

async function testWorkspaceMoveToTab(driver: WebDriver): Promise<void> {
  console.log('    DEBUG: Looking for view menu icon...')
  const viewMenu = await driver.wait(
    until.elementLocated(By.css('[data-testid="view_menu_icon"]')),
    10000,
  )
  console.log('    DEBUG: Found view menu, clicking...')
  await viewMenu.click()
  await delay(500)

  // Click "View options" menu item to open submenu using data-testid
  console.log('    DEBUG: Looking for View options submenu...')
  const viewOptions = await driver.wait(
    until.elementLocated(
      By.css('[data-testid="cascading-submenu-view_options"]'),
    ),
    5000,
  )
  console.log('    DEBUG: Found View options, clicking to open submenu...')
  await viewOptions.click()
  await delay(1000)

  console.log('    DEBUG: Looking for Move to new tab...')
  const moveToTab = await driver.wait(
    until.elementLocated(
      By.css('[data-testid="cascading-menuitem-move_to_new_tab"]'),
    ),
    5000,
  )
  console.log('    DEBUG: Found Move to new tab, clicking...')
  await moveToTab.click()
  await delay(2000)

  // Verify dockview is present - check for various possible class names
  console.log('    DEBUG: Checking for dockview element...')
  let dockview = await driver.findElements(
    By.css('.dockview-theme-light, .dockview-theme-dark, [class*="dockview"]'),
  )
  console.log(`    DEBUG: Found ${dockview.length} dockview elements`)

  if (dockview.length === 0) {
    // Try alternative check - look for tab elements
    const tabs = await driver.findElements(By.css('[class*="tab"]'))
    console.log(`    DEBUG: Found ${tabs.length} tab-related elements`)
    throw new Error('Dockview not found after moving to new tab')
  }
}

async function testWorkspaceMoveToTabWithMultipleViews(
  driver: WebDriver,
): Promise<void> {
  // This tests the bug fix: with 3 views and workspaces OFF, clicking
  // "Move to new tab" should create 2 tabs (one with 2 views, one with 1 view)

  // First, create additional views using "Copy view" so we have multiple views
  // We should already have at least 1 view from previous tests
  console.log('    DEBUG: Counting initial views...')
  let viewMenus = await driver.findElements(
    By.css('[data-testid="view_menu_icon"]'),
  )
  console.log(`    DEBUG: Initial view count: ${viewMenus.length}`)

  // Create views until we have at least 3
  while (viewMenus.length < 3) {
    console.log(`    DEBUG: Creating view ${viewMenus.length + 1}...`)

    // Close any open menus first
    await driver.actions().sendKeys('\uE00C').perform()
    await delay(300)

    // Re-find the view menu in case DOM changed
    viewMenus = await driver.findElements(
      By.css('[data-testid="view_menu_icon"]'),
    )
    const viewMenu = viewMenus[0]!

    console.log('    DEBUG: Clicking view menu...')
    await driver.executeScript('arguments[0].click();', viewMenu)
    await delay(700)

    // Check if menu opened by looking for menu items
    const menuItems = await driver.findElements(By.css('.MuiMenuItem-root'))
    console.log(`    DEBUG: Found ${menuItems.length} menu items`)

    if (menuItems.length === 0) {
      console.log('    DEBUG: Menu did not open, retrying...')
      await driver.executeScript('arguments[0].click();', viewMenu)
      await delay(700)
    }

    console.log('    DEBUG: Looking for View options...')
    const viewOptions = await driver.wait(
      until.elementLocated(
        By.css('[data-testid="cascading-submenu-view_options"]'),
      ),
      5000,
    )
    console.log('    DEBUG: Found View options, clicking to open submenu...')
    await viewOptions.click()
    await delay(1000)

    console.log('    DEBUG: Looking for Copy view...')
    const copyView = await driver.wait(
      until.elementLocated(
        By.css('[data-testid="cascading-menuitem-copy_view"]'),
      ),
      5000,
    )
    console.log('    DEBUG: Found Copy view, clicking...')
    await copyView.click()
    await delay(1500)

    // Close any leftover menus by pressing Escape multiple times
    await driver.actions().sendKeys('\uE00C').perform()
    await delay(200)
    await driver.actions().sendKeys('\uE00C').perform()
    await delay(300)

    viewMenus = await driver.findElements(
      By.css('[data-testid="view_menu_icon"]'),
    )
    console.log(`    DEBUG: Now have ${viewMenus.length} views`)
  }

  console.log(`    DEBUG: Now have ${viewMenus.length} views`)

  // Now click "Move to new tab" on one of the views
  // This should enable workspaces and create 2 tabs
  console.log('    DEBUG: Opening view menu for Move to new tab...')
  const targetViewMenu = viewMenus[viewMenus.length - 1]! // Use last view
  await driver.executeScript('arguments[0].click();', targetViewMenu)
  await delay(500)

  const viewOptions2 = await driver.wait(
    until.elementLocated(
      By.css('[data-testid="cascading-submenu-view_options"]'),
    ),
    5000,
  )
  console.log('    DEBUG: Found View options, clicking to open submenu...')
  await viewOptions2.click()
  await delay(1000)

  console.log('    DEBUG: Clicking Move to new tab...')
  const moveToTab = await driver.wait(
    until.elementLocated(
      By.css('[data-testid="cascading-menuitem-move_to_new_tab"]'),
    ),
    5000,
  )
  await moveToTab.click()

  // Wait longer for workspace transition to complete
  console.log('    DEBUG: Waiting for workspace transition...')
  await delay(3000)

  // Debug: Check what's in the DOM after transition
  const dockviewElements = await driver.findElements(
    By.css('[class*="dockview"]'),
  )
  console.log(
    `    DEBUG: Found ${dockviewElements.length} elements with "dockview" in class`,
  )

  const allTabs = await driver.findElements(By.css('.tab, [class*="tab"]'))
  console.log(`    DEBUG: Found ${allTabs.length} elements with "tab" in class`)

  // Check for any error alerts
  const alerts = await driver.findElements(By.css('.MuiAlert-root'))
  if (alerts.length > 0) {
    console.log(`    DEBUG: Found ${alerts.length} alert elements`)
  }

  // Verify we have tabs in dockview - try multiple selectors
  console.log('    DEBUG: Checking for dockview tabs...')
  let tabs = await driver.findElements(By.css('.dockview-react .tab'))
  if (tabs.length === 0) {
    // Try alternative selector
    tabs = await driver.findElements(
      By.css('[class*="dockview"] [class*="tab"]'),
    )
  }
  console.log(`    DEBUG: Found ${tabs.length} dockview tabs`)

  // In dockview/workspace mode, only the active tab's content is rendered in DOM
  // So we can't count view_menu_icons to verify all views exist
  // Instead, verify that:
  // 1. Dockview is active (has tabs)
  // 2. At least one view is visible in the active tab
  viewMenus = await driver.findElements(
    By.css('[data-testid="view_menu_icon"]'),
  )
  console.log(`    DEBUG: Visible views in active tab: ${viewMenus.length}`)

  if (viewMenus.length < 1) {
    throw new Error(
      `Expected at least 1 view to be visible in active tab, got ${viewMenus.length}`,
    )
  }

  // Check that we have at least 2 tabs (workspaces enabled successfully)
  if (tabs.length < 2) {
    throw new Error(
      `Expected at least 2 tabs after "Move to new tab", got ${tabs.length}`,
    )
  }

  console.log('    DEBUG: Move to new tab with multiple views succeeded!')
}

async function testWorkspaceCopyView(driver: WebDriver): Promise<void> {
  console.log('    DEBUG: Looking for view menu icon...')

  // Try to find the view menu icon
  let viewMenu = await driver.findElements(
    By.css('[data-testid="view_menu_icon"]'),
  )
  console.log(`    DEBUG: Found ${viewMenu.length} view_menu_icon elements`)

  if (viewMenu.length === 0) {
    throw new Error('Could not find view menu icon')
  }

  // Get current count to verify we add one more
  const initialCount = viewMenu.length

  const viewMenuElement = viewMenu[0]!
  console.log('    DEBUG: Found view menu, clicking via JavaScript...')
  await driver.executeScript('arguments[0].click();', viewMenuElement)
  await delay(500)

  // Click "View options" to open submenu using data-testid
  console.log('    DEBUG: Looking for View options submenu...')
  const viewOptions = await driver.wait(
    until.elementLocated(
      By.css('[data-testid="cascading-submenu-view_options"]'),
    ),
    5000,
  )
  console.log('    DEBUG: Found View options, clicking to open submenu...')
  await viewOptions.click()
  await delay(1000)

  console.log('    DEBUG: Looking for Copy view...')
  const copyView = await driver.wait(
    until.elementLocated(
      By.css('[data-testid="cascading-menuitem-copy_view"]'),
    ),
    5000,
  )
  console.log('    DEBUG: Found Copy view, clicking...')
  await copyView.click()
  await delay(2000)

  console.log('    DEBUG: Counting view menus...')
  const viewMenus = await driver.findElements(
    By.css('[data-testid="view_menu_icon"]'),
  )
  console.log(
    `    DEBUG: Found ${viewMenus.length} view menus (was ${initialCount})`,
  )

  if (viewMenus.length <= initialCount) {
    throw new Error(
      `Expected more than ${initialCount} view menus after copy, got ${viewMenus.length}`,
    )
  }
}

async function cleanup(): Promise<void> {
  const { execSync } = await import('child_process')
  try {
    if (isWindows) {
      execSync('taskkill /F /IM chromedriver.exe 2>nul', { stdio: 'ignore' })
      execSync('taskkill /F /IM "jbrowse-desktop.exe" 2>nul', {
        stdio: 'ignore',
      })
    } else {
      execSync('pkill -f chromedriver || true', { stdio: 'ignore' })
      execSync('pkill -f jbrowse-desktop || true', { stdio: 'ignore' })
    }
  } catch {
    // Ignore errors
  }
  await delay(1000)
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
  await cleanup()

  console.log('Starting ChromeDriver...')
  await startChromedriver()

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

  // Temporarily focusing on volvox tests only for Windows CI debugging
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
    } catch {
      // Ignore errors during cleanup
    }
  }
  if (chromedriverProcess) {
    chromedriverProcess.kill('SIGKILL')
  }
  // Force kill any remaining jbrowse-desktop processes
  const { execSync } = await import('child_process')
  try {
    if (isWindows) {
      execSync('taskkill /F /IM "jbrowse-desktop.exe" 2>nul', {
        stdio: 'ignore',
      })
    } else {
      execSync('pkill -f jbrowse-desktop || true', { stdio: 'ignore' })
    }
  } catch {
    // Ignore errors
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(async e => {
  console.error('Fatal error:', e)
  if (driver) {
    try {
      await driver.quit()
    } catch {
      // Ignore
    }
  }
  if (chromedriverProcess) {
    chromedriverProcess.kill('SIGKILL')
  }
  // Force kill any remaining jbrowse-desktop processes
  const { execSync } = await import('child_process')
  try {
    if (isWindows) {
      execSync('taskkill /F /IM "jbrowse-desktop.exe" 2>nul', {
        stdio: 'ignore',
      })
    } else {
      execSync('pkill -f jbrowse-desktop || true', { stdio: 'ignore' })
    }
  } catch {
    // Ignore errors
  }
  process.exit(1)
})
