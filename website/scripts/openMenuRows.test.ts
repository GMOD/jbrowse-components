import { openMenuRows } from './openMenuRows.ts'

import type { Page } from 'puppeteer'

// The predicate runs in the page; here it runs over stand-ins for its rows
class FakeRow {
  dataset: { testid: string }
  width: number
  constructor(testid: string, width: number) {
    this.dataset = { testid }
    this.width = width
  }
  getBoundingClientRect() {
    return { width: this.width }
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, 'HTMLElement', {
    value: FakeRow,
    configurable: true,
  })
})

function pageWith(rows: FakeRow[]) {
  const $$eval = ((_selector: string, fn: (els: FakeRow[]) => unknown) =>
    Promise.resolve(fn(rows))) as unknown as Page['$$eval']
  return { $$eval }
}

test('a missed wait names the rows the open menu shows', async () => {
  expect(
    await openMenuRows(
      pageWith([
        new FakeRow('cascading-menuitem-protein_view...', 120),
        new FakeRow('cascading-menuitem-msa_view...', 120),
        new FakeRow('cascading-submenu-highlight', 0),
      ]),
    ),
  ).toBe(
    '; the open menu has cascading-menuitem-protein_view..., cascading-menuitem-msa_view...',
  )
})

test('no open menu adds nothing', async () => {
  expect(await openMenuRows(pageWith([]))).toBe('')
})
