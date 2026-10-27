// The search box against the hosted hg38 config and its genome-wide trix
// index: real gene names, transcript IDs, aliases and contigs. Each query
// starts from chr1:1..100. Assertions name only what the hosted data is not
// expected to move: which sequence a hit lands on, roughly where.
import { delay, navigateWithSessionSpec } from '../helpers.ts'

import type { TestSuite } from '../types.ts'
import type { Page } from 'puppeteer'

const CONFIG = 'https://jbrowse.org/ucsc/hg38/config.json'
const INPUT = 'input[placeholder="Search for location"]'
const START = 'chr1:1..100'

async function search(page: Page, query: string) {
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
  const input = await page.waitForSelector(INPUT)
  await input!.focus()
  await page.keyboard.down('Control')
  await page.keyboard.press('a')
  await page.keyboard.up('Control')
  await page.keyboard.press('Backspace')
  await input!.type(query)
  await page.keyboard.press('Enter')
  let last = ''
  for (let i = 0; i < 100; i++) {
    await delay(200)
    const now = await page.evaluate(() => {
      const session = (window as any).JBrowseSession
      const view = session.views[0]
      return JSON.stringify({
        loc: view.coarseVisibleLocStrings as string,
        picker: view.searchPicker?.rows.map((r: any) => r.label as string),
        messages: session.snackbarMessages.map((m: any) => m.message as string),
      })
    })
    if (now === last && !now.includes(`"loc":"${START}","messages":[]`)) {
      break
    }
    last = now
  }
  return JSON.parse(last) as {
    loc: string
    picker?: string[]
    messages: string[]
  }
}

function expectThat(what: string, ok: boolean, got: unknown) {
  if (!ok) {
    throw new Error(`${what}: got ${JSON.stringify(got)}`)
  }
}

const suite: TestSuite = {
  name: 'TextSearchHg38',
  requiresRemote: true,
  tests: [
    {
      name: 'genes, transcripts, aliases and contigs land where they are',
      requiresRemote: true,
      fn: async page => {
        const warnings: string[] = []
        page.on('console', msg => {
          if (msg.type() === 'warn' || msg.type() === 'error') {
            warnings.push(msg.text())
          }
        })
        await navigateWithSessionSpec(
          page,
          {
            views: [{ type: 'LinearGenomeView', assembly: 'hg38', loc: START }],
          },
          CONFIG,
        )
        await page.waitForSelector(INPUT, { timeout: 60000 })

        for (const [query, prefix] of [
          ['BRCA1', 'chr17:43,0'],
          ['brca1', 'chr17:43,0'],
          ['TP53', 'chr17:7,6'],
          ['NM_007294', 'chr17:43,0'],
          ['NM_007294.4', 'chr17:43,0'],
          ['XIST', 'chrX:73,8'],
          ['17', 'chr17:1..'],
          ['chrM', 'chrM:1..'],
          ['KI270706', 'chr1_KI270706v1_random:1..'],
        ] as const) {
          const { loc, picker, messages } = await search(page, query)
          expectThat(
            `"${query}" lands on ${prefix}`,
            loc.startsWith(prefix) && !picker && !messages.length,
            { loc, picker, messages },
          )
        }

        const brca = await search(page, 'BRCA')
        expectThat(
          'a bare prefix asks, with the genes it names first',
          brca.picker?.[0] === 'BRCA1' && brca.picker.includes('BRCA2'),
          brca.picker?.slice(0, 5),
        )

        const phrase = await search(page, 'breast cancer')
        expectThat(
          'a phrase that matches nothing says so',
          phrase.messages[0] === 'No results found for "breast cancer"',
          phrase.messages,
        )

        const unparsed = warnings.filter(w => w.includes('location string'))
        expectThat('no warnings over normal hits', !unparsed.length, unparsed)
      },
    },
  ],
}

export default suite
