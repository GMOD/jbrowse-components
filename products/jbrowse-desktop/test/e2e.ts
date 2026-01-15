import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { createRequire } from 'module'
import { Builder, WebDriver, By, until } from 'selenium-webdriver'

const require = createRequire(import.meta.url)

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEST_DATA_DIR = resolve(__dirname, '../../../test_data/volvox')
const APP_BINARY = resolve(__dirname, '../dist/linux-unpacked/jbrowse-desktop')
const CHROMEDRIVER_PORT = 9515

// Check for headless mode via CLI arg or environment variable
const isHeadless =
  process.argv.includes('--headless') || process.env.HEADLESS === 'true'

// Get chromedriver path by resolving the electron-chromedriver package location
const electronChromedriverDir = dirname(
  require.resolve('electron-chromedriver/package.json'),
)
const CHROMEDRIVER_PATH = join(electronChromedriverDir, 'bin', 'chromedriver')

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
  const chromeArgs = ['--no-sandbox']

  if (isHeadless) {
    chromeArgs.push(
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
    )
  }

  const driver = await new Builder()
    .usingServer(`http://localhost:${CHROMEDRIVER_PORT}`)
    .withCapabilities({
      'goog:chromeOptions': {
        binary: APP_BINARY,
        args: chromeArgs,
      },
    })
    .forBrowser('chrome')
    .build()

  return driver
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
  await button.click()
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

// Helper to close any open dialogs - useful for test recovery
async function closeAllDialogs(driver: WebDriver): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const dialogs = await driver.findElements(By.css('.MuiDialog-root'))
    if (dialogs.length === 0) {
      break
    }
    await driver.actions().sendKeys('\uE00C').perform()
    await delay(300)
  }
}

