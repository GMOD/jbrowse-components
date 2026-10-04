import type { Page } from 'puppeteer'

// Both tooltip kinds, as one selector list: JBrowse's BaseTooltip portals with
// an inline z-index of 100000 (MUI menus use 1300), and MUI's own `title`
// tooltips portal to `.MuiTooltip-popper`, whose z-index is theme-dependent.
const TOOLTIP_SELECTORS = ['.MuiTooltip-popper']

/**
 * The text of a tooltip on screen, or undefined if there is none.
 *
 * Read before the shot so the run can report a tooltip the spec did not ask for
 * — the accidental kind, left behind because a click sequence ended on a
 * hoverable control. The text is what makes the report actionable: it says which
 * control the cursor was parked on.
 */
export async function visibleTooltipText(page: Page) {
  return page.evaluate(selectors => {
    const found: Element[] = [...document.querySelectorAll('div')].filter(
      el => (el as HTMLElement).style.zIndex === '100000',
    )
    for (const sel of selectors) {
      found.push(...document.querySelectorAll(sel))
    }
    for (const el of found) {
      // getClientRects is empty for a display:none or unmounted portal, which is
      // how a tooltip that has faded out is told from one that is showing
      if (el.getClientRects().length > 0) {
        const text = el.textContent.trim()
        if (text) {
          return text
        }
      }
    }
    return undefined
  }, TOOLTIP_SELECTORS)
}

export async function hideLingeringTooltip(page: Page) {
  // Two kinds, and a spec asking for neither has to say so once.
  //
  // BaseTooltip (the feature/hover tooltip) renders into a portal with inline
  // z-index:100000 (MUI menus use 1300), so matching on that targets it without
  // touching the context menu a figure may want to keep.
  //
  // MUI's own `title` tooltips are the other kind, and they used to sail
  // through: any action ending on a toolbar button leaves the cursor over it,
  // and the tooltip fades in during the settle before the shot. That is how a
  // "View options" bubble got into read_vs_ref_insertion. They portal to
  // `.MuiTooltip-popper`, whose z-index is theme-dependent, so match the class
  // rather than another number.
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('div')) {
      if (el.style.zIndex === '100000') {
        el.style.display = 'none'
      }
    }
    for (const el of document.querySelectorAll<HTMLElement>(
      '.MuiTooltip-popper',
    )) {
      el.style.display = 'none'
    }
  })
}
