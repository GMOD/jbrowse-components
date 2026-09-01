// What the camera adds to the page that a user's own screen would have: a
// pointer, a mark where each click lands, and a line of text naming the step.
//
// Headless Chrome renders no OS cursor into a screencast, so a film taken
// without this is a UI operating itself — menus open with nothing having touched
// them. Every element here is `pointerEvents: none` and outside React's tree, so
// the app cannot see any of it and the click that follows is the real one.
import { delay } from '@jbrowse/browser-test-utils'

import type { Page } from 'puppeteer'

// How long a cursor takes to cross the frame. Long enough to follow, short
// enough that a six-step tour is not a minute of travel.
export const GLIDE_MS = 550

const CURSOR_ID = '__tour_cursor'
const CAPTION_ID = '__tour_caption'

export async function injectOverlay(page: Page) {
  await page.evaluate(
    (cursorId, captionId, glideMs) => {
      // 40px in a 1920 frame, for the reason the caption is 32px: an arrow at
      // the size a pointer is on the machine that filmed it is a few pixels
      // wide by the time the clip is played in a docs column, and a tour whose
      // pointer cannot be followed is a UI operating itself again.
      const cursor = document.createElement('div')
      cursor.id = cursorId
      cursor.innerHTML = `<svg width="40" height="40" viewBox="0 0 24 24">
        <path d="M5 3l14 7-6 1.5L9.5 19 5 3z" fill="#fff"
          stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`
      Object.assign(cursor.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        zIndex: '2147483647',
        pointerEvents: 'none',
        transform: 'translate(-100px, -100px)',
        transition: `transform ${glideMs}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        filter: 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.5))',
      })
      document.body.append(cursor)

      // THE TEXT IS DRAWN BY A PSEUDO-ELEMENT, not written into the node.
      //
      // A step's caption is usually the label of the thing it is about to click,
      // and the steps find their targets with puppeteer's `::-p-text(…)`. With
      // the words in the DOM, a caption reading `Launch` is a second
      // element containing "Launch" — and the resolver took it, so the tour
      // clicked its own subtitle and the menu item was never touched. Content
      // from `attr()` is not in textContent and cannot be matched.
      const style = document.createElement('style')
      style.textContent = `#${captionId}::after { content: attr(data-say); }`
      document.head.append(style)

      // Bottom centre, where a reader already looks for subtitles, and dark
      // rather than themed: it belongs to the film and not to the app, and a
      // chip in the app's own palette reads as a UI element the reader should
      // look for.
      //
      // THE TYPE IS SIZED FOR THE EMBED, NOT THE FRAME. A tour is filmed at
      // 1920 wide and played in a column around a third of that, so a caption
      // set at a comfortable 17px on the capture arrives at the reader near
      // 6px.
      const caption = document.createElement('div')
      caption.id = captionId
      Object.assign(caption.style, {
        position: 'fixed',
        left: '50%',
        bottom: '32px',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100% - 120px)',
        textAlign: 'center',
        zIndex: '2147483646',
        pointerEvents: 'none',
        padding: '12px 26px',
        borderRadius: '10px',
        background: 'rgba(17, 17, 17, 0.88)',
        color: '#fff',
        font: '600 32px/1.3 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        letterSpacing: '0.01em',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
        opacity: '0',
        transition: 'opacity 220ms ease',
      })
      document.body.append(caption)
    },
    CURSOR_ID,
    CAPTION_ID,
    GLIDE_MS,
  )
}

// Glide the drawn cursor to (x, y) and move the real mouse there in lockstep,
// then wait out the CSS transition so the screencast records the travel.
export async function moveCursor(page: Page, x: number, y: number) {
  await page.evaluate(
    (id, cx, cy) => {
      const c = document.getElementById(id)
      if (c) {
        c.style.transform = `translate(${cx}px, ${cy}px)`
        c.dataset.x = String(cx)
        c.dataset.y = String(cy)
      }
    },
    CURSOR_ID,
    x,
    y,
  )
  await page.mouse.move(x, y)
  await delay(GLIDE_MS + 80)
}

