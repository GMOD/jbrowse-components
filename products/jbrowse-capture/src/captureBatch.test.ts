import { launchBrowser } from './browser.ts'
import { captureBatch } from './capture.ts'

jest.mock('./browser.ts', () => ({
  isBrowserConsoleNoise: () => false,
  launchBrowser: jest.fn(),
}))
jest.mock('./catalog.ts', () => ({
  resolveAgainstConfig: (options: object) => Promise.resolve(options),
  canonicalSessionAssembly: () => Promise.resolve(undefined),
}))
jest.mock('./instanceVersion.ts', () => ({
  assertSupportedInstance: () => Promise.resolve(),
}))
jest.mock('./ready.ts', () => ({
  waitForJBrowseReady: () =>
    Promise.resolve({ pending: [], tooLarge: [], unsettled: [] }),
}))

function fakeBrowser({ dieOn }: { dieOn?: string } = {}) {
  const browser = {
    connected: true,
    pagesOpen: 0,
    close: jest.fn(() => Promise.resolve()),
    newPage: jest.fn(() => {
      browser.pagesOpen++
      return Promise.resolve({
        setViewport: () => Promise.resolve(),
        viewport: () => undefined,
        goto: (url: string) => {
          if (dieOn && url.includes(dieOn)) {
            browser.connected = false
            return Promise.reject(new Error('Target closed'))
          }
          const cached = browser.newPage.mock.calls.length > 1
          return Promise.resolve({
            ok: () => !cached,
            status: () => (cached ? 304 : 200),
          })
        },
        screenshot: () => Promise.resolve(new Uint8Array()),
        close: () => {
          browser.pagesOpen--
          return Promise.resolve()
        },
      })
    }),
  }
  return browser
}

const launch = launchBrowser as unknown as jest.Mock

const captures = ['chr1:1-100', 'chr2:1-100', 'chr3:1-100'].map(loc => ({
  hub: 'hg38',
  loc,
}))

test('every capture shares one browser and closes its page, and a cached page load is a success', async () => {
  const browser = fakeBrowser()
  launch.mockReset().mockResolvedValue(browser)
  const results = await captureBatch(captures, { concurrency: 2 })
  expect(results.map(r => r.ok)).toEqual([true, true, true])
  expect(launch).toHaveBeenCalledTimes(1)
  expect(browser.newPage).toHaveBeenCalledTimes(3)
  expect(browser.pagesOpen).toBe(0)
  expect(browser.close).toHaveBeenCalledTimes(1)
})

test('a browser that died fails one capture and is relaunched for the rest', async () => {
  const second = fakeBrowser()
  launch
    .mockReset()
    .mockResolvedValueOnce(fakeBrowser({ dieOn: 'chr1' }))
    .mockResolvedValue(second)
  const results = await captureBatch(captures, { concurrency: 1 })
  expect(results.map(r => r.ok)).toEqual([false, true, true])
  expect(results[0]).toMatchObject({ error: { message: 'Target closed' } })
  expect(launch).toHaveBeenCalledTimes(2)
  expect(second.close).toHaveBeenCalledTimes(1)
})
