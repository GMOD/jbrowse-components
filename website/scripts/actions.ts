import { delay, waitForAppSettled } from '@jbrowse/browser-test-utils'

import { chordPoint } from './chordAnchor.ts'
import { graphNodePoint } from './graphAnchor.ts'
import { locusPoint } from './locusAnchor.ts'

import type { AnnotationAnchor, ScreenshotAction } from './screenshot-specs.ts'
import type { ElementHandle, Page } from 'puppeteer'

// re-exported so generate-screenshots.ts keeps importing it from './actions'
export { delay }

// Default wait for an element to appear/become-visible before acting on it.
export const FIND_TIMEOUT = 30000
const DEFAULT_ACTION_DELAY_MS = 500

// puppeteer text-pseudo-selector: matches an element by its visible text. Used
// to reach HTML floating labels / menu items that carry no testid.
export const textSelector = (text: string) => `::-p-text(${text})`
const textOf = (selector: string) =>
  /^::-p-text\((.*)\)$/s.exec(selector)?.[1] ?? selector

// Poll, from Node, until nothing matching is left showing. Used for the
// loading-overlay-disappears wait: puppeteer's in-page waits (waitForSelector
// rAF-poll, waitForFunction timer-poll) both run their polling loop *inside* the
// page, and once a view settles the headless tab is non-visible — Chrome starves
// rAF and throttles in-page timers — so the loop stops firing and the wait times
// out even though the element was already removed. A Node-side timer is never
// throttled by page visibility, so this observes the removal reliably.
//
// Takes a CSS selector or a TEXT string. The text case used to go to puppeteer's
// native `waitForSelector('::-p-text(…)', { hidden: true })`, whose notion of
// visible is "has a box and is not styled away" — which an element clipped by an
// ancestor keeps.
async function waitHiddenByNodePolling(
  page: Page,
  target: { selector?: string; text?: string },
  timeout: number,
) {
  // Exactly one, because the degenerate cases are both silent: a missing
  // selector would fall back to matching everything (a wait that never ends) or
  // nothing (a wait that ends at once and reports success).
  if ((target.selector === undefined) === (target.text === undefined)) {
    throw new Error('waitHiddenByNodePolling needs one of selector or text')
  }
  const deadline = Date.now() + timeout
  let gone = false
  while (!gone && Date.now() < deadline) {
    gone = await page.evaluate(
      ({ selector, text }: { selector?: string; text?: string }) => {
        // Whether an element shows nothing to a reader.
        //
        // The styled cases are the obvious ones. THE CLIPPED CASE IS NOT, and it
        // is the one that hangs a run: an element inside an ancestor with
        // `overflow: hidden` keeps its own box and its own computed style while
        // the compositor paints none of it, so every other check reads it as
        // visible. A JBrowse view is full of those — a display renders block
        // placeholders past the edges of a track container that clips them — and
        // `waitForText 'Loading' hidden` on genomes.jbrowse.org waited out its
        // 90s on a "Loading" no pixel of which was ever drawn, over a page that
        // had finished rendering.
        //
        // `hidden` and `clip` only, never `auto`/`scroll`: a scrollable
        // container's contents are out of view but reachable, and calling those
        // hidden would let a wait on a long menu finish while it is still open.
        const isHidden = (el: Element) => {
          const style = getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            Number(style.opacity) === 0 ||
            (rect.width === 0 && rect.height === 0)
          ) {
            return true
          }
          for (let up = el.parentElement; up; up = up.parentElement) {
            const upStyle = getComputedStyle(up)
            if (
              ![upStyle.overflowX, upStyle.overflowY].some(
                v => v === 'hidden' || v === 'clip',
              )
            ) {
              continue
            }
            const box = up.getBoundingClientRect()
            if (
              rect.right <= box.left ||
              rect.left >= box.right ||
              rect.bottom <= box.top ||
              rect.top >= box.bottom
            ) {
              return true
            }
          }
          return false
        }
        // every match must be gone, not just the first: a view renders one
        // loading-overlay per pending block, so querySelector alone reports
        // "gone" as soon as the earliest-finishing block clears
        const matches =
          text === undefined
            ? Array.from(document.querySelectorAll(selector!))
            : // the deepest elements carrying the string, which is how
              // `::-p-text(…)` matches: an ancestor is not reported for text
              // that belongs to its child
              Array.from(document.querySelectorAll('*')).filter(
                el =>
                  el.textContent.includes(text) &&
                  !Array.from(el.children).some(child =>
                    child.textContent.includes(text),
                  ),
              )
        return matches.every(el => isHidden(el))
      },
      target,
    )
    if (!gone) {
      await delay(200)
    }
  }
  if (!gone) {
    const what =
      target.text === undefined ? target.selector : `text "${target.text}"`
    throw new Error(`timed out waiting for ${what} to be hidden`)
  }
}

