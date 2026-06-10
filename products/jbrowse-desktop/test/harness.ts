import { spawn, ChildProcess, execSync } from 'child_process'
import http from 'http'
import { createRequire } from 'module'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'

import handler from 'serve-handler'
import { Builder, WebDriver, By, until, logging, Key } from 'selenium-webdriver'

const require = createRequire(import.meta.url)
const __dirname = dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = resolve(__dirname, '../../..')
export const TEST_DATA_DIR = resolve(__dirname, '../../../test_data/volvox')
export const isWindows = process.platform === 'win32'
export const isHeadless =
  process.argv.includes('--headless') || process.env.HEADLESS === 'true'

export const APP_BINARY = resolve(
  __dirname,
  isWindows
    ? '../dist/unpacked/jbrowse-desktop-win32-x64/jbrowse-desktop.exe'
    : '../dist/unpacked/jbrowse-desktop-linux-x64/jbrowse-desktop',
)

const CHROMEDRIVER_PORT = 9515
const electronChromedriverDir = dirname(
  require.resolve('electron-chromedriver/package.json'),
)
const CHROMEDRIVER_PATH = join(
  electronChromedriverDir,
  'bin',
  isWindows ? 'chromedriver.exe' : 'chromedriver',
)

export const delay = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

export async function startChromedriver(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    console.log(`  Launching: ${CHROMEDRIVER_PATH}`)
    const proc = spawn(CHROMEDRIVER_PATH, [`--port=${CHROMEDRIVER_PORT}`], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    proc.on('error', err => {
      console.error('  ChromeDriver spawn error:', err)
      reject(err)
    })
    proc.stdout?.on('data', data => {
      const output = data.toString()
      console.log('  ChromeDriver stdout:', output.trim())
      if (output.includes('was started successfully')) {
        resolve(proc)
      }
    })
    proc.stderr?.on('data', data => {
      console.log('  ChromeDriver stderr:', data.toString().trim())
    })
    // Fallback timeout - give it more time to start
    setTimeout(() => {
      resolve(proc)
    }, 5000)
  })
}

export async function createDriver(): Promise<WebDriver> {
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

  await driver.manage().setTimeouts({
    implicit: 30000,
    pageLoad: 120000,
    script: 60000,
  })

  return driver
}

export async function flushBrowserLogs(driver: WebDriver): Promise<void> {
  try {
    const logs = await driver.manage().logs().get(logging.Type.BROWSER)
    for (const entry of logs) {
      console.log(`    [Browser ${entry.level.name}] ${entry.message}`)
    }
  } catch (e) {
    console.warn('    WARN: could not fetch browser logs:', e)
  }
}

// Case-insensitive XPath text search
export function textContainsXPath(text: string, elementType = '*') {
  const lowerText = text.toLowerCase()
  return `//${elementType}[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lowerText}')]`
}

export async function findByText(
  driver: WebDriver,
  text: string,
  timeout = 30000,
) {
  return driver.wait(
    until.elementLocated(By.xpath(textContainsXPath(text))),
    timeout,
  )
}

export async function clickButton(
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

// Clear input field using keyboard shortcuts
export async function clearInput(
  driver: WebDriver,
  element: any,
): Promise<void> {
  await element.click()
  await driver
    .actions()
    .keyDown(Key.CONTROL)
    .sendKeys('a')
    .keyUp(Key.CONTROL)
    .perform()
  await driver.actions().sendKeys(Key.DELETE).perform()
}

export async function waitForStartScreen(
  driver: WebDriver,
  timeout = 30000,
): Promise<void> {
  await findByText(driver, 'Launch new session', timeout)
}

export async function waitForBackdropsToDisappear(
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

// Close all dialogs, menus, and backdrops
export async function cleanupUI(driver: WebDriver): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const dialogs = await driver.findElements(By.css('.MuiDialog-root'))
    if (dialogs.length === 0) {
      break
    }
    await driver.actions().sendKeys(Key.ESCAPE).perform()
    await delay(300)
  }

  const backdrops = await driver.findElements(By.css('.MuiBackdrop-root'))
  for (const backdrop of backdrops) {
    try {
      await driver.executeScript('arguments[0].click();', backdrop)
      await delay(200)
    } catch (e) {
      console.warn(
        '    WARN: backdrop dismiss failed (likely already gone):',
        e,
      )
    }
  }

  for (let i = 0; i < 3; i++) {
    await driver.actions().sendKeys(Key.ESCAPE).perform()
    await delay(200)
  }
  try {
    const body = await driver.findElement(By.css('body'))
    await driver.executeScript('arguments[0].click();', body)
    await delay(300)
  } catch (e) {
    console.warn('    WARN: body click during cleanup failed:', e)
  }
}

// Open a menu and click an item within it
export async function openMenuItem(
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
  await driver.executeScript('arguments[0].click();', menuItem)
  await delay(500)
}

