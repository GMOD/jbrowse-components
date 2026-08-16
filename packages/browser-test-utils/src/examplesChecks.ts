import type { Page } from 'puppeteer'

// Per-page assertions for examples-site smoke runs — the `check` hook of
// smokeExamplesSite. These live here rather than in each site's smoke.mjs
// because all three products ship the same demos of the same shared API, and a
// check that drifts between them stops being a guard. (The
// don't-factor-anything-out rule in each site's CLAUDE.md is about the *example
// files*, which a reader has to be able to paste; scripts are not that.)

// How far a demo may sit from the space held for it. The two edges are not
// symmetric, because the two mistakes are not. A demo taller than its
// reservation jumps the page, which is the whole failure being prevented, so
// that edge is tight — and note that under-reserving is not a return to no
// reservation at all: what jumps is only the leftover, not the whole demo.
//
// A demo *shorter* than its reservation just leaves space inside its own
// border, and is routinely correct: the figure reserved is the tallest the demo
// gets across widths, and this viewport is the wide one, where a demo that
// reflows is legitimately shorter. lgv's single-cell-umap is 1546px here and
// 1714px narrow, reproducibly — 168px apart, and neither is wrong. So the loose
// edge is a ratio rather than a distance, and it is only trying to catch a
// figure that has gone stale by an amount no reflow explains.
const TALLER_PX = 12
const SHORTEST_FRACTION = 0.5

/**
 * Check that every demo box on the page still holds the space its demo needs.
 *
 * These demos are all `client:only`, and Astro gives an island
 * `display: contents`, so a demo box is empty and 0 high until React hydrates —
 * several hundred KB later. `demoHeights.json` (written by
 * `pnpm measure-demo-heights`) is reserved on the box as a min-height so the
 * page doesn't drop everything below it when the demo lands.
 *
 * Measured with each box's own reservation neutralised, and read off the
 * element rather than re-importing the table, so this checks what the page
 * actually shipped and covers a page stacking several demos without having to
 * know which section is which.
 *
 * A `.fill` box is skipped: that site fixes its demo height in CSS, so it owns
 * its space already and has nothing to reserve.
 */
export async function checkDemoHeights(page: Page): Promise<string[]> {
  const boxes = await page.$$eval('.demo', els =>
    // narrowed rather than asserted: `.demo` is not a tag selector, so
    // puppeteer types the callback's elements as bare `Element`, which has no
    // `style`
    els
      .filter(el => el instanceof HTMLElement)
      .map(el => {
        const before = el.style.minHeight
        el.style.minHeight = '0px'
        const settled = Math.round(el.getBoundingClientRect().height)
        el.style.minHeight = before
        return {
          fill: el.classList.contains('fill'),
          reserved: Math.round(Number.parseFloat(el.style.minHeight) || 0),
          settled,
        }
      }),
  )
  return boxes.flatMap(({ fill, reserved, settled }) => {
    if (fill) {
      return []
    }
    if (reserved === 0) {
      return [
        `demo box reserves no height (it settles at ${settled}px), so the page ` +
          'jumps when the island mounts — run `pnpm measure-demo-heights`, then ' +
          'build again to ship the result',
      ]
    }
    if (settled > reserved + TALLER_PX) {
      return [
        `demo settles at ${settled}px, taller than the ${reserved}px reserved ` +
          'for it, so the page jumps when it mounts — re-run ' +
          '`pnpm measure-demo-heights`',
      ]
    }
    if (settled < reserved * SHORTEST_FRACTION) {
      return [
        `demo settles at ${settled}px, less than half the ${reserved}px ` +
          'reserved for it, which is too far apart for a reflow to explain — ' +
          're-run `pnpm measure-demo-heights`',
      ]
    }
    return []
  })
}

/**
 * Confirm a demo whose subject is `showTrack` actually shows one.
 *
 * The page loads, paints a genome and reads correctly whether or not the call
 * landed, so nothing else in the run can tell the two apart — the same gap a
 * gesture leaves. It earns a check because the call is the only thing that page
 * teaches, and because the imperative form is the fragile one: it cannot live
 * beside the engine's construction (a `useState` initializer there is the
 * StrictMode trap `useCreateViewState` exists to close), so it runs from an
 * effect, one step further from the thing it acts on.
 */