// Ceiling on the settle below. Reached only by an element whose geometry never
// stops moving, where proceeding is the same thing the fixed `delay` this
// replaces did — so the worst case is today's behaviour and the normal case is
// three frames.
const RECT_SETTLE_CAP_MS = 600

// Resolve once the element's viewport rect has held still for two consecutive
// animation frames.
//
// "Visible" is not "done moving". A MUI Popper mounts, paints, and is THEN
// repositioned by popper.js against its anchor, so a menu item can satisfy
// `waitForSelector(visible)` a frame or two before it is where it will end up.
// That gap is what the fixed 300-800ms `delay` after every `waitForText` in the
// menu helpers was really paying for — a click landing on a popper still sliding
// into place, or a capture of one. Frozen CSS animations removed the transition
// half of that; this removes the layout half, and does it by watching the thing
// that has to settle instead of guessing how long it takes.
//
// The bound is applied from Node, not from an in-page timer: a settled headless
// tab is non-visible, where Chrome throttles in-page timers and can starve rAF
// (see waitHiddenByNodePolling), and a bound that can itself be throttled is no
// bound at all.
async function waitForRectSettled(el: ElementHandle) {
  await Promise.race([
    el
      .evaluate(
        node =>
          new Promise<void>(resolve => {
            let last = ''
            let held = 0
            const tick = () => {
              const r = node.getBoundingClientRect()
              const key = `${r.x},${r.y},${r.width},${r.height}`
              held = key === last ? held + 1 : 0
              last = key
              if (held >= 2) {
                resolve()
              } else {
                requestAnimationFrame(tick)
              }
            }
            requestAnimationFrame(tick)
          }),
      )
      // the page can navigate or the node detach mid-settle; that is not a
      // failure of the wait, it just means there is nothing left to settle
      .catch(() => {}),
    delay(RECT_SETTLE_CAP_MS),
  ])
}

export async function waitForVisible(
  page: Page,
  selector: string,
  {
    hidden = false,
    timeout = FIND_TIMEOUT,
  }: { hidden?: boolean; timeout?: number } = {},
) {
  // BOTH hidden waits poll from Node now (see waitHiddenByNodePolling). The text
  // case used the native `::-p-text(…)` wait until it hung a tour for 90s on
  // text an ancestor was clipping; matching the deepest text-carrying elements
  // in-page costs one querySelectorAll and answers the question the spec is
  // actually asking. The APPEAR case stays native — appearances follow clicks
  // and paints that keep rAF alive, and puppeteer's own visibility test is the
  // right one for "can I click this".
  if (hidden) {
    return waitHiddenByNodePolling(
      page,
      selector.startsWith('::-p-') ? { text: textOf(selector) } : { selector },
      timeout,
    )
  }
  const el = await page.waitForSelector(selector, { visible: true, timeout })
  if (el) {
    await waitForRectSettled(el)
  }
  return el
}