// Move both cursors together over `steps` frames, for the one action whose
// travel IS the action. A rubberband follows the real mouse, so a drawn cursor
// gliding on a CSS transition while puppeteer's stepped move finishes instantly
// would draw the selection somewhere the pointer is not.
export async function dragCursor(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  { steps, ms = 700 }: { steps?: number; ms?: number } = {},
) {
  // ~30ms a frame, so a drag stretched out to be watched moves as smoothly as
  // the default one rather than in 24 jumps however long it is given
  const frames = steps ?? Math.max(24, Math.round(ms / 30))
  await moveCursor(page, from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= frames; i++) {
    const x = from.x + ((to.x - from.x) * i) / frames
    const y = from.y + ((to.y - from.y) * i) / frames
    await page.evaluate(
      (id, cx, cy) => {
        const c = document.getElementById(id)
        if (c) {
          // no transition during a drag: the cursor is being placed every frame
          // rather than sent somewhere
          c.style.transition = 'none'
          c.style.transform = `translate(${cx}px, ${cy}px)`
          c.dataset.x = String(cx)
          c.dataset.y = String(cy)
        }
      },
      CURSOR_ID,
      x,
      y,
    )
    await page.mouse.move(x, y)
    await delay(ms / frames)
  }
  await page.mouse.up()
  await page.evaluate(
    (id, glideMs) => {
      const c = document.getElementById(id)
      if (c) {
        c.style.transition = `transform ${glideMs}ms cubic-bezier(0.4, 0, 0.2, 1)`
      }
    },
    CURSOR_ID,
    GLIDE_MS,
  )
}

// An expanding red ring where a click is about to land, so the click is legible
// on camera. Red because it is the one mark on screen that has to read as the
// film's and not the app's, and nothing in JBrowse's chrome is that colour.
//
// Fired before the real click rather than after: the click can navigate,
// open a menu over the point, or start a fetch that blocks the main thread, and
// a ripple queued behind any of those plays late or not at all.
export async function clickPulse(page: Page, x: number, y: number) {
  await page.evaluate(
    (cx, cy) => {
      const ring = document.createElement('div')
      Object.assign(ring.style, {
        position: 'fixed',
        left: `${cx}px`,
        top: `${cy}px`,
        width: '26px',
        height: '26px',
        marginLeft: '-13px',
        marginTop: '-13px',
        borderRadius: '50%',
        border: '4px solid #e53935',
        background: 'rgba(229, 57, 53, 0.35)',
        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.6)',
        pointerEvents: 'none',
        zIndex: '2147483646',
      })
      document.body.append(ring)
      ring
        .animate(
          [
            { transform: 'scale(0.3)', opacity: 1 },
            { transform: 'scale(1.9)', opacity: 1, offset: 0.55 },
            { transform: 'scale(2.9)', opacity: 0 },
          ],
          { duration: 550, easing: 'ease-out' },
        )
        .addEventListener('finish', () => {
          ring.remove()
        })
    },
    x,
    y,
  )
}

// A keycap where the pointer is, for the steps that press a key.
//
// A press is the one action with nothing on screen behind it: the cursor does
// not move, no ripple lands, and the app just changes — a locus box that
// navigates on Enter reads as having navigated by itself, and an Escape that
// closes a menu reads as the menu giving up. The cap is drawn beside the
// pointer's last position rather than in a corner, so it belongs to the hand
// that has been doing everything else.
export async function keyPress(page: Page, key: string) {
  await page.evaluate(
    (cursorId, label) => {
      const cursor = document.getElementById(cursorId)
      const x = Number(cursor?.dataset.x ?? window.innerWidth / 2)
      const y = Number(cursor?.dataset.y ?? window.innerHeight / 2)
      const cap = document.createElement('div')
      cap.textContent = label
      Object.assign(cap.style, {
        position: 'fixed',
        left: `${x + 26}px`,
        top: `${Math.max(12, y - 52)}px`,
        zIndex: '2147483646',
        pointerEvents: 'none',
        padding: '6px 14px',
        borderRadius: '8px',
        border: '2px solid #111',
        borderBottomWidth: '5px',
        background: '#fff',
        color: '#111',
        font: '600 24px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
      })
      document.body.append(cap)
      cap
        .animate(
          [
            { transform: 'translateY(6px)', opacity: 0 },
            { transform: 'translateY(0)', opacity: 1, offset: 0.12 },
            { transform: 'translateY(0)', opacity: 1, offset: 0.75 },
            { transform: 'translateY(-8px)', opacity: 0 },
          ],
          { duration: 900, easing: 'ease-out' },
        )
        .addEventListener('finish', () => {
          cap.remove()
        })
    },
    CURSOR_ID,
    key,
  )
}

