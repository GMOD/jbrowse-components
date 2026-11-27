import type { Page } from 'puppeteer'

/**
 * The rows of whatever menu is open, by their `cascading-…` test ids, so a wait
 * that missed a row says what the menu offered instead: a plugin relabelling
 * "Launch protein view" to "Protein view..." under a Launch submenu then reads
 * as a rename, not a timeout.
 */
export async function openMenuRows(page: Pick<Page, '$$eval'>) {
  const rows = await page
    .$$eval('[data-testid^="cascading-"]', elements =>
      elements.flatMap(e =>
        e instanceof HTMLElement && e.getBoundingClientRect().width > 0
          ? [e.dataset.testid ?? '']
          : [],
      ),
    )
    .catch(() => [])
  return rows.length > 0 ? `; the open menu has ${rows.join(', ')}` : ''
}