// Serve a directory over http. Desktop loads picked local files via LocalFile
// (localPath), but a typed file:// URL becomes a UriLocation that the packaged
// renderer's fetch refuses — so screenshots serve test_data over http instead.
export async function startStaticServer(
  rootDir: string,
  port: number,
): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    void handler(req, res, { public: rootDir })
  })
  return new Promise((resolve, reject) => {
    server.on('error', reject)
    // Bind IPv4 explicitly so the Chromium fetch of http://127.0.0.1 resolves
    // (localhost can resolve to ::1 while the server listens on IPv4 → fetch fails)
    server.listen(port, '127.0.0.1', () => {
      resolve(server)
    })
  })
}

// Load the volvox assembly from a FASTA url via the "Open new genome" dialog,
// then navigate to a region so the view fully paints. The .fai index url is
// auto-derived as <fasta>.fai.
export async function openVolvoxGenome(
  driver: WebDriver,
  fastaUrl: string,
): Promise<void> {
  await waitForStartScreen(driver)
  await clickButton(driver, 'Open new genome')
  await delay(1000)

  const assemblyInput = await driver.wait(
    until.elementLocated(By.css('input[type="text"]')),
    10000,
  )
  await assemblyInput.sendKeys('volvox')

  // The "FASTA with index" format has two file selectors (FASTA + .fai index),
  // both required — the index is NOT auto-derived. Switch each to URL mode and
  // fill it. The index url is <fasta>.fai.
  const urlToggleButtons = await driver.findElements(
    By.xpath("//button[contains(., 'URL')]"),
  )
  if (urlToggleButtons.length >= 1) {
    await urlToggleButtons[0]!.click()
    await delay(500)
  }
  let urlInputs = await driver.findElements(By.css('[data-testid="urlInput"]'))
  if (urlInputs.length >= 1) {
    await clearInput(driver, urlInputs[0]!)
    await urlInputs[0]!.sendKeys(fastaUrl)
  }
  if (urlToggleButtons.length >= 2) {
    await urlToggleButtons[1]!.click()
    await delay(500)
  }
  urlInputs = await driver.findElements(By.css('[data-testid="urlInput"]'))
  if (urlInputs.length >= 2) {
    // The index field auto-fills with a derived name; clear it before typing
    await clearInput(driver, urlInputs[1]!)
    await urlInputs[1]!.sendKeys(`${fastaUrl}.fai`)
  }
  for (const [i, input] of urlInputs.entries()) {
    console.log(
      `    DEBUG: urlInput[${i}] = ${await input.getAttribute('value')}`,
    )
  }

  let submitButton = await driver.findElements(
    By.css('[data-testid="open-sequence-submit"]'),
  )
  if (submitButton.length === 0) {
    submitButton = [
      await driver.wait(
        until.elementLocated(By.xpath("//button[contains(., 'Submit')]")),
        10000,
      ),
    ]
  }
  const submitBtn = submitButton[0]!
  await driver.executeScript('arguments[0].scrollIntoView(true);', submitBtn)
  await delay(500)
  await driver.executeScript('arguments[0].click();', submitBtn)
  await delay(3000)

  const dialogs = await driver.findElements(By.css('.MuiDialog-root'))
  console.log(`    DEBUG: ${dialogs.length} dialogs open after submit`)
  if (dialogs.length > 0) {
    await driver.actions().sendKeys(Key.ESCAPE).perform()
    await delay(1000)
  }

  // Opening a new genome creates a session with no view; the empty session
  // shows a launcher. Click whatever launches a linear genome view.
  const launchButtons = await driver.findElements(
    By.xpath(
      "//button[contains(., 'Launch view') or contains(., 'Linear genome view')]",
    ),
  )
  console.log(`    DEBUG: ${launchButtons.length} view-launch buttons found`)
  if (launchButtons.length > 0) {
    await driver.executeScript('arguments[0].click();', launchButtons[0])
    await delay(2000)
  }

  // The linear genome view import form shows a submit "Open" button that enables
  // once the assembly has loaded and a default region is selected.
  const openButton = await driver.wait(
    until.elementLocated(
      By.xpath("//button[@type='submit' and contains(., 'Open')]"),
    ),
    30000,
  )
  await driver.wait(until.elementIsEnabled(openButton), 30000)
  console.log('    DEBUG: import-form Open button enabled, clicking')
  await driver.executeScript('arguments[0].click();', openButton)
  await delay(2000)

  const searchInput = await driver.wait(
    until.elementLocated(By.css('input[placeholder="Search for location"]')),
    30000,
  )
  await clearInput(driver, searchInput)
  await searchInput.sendKeys('ctgA:1-10000')
  await searchInput.sendKeys(Key.ENTER)
  await delay(2000)

  await driver.wait(
    until.elementLocated(By.css('[data-testid="zoom_in"]')),
    10000,
  )
}

// Kill leftover chromedriver / electron processes
export async function killProcesses(): Promise<void> {
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
  } catch (e) {
    console.warn('    WARN: process cleanup failed:', e)
  }
  await delay(1000)
}