async function runTest(
  name: string,
  fn: (driver: WebDriver) => Promise<void>,
  d: WebDriver,
): Promise<void> {
  const start = Date.now()
  process.stdout.write(`  ⏳ ${name}...`)

  try {
    await fn(d)
    const duration = Date.now() - start
    results.push({ name, passed: true, duration })
    console.log(`\r  ✓ ${name} (${duration}ms)`)
  } catch (e) {
    const duration = Date.now() - start
    const error = e instanceof Error ? e.message : String(e)
    results.push({ name, passed: false, error, duration })
    console.log(`\r  ✗ ${name}`)
    console.log(`    Error: ${error}`)

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
  await delay(1000)

  // Find the row containing hg19 and click the (launch) link within it
  console.log('    DEBUG: Looking for hg19 launch link...')
  const launchLink = await driver.wait(
    until.elementLocated(
      By.xpath("//td[contains(., 'hg19')]//a[contains(text(), 'launch')]"),
    ),
    15000,
  )
  console.log('    DEBUG: Found launch link, waiting for visibility...')
  await driver.wait(until.elementIsVisible(launchLink), 15000)
  console.log('    DEBUG: Clicking launch link...')
  await launchLink.click()

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
    // Click File menu
    console.log('    DEBUG: Clicking File menu...')
    await clickButton(driver, 'File')
    await delay(1000)

    // Click "Return to start screen"
    console.log('    DEBUG: Looking for Return to start screen menu item...')
    const returnItem = await driver.wait(
      until.elementLocated(
        By.xpath("//*[contains(text(), 'Return to start screen')]"),
      ),
      5000,
    )
    console.log('    DEBUG: Found menu item, waiting for visibility...')
    await driver.wait(until.elementIsVisible(returnItem), 3000)
    console.log('    DEBUG: Clicking Return to start screen...')
    await returnItem.click()
    await delay(2000)
    console.log('    DEBUG: Clicked, waiting for start screen...')
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
  console.log(`    DEBUG: Found ${urlInputs.length} URL inputs after first toggle`)

  if (urlInputs.length >= 1) {
    console.log(`    DEBUG: Entering FASTA URL: file://${join(TEST_DATA_DIR, 'volvox.fa')}`)
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
  console.log(`    DEBUG: Found ${urlInputs.length} URL inputs after second toggle`)

  if (urlInputs.length >= 2) {
    console.log(`    DEBUG: Entering FAI URL: file://${join(TEST_DATA_DIR, 'volvox.fa.fai')}`)
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

async function testFileMenu(driver: WebDriver): Promise<void> {
  await findByText(driver, 'File', 10000)
}

async function testHelpAbout(driver: WebDriver): Promise<void> {
  // Close any open dialogs from previous tests
  await closeAllDialogs(driver)

  // Check if we're in an active session (not on start screen)
  const startScreenElements = await driver.findElements(
    By.xpath("//*[contains(text(), 'Launch new session')]"),
  )
  if (startScreenElements.length > 0) {
    console.log('    DEBUG: On start screen, no active session - skipping test')
    throw new Error('No active session - previous genome loading test may have failed')
  }

  // First, let's see what menus are available
  console.log('    DEBUG: Looking for menu buttons in toolbar...')
  const allButtons = await driver.findElements(By.css('button'))
  console.log(`    DEBUG: Found ${allButtons.length} buttons total`)

  // Try to find the Help menu by looking for buttons in the toolbar area
  // The menus are rendered using DropDownMenu which creates buttons with menu labels
  const helpButton = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//button[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'help')]",
      ),
    ),
    10000,
  )
  console.log('    DEBUG: Found Help button, clicking...')
  await helpButton.click()
  await delay(500)

  // Click About in the dropdown menu - look specifically for a MenuItem or li element
  console.log('    DEBUG: Looking for About menu item in dropdown...')
  const aboutItem = await driver.wait(
    until.elementLocated(
      By.xpath(
        "//li[contains(@class, 'MuiMenuItem') and contains(., 'About')]",
      ),
    ),
    5000,
  )
  console.log('    DEBUG: Found About menu item, clicking...')
  await aboutItem.click()
  await delay(500)

  console.log('    DEBUG: Looking for About dialog content...')
  await findByText(driver, 'The Evolutionary Software Foundation', 10000)

  // Press Escape to close
  console.log('    DEBUG: Closing About dialog...')
  await driver.actions().sendKeys('\uE00C').perform()
  await delay(300)
}

async function testZoom(driver: WebDriver): Promise<void> {
  // Close any open dialogs from previous tests
  await closeAllDialogs(driver)

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
  // Close any open dialogs from previous tests
  await closeAllDialogs(driver)

  console.log('    DEBUG: Looking for view menu icon...')
  const viewMenu = await driver.wait(
    until.elementLocated(By.css('[data-testid="view_menu_icon"]')),
    10000,
  )
  console.log('    DEBUG: Found view menu, clicking...')
  await viewMenu.click()
  await delay(500)

  // Hover over "View options" menu item to open submenu
  console.log('    DEBUG: Looking for View options submenu...')
  const viewOptions = await findByText(driver, 'View options', 5000)
  console.log('    DEBUG: Found View options, hovering...')
  await driver.actions().move({ origin: viewOptions }).perform()
  await delay(1000)

  console.log('    DEBUG: Looking for Move to new tab...')
  const moveToTab = await driver.wait(
    until.elementLocated(
      By.xpath("//li[contains(@class, 'MuiMenuItem') and contains(., 'Move to new tab')]"),
    ),
    5000,
  )
  console.log('    DEBUG: Found Move to new tab, clicking via JavaScript...')
  // Use JavaScript click which is more reliable for menu items
  await driver.executeScript('arguments[0].click();', moveToTab)
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

async function testWorkspaceCopyView(driver: WebDriver): Promise<void> {
  // Close any open dialogs from previous tests
  await closeAllDialogs(driver)

  // After moving to a new tab, the view structure might be different
  // Let's see what's available
  console.log('    DEBUG: Looking for view menu icon...')

  // First check what elements exist
  const allTestIds = await driver.findElements(By.css('[data-testid]'))
  console.log(`    DEBUG: Found ${allTestIds.length} elements with data-testid`)

  // Try to find the view menu icon - it might be inside the dockview panel now
  let viewMenu = await driver.findElements(
    By.css('[data-testid="view_menu_icon"]'),
  )
  console.log(`    DEBUG: Found ${viewMenu.length} view_menu_icon elements`)

  if (viewMenu.length === 0) {
    // Maybe the view is inside a dockview panel, try a broader search
    viewMenu = await driver.findElements(By.css('[class*="view"] button'))
    console.log(`    DEBUG: Found ${viewMenu.length} buttons in view-related elements`)
  }

  if (viewMenu.length === 0) {
    throw new Error('Could not find view menu icon')
  }

  const viewMenuElement = viewMenu[0]!
  console.log('    DEBUG: Found view menu, clicking...')
  await viewMenuElement.click()
  await delay(500)

  // Hover over "View options" menu item to open submenu
  console.log('    DEBUG: Looking for View options submenu...')
  const viewOptions = await findByText(driver, 'View options', 5000)
  console.log('    DEBUG: Found View options, hovering...')
  await driver.actions().move({ origin: viewOptions }).perform()
  await delay(1000)

  console.log('    DEBUG: Looking for Copy view...')
  const copyView = await driver.wait(
    until.elementLocated(
      By.xpath("//li[contains(@class, 'MuiMenuItem') and contains(., 'Copy view')]"),
    ),
    5000,
  )
  console.log('    DEBUG: Found Copy view, clicking via JavaScript...')
  // Use JavaScript click which is more reliable for menu items
  await driver.executeScript('arguments[0].click();', copyView)
  await delay(2000)

  console.log('    DEBUG: Counting view menus...')
  const viewMenus = await driver.findElements(
    By.css('[data-testid="view_menu_icon"]'),
  )
  console.log(`    DEBUG: Found ${viewMenus.length} view menus`)

  if (viewMenus.length !== 2) {
    throw new Error(`Expected 2 view menus, got ${viewMenus.length}`)
  }
}

async function cleanup(): Promise<void> {
  const { execSync } = await import('child_process')
  try {
    execSync('pkill -f chromedriver || true', { stdio: 'ignore' })
    execSync('pkill -f jbrowse-desktop || true', { stdio: 'ignore' })
  } catch {
    // Ignore errors
  }
  await delay(1000)
}

async function main(): Promise<void> {
  console.log(`Running in ${isHeadless ? 'headless' : 'headed'} mode`)

  // Clean up any leftover processes from previous runs
  console.log('Cleaning up leftover processes...')
  await cleanup()

  console.log('Starting ChromeDriver...')
  await startChromedriver()

  console.log('Creating WebDriver and launching Electron app...')
  driver = await createDriver()

  console.log('\nRunning tests...\n')

  console.log('Start Screen:')
  await runTest('should display application title', testStartScreen, driver)
  await runTest(
    'should show start screen elements',
    testStartScreenElements,
    driver,
  )

  console.log('\nOpen Genome from Available Genomes:')
  await runTest('should open hg19 genome', testOpenHg19Genome, driver)

  console.log('\nOpen Genome with Local Files:')
  await runTest('should open volvox genome', testOpenVolvoxGenome, driver)

  console.log('\nTrack Operations:')
  await runTest('should show File menu', testFileMenu, driver)
  await runTest('should open Help > About dialog', testHelpAbout, driver)
  await runTest('should zoom in and out', testZoom, driver)
  await runTest('should search for location', testLocationSearch, driver)

  console.log('\nWorkspaces:')
  await runTest('should move view to new tab', testWorkspaceMoveToTab, driver)
  await runTest('should copy view', testWorkspaceCopyView, driver)

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
    execSync('pkill -f jbrowse-desktop || true', { stdio: 'ignore' })
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
    execSync('pkill -f jbrowse-desktop || true', { stdio: 'ignore' })
  } catch {
    // Ignore errors
  }
  process.exit(1)
})
