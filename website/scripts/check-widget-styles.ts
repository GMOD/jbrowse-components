// Fails when a widget the markdown pipeline emits as a string renders unstyled
// — the failure mode a build, a typecheck and a link check all sail past.
//
// Those widgets (Config/CLI tabs, admonitions, the figure recipe dialog, the
// api-docs cell dialogs) have no component to scope their CSS to, so it lives
// in `src/styles/widgets/*.css` in the `widget` cascade layer. Two things can
// silently break that and neither shows up in a diff of the widget's own file:
// a rule qualified with a page-context ancestor it doesn't have wherever else
// it renders, and a layer whose order got established somewhere earlier in the
// bundle than styles/layers.css. The Config/CLI tabs shipped with the first of
// those — every rule carried `.spec-dialog`, so outside the recipe dialog
// nothing hid the unselected panel and the fence rendered both panels under a
// pair of raw radio buttons, on 38 pages, looking like a plain layout bug.
//
// So this asserts computed styles in a real browser rather than the presence of
// a selector: `.spec-panel` *was* styled when that shipped, just not reachably.
// Marker properties are picked to be ones only the widget layer sets, so an
// assertion can only pass if the widget rule actually won.
//
// Operates on dist/ (run `pnpm build` first), like check-llms and
// check-dupe-ids, and runs beside them in the `buildwebsite` job. It needs
// puppeteer's Chrome, which the workspace install provides — the same one
// examples_site_smoke uses. Run: `pnpm check-widget-styles`.
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { join, relative } from 'node:path'

import { launch } from 'puppeteer'
import handler from 'serve-handler'

import { assertDirExists, reportProblems, walkFiles } from './check-utils.ts'
import { distDir } from './paths.ts'

import type { Page } from 'puppeteer'

const PORT = 3396
// Pages are built under the site's `base`, so their asset URLs carry it.
const BASE = '/jb2'

// The layer order every widget rule depends on. A widget rule wins over the
// prose it lands in because `widget` comes last, not because it out-specifies
// anything — so if this order inverts, every widget silently loses instead.
const LAYER_ORDER = ['base', 'prose', 'widget']

// One entry per widget: a page is found by the marker class, then each check
// asserts a property only that widget's own CSS sets. `find` is a substring of
// the built HTML rather than a fixed path, so renaming a doc doesn't strand the
// check on a page that no longer exists.
interface Widget {
  name: string
  find: string
  check: (page: Page) => Promise<string[]>
}

// Computed-style reads all go through this so a failure names the property and
// both values rather than just "false".
async function expectStyle(
  page: Page,
  selector: string,
  prop: string,
  want: string,
  why: string,
) {
  const got = await page.evaluate(
    ([sel, p]) => {
      const el = document.querySelector(sel!)
      return el ? getComputedStyle(el).getPropertyValue(p!) : null
    },
    [selector, prop],
  )
  if (got === null) {
    return [`    ${selector} — no such element on the page`]
  }
  return got === want
    ? []
    : [`    ${selector} { ${prop}: ${got} } — expected ${want} (${why})`]
}

// Exactly one panel visible per tab group, and the radios that drive them
// hidden. Shared by the fence widget and the recipe dialog, which is the point:
// they are the same widget in two contexts, and the bug was that only one of
// them was reachable.
async function checkTabGroups(page: Page, scope: string) {
  const groups = await page.evaluate(sel => {
    const visible = (el: Element) => getComputedStyle(el).display !== 'none'
    return [...document.querySelectorAll(sel)].map(w => ({
      panels: [...w.querySelectorAll(':scope > .spec-panel')].length,
      shown: [...w.querySelectorAll(':scope > .spec-panel')].filter(visible)
        .length,
      inputsShown: [...w.querySelectorAll(':scope > .spec-tab-input')].filter(
        i => Number(getComputedStyle(i).opacity) > 0,
      ).length,
      labelStyled: [...w.querySelectorAll(':scope > .spec-tab-label')].every(
        l => getComputedStyle(l).cursor === 'pointer',
      ),
    }))
  }, scope)
  if (groups.length === 0) {
    return [`    ${scope} — no tab group found`]
  }
  return groups.flatMap((g, i) => {
    const at = `    ${scope}[${i}]`
    return [
      g.shown === 1
        ? ''
        : `${at} shows ${g.shown} of ${g.panels} panels — exactly one must be visible`,
      g.inputsShown === 0
        ? ''
        : `${at} leaves ${g.inputsShown} radio input(s) visible — the labels are the tabs`,
      g.labelStyled ? '' : `${at} has unstyled tab labels`,
    ].filter(Boolean)
  })
}

