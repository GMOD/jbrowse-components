import { delay } from '@jbrowse/browser-test-utils'

import type { ScreenshotAction } from './screenshot-specs.ts'
import type { ElementHandle, Page } from 'puppeteer'

// re-exported so generate-screenshots.ts keeps importing it from './actions'
export { delay }

// Default wait for an element to appear/become-visible before acting on it.
export const FIND_TIMEOUT = 30000
const LOCATION_BOX_TIMEOUT = 15000
const TRACK_LABEL_TIMEOUT = 5000
const DEFAULT_ACTION_DELAY_MS = 500
const NAV_SETTLE_MS = 300
const SCROLL_STEP_MS = 100

// puppeteer text-pseudo-selector: matches an element by its visible text. Used
// to reach HTML floating labels / menu items that carry no testid.
export const textSelector = (text: string) => `::-p-text(${text})`

// Poll, from Node, until a plain-CSS element is gone or styled-hidden. Used for
// the loading-overlay-disappears wait: puppeteer's in-page waits (waitForSelector
// rAF-poll, waitForFunction timer-poll) both run their polling loop *inside* the
// page, and once a view settles the headless tab is non-visible — Chrome starves
// rAF and throttles in-page timers — so the loop stops firing and the wait times
// out even though the element was already removed. A Node-side timer is never
// throttled by page visibility, so this observes the removal reliably.
async function waitHiddenByNodePolling(
  page: Page,
  selector: string,
  timeout: number,
) {
  const deadline = Date.now() + timeout
  let gone = false
  while (!gone && Date.now() < deadline) {
    gone = await page.evaluate((sel: string) => {
      const el = document.querySelector(sel)
      const s = el ? getComputedStyle(el) : undefined
      const r = el?.getBoundingClientRect()
      return (
        !el ||
        s?.display === 'none' ||
        s?.visibility === 'hidden' ||
        Number(s?.opacity) === 0 ||
        (r?.width === 0 && r.height === 0)
      )
    }, selector)
    if (!gone) {
      await delay(200)
    }
  }
  if (!gone) {
    throw new Error(`timed out waiting for ${selector} to be hidden`)
  }
}

export function waitForVisible(
  page: Page,
  selector: string,
  {
    hidden = false,
    timeout = FIND_TIMEOUT,
  }: { hidden?: boolean; timeout?: number } = {},
) {
  // Plain-CSS hidden waits poll from Node (see waitHiddenByNodePolling). Text
  // disappearances use puppeteer's `::-p-text(…)` pseudo-selector, which
  // document.querySelector can't parse, and follow a click that keeps the page
  // compositing — so they keep the native wait. The appear case likewise stays
  // native (appearances follow clicks/paints that keep rAF alive).
  return hidden && !selector.startsWith('::-p-')
    ? waitHiddenByNodePolling(page, selector, timeout)
    : page.waitForSelector(selector, {
        [hidden ? 'hidden' : 'visible']: true,
        timeout,
      })
}

// Resolve an action's target element from either a CSS selector or visible text.
// On timeout, rethrow with the human target (the spec's `text`/`selector`) so a
// renamed menu item reads as `click target not found: text "Settings"` instead
// of puppeteer's parsed-selector blob ([[[{name,value}]]]).
function resolveTarget(page: Page, action: ScreenshotAction) {
  const selector =
    action.selector ?? (action.text ? textSelector(action.text) : undefined)
  return selector
    ? waitForVisible(page, selector).catch(() => {
        const target = action.selector
          ? `selector "${action.selector}"`
          : `text "${action.text}"`
        throw new Error(`${action.type} target not found: ${target}`)
      })
    : null
}

// Click a resolved element. A real mouse click at the element's center is
// preferred (it exercises hover/focus the way a user would), but absolutely-
// positioned overlays — e.g. an offset/overlapping track-name label sitting on
// top of a feature's floating label — can intercept that coordinate. When the
// element is covered (elementFromPoint resolves to a non-descendant), fall back
// to dispatching the event directly on the node, which still fires React's
// onClick/onContextMenu but can't be stolen by a painted-over sibling.
async function clickElement(
  el: Awaited<ReturnType<typeof resolveTarget>>,
  button: 'left' | 'right' = 'left',
) {
  if (el) {
    const covered = await el.evaluate(node => {
      const r = node.getBoundingClientRect()
      const top = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      )
      return (
        !top || (top !== node && !node.contains(top) && !top.contains(node))
      )
    })
    if (covered) {
      await el.evaluate((node, btn) => {
        if (btn === 'right') {
          const r = node.getBoundingClientRect()
          node.dispatchEvent(
            new MouseEvent('contextmenu', {
              bubbles: true,
              cancelable: true,
              clientX: r.left + r.width / 2,
              clientY: r.top + r.height / 2,
              button: 2,
            }),
          )
        } else {
          ;(node as HTMLElement).click()
        }
      }, button)
    } else {
      await el.click({ button })
    }
  }
}

