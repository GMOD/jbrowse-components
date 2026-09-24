import { waitForSelectorAttributed } from './waits.ts'

import type { Page } from 'puppeteer'

afterEach(() => {
  document.body.replaceChildren()
})

// `evaluate` runs the serialized census against jsdom's document, as it runs
// against the page's
function fakePage({
  appears = false,
  queryable = true,
}: { appears?: boolean; queryable?: boolean } = {}) {
  return {
    waitForSelector: () =>
      appears
        ? Promise.resolve({ handle: true })
        : Promise.reject(
            new Error('Waiting for selector failed: 100ms exceeded'),
          ),
    evaluate: (fn: () => unknown) =>
      queryable
        ? Promise.resolve(fn())
        : Promise.reject(new Error('Execution context was destroyed')),
  } as unknown as Page
}

test('a timeout names each unpainted display and its own phase', async () => {
  document.body.innerHTML = `
    <div data-testid="pileup-display" data-display-id="reads-x"
         data-display-drawn="false" data-display-phase="loading"></div>
    <div data-testid="maf-display" data-display-drawn="false"
         data-display-phase="ready"></div>`

  await expect(
    waitForSelectorAttributed(fakePage(), '[data-testid="maf-display"]', {
      timeout: 100,
    }),
  ).rejects.toThrow(
    '2 display(s) had not painted: pileup-display (reads-x) is loading; maf-display is ready',
  )
})

// The selector and the deadline stay in the message: the census explains the
// commonest cause, it does not replace what was being waited for.
test('the message keeps the selector and the timeout', async () => {
  await expect(
    waitForSelectorAttributed(fakePage(), '[data-testid="pileup"]', {
      timeout: 100,
    }),
  ).rejects.toThrow('[data-testid="pileup"] did not appear within 100ms')
})

test('a page with nothing pending says the selector was not a display', async () => {
  document.body.innerHTML =
    '<div data-testid="pileup-display" data-display-drawn="true"></div>'
  await expect(
    waitForSelectorAttributed(fakePage(), '[data-testid="dialog"]', {
      timeout: 100,
    }),
  ).rejects.toThrow('no display reported itself unpainted')
})

// A wait on a too-large display's body can never resolve; the banner that
// replaced it still says which display it is.
test('a display showing "too much data" is named in the timeout', async () => {
  document.body.innerHTML =
    '<div data-display-id="pileup-1" data-display-phase="tooLarge"></div>'
  await expect(
    waitForSelectorAttributed(
      fakePage(),
      '[data-testid="pileup-display"][data-display-drawn="true"]',
      { timeout: 100 },
    ),
  ).rejects.toThrow(
    '1 display(s) show "too much data" in place of their features: pileup-1 is tooLarge',
  )
})

// A navigation or a closed target destroys the context, so the census cannot be
// taken either — best-effort in its own right, and the timeout still surfaces.
test('a page that cannot be queried still reports the timeout', async () => {
  await expect(
    waitForSelectorAttributed(
      fakePage({ queryable: false }),
      '[data-testid="pileup"]',
      { timeout: 100 },
    ),
  ).rejects.toThrow('the page could not be queried afterwards (context gone)')
})

// The original is kept as `cause`: puppeteer distinguishes a deadline from a
// detached frame in its own message, and that is the half this wrapper cannot
// restate.
test('the puppeteer error survives as the cause', async () => {
  const error = await waitForSelectorAttributed(
    fakePage(),
    '[data-testid="pileup"]',
    { timeout: 100 },
  ).catch((e: unknown) => e)
  expect(((error as Error).cause as Error).message).toContain('100ms exceeded')
})

test('a selector that resolves hands back its handle', async () => {
  await expect(
    waitForSelectorAttributed(
      fakePage({ appears: true }),
      '[data-testid="pileup"]',
      { timeout: 100 },
    ),
  ).resolves.toEqual({ handle: true })
})