// Resolve an action's target element from either a CSS selector or visible text.
// On timeout, rethrow with the human target (the spec's `text`/`selector`) so a
// renamed menu item reads as `click target not found: text "Settings"` instead
// of puppeteer's parsed-selector blob ([[[{name,value}]]]).
function resolveTarget(page: Page, action: ScreenshotAction) {
  const selector =
    action.selector ?? (action.text ? textSelector(action.text) : undefined)
  if (!selector) {
    throw new Error(`${action.type} action needs a selector, text, or from`)
  }
  return waitForVisible(page, selector, { timeout: action.timeout }).catch(
    () => {
      const target = action.selector
        ? `selector "${action.selector}"`
        : `text "${action.text}"`
      throw new Error(`${action.type} target not found: ${target}`)
    },
  )
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
    // el.click() scrolls the element into view itself, but the coverage probe
    // below runs first and reads viewport coordinates — without scrolling here,
    // an off-screen target makes elementFromPoint return null, which reads as
    // "covered" and silently downgrades every such click to a synthetic event.
    await el.scrollIntoView()
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
        const r = node.getBoundingClientRect()
        // Dispatched rather than `node.click()`, which exists only on
        // HTMLElement: the MUI track control draws its (×) as an <svg>
        // deleteIcon, so the covered path threw "node.click is not a function"
        // on the one control every alphagenome spec dismisses.
        node.dispatchEvent(
          new MouseEvent(btn === 'right' ? 'contextmenu' : 'click', {
            bubbles: true,
            cancelable: true,
            clientX: r.left + r.width / 2,
            clientY: r.top + r.height / 2,
            button: btn === 'right' ? 2 : 0,
          }),
        )
      }, button)
    } else {
      await el.click({ button })
    }
  }
}

// A point outside the capture viewport is a click that lands on nothing.
// Puppeteer dispatches it, Chrome routes it nowhere, and the action reports
// success — so a menu meant to be dismissed stays open, a feature meant to be
// selected is not, and the run's own size and paint reports all pass, because
// nothing about the page is unrendered. The frame is simply of the wrong state.
//
// This is the failure the anchored forms cannot have (an anchor that resolves to
// nothing already throws by name) and the raw-coordinate form was left able to
// have. It is reached by editing a VIEWPORT rather than by editing the
// coordinate, which is why nobody looks at the number: `gene_track_color_by_cds`
// dismissed its view menu at a bare `y: 550`, and lowering the spec to 500px
// turned that into a no-op with the menu standing over the result it had just
// produced.
//
// Raw coordinates only. An anchored point can also land below the fold (a
// display that grew past the frame resolves a real y under it), but that is a
// different mistake with a different fix, and every one of the corpus's anchored
// actions would have to be re-run to know whether any is silently making it.
// The bare-coordinate set is 35 and was measured clean when this went in.
const viewportBound = (page: Page) => page.viewport()

function assertInViewport(
  action: ScreenshotAction,
  point: { x: number; y: number },
  bound: { width: number; height: number } | null,
) {
  if (!bound) {
    return
  }
  const { width, height } = bound
  if (point.x < 0 || point.y < 0 || point.x > width || point.y > height) {
    throw new Error(
      `${action.type} at (${point.x},${point.y}) is outside the ${width}x${height} viewport, so it would land on nothing. Anchor it, or move it inside the frame.`,
    )
  }
}

// The viewport point a click/hover acts on when it isn't targeting an element:
// a model-resolved position where the spec gives an anchor — a chord, a graph
// node, or a genomic locus in a linear view — else the literal `from`. An anchor
// that resolves to nothing throws, so a moved node or a locus scrolled out of
// view fails the spec by name instead of clicking the top-left corner of the
// page.
async function anchorPoint(
  page: Page,
  action: ScreenshotAction,
  anchor: AnnotationAnchor,
) {
  const point = anchor.chord
    ? await chordPoint(page, anchor)
    : anchor.graphNode
      ? await graphNodePoint(page, anchor)
      : await locusPoint(page, anchor)
  if (!point) {
    throw new Error(
      `${action.type} anchor did not resolve: ${JSON.stringify(anchor)}`,
    )
  }
  return point
}