// The strip the clip's box carries under the picture for the browser's own
// control bar. Without it the bar sits on the clip and covers the step label
// the tour burns into its lower left, which is the state this shipped in — and
// nothing about it fails a build, since the video is there and plays.
async function checkVideoGutter(page: Page) {
  const gutter = await page.evaluate(() => {
    const frame = document.querySelector('.video-frame')
    if (!(frame instanceof HTMLElement)) {
      return null
    }
    const style = getComputedStyle(frame)
    // the same fallback shape the CSS uses for a clip of unknown size
    const dimension = (name: string, fallback: number) =>
      Number(style.getPropertyValue(name)) || fallback
    const ratio = dimension('--video-h', 1080) / dimension('--video-w', 1920)
    return (
      Number.parseFloat(style.paddingBottom) -
      frame.getBoundingClientRect().width * ratio
    )
  })
  if (gutter === null || Number.isNaN(gutter)) {
    return ['    .video-frame — no frame, or its --video-w/--video-h are gone']
  }
  return gutter > 40
    ? []
    : [
        `    .video-frame leaves ${Math.round(gutter)}px under the picture — the control bar needs ~48px`,
      ]
}

const WIDGETS: Widget[] = [
  {
    // src/lib/remark-video.ts, styled by styles/widgets/video-overlay.css
    name: 'video embed',
    find: 'class="video-frame"',
    check: async page => [
      ...(await checkVideoGutter(page)),
      // The picture rides at the top of that taller box rather than filling it.
      ...(await expectStyle(
        page,
        '.video-frame video',
        'object-fit',
        'contain',
        'a stretched clip would put the label back under the bar',
      )),
      ...(await expectStyle(
        page,
        '.video-frame video',
        'object-position',
        '50% 0%',
        'the gutter belongs under the picture, not split around it',
      )),
    ],
  },
  {
    // src/lib/remark-config-cli-tabs.ts
    name: 'Config/CLI tabs',
    find: 'class="spec-tabs config-cli-tabs"',
    check: page => checkTabGroups(page, '.config-cli-tabs'),
  },
  {
    // src/lib/rehype-admonitions.ts. Runs on every markdown surface, so its CSS
    // must not be qualified with a docs-only ancestor.
    name: 'admonitions',
    find: 'class="admonition admonition-',
    check: async page => [
      ...(await expectStyle(
        page,
        '.admonition',
        'border-left-width',
        '4px',
        'the accent bar is the widget layer',
      )),
      ...(await expectStyle(
        page,
        '.admonition-title',
        'text-transform',
        'uppercase',
        'only widgets/admonitions.css sets this',
      )),
    ],
  },
  {
    // scripts/api-docs/util.ts dialogCell
    name: 'api-docs cell dialog',
    find: 'class="cell-dialog"',
    check: async page => [
      // `pre-wrap` is the widget layer beating the prose layer's `pre` rules;
      // a `<pre>` is `pre` by default and the prose rules don't touch it.
      ...(await expectStyle(
        page,
        '.cell-dialog pre',
        'white-space',
        'pre-wrap',
        'widget must outrank the prose pre rules',
      )),
      ...(await expectStyle(
        page,
        '.cell-more-trigger',
        'cursor',
        'pointer',
        'the trigger reads as the truncated code itself',
      )),
    ],
  },
  {
    // src/lib/spec-recipe/html.ts, opened here rather than clicked so the check
    // does not depend on which figure carries a trigger.
    name: 'figure recipe dialog',
    find: 'class="spec-dialog"',
    check: async page => {
      await page.evaluate(() => {
        document.querySelector<HTMLDialogElement>('.spec-dialog')?.showModal()
      })
      return [
        ...(await checkTabGroups(page, '.spec-dialog .spec-tabs')),
        // The prose `li` rule sets a top margin; the recipe's own rule zeroes
        // it. Equal margins here would mean the widget layer lost.
        ...(await expectStyle(
          page,
          '.spec-dialog .spec-steps li',
          'margin-top',
          '0px',
          'widget must outrank the prose list rules',
        )),
      ]
    },
  },
]