// Empty text fades the chip out rather than emptying it, so a step with nothing
// to say leaves no black bar behind, and the words it was showing stay put while
// it fades.
export async function setCaption(page: Page, text: string) {
  await page.evaluate(
    (id, value) => {
      const el = document.getElementById(id)
      if (el) {
        if (value) {
          el.dataset.say = value
        }
        el.style.opacity = value ? '1' : '0'
      }
    },
    CAPTION_ID,
    text,
  )
}

// Send the pointer off frame, for the tail of a clip: a cursor parked over a
// control leaves the last thing on screen looking like a step that did not
// finish, and it is the frame the poster is taken from.
//
// THE DRAWN CURSOR IS HIDDEN RATHER THAN GLIDED OUT. A screencast delivers
// frames while the page repaints and the last repaint of a run of them does not
// reach the file, so a park that is only a `moveCursor` ends the clip with the
// arrow frozen about four fifths of the way through its travel — near the
// bottom edge, over whatever is drawn there. Every poster taken at the end
// carried one. Dropping the opacity in one step leaves the arrow gone in the
// frame after it, which the seconds of tail behind it do reach. The real mouse
// still leaves the viewport, so the app's own hover comes down with it.
export async function parkCursor(page: Page, height: number) {
  await page.mouse.move(40, height + 60)
  await page.evaluate(id => {
    const c = document.getElementById(id)
    if (c) {
      c.style.transition = 'none'
      c.style.opacity = '0'
    }
  }, CURSOR_ID)
  await delay(GLIDE_MS + 80)
}

// Scroll the page, filmed. `to` is a y offset, or 'bottom' for as far as the
// document goes.
//
// The one motion in these tours that is the READER's rather than the app's: a
// launch adds a whole view below the one it was launched from, and a window that
// held the first does not hold both. Smooth rather than instant, because a jump
// cut down a page reads as the app having redrawn itself.
export async function scrollPage(
  page: Page,
  to: number | 'bottom',
  { ms = 900 }: { ms?: number } = {},
) {
  await page.evaluate(
    (target, duration) => {
      // The app fills the window and absorbs its overflow in an inner container,
      // so `window.scrollTo` moves nothing. What scrolls is the nearest
      // scrollable ancestor of the views themselves.
      const view = document.querySelector('[data-testid^="view-container-"]')
      let scroller: HTMLElement = document.documentElement
      for (
        let el = view?.parentElement as HTMLElement | null;
        el;
        el = el.parentElement
      ) {
        const overflowY = getComputedStyle(el).overflowY
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight
        ) {
          scroller = el
          break
        }
      }
      const max = scroller.scrollHeight - scroller.clientHeight
      const end = target === 'bottom' ? max : Math.min(target, max)
      const start = scroller.scrollTop
      const t0 = performance.now()
      return new Promise<void>(resolve => {
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration)
          // ease in and out, so the scroll starts and stops rather than
          // snapping at both ends
          const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2
          scroller.scrollTop = start + (end - start) * eased
          if (p < 1) {
            requestAnimationFrame(tick)
          } else {
            resolve()
          }
        }
        requestAnimationFrame(tick)
      })
    },
    to,
    ms,
  )
}
