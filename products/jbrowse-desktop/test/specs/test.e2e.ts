import * as path from 'path'
import { fileURLToPath } from 'url'

declare const browser: WebdriverIO.Browser
declare const $: WebdriverIO.Browser['$']
declare const $$: WebdriverIO.Browser['$$']

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_DATA_DIR = path.resolve(__dirname, '../../../../test_data/volvox')

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function findByText(text: string, timeout = 30000) {
  const element = await $(`*=${text}`)
  await element.waitForDisplayed({ timeout })
  return element
}

async function findByTestId(testId: string, timeout = 30000) {
  const element = await $(`[data-testid="${testId}"]`)
  await element.waitForDisplayed({ timeout })
  return element
}

async function waitForAppReady(timeout = 60000) {
  // Wait for the app to be ready - look for common elements
  // Try multiple selectors since we're not sure what's on screen
  const startTime = Date.now()
  while (Date.now() - startTime < timeout) {
    try {
      // Try to find any of these elements that indicate the app is ready
      const body = await $('body')
      const text = await body.getText()
      if (text && text.length > 100) {
        // App has loaded some content
        return text
      }
    } catch {
      // Keep trying
    }
    await delay(1000)
  }
  throw new Error('App did not load within timeout')
}

async function clickButton(text: string, timeout = 10000) {
  const button = await findByText(text, timeout)
  await button.click()
}

describe('JBrowse Desktop', () => {
  it('should launch and display content', async () => {
    // Take a screenshot to see what's on screen
    await delay(5000) // Wait for app to initialize

    const title = await browser.getTitle()
    console.log('Page title:', title)

    // Get the page source to debug
    const body = await $('body')
    const text = await body.getText()
    console.log('Page text (first 500 chars):', text.slice(0, 500))

    // Save a screenshot for debugging
    await browser.saveScreenshot('./test/screenshots/debug-startup.png')

    expect(title).toEqual('JBrowse')
  })

  it('should show start screen elements', async () => {
    await delay(3000)

    // Try to find any text on the page
    const body = await $('body')
    const text = await body.getText()

    // Check for various possible start screen texts
    const hasLaunchSession = text.includes('Launch new session')
    const hasOpenGenome = text.includes('Open new genome')
    const hasRecentSessions = text.includes('Recently opened')
    const hasJBrowse = text.includes('JBrowse')

    console.log('Found elements:', { hasLaunchSession, hasOpenGenome, hasRecentSessions, hasJBrowse })

    expect(hasLaunchSession || hasOpenGenome || hasJBrowse).toBe(true)
  })
})
