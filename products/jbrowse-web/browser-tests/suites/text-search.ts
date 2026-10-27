// What a user typing into the LGV search box sees and where Enter takes them,
// against volvox's trix index. Each query starts from ctgB:1..100, so a query
// that should navigate and did not shows up as the view staying there.
import { delay, navigateToApp } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const INPUT = 'input[placeholder="Search for location"]'
const START = 'ctgB:1..100'

interface ViewState {
  loc: string
  picker?: string[]
  tracks: string[]
  messages: string[]
}

function viewState(page: Page) {
  return page.evaluate(() => {
    const session = (window as any).JBrowseSession
    const view = session.views[0]
    return {
      loc: view.coarseVisibleLocStrings as string,
      picker: view.searchPicker?.rows.map(
        (r: { label: string; location: string }) => `${r.label} ${r.location}`,
      ),
      tracks: view.tracks.map((t: any) => t.configuration.trackId as string),
      messages: session.snackbarMessages.map((m: any) => m.message as string),
    } satisfies ViewState
  })
}

async function reset(page: Page) {
  await page.evaluate((start: string) => {
    const session = (window as any).JBrowseSession
    const view = session.views[0]
    view.closeSearchPicker()
    for (const { message } of [...session.snackbarMessages]) {
      session.removeSnackbarMessage(message)
    }
    view.navToLocString(start)
  }, START)
  await page.waitForFunction(
    (start: string) =>
      (window as any).JBrowseSession.views[0].coarseVisibleLocStrings === start,
    { timeout: 10000 },
    START,
  )
}

async function typeQuery(page: Page, query: string) {
  await reset(page)
  const input = await page.waitForSelector(INPUT, { timeout: 30000 })
  await input!.focus()
  await page.keyboard.down('Control')
  await page.keyboard.press('a')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await input!.type(query)
}

// the dropdown rows once the typed query's search has landed and stopped moving
async function settledOptions(page: Page) {
  let last = ''
  let stableFor = 0
  for (let i = 0; i < 100 && stableFor < 4; i++) {
    await delay(100)
    const now = await page.evaluate(() =>
      JSON.stringify(
        document.querySelector('.MuiAutocomplete-loading')
          ? 'loading'
          : [...document.querySelectorAll('[role="option"]')].map(o =>
              (o as HTMLElement).innerText.replaceAll('\n', ' | '),
            ),
      ),
    )
    stableFor = now === last && now !== '"loading"' ? stableFor + 1 : 0
    last = now
  }
  return JSON.parse(last) as string[]
}

// Enter on the typed text, then the view once it has stopped moving
async function submit(page: Page) {
  await page.keyboard.press('Enter')
  let last = ''
  for (let i = 0; i < 50; i++) {
    await delay(100)
    const now = JSON.stringify(await viewState(page))
    if (now === last && i > 5) {
      break
    }
    last = now
  }
  return JSON.parse(last) as ViewState
}

async function search(page: Page, query: string) {
  await typeQuery(page, query)
  const options = await settledOptions(page)
  return { options, ...(await submit(page)) }
}

function expectEqual<T>(what: string, actual: T, expected: T) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) {
    throw new Error(`${what}: expected ${e}, got ${a}`)
  }
}

async function expectLands(page: Page, query: string, loc: string) {
  const { loc: landed, picker, messages } = await search(page, query)
  expectEqual(
    `"${query}" lands`,
    { landed, picker, messages },
    {
      landed: loc,
      picker: undefined,
      messages: [],
    },
  )
}

const EDEN = 'ctgA:1..10,590'
const APPLE3 = 'ctgA:16,278..24,119'

