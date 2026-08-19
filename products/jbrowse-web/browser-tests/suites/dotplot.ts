import { displayPainted } from '@jbrowse/browser-test-utils'

import {
  delay,
  findByTestId,
  findDisplayPainted,
  navigateToUrl,
  navigateWithSessionSpec,
  waitForDataLoaded,
  waitForDisplayPaint,
} from '../helpers.ts'
import { dualSnapshot } from '../snapshot.ts'

import type { TestCase, TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

async function openPaletteMenu(page: Page) {
  const alreadyOpen = await page.$('[role="menu"]')
  if (!alreadyOpen) {
    const btn = await findByTestId(page, 'color_by_menu', 20000)
    await btn.click()
    await page.waitForSelector('[role="menu"]', { timeout: 10000 })
  }
}

// A row's testid is `cascading-menuitem-<label>` (spaces -> underscores). Rows
// are looked up inside one panel, since a label like "Strand" exists at both
// the view-wide level and inside a track's submenu; `deepest` targets the
// innermost open submenu.
function rowTestId(kind: 'menuitem' | 'submenu', label: string) {
  return `cascading-${kind}-${label.toLowerCase().replaceAll(/\s+/g, '_')}`
}

async function menuRowBox(page: Page, testId: string, deepest: boolean) {
  return page.evaluate(
    (id, deep) => {
      const menus = [...document.querySelectorAll('[role="menu"]')]
      const scope = deep ? menus.at(-1) : menus[0]
      const li = scope?.querySelector(`[data-testid="${CSS.escape(id)}"]`)
      if (!li) {
        return null
      }
      const r = li.getBoundingClientRect()
      return { x: r.x + 20, y: r.y + r.height / 2 }
    },
    testId,
    deepest,
  )
}

async function clickMenuRow(page: Page, label: string, deepest = false) {
  const box = await menuRowBox(page, rowTestId('menuitem', label), deepest)
  if (!box) {
    throw new Error(`no menu row "${label}"`)
  }
  await page.mouse.click(box.x, box.y)
  await delay(400)
}

// Submenu labels are unique across the whole menu tree (unlike a mode name like
// "Strand", which appears both view-wide and inside every track), so this looks
// document-wide rather than in one panel — with several panels open the target
// is usually not the innermost one.
async function hoverSubmenu(page: Page, label: string) {
  const testId = rowTestId('submenu', label)
  const box = await page.evaluate(id => {
    const li = document.querySelector(`[data-testid="${CSS.escape(id)}"]`)
    if (!li) {
      return null
    }
    const r = li.getBoundingClientRect()
    return { x: r.x + 20, y: r.y + r.height / 2 }
  }, testId)
  if (!box) {
    throw new Error(`no submenu row "${label}"`)
  }
  await page.mouse.move(box.x, box.y)
  await delay(600)
}

// Radios render as MUI icons rather than inputs, so checked state is read off
// the RadioButtonChecked glyph's inner-dot subpath.
const CHECKED_GLYPH = 'M12 7c-2.76 0'
const UNCHECKED_GLYPH = 'M12 2C6.48 2 2 6.48'

function readRadios(page: Page) {
  return page.evaluate(
    (checkedGlyph, uncheckedGlyph) => {
      const menu = [...document.querySelectorAll('[role="menu"]')].at(-1)
      return [...(menu?.querySelectorAll('li') ?? [])]
        .map(li => {
          const paths = [...li.querySelectorAll('svg path')].map(
            p => p.getAttribute('d') ?? '',
          )
          const checked = paths.some(d => d.startsWith(checkedGlyph))
          const isRadio =
            checked || paths.some(d => d.startsWith(uncheckedGlyph))
          return isRadio ? { label: li.textContent.trim(), checked } : undefined
        })
        .filter(r => r !== undefined)
    },
    CHECKED_GLYPH,
    UNCHECKED_GLYPH,
  )
}

const TWO_TRACK_SESSION = {
  views: [
    {
      type: 'DotplotView',
      views: [{ assembly: 'peach' }, { assembly: 'grape' }],
      tracks: ['grape_peach_paf', 'dotplot_track_small_cigar'],
    },
  ],
}

// ADR-076: the shared canvas publishes `data-display-phase` beside
// `data-display-drawn`, so `displaySettled` and every other DOM-level doneness
// wait works on a comparative page. It could not before — those waits key on an
// attribute this canvas did not carry, which makes each of them an assertion
// about an absent selector, satisfied by a canvas that has not begun.
//
// This has to run in a browser: `painted` never flips without a compositor, so
// the jsdom tests that pin the model side call `markCanvasDrawn()` by hand and
// cannot see whether the attribute reaches the DOM at all.
const phaseTest: TestCase = {
  name: 'a dotplot publishes a settled display phase',
  fn: async page => {
    await navigateWithSessionSpec(
      page,
      {
        views: [
          {
            type: 'DotplotView',
            tracks: ['grape_peach_synteny_mcscan'],
            views: [{ assembly: 'grape' }, { assembly: 'peach' }],
          },
        ],
      },
      'test_data/config_dotplot.json',
    )
    const canvas = await findDisplayPainted(page, 'dotplot_webgl_canvas', 60000)
    await waitForDataLoaded(page, 60000)
    const ready = await page
      .waitForFunction(
        () =>
          document.querySelector<HTMLElement>(
            '[data-testid="dotplot_webgl_canvas"]',
          )?.dataset.displayPhase === 'ready' || undefined,
        { timeout: 60000 },
      )
      .catch(() => undefined)
    if (!ready) {
      const actual = await canvas.evaluate(
        e => (e as HTMLElement).dataset.displayPhase,
      )
      throw new Error(
        `dotplot_webgl_canvas never reported phase=ready (saw ${actual ?? 'no attribute'})`,
      )
    }
  },
}

const suite: TestSuite = {
  name: 'Dotplot View',
  tests: [
    phaseTest,
    {
      // A synteny track is queryable in either direction, so the axes Quick
      // start derives are a starting point, not a fact about the track. Swap
      // flips them, and the choice has to survive the handoff into Manual —
      // otherwise switching modes silently discards the user's orientation.
      name: 'import form quick start swaps axes and carries them into Manual',
      fn: async page => {
        await navigateToUrl(page, 'config=test_data/config_dotplot.json')
        const add = await page.waitForSelector('::-p-text(Add)', {
          timeout: 30000,
        })
        await add!.click()
        const dotplot = await page.waitForSelector('::-p-text(Dotplot view)')
        await dotplot!.click()

        const axes = await findByTestId(page, 'quick-start-axes', 30000)
        const before = await axes.evaluate(e => e.textContent)

        const swap = await page.waitForSelector('::-p-text(Swap)')
        await swap!.click()
        const after = await page.waitForFunction(
          (prev: string) => {
            const el = document.querySelector(
              '[data-testid="quick-start-axes"]',
            )
            const text = el?.textContent
            return text && text !== prev ? text : undefined
          },
          { timeout: 10000 },
          before,
        )
        const swapped = (await after.jsonValue()) ?? ''
        // grape/peach either way round; the point is the two axes exchanged
        if (
          !before.includes('X-axis: grape') ||
          !swapped.includes('X-axis: peach')
        ) {
          throw new Error(`swap did not exchange axes: ${before} -> ${swapped}`)
        }

        const manual = await page.waitForSelector('::-p-text(Manual)')
        await manual!.click()
        await page.waitForSelector('::-p-text(Select assemblies for dotplot)')
        const values = await page.$$eval('.MuiSelect-select', els =>
          els.map(e => e.textContent),
        )
        // x-axis selector renders first, so the swapped x (peach) leads
        if (values[0] !== 'peach' || values[1] !== 'grape') {
          throw new Error(
            `Manual lost the swapped axes: ${JSON.stringify(values)}`,
          )
        }
      },
    },
    {
      // Two alignment files drawn into one plot were indistinguishable before
      // colorBy:'track' — same mode, same black points. The palette is assigned
      // by the view so an automatic slot can't collide with a pinned one.
      name: 'overlaid tracks take distinct colors under "Distinct color per track"',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          TWO_TRACK_SESSION,
          'test_data/config_dotplot.json',
        )
        await page.waitForSelector(displayPainted('dotplot_webgl_canvas'), {
          timeout: 60000,
        })

        const colors = await page.evaluate(() => {
          const view = (
            window as unknown as {
              JBrowseRootModel: {
                session: {
                  views: {
                    tracks: { configuration: { trackId: string } }[]
                    trackColorFor: (id: string) => string
                  }[]
                }
              }
            }
          ).JBrowseRootModel.session.views[0]!
          return view.tracks.map(t =>
            view.trackColorFor(t.configuration.trackId),
          )
        })
        if (colors.length !== 2) {
          throw new Error(`expected 2 overlaid tracks, got ${colors.length}`)
        }
        if (colors[0] === colors[1]) {
          throw new Error(`overlaid tracks share a color: ${colors[0]}`)
        }

        await openPaletteMenu(page)
        const top = await readRadios(page)
        const modes = top.map(r => r.label)
        if (!modes.includes('Distinct color per track')) {
          throw new Error(
            `auto-palettize mode missing from the menu: ${modes.join(', ')}`,
          )
        }
        await clickMenuRow(page, 'Distinct color per track')
        await clickMenuRow(page, 'Show color legend')
        await findByTestId(page, 'color-by-legend', 10000)

        // the legend keys the plot by track name, one chip each
        const labels = await page.evaluate(() => {
          const box = document.querySelector('[data-testid="color-by-legend"]')
          return box ? box.textContent : ''
        })
        if (!labels.includes('Grape vs Peach (PAF)')) {
          throw new Error(`legend does not name the tracks: "${labels}"`)
        }
      },
    },
    {
      // Regression: checked state used to compare the track's RESOLVED mode to
      // the view's, so a track pinned to the mode the view already used showed
      // two checked radios and "Use view setting" appeared to do nothing.
      name: 'a per-track override round-trips back to "Use view setting"',
      fn: async page => {
        await navigateWithSessionSpec(
          page,
          TWO_TRACK_SESSION,
          'test_data/config_dotplot.json',
        )
        await page.waitForSelector(displayPainted('dotplot_webgl_canvas'), {
          timeout: 60000,
        })

        await openPaletteMenu(page)
        // put the VIEW on Strand first — the case where an override equals it
        await clickMenuRow(page, 'Strand')

        const openTrackSubmenu = async () => {
          await openPaletteMenu(page)
          await hoverSubmenu(page, 'Customize per track')
          await hoverSubmenu(page, 'Grape vs Peach (PAF)')
          return readRadios(page)
        }
        const checkedIn = (rows: { label?: string; checked: boolean }[]) =>
          rows.filter(r => r.checked).map(r => r.label)

        const before = await openTrackSubmenu()
        if (checkedIn(before).join(',') !== 'Use view setting') {
          throw new Error(
            `expected only "Use view setting" checked, got: ${checkedIn(before).join(', ')}`,
          )
        }

        await clickMenuRow(page, 'Strand', true)
        const overridden = await openTrackSubmenu()
        if (checkedIn(overridden).join(',') !== 'Strand') {
          throw new Error(
            `expected only "Strand" checked after overriding, got: ${checkedIn(overridden).join(', ')}`,
          )
        }

        await clickMenuRow(page, 'Use view setting', true)
        const restored = await openTrackSubmenu()
        if (checkedIn(restored).join(',') !== 'Use view setting') {
          throw new Error(
            `"Use view setting" did not take effect, checked: ${checkedIn(restored).join(', ')}`,
          )
        }
      },
    },
    {
      name: 'dotplot default session',
      fn: async page => {
        await navigateToUrl(
          page,
          'config=test_data/config_dotplot.json&sessionName=Test%20Session',
        )

        await waitForDisplayPaint(
          page,
          displayPainted('dotplot_webgl_canvas'),
          60000,
        )
        await waitForDataLoaded(page)
        await dualSnapshot(
          page,
          'dotplot-default-canvas',
          displayPainted('dotplot_webgl_canvas'),
        )
      },
    },
  ],
}

export default suite