export async function runAction(page: Page, action: ScreenshotAction) {
  if (action.type === 'delay') {
    await delay(action.ms ?? DEFAULT_ACTION_DELAY_MS)
  } else if (action.type === 'click') {
    // canvas-drawn features (reads, gene glyphs) have no DOM node, so allow a
    // viewport-coordinate click via action.from
    if (action.from) {
      await page.mouse.click(action.from.x, action.from.y)
    } else {
      await clickElement(await resolveTarget(page, action))
    }
  } else if (action.type === 'rightclick') {
    if (action.from) {
      await page.mouse.click(action.from.x, action.from.y, { button: 'right' })
    } else {
      await clickElement(await resolveTarget(page, action), 'right')
    }
  } else if (action.type === 'hover') {
    // a bare coordinate move (e.g. off a read to dismiss its hover tooltip while
    // a just-opened context menu stays put)
    if (action.from) {
      await page.mouse.move(action.from.x, action.from.y)
    } else {
      const el = await resolveTarget(page, action)
      await el?.hover()
    }
  } else if (action.type === 'type') {
    const el = await resolveTarget(page, action)
    if (action.clear) {
      // triple-click selects the field's current text, then Backspace deletes it
      // so an empty value genuinely clears the field (typing '' alone leaves the
      // selection in place)
      await el?.click({ count: 3 })
      await page.keyboard.press('Backspace')
    } else {
      await el?.click()
    }
    await page.keyboard.type(action.value ?? '')
  } else if (action.type === 'drag' && action.from && action.to) {
    await page.mouse.move(action.from.x, action.from.y)
    await page.mouse.down()
    await page.mouse.move(action.to.x, action.to.y, { steps: 20 })
    await page.mouse.up()
  } else if (action.type === 'scroll') {
    const el = await resolveTarget(page, action)
    await el?.evaluate(node => {
      let ancestor: HTMLElement | null = node.parentElement
      while (ancestor) {
        const style = getComputedStyle(ancestor)
        if (
          (style.overflowX === 'auto' || style.overflowX === 'scroll') &&
          ancestor.scrollWidth > ancestor.clientWidth
        ) {
          break
        }
        ancestor = ancestor.parentElement
      }
      if (ancestor) {
        const targetRect = node.getBoundingClientRect()
        const containerRect = ancestor.getBoundingClientRect()
        const targetCenter =
          targetRect.left -
          containerRect.left +
          ancestor.scrollLeft +
          targetRect.width / 2
        ancestor.scrollLeft = targetCenter - ancestor.clientWidth / 2
      }
    })
  } else if (action.type === 'press' && action.key) {
    await page.keyboard.press(action.key)
  } else if (action.type === 'waitForSelector' && action.selector) {
    // rethrow puppeteer's parsed-selector blob ([[[{name,value}]]]) as the
    // readable selector so a timeout names what was missing
    await waitForVisible(page, action.selector, {
      hidden: action.hidden,
    }).catch(() => {
      throw new Error(
        `waitForSelector: ${action.hidden ? 'still visible' : 'never found'} "${action.selector}"`,
      )
    })
  } else if (action.type === 'waitForText' && action.text) {
    await waitForVisible(page, textSelector(action.text), {
      hidden: action.hidden,
    }).catch(() => {
      throw new Error(
        `waitForText: ${action.hidden ? 'text still visible' : 'never found visible text'} "${action.text}"`,
      )
    })
  }
}

export async function setLocation(page: Page, loc: string) {
  const locBox = await waitForVisible(
    page,
    'input[placeholder="Search for location"]',
    { timeout: LOCATION_BOX_TIMEOUT },
  )
  await locBox?.click({ count: 3 })
  await locBox?.type(loc)
  await page.keyboard.press('Enter')
  await delay(NAV_SETTLE_MS)
}

async function scrollTrackListUntilVisible(page: Page, trackId: string) {
  const selector = `[data-testid="htsTrackLabel-Tracks,${trackId}"]`
  // The track list is virtualized, so scroll its container until the item renders
  let found: ElementHandle | null = null
  for (let step = 0; step < 30 && !found; step++) {
    found = await page.$(selector)
    if (!found) {
      await page.evaluate((s: number) => {
        // Find the scrollable track list container (overflowY:auto with scrollable content)
        const containers = Array.from(
          document.querySelectorAll<HTMLElement>('*'),
        )
        const scrollable = containers.find(
          el =>
            window.getComputedStyle(el).overflowY === 'auto' &&
            el.scrollHeight > el.clientHeight + 10,
        )
        if (scrollable) {
          scrollable.scrollTop = s * 150
        }
      }, step)
      await delay(SCROLL_STEP_MS)
    }
  }
  return found
}

export async function openTrack(page: Page, trackId: string) {
  const selector = `[data-testid="htsTrackLabel-Tracks,${trackId}"]`
  // First check if it's already in the DOM, otherwise scroll the virtualized list
  if (!(await page.$(selector))) {
    await scrollTrackListUntilVisible(page, trackId)
  }
  const label = await page.waitForSelector(selector, {
    timeout: TRACK_LABEL_TIMEOUT,
  })
  await label?.click()
}
