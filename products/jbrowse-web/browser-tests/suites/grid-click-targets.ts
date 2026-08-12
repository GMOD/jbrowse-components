import { delay, findByText, navigateToApp, navigateToUrl } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

/**
 * Every DataGrid in the app hides a way to make its own controls stop working,
 * and it fails silently.
 *
 * MUI draws the grid's horizontal scrollbar as an absolutely positioned overlay
 * at `z-index: 60`, at the bottom of the grid's own box. A grid sized to its
 * content — which is what `DataGridFlexContainer` gives you unless the caller
 * asks for more — therefore puts that 14px bar directly on top of its last row,
 * and the bar wins the hit test. The button is drawn, enabled, hoverable, and
 * the click never arrives. Nothing throws and nothing looks wrong.
 *
 * It shipped once, in the session manager: the columns summed to 400px in a
 * 382px drawer, and the bottom session in the list could not be opened or
 * deleted at all. No unit test can see it — jsdom has no layout, so every
 * rectangle is 0×0 and every hit test is vacuous.
 *
 * So the check is here, and it is the real one: walk each row's links, buttons
 * and inputs, and ask the page what `elementFromPoint` returns at the centre of
 * each. Anything but the control itself is a dead control.
 */
async function expectNoCoveredControls(page: Page, label: string) {
  const grids = await page.evaluate(
    () => document.querySelectorAll('.MuiDataGrid-root').length,
  )
  if (!grids) {
    throw new Error(`${label}: expected at least one DataGrid on the page`)
  }
  const failures: string[] = []
  for (let i = 0; i < grids; i++) {
    // scroll the grid into the middle of the viewport first: elementFromPoint
    // answers null outside it, and a null answer is not evidence of covering
    await page.evaluate((n: number) => {
      document
        .querySelectorAll('.MuiDataGrid-root')
        [n]?.scrollIntoView({ block: 'center' })
    }, i)
    await delay(250)
    const covered = await page.evaluate((n: number) => {
      const root = document.querySelectorAll('.MuiDataGrid-root')[n]
      const out: string[] = []
      for (const row of root?.querySelectorAll('.MuiDataGrid-row') ?? []) {
        for (const el of row.querySelectorAll(
          'a, button:not([disabled]), input',
        )) {
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          if (
            r.width === 0 ||
            r.height === 0 ||
            cx < 0 ||
            cy < 0 ||
            cx > innerWidth ||
            cy > innerHeight
          ) {
            continue
          }
          const hit = document.elementFromPoint(cx, cy)
          if (hit !== el && !el.contains(hit)) {
            // `||`, not `??`: an icon-only button's textContent is the empty
            // string rather than null, and "" names nothing
            const name =
              el.getAttribute('aria-label') ||
              el.textContent.trim() ||
              el.tagName
            out.push(
              `${name} is covered by ${hit ? `${hit.tagName}.${String((hit as HTMLElement).className).slice(0, 60)}` : 'nothing (null)'}`,
            )
          }
        }
      }
      return out
    }, i)
    failures.push(...covered.map(c => `  [grid ${i}] ${c}`))
  }
  if (failures.length) {
    throw new Error(
      `${label}: ${failures.length} control(s) cannot be clicked:\n${failures.join('\n')}\n` +
        'Usually the columns sum to more than the panel, so the grid grew a ' +
        'horizontal scrollbar and the overlay landed on the last row. Either ' +
        'narrow the columns / flex one of them, or give the grid room below ' +
        'its rows (see SessionManager useStyles).',
    )
  }
}

const suite: TestSuite = {
  name: 'Grid click targets',
  tests: [
    {
      name: 'session manager rows stay clickable',
      fn: async page => {
        // three loads under different names, so the saved-session list has rows
        for (const name of ['Grid A', 'Grid B', 'Grid C']) {
          await navigateToApp(page, 'test_data/volvox/config.json', name)
          // the autosave is debounced 400ms; let each session's row land
          await delay(1200)
        }
        await (await findByText(page, 'File')).click()
        await delay(400)
        await (await findByText(page, 'Recent sessions...')).click()
        await delay(400)
        await (await findByText(page, 'More...')).click()
        await delay(1500)

        await expectNoCoveredControls(page, 'SessionManager')
      },
    },
    {
      name: 'bookmark grid rows stay clickable',
      fn: async page => {
        await navigateToApp(page)
        await delay(800)
        for (let i = 0; i < 4; i++) {
          if (i > 0) {
            await page.keyboard.press('ArrowRight')
            await delay(300)
          }
          await (await page.$('[data-testid="view_menu_icon"]'))?.click()
          await delay(400)
          await (await findByText(page, 'Bookmarks/highlights')).click()
          await delay(400)
          await (await findByText(page, 'Bookmark current region')).click()
          await delay(600)
        }

        await expectNoCoveredControls(page, 'BookmarkGrid')
      },
    },
    {
      name: 'assembly manager rows stay clickable',
      fn: async page => {
        // adminKey is what turns on adminMode, which is what makes the
        // per-row edit/delete buttons live rather than disabled
        await navigateToUrl(
          page,
          'config=test_data/volvox/config.json&sessionName=Grids&adminKey=griddy',
        )
        await findByText(page, 'ctgA')
        await delay(800)
        await (await findByText(page, 'Tools')).click()
        await delay(600)
        await (await findByText(page, 'Assembly manager')).click()
        await delay(1500)

        await expectNoCoveredControls(page, 'AssemblyTable')
      },
    },
  ],
}

export default suite