async function actionPoint(page: Page, action: ScreenshotAction) {
  if (action.anchor) {
    return anchorPoint(page, action, action.anchor)
  }
  if (action.from) {
    assertInViewport(action, action.from, viewportBound(page))
  }
  return action.from
}

// Both ends of a drag, each from its anchor where the spec gives one. Exported
// because generate-video.ts draws the cursor along the same two points the drag
// runs between: a rubberband follows the real mouse, so a drawn cursor gliding
// somewhere else would draw the selection where the pointer is not.
export async function dragPoints(page: Page, action: ScreenshotAction) {
  const from = action.fromAnchor
    ? await anchorPoint(page, action, action.fromAnchor)
    : action.from
  const to = action.toAnchor
    ? await anchorPoint(page, action, action.toAnchor)
    : action.to
  if (!from || !to) {
    throw new Error('drag action needs both from and to')
  }
  // both ends, since a rubberband whose release is off the frame selects a
  // different span than the spec wrote
  const bound = viewportBound(page)
  assertInViewport(action, from, bound)
  assertInViewport(action, to, bound)
  return { from, to }
}

// Where a filmed cursor has to travel before this action fires: the model- or
// spec-resolved point when the action carries one, else the centre of the
// element it targets.
//
// For generate-video.ts, which draws a cursor into the frame because headless
// Chrome renders no OS one. It resolves the target a second time rather than
// having runAction report where it clicked, so that the two stay one code path:
// the click below is the one the stills take, and the cursor is drawn onto
// whatever it is about to hit. A menu item's rect has settled by the time
// resolveTarget returns, so the two lookups agree.
export async function actionTargetPoint(page: Page, action: ScreenshotAction) {
  const point = await actionPoint(page, action)
  if (point) {
    return point
  }
  const el = await resolveTarget(page, action)
  const box = await el?.boundingBox()
  return box
    ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    : undefined
}