const suite: TestSuite = {
  name: 'TextSearch',
  tests: [
    {
      name: 'a feature name, ID or description lands on the feature',
      fn: async page => {
        await navigateToApp(page)
        await expectLands(page, 'EDEN', EDEN)
        await expectLands(page, 'eden', EDEN)
        await expectLands(page, '  EDEN  ', EDEN)
        await expectLands(page, 'Apple3', APPLE3)
        await expectLands(page, 'rna-Apple3', APPLE3)
        await expectLands(page, 'protein kinase', EDEN)
        await expectLands(page, 'ENST00000001.1', 'ctgA:9,403..20,603')
      },
    },
    {
      name: 'a precise name lands even when it prefixes others',
      fn: async page => {
        await navigateToApp(page)
        const { options, loc, picker } = await search(page, 'EDEN')
        expectEqual(
          'EDEN leads the list',
          options[0],
          'EDEN | ctgA:1,050-9,000 · GFF3Tabix genes',
        )
        expectEqual('EDEN.1-3 are listed too', options.length, 4)
        expectEqual(
          'Enter lands on EDEN',
          { loc, picker },
          { loc: EDEN, picker: undefined },
        )
      },
    },
    {
      name: 'a name at several places asks which one',
      fn: async page => {
        await navigateToApp(page)
        const f07 = await search(page, 'f07')
        expectEqual('f07 is one row', f07.options, ['f07 | 2 matches'])
        expectEqual('f07 picker', f07.picker, [
          'f07 ctgA:1,659..1,984',
          'f07 ctgB:1,659..1,984',
        ])
        expectEqual('f07 stays put', f07.loc, START)

        const apple = await search(page, 'apple')
        expectEqual('apple picker', apple.picker, [
          'Apple2 ctgA:13,000..17,200',
          'Apple3 ctgA:17,400..23,000',
          'Apple4 ctgA:10,000..11,500',
        ])

        const dead = await search(page, 'DEAD box')
        expectEqual('a description shared by two genes', dead.picker, [
          'm10 ctgA:28,342..28,447',
          'm13 ctgA:17,667..17,690',
        ])
      },
    },
    {
      name: 'the picker lands on the row chosen',
      fn: async page => {
        await navigateToApp(page)
        await search(page, 'f07')
        const go = await page.waitForSelector(
          '::-p-xpath(//tr[.//td[text()="ctgB:1,659..1,984"]]//button)',
          { timeout: 10000 },
        )
        await go!.click()
        await page.waitForFunction(
          () => !(window as any).JBrowseSession.views[0].searchPicker,
          { timeout: 10000 },
        )
        const { loc } = await viewState(page)
        expectEqual('f07 on ctgB', loc.startsWith('ctgB:1,5'), true)
      },
    },
    {
      name: 'a dropdown row chosen with the keyboard lands there',
      fn: async page => {
        await navigateToApp(page)
        await typeQuery(page, 'apple')
        const options = await settledOptions(page)
        expectEqual('second row', options[1]?.split(' | ')[0], 'Apple3')
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('ArrowDown')
        const { loc, picker } = await submit(page)
        expectEqual(
          'Apple3 by keyboard',
          { loc, picker },
          { loc: APPLE3, picker: undefined },
        )
      },
    },
    {
      name: 'a sequence by name, alias, part of its name, glob or locstring',
      fn: async page => {
        await navigateToApp(page)
        await expectLands(page, 'ctgA', 'ctgA:1..50,001')
        await expectLands(page, 'contigA', 'ctgA:1..50,001')
        await expectLands(page, 'tgA', 'ctgA:1..50,001')
        await expectLands(page, 'ctgA:1000..2000', 'ctgA:1,000..2,000')

        const glob = await search(page, 'ctg*')
        expectEqual(
          'glob offers the set first',
          glob.options[0],
          'Show all 2 regions matching ctg*',
        )
        expectEqual(
          'glob opens the set',
          glob.loc,
          'ctgA:1..50,001 ctgB:1..6,079',
        )
      },
    },
    {
      name: 'a variant ID lands on its base, named as the assembly names it',
      fn: async page => {
        await navigateToApp(page)
        // the index spells these by the aliases A and contigA, and each
        // names one base in two tracks, so the row says where and not which
        const bnd = await search(page, 'bnd_A')
        expectEqual('bnd_A row', bnd.options, ['bnd_A | ctgA:2,700'])
        expectEqual('bnd_A lands', bnd.loc, 'ctgA:2,692..2,708')
        const rs = await search(page, 'rs1041740')
        expectEqual('rs row', rs.options, ['rs1041740 | ctgA:11,340'])
        expectEqual('rs lands', rs.loc, 'ctgA:11,332..11,348')
        expectEqual(
          'rs opens its track',
          rs.tracks.includes('volvox_test_vcf'),
          true,
        )
      },
    },
    {
      name: 'a miss says so and stays put',
      fn: async page => {
        await navigateToApp(page)
        for (const query of ['nonexistentgene', 'no such phrase']) {
          const { loc, messages } = await search(page, query)
          expectEqual(
            `"${query}" misses`,
            { loc, messages },
            { loc: START, messages: [`No results found for "${query}"`] },
          )
        }
      },
    },
  ],
}

export default suite
