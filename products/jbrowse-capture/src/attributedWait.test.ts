import { waitForSelectorAttributed } from './waits.ts'

import type { Page } from 'puppeteer'

afterEach(() => {
  document.body.replaceChildren()
})

// A SELECTOR WAIT RUNS BEFORE EVERY BEST-EFFORT ONE, so it is the wait a capture
// with an unpainted display actually dies on — and puppeteer's `TimeoutError`
// names the selector and nothing else. The census that answers "which display,
// and what does it say about itself" ran after it, or not at all.
//
// The page here is a stand-in whose `evaluate` runs the serialized function
// against jsdom, which is what it does against the real page: the census is
// re-read from the DOM at report time rather than taken off a handle the wait
// held. Holding one across a re-render throws `Node is detached from document`,
// which is how the first attempt at this turned four diagnosable timeouts into
// nine opaque puppeteer errors.
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
    waitForSelectorAttributed(fakePage(), '[data-testid="maf-display"]', 100),
  ).rejects.toThrow(
    '2 display(s) had not painted: pileup-display (reads-x) is loading; maf-display is ready',
  )
})

// The selector and the deadline stay in the message: the census explains the
// commonest cause, it does not replace what was being waited for.
test('the message keeps the selector and the timeout', async () => {
  await expect(
    waitForSelectorAttributed(fakePage(), '[data-testid="pileup"]', 100),
  ).rejects.toThrow('[data-testid="pileup"] did not appear within 100ms')
})

// An empty census is a real answer, not a shrug — and NOT the same as good news.
// `tooLarge` and `renderError` replace the display's subtree, so they publish
// neither attribute and are absent here: a wait on one of those can never
// resolve and can never be reported. The message names both readings.
test('a page with nothing pending names the two readings of that', async () => {
  document.body.innerHTML =
    '<div data-testid="pileup-display" data-display-drawn="true"></div>'
  await expect(
    waitForSelectorAttributed(fakePage(), '[data-testid="dialog"]', 100),
  ).rejects.toThrow('no display reported itself unpainted')
})

// The terminal phases, spelled as the DOM spells them: no wrapper at all. This
// is the case that reads as a timeout forever, and it arrives as an empty
// census rather than as a phase.
test('a display in a terminal phase publishes nothing to the census', async () => {
  document.body.innerHTML = '<div class="tooLargeBanner">Zoom in</div>'
  await expect(
    waitForSelectorAttributed(
      fakePage(),
      '[data-testid="pileup-display"][data-display-drawn="true"]',
      100,
    ),
  ).rejects.toThrow('tooLarge, renderError')
})

// A navigation or a closed target destroys the context, so the census cannot be
// taken either — best-effort in its own right, and the timeout still surfaces.
test('a page that cannot be queried still reports the timeout', async () => {
  await expect(
    waitForSelectorAttributed(
      fakePage({ queryable: false }),
      '[data-testid="pileup"]',
      100,
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
    100,
  ).catch((e: unknown) => e)
  expect(((error as Error).cause as Error).message).toContain('100ms exceeded')
})

test('a selector that resolves hands back its handle', async () => {
  await expect(
    waitForSelectorAttributed(
      fakePage({ appears: true }),
      '[data-testid="pileup"]',
      100,
    ),
  ).resolves.toEqual({ handle: true })
})