export async function checkTrackIsShown(page: Page): Promise<string[]> {
  try {
    // by the `chord-` prefix, not a whole testid: the rest of one is the
    // adapter's generated id and the feature's position, neither of which this
    // is about
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid^="chord-"]').length > 0,
      { timeout: 20000 },
    )
    return []
  } catch {
    return [
      'the demo showed no track — `showTrack` never reached the view, or its ' +
        'renderer drew nothing. The page looks healthy either way, which is ' +
        'why this is asserted rather than eyeballed.',
    ]
  }
}

/**
 * Drive a session-in-url demo's real round trip: save the live session into the
 * URL, reload, and confirm the app came back up from it. Both halves are
 * browser-only — deflate + base64 on the way out, the hash read and restore on
 * the way back — so a unit test can't stand in for this.
 *
 * Assumes the demo renders a save button and reports `restored "<name>"` once a
 * session in the URL is applied.
 */
export async function checkSessionUrlRoundTrip(page: Page): Promise<string[]> {
  // The save button by its name, not the first button in the demo. Scoped to
  // .demo because the doc prose above it renders code blocks with their own
  // copy buttons — and matched by text because a demo is free to put its save
  // button in the app's own toolbar (react-app's `headerButtons`), behind that
  // toolbar's menus. Taking the first button there opens the File menu and
  // reports as "save did not write a session to the url".
  const buttons = await page.$$('#session-in-url .demo button')
  const labels = await Promise.all(
    buttons.map(b => b.evaluate(el => el.textContent)),
  )
  const button = buttons[labels.findIndex(text => /save/i.test(text))]
  if (!button) {
    return ['session-in-url: save button not rendered']
  }
  await button.click()
  const saved = await page
    .waitForFunction(() => window.location.hash.includes('session=encoded-'), {
      timeout: 10000,
    })
    .then(() => true)
    .catch(() => false)
  if (!saved) {
    const hash = await page.evaluate(() => window.location.hash)
    return [`session-in-url: save did not write a session to the url (${hash})`]
  }
  await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
  return page
    .waitForFunction(
      () =>
        (
          document.querySelector('#session-in-url .demo')?.textContent ?? ''
        ).includes('restored "'),
      { timeout: 30000 },
    )
    .then(() => [])
    .catch(() => ['session-in-url: the session in the url did not restore'])
}

/**
 * Confirm a runtime-loaded plugin actually took effect, when it loaded at all.
 *
 * If the bundle fetch failed (registry down, no network) this passes — that's
 * an environment problem, already filtered as network noise. But if the bundle
 * DID load and the app still can't resolve the types it provides, the wiring
 * dropped the plugin on the way into the PluginManager, which a load-only check
 * can't see: the page renders, the track just errors.
 *
 * `globalName` is the global a UMD bundle assigns as it evaluates.
 */
export async function checkPluginTookEffect(
  page: Page,
  globalName: string,
): Promise<string[]> {
  const loaded = await page.evaluate(
    name => name in window,
    globalName as keyof Window & string,
  )
  if (!loaded) {
    return []
  }
  const text = await page.evaluate(() => document.body.innerText)
  return /unknown (adapter|track) type/i.test(text)
    ? [`${globalName} loaded but the app did not register its types`]
    : []
}

// The floor, not the standard. WCAG AA is 4.5:1 for body text and these pages
// clear it nearly everywhere, but this check is not a design review — it is here
// for one failure, and the number is chosen to catch that failure and stay
// silent about taste.
//
// The failure: an example may not use this shell's custom properties, because it
// has to stay a file the reader can paste into their own app, so the demos style
// themselves with CSS *system* colours. Get the theme plumbing wrong and those
// stop tracking the page — `color-mix(in srgb, CanvasText 8%, Canvas)` painted a
// near-white box under near-white text on every dark-mode page for as long as
// `color-scheme` went undeclared, and the *only* reason anyone found out was
// somebody happening to screenshot a dark page. Nothing measured it, on the one
// site whose whole premise is that its claims are measured.
//
// 3:1 is the large-text AA bound, and it sits well below anything deliberate: a
// muted 0.6-alpha hint on this palette lands near 5.6:1. So a failure here is
// never "this could be crisper", it is "these two colours came from different
// themes". Raising it toward 4.5 would start reporting design choices, which is
// how a check like this gets muted.
const MIN_CONTRAST = 3