export async function runAction(page: Page, action: ScreenshotAction) {
  if (action.type === 'delay') {
    await delay(action.ms ?? DEFAULT_ACTION_DELAY_MS)
  } else if (action.type === 'click') {
    // canvas-drawn features (reads, gene glyphs) have no DOM node, so allow a
    // viewport-coordinate click via action.from / action.anchor
    const point = await actionPoint(page, action)
    if (point) {
      await page.mouse.click(point.x, point.y)
    } else {
      await clickElement(await resolveTarget(page, action))
    }
  } else if (action.type === 'rightclick') {
    const point = await actionPoint(page, action)
    if (point) {
      await page.mouse.click(point.x, point.y, { button: 'right' })
    } else {
      await clickElement(await resolveTarget(page, action), 'right')
    }
  } else if (action.type === 'hover') {
    // a bare coordinate move (e.g. off a read to dismiss its hover tooltip while
    // a just-opened context menu stays put)
    const point = await actionPoint(page, action)
    if (point) {
      await page.mouse.move(point.x, point.y)
    } else {
      const el = await resolveTarget(page, action)
      await el?.hover()
    }
  } else if (action.type === 'type') {
    const el = await resolveTarget(page, action)
    if (action.clear) {
      // `select()` rather than a triple-click, which selects one LINE: on a
      // multiline field that left every other line in place and typed the new
      // value into the middle of them. The sequence-search tour is where that
      // showed up — 16 prefilled enzymes, 3 typed over line 8, and a list that
      // no longer parsed, so both submit buttons went disabled and the tour
      // clicked one of them and filmed nothing happening.
      //
      // Click first so the field is focused and React is listening, then
      // Backspace over a real selection, which raises the input events a
      // controlled component needs. Typing '' alone leaves the selection in
      // place.
      await el?.click()
      await el?.evaluate(node => {
        if (
          node instanceof HTMLTextAreaElement ||
          node instanceof HTMLInputElement
        ) {
          node.select()
        }
      })
      await page.keyboard.press('Backspace')
    } else {
      await el?.click()
    }
    await page.keyboard.type(action.value ?? '')
  } else if (action.type === 'drag') {
    const { from, to } = await dragPoints(page, action)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 20 })
    await page.mouse.up()
  } else if (action.type === 'scroll') {
    const el = await resolveTarget(page, action)
    // Reports whether it found something to scroll, because the answer used to
    // be discarded: no horizontally-scrollable ancestor meant the whole action
    // quietly did nothing, and a `scroll` is only ever written because its
    // target is off the right edge — so the frame is captured with the subject
    // out of shot and the run reports success. That is the same silent-no-op
    // this file already throws on for an unknown action type.
    //
    // It legitimately finds nothing when the layout STOPS overflowing (the
    // display got shorter rows, the viewport got wider), which is exactly the
    // drift a spec should be told about rather than absorb.
    const scrolled = await el?.evaluate(node => {
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
      if (!ancestor) {
        return false
      }
      const targetRect = node.getBoundingClientRect()
      const containerRect = ancestor.getBoundingClientRect()
      const targetCenter =
        targetRect.left -
        containerRect.left +
        ancestor.scrollLeft +
        targetRect.width / 2
      ancestor.scrollLeft = targetCenter - ancestor.clientWidth / 2
      return true
    })
    if (!scrolled) {
      throw new Error(
        `scroll: no horizontally-scrollable ancestor overflows for ${
          action.selector
            ? `selector "${action.selector}"`
            : `text "${action.text}"`
        } — nothing to scroll, so the target is already in view or the layout changed`,
      )
    }
  } else if (action.type === 'press') {
    if (!action.key) {
      throw new Error('press action needs a key')
    }
    await page.keyboard.press(action.key)
  } else if (action.type === 'waitForSelector') {
    if (!action.selector) {
      throw new Error('waitForSelector action needs a selector')
    }
    // rethrow puppeteer's parsed-selector blob ([[[{name,value}]]]) as the
    // readable selector so a timeout names what was missing
    await waitForVisible(page, action.selector, {
      hidden: action.hidden,
      timeout: action.timeout,
    }).catch(() => {
      throw new Error(
        `waitForSelector: ${action.hidden ? 'still visible' : 'never found'} "${action.selector}"`,
      )
    })
  } else if (action.type === 'waitForAppSettled') {
    // Wait out the work this action sequence just started, by asking the app.
    //
    // The gate an interaction needs, and the one a fixed `delay` was standing in
    // for: it ends when the session reports itself finished and stays finished,
    // rather than at a number somebody picked. `ms` overrides how long that hold
    // is; `timeout` is the ceiling. See waitForAppSettled's own doc for why it is
    // a hold.
    //
    // It cannot be written as a `waitForSelector` on `[data-app-phase="ready"]`
    // for two separate reasons: that selector is already true on the pre-click
    // frame, and the marker element is `hidden`, so a visibility-requiring wait
    // on it can only time out.
    await waitForAppSettled(page, {
      ...(action.timeout ? { timeout: action.timeout } : {}),
      ...(action.ms ? { holdMs: action.ms } : {}),
    })
    // the chain covers every member of the union, so this last comparison is
    // provably true — kept explicit so adding an action type surfaces here
    // rather than silently falling into the waitForText branch
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  } else if (action.type === 'waitForText') {
    if (!action.text) {
      throw new Error('waitForText action needs text')
    }
    await waitForVisible(page, textSelector(action.text), {
      hidden: action.hidden,
      timeout: action.timeout,
    }).catch(() => {
      throw new Error(
        `waitForText: ${action.hidden ? 'text still visible' : 'never found visible text'} "${action.text}"`,
      )
    })
  } else {
    // a spec that mistypes an action type (or drops a required field) used to
    // fall through every branch and no-op, producing a wrong-but-plausible
    // figure with no error
    throw new Error(`unknown action type: ${JSON.stringify(action)}`)
  }
}