// Layer positions are read from the page's own stylesheets in document order,
// which is what the browser does — not from styles/layers.css, whose statement
// only fixes the order if nothing establishes a layer before it. Getting that
// from the built output is the whole point: the import order in BaseLayout is a
// claim, and the bundler is what decides.
function layerOrderProblems(htmlPath: string) {
  const html = readFileSync(htmlPath, 'utf8')
  const hrefs = [
    ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g),
  ]
    .map(m => m[1] ?? '')
    .filter(href => href.startsWith(BASE))
  const seen: string[] = []
  const record = (name: string) => {
    if (!seen.includes(name)) {
      seen.push(name)
    }
  }
  // Inline <style> comes before the linked bundles only if Astro put it there,
  // so read the document in the order the browser would: the head's inline
  // styles and links interleaved.
  for (const chunk of html.matchAll(
    /<style[^>]*>([\s\S]*?)<\/style>|<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g,
  )) {
    const css = chunk[1]
      ? chunk[1]
      : chunk[2]?.startsWith(BASE)
        ? readFileSync(join(distDir, chunk[2].slice(BASE.length)), 'utf8')
        : ''
    // `@layer a, b;` establishes several at once; `@layer a {` just the one.
    for (const at of css.matchAll(/@layer\s+([a-zA-Z0-9_, -]+?)\s*[{;]/g)) {
      for (const name of (at[1] ?? '').split(',')) {
        record(name.trim())
      }
    }
  }
  const ours = seen.filter(name => LAYER_ORDER.includes(name))
  if (ours.join(',') !== LAYER_ORDER.join(',')) {
    return [
      `  ${relative(distDir, htmlPath)}: cascade layers are established in the order [${ours.join(', ')}],`,
      `    but styles/layers.css declares [${LAYER_ORDER.join(', ')}]. A layer used before that`,
      `    statement takes its position from first use, which silently inverts precedence —`,
      `    check what BaseLayout imports first, and whether a component now names a layer.`,
      ...(hrefs.length === 0 ? ['    (no linked stylesheets found)'] : []),
    ]
  }
  return []
}

// The first built page containing `find`, so the checks follow the content
// around rather than pinning page paths.
function findPage(pages: string[], marker: string) {
  return pages.find(p => readFileSync(p, 'utf8').includes(marker))
}

assertDirExists(distDir, 'run `pnpm build` first.')

const pages = walkFiles(distDir, name => name.endsWith('.html')).sort()
const problems: string[] = []

const home = findPage(pages, '<link rel="stylesheet"')
if (home === undefined) {
  problems.push('  no built page links a stylesheet — was `pnpm build` run?')
} else {
  problems.push(...layerOrderProblems(home))
}

const browser = await launch({ args: ['--no-sandbox'] })
const server = http.createServer((req, res) => {
  req.url = (req.url ?? '/').replace(new RegExp(`^${BASE}`), '') || '/'
  void handler(req, res, { public: distDir })
})
await new Promise<void>(resolve => server.listen(PORT, resolve))

try {
  for (const widget of WIDGETS) {
    const file = findPage(pages, widget.find)
    if (file === undefined) {
      problems.push(
        `  ${widget.name}: no built page contains \`${widget.find}\`, so nothing here is checked.`,
        '    Either the widget is gone (drop its entry) or its markup changed (update `find`).',
      )
      continue
    }
    const url = `http://localhost:${PORT}/${relative(distDir, file).replace(/index\.html$/, '')}`
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 1000 })
    await page.goto(url, { waitUntil: 'networkidle0' })
    const found = await widget.check(page)
    await page.close()
    if (found.length > 0) {
      problems.push(`  ${widget.name} (${relative(distDir, file)}):`, ...found)
    }
  }
} finally {
  await browser.close()
  server.close()
}

reportProblems(
  problems.length > 0
    ? ['Widget styling is not reaching the built pages:', ...problems]
    : [],
  `Layer order and ${WIDGETS.length} string-emitted widgets render styled.`,
)
