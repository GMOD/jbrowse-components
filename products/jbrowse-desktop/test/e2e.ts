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
  await delay(500)
  await clickButton(driver, 'Cancel')
  await delay(500)
  await waitForStartScreen(driver)
}

async function testAvailableGenomesDialog(driver: WebDriver): Promise<void> {
  await waitForStartScreen(driver)
  await clickButton(driver, 'Show all available genomes')
  await delay(500)
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
  // Ensure any dialogs are closed
  await driver.actions().sendKeys('\uE00C').perform()
  await delay(300)

  await waitForStartScreen(driver)

  // Click "Show all available genomes"
  await clickButton(driver, 'Show all available genomes')
  await delay(2000)

  // Search for hg19 to filter the table (so the row is visible without scrolling)
  const genomeSearchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search"]')),
    10000,
  )
  await genomeSearchInput.sendKeys('hg19')
  await delay(1000)

  // Find the row containing hg19 and click the (launch) link within it
  const launchLink = await driver.wait(
    until.elementLocated(
      By.xpath("//td[contains(., 'hg19')]//a[contains(text(), 'launch')]"),
    ),
    15000,
  )
  await driver.wait(until.elementIsVisible(launchLink), 5000)
  await launchLink.click()
  await delay(3000)

  // Click "Launch view" to create the linear genome view
  await clickButton(driver, 'Launch view')
  await delay(2000)

  // Wait for location search input
  const searchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search for location"]')),
    30000,
  )

  // Navigate to a specific region so the view fully loads
  await clearInput(driver, searchInput)
  await searchInput.sendKeys('chr1:1-10000')
  await searchInput.sendKeys('\uE007') // Enter
  await delay(3000)

  // Wait for zoom controls to appear (indicates view is fully loaded)
  await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_in"]')),
    15000,
  )
}

async function testOpenVolvoxGenome(driver: WebDriver): Promise<void> {
  // Ensure any dialogs are closed
  await driver.actions().sendKeys('\uE00C').perform()
  await delay(500)

  await waitForStartScreen(driver)
  await clickButton(driver, 'Open new genome')
  await delay(1000)

  // Find and fill assembly name input (first visible text input)
  const assemblyInput = await driver.wait(
    until.elementLocated(By.css('input[type="text"]')),
    10000,
  )
  await assemblyInput.sendKeys('volvox')

  // Click URL toggle buttons to switch from file to URL mode
  const urlToggleButtons = await driver.findElements(
    By.css('button[value="url"]'),
  )

  // Click first URL toggle (for FASTA file)
  if (urlToggleButtons.length >= 1) {
    await urlToggleButtons[0].click()
    await delay(500)
  }

  // Find URL inputs by data-testid
  let urlInputs = await driver.findElements(By.css('[data-testid="urlInput"]'))

  if (urlInputs.length >= 1) {
    await urlInputs[0].sendKeys(`file://${join(TEST_DATA_DIR, 'volvox.fa')}`)
  }

  // Click second URL toggle (for FAI file)
  if (urlToggleButtons.length >= 2) {
    await urlToggleButtons[1].click()
    await delay(500)
  }

  // Find URL inputs again after second toggle
  urlInputs = await driver.findElements(By.css('[data-testid="urlInput"]'))

  if (urlInputs.length >= 2) {
    await urlInputs[1].sendKeys(
      `file://${join(TEST_DATA_DIR, 'volvox.fa.fai')}`,
    )
  }

  await clickButton(driver, 'Submit')

  // Wait for session to be created
  await delay(2000)

  // Launch the linear genome view
  await clickButton(driver, 'Launch view')
  await delay(2000)

  // Wait for location search input
  const searchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search for location"]')),
    30000,
  )

  // Navigate to a specific region so the view fully loads
  await clearInput(driver, searchInput)
  await searchInput.sendKeys('ctgA:1-10000')
  await searchInput.sendKeys('\uE007') // Enter
  await delay(2000)

  // Wait for zoom controls to appear (indicates view is fully loaded)
  await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_in"]')),
    10000,
  )
}

async function testFileMenu(driver: WebDriver): Promise<void> {
  await findByText(driver, 'File', 10000)
}

async function testHelpAbout(driver: WebDriver): Promise<void> {
  // Help is a button in the toolbar - find and click the button containing "Help"
  const helpButton = await driver.wait(
    until.elementLocated(By.xpath("//button[contains(., 'Help')]")),
    10000,
  )
  await helpButton.click()
  await delay(500)
  // Click About in menu
  const aboutItem = await findByText(driver, 'About', 5000)
  await aboutItem.click()
  await delay(500)
  await findByText(driver, 'The Evolutionary Software Foundation', 10000)
  // Press Escape to close
  await driver.actions().sendKeys('\uE00C').perform()
  await delay(300)
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
  const viewMenu = await driver.wait(
    until.elementLocated(By.css('[data-testid="view_menu_icon"]')),
    10000,
  )
  await viewMenu.click()
  await delay(500)

  // Hover over "View options" menu item to open submenu
  const viewOptions = await findByText(driver, 'View options', 5000)
  await driver.actions().move({ origin: viewOptions }).perform()
  await delay(500)

  const moveToTab = await findByText(driver, 'Move to new tab', 5000)
  await moveToTab.click()
  await delay(1000)

  // Verify dockview is present
  const dockview = await driver.findElements(
    By.css('.dockview-theme-light, .dockview-theme-dark'),
  )
  if (dockview.length === 0) {
    throw new Error('Dockview not found after moving to new tab')
  }
}

async function testWorkspaceCopyView(driver: WebDriver): Promise<void> {
  const viewMenu = await driver.wait(
    until.elementLocated(By.css('[data-testid="view_menu_icon"]')),
    10000,
  )
  await viewMenu.click()
  await delay(500)

  // Hover over "View options" menu item to open submenu
  const viewOptions = await findByText(driver, 'View options', 5000)
  await driver.actions().move({ origin: viewOptions }).perform()
  await delay(500)

  const copyView = await findByText(driver, 'Copy view', 5000)
  await copyView.click()
  await delay(1000)

  const viewMenus = await driver.findElements(
    By.css('[data-testid="view_menu_icon"]'),
  )
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

  console.log('\nOpen Genome Dialog:')
  await runTest('should open genome dialog', testOpenGenomeDialog, driver)
  await runTest('should cancel genome dialog', testCancelGenomeDialog, driver)

  console.log('\nAvailable Genomes:')
  await runTest(
    'should open available genomes dialog',
    testAvailableGenomesDialog,
    driver,
  )
  await runTest(
    'should close available genomes dialog',
    testCloseAvailableGenomesDialog,
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