// The floor below which a clean result is meaningless rather than good. See the
// guard at the bottom of the check.
const MIN_TEXT_ELEMENTS = 25

/**
 * Check that every piece of DOM text on the page is legible against what is
 * actually painted behind it.
 *
 * Both colours are *composited*, which is the whole reason this can't be a
 * stylesheet review: `color` and `background-color` are frequently translucent,
 * an ancestor's `opacity` multiplies through, and the effective background is
 * whatever the first opaque layer up the tree turns out to be. The pair that
 * shipped broken read `rgb(228,230,232)` on `rgb(235,235,235)` — two colours
 * neither of which is wrong on its own.
 *
 * **Text over a `<canvas>` is skipped, and that is not laziness.** A scalebar
 * label or a track label sits on pixels the DOM cannot report: the background
 * walk finds the container's colour, not the rendered image, so any ratio
 * computed for it would be fiction — and a confident fiction is worse here than
 * a gap, because it would be the number someone later tunes the palette
 * against. Those labels get their colour from `usePalette`, which is the
 * mechanism `PaletteProvider` exists to keep correct.
 */
async function contrastPass(page: Page, minContrast: number) {
  const found = await page.evaluate(min => {
    type Rgba = [number, number, number, number]

    // Painted, not parsed. `getComputedStyle` hands back whatever notation the
    // author's value resolves to, and a regex over `rgb()` quietly drops the
    // rest: `color-mix(in srgb, …)` resolves to `color(srgb 0.92 0.92 0.92)`,
    // which is exactly the recipe every demo here styles itself with. A parser
    // that skips the one syntax under test is worse than no check — this
    // returned a clean run against the very bug it was written for. So the
    // browser resolves it: fill one pixel and read it back, which works for
    // `color-mix`, `color()`, `lab()`, system colours and named colours alike.
    // Every input here comes from `getComputedStyle`, so it is always a resolved,
    // valid colour — no validity handling is needed, and adding some would only
    // be another place to be quietly wrong.
    const probe = document.createElement('canvas')
    probe.width = 1
    probe.height = 1
    const ctx = probe.getContext('2d', { willReadFrequently: true })!
    const cache = new Map<string, Rgba>()
    const parse = (css: string): Rgba => {
      const hit = cache.get(css)
      if (hit) {
        return hit
      }
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = css
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      const out: Rgba = [d[0]!, d[1]!, d[2]!, d[3]! / 255]
      cache.set(css, out)
      return out
    }

    // src over dst
    const over = (src: Rgba, dst: Rgba): Rgba => {
      const a = src[3] + dst[3] * (1 - src[3])
      if (a === 0) {
        return [0, 0, 0, 0]
      }
      const c = (i: 0 | 1 | 2) =>
        (src[i] * src[3] + dst[i] * dst[3] * (1 - src[3])) / a
      return [c(0), c(1), c(2), a]
    }

    const luminance = ([r, g, b]: Rgba) => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }

    const ratio = (x: Rgba, y: Rgba) => {
      const a = luminance(x)
      const b = luminance(y)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }

    // The ground under everything, for text whose ancestors are all
    // transparent. White is the browser's own default canvas, so it is the
    // honest fallback when the document declares none.
    const rootBg = parse(
      getComputedStyle(document.documentElement).backgroundColor,
    )
    const ground: Rgba = rootBg[3] === 1 ? rootBg : [255, 255, 255, 1]

    // Stack the translucent layers from the element outward until one is
    // opaque. `opacity` on an ancestor applies to the whole subtree including
    // the text, so it is folded into both sides rather than only the background.
    const backgroundOf = (el: Element): Rgba => {
      let acc: Rgba = [0, 0, 0, 0]
      let node: Element | null = el
      while (node) {
        const cs = getComputedStyle(node)
        const own = parse(cs.backgroundColor)
        if (own[3] > 0) {
          const layer: Rgba = [
            own[0],
            own[1],
            own[2],
            own[3] * Number(cs.opacity),
          ]
          acc = over(acc, layer)
          if (acc[3] >= 0.99) {
            return acc
          }
        }
        node = node.parentElement
      }
      return over(acc, ground)
    }

    // Is this text painted on top of a canvas?
    //
    // Structural, deliberately, and NOT a rectangle intersection with the
    // canvas's box. Geometry here depends on the canvas having been laid out at
    // the instant the check runs, and a display that has not drawn yet reports
    // no box — so on a slow page a hundred feature labels stop being skipped and
    // report as white-on-white against their container. That is not a
    // theoretical flake; it is what the first version of this check did,
    // alternating between 22 findings and none on the same page. A check that
    // invents failures on a slow machine gets muted, and then it is worth less
    // than nothing.
    //
    // The structural question has a stable answer: a label overlay is an
    // absolutely-positioned element whose containing block also holds the
    // canvas. Walk out through every positioned ancestor and ask that.
    const overCanvas = (el: Element) => {
      let node: Element | null = el
      while (node && node !== document.body) {
        const pos = getComputedStyle(node).position
        if (pos === 'absolute' || pos === 'fixed') {
          let block = node.parentElement
          while (block && getComputedStyle(block).position === 'static') {
            block = block.parentElement
          }
          if (block?.querySelector('canvas')) {
            return true
          }
        }
        node = node.parentElement
      }
      return false
    }

    // Kept alongside it, because the two miss different things and both only
    // ever *skip*: a false negative here costs a gap, never a wrong failure.
    const canvasRects = [...document.querySelectorAll('canvas')].map(c =>
      c.getBoundingClientRect(),
    )
    const overlapsCanvas = (r: DOMRect) =>
      canvasRects.some(
        c =>
          r.left < c.right &&
          r.right > c.left &&
          r.top < c.bottom &&
          r.bottom > c.top,
      )

    let examined = 0
    const out: {
      ratio: number
      fg: string
      bg: string
      tag: string
      cls: string
      text: string
    }[] = []

    for (const el of document.querySelectorAll('body *')) {
      // only elements owning their own text: a wrapper reports its child's
      // words too, which would report one failure once per ancestor
      const text = [...el.childNodes]
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent ?? '')
        .join('')
        .trim()
      if (!text) {
        continue
      }
      const cs = getComputedStyle(el)
      if (
        cs.visibility === 'hidden' ||
        cs.display === 'none' ||
        Number(cs.opacity) === 0
      ) {
        continue
      }
      const rect = el.getBoundingClientRect()
      if (
        rect.width === 0 ||
        rect.height === 0 ||
        overCanvas(el) ||
        overlapsCanvas(rect)
      ) {
        continue
      }

      // effective alpha of the text: its own, times every ancestor opacity
      let mult = 1
      for (let n: Element | null = el; n; n = n.parentElement) {
        mult *= Number(getComputedStyle(n).opacity)
      }
      examined++
      const rawFg = parse(cs.color)
      const bg = backgroundOf(el)
      const fg = over([rawFg[0], rawFg[1], rawFg[2], rawFg[3] * mult], bg)
      const r = ratio(fg, bg)
      if (r < min) {
        out.push({
          ratio: Math.round(r * 100) / 100,
          fg: `rgb(${fg.slice(0, 3).map(Math.round).join(',')})`,
          bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`,
          tag: el.tagName.toLowerCase(),
          cls: el.getAttribute('class') ?? '',
          text: text.slice(0, 50),
        })
      }
    }
    return { examined, bad: out.sort((a, b) => a.ratio - b.ratio) }
  }, minContrast)

  // A contrast check reports nothing on a page it could not read, and that is
  // indistinguishable from a pass. It is not a hypothetical: an early run of
  // this served every site's `dist` without stripping the astro `base`, so all
  // four were 404 shells, and it reported four clean sites in a row. Every page
  // here carries a sidebar, a heading and prose before any demo mounts, so a
  // couple of dozen text nodes is a floor no real page approaches — falling
  // under it means the page did not load, not that its colours are good.
  if (found.examined < MIN_TEXT_ELEMENTS) {
    return [
      `contrast check examined only ${found.examined} text elements (expected ` +
        `at least ${MIN_TEXT_ELEMENTS}) — the page did not render, so a clean ` +
        'result here would mean nothing',
    ]
  }

  return found.bad.map(
    b =>
      `text at ${b.ratio}:1 (needs ${minContrast}) — ${b.fg} on ${b.bg} — ` +
      `<${b.tag}${b.cls ? ` class="${b.cls}"` : ''}> ${JSON.stringify(b.text)}`,
  )
}

/**
 * Run {@link contrastPass} in both themes.
 *
 * **Both, always, and this is the point of the check rather than a thoroughness
 * flourish.** Smoke loads every page in the default theme, headless Chrome
 * defaults to light, and the bug that motivated all of this was dark-only — a
 * light-only contrast check would have watched it ship. The toggle is the same
 * attribute the shell's own theme button writes, so this exercises the real
 * mechanism rather than a simulation of it.
 *
 * The page is left on whatever theme it arrived with, because this shares a
 * page with every other check in the composition. Even so, prefer to call it
 * before anything that clicks: the settle below is sized for a CSS cascade
 * (which is what these colours are), not for a display refetching at a new
 * theme, and a check that drives the UI afterwards should start from a page
 * that has stopped moving.
 */
export async function checkTextContrast(
  page: Page,
  { minContrast = MIN_CONTRAST, themes = ['light', 'dark'] as const } = {},
): Promise<string[]> {
  const original = await page.evaluate(
    () => document.documentElement.dataset.theme ?? '',
  )
  const out: string[] = []
  try {
    for (const theme of themes) {
      await page.evaluate(t => {
        document.documentElement.dataset.theme = t
      }, theme)
      await new Promise(resolve => setTimeout(resolve, 300))
      out.push(
        ...(await contrastPass(page, minContrast)).map(m => `[${theme}] ${m}`),
      )
    }
  } finally {
    await page.evaluate(t => {
      if (t) {
        document.documentElement.dataset.theme = t
      } else {
        delete document.documentElement.dataset.theme
      }
    }, original)
  }
  return out
}

/**
 * The first demo on a page has to begin above the fold.
 *
 * This is the whole premise of the page order — heading, then demo, then the
 * prose annotating it — and it is a property nothing else checks. It regresses
 * the same quiet way every time: someone adds a paragraph to a lead, or a
 * fourth section to a page's "On this page" card, and the demo slides under the
 * fold on a laptop while every existing check stays green, because the page
 * still builds and the island still mounts.
 *
 * Geometry only, so it does not care whether the demo actually drew: the box
 * owns its height before React arrives, which is what `demoHeights` (and, on
 * react-app, the `80vh` `.fill` rule) exist to guarantee.
 *
 * The bound is the viewport height rather than a tuned number — the claim is
 * "the demo starts on the first screen", nothing finer. At the time of writing
 * the worst page sits at 553 of 900, so there is real headroom before this
 * fires.
 */
export async function checkDemoAboveFold(page: Page): Promise<string[]> {
  const found = await page.evaluate(() => {
    const demo = document.querySelector('.demo')
    if (!demo) {
      return null
    }
    return {
      top: Math.round(demo.getBoundingClientRect().top + window.scrollY),
      fold: window.innerHeight,
    }
  })
  // a page with no demo is a page this has nothing to say about
  if (!found || found.top <= found.fold) {
    return []
  }
  return [
    `the first demo starts at ${found.top}px, below the ${found.fold}px fold — ` +
      'a reader meets only prose on the first screen. Shorten what precedes it ' +
      'rather than moving the demo down the page',
  ]
}
