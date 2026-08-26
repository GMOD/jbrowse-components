// The review page is where a verdict actually gets made, and none of it is
// reachable from run.mjs: the keyboard queue, the in-place repaint and the
// progress arithmetic all live in template.html. This builds a real portal off
// the same fixture and drives it. Needs puppeteer, which the monorepo has and
// a bare gene-review-portal checkout does not — there it says so and stops.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const HERE = import.meta.dirname

let puppeteer
try {
  puppeteer = (await import('puppeteer')).default
} catch {
  console.log(
    'skipped: puppeteer did not resolve, so template.html is unchecked here.\n' +
      '         it ships with @jbrowse/capture; run this from a jbrowse-components\n' +
      '         checkout, or `npm i -D puppeteer`, to cover the review page.',
  )
  process.exit(0)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gene-review-browser-'))
const fixture = path.join(tmp, 'fixture')
const portal = path.join(tmp, 'portal')
execFileSync('node', [path.join(HERE, 'make-fixture.mjs'), fixture], {
  stdio: 'pipe',
})
execFileSync(
  'node',
  [
    path.join(HERE, '..', 'bin', 'make-portal.mjs'),
    '--prediction',
    path.join(fixture, 'prediction.gff3'),
    '--reference',
    path.join(fixture, 'reference.gff3'),
    '--fasta',
    path.join(fixture, 'genome.fa'),
    '--assembly',
    'test',
    '--no-capture',
    '--out',
    portal,
  ],
  { stdio: 'pipe' },
)

let failures = 0
async function check(name, produce, expected) {
  let actual
  try {
    actual = await produce()
  } catch (e) {
    // a selector that matches nothing throws rather than returning, and a
    // missing card is the shape most of these regressions take
    console.log(`FAIL ${name}\n       threw ${e.message.split('\n')[0]}`)
    failures++
    return
  }
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`ok   ${name}`)
  } else {
    console.log(`FAIL ${name}\n       expected ${e}\n       actual   ${a}`)
    failures++
  }
}

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => {
  if (m.type() === 'error') {
    errors.push(m.text())
  }
})
await page.goto(`file://${path.join(portal, 'index.html')}`, {
  waitUntil: 'load',
})

const ids = await page.$$eval('.card', els => els.map(e => e.dataset.id))
const current = () => page.$eval('.card[data-current]', e => e.dataset.id)
const verdictOf = id =>
  page.$eval(`.card[data-id="${id}"]`, e => e.dataset.verdict)
const text = sel => page.$eval(sel, e => e.textContent)

await check('the fixture builds a card per candidate', () => ids.length, 5)

await page.keyboard.press('j')
await check('j puts the cursor on the first card', current, ids[0])
await page.keyboard.press('j')
await check('and again advances one', current, ids[1])
await page.keyboard.press('k')
await check('k goes back', current, ids[0])
await page.keyboard.press('k')
await check('and stops at the top rather than wrapping', current, ids[0])

await page.keyboard.press('1')
await check(
  '1 keeps the card under the cursor',
  () => verdictOf(ids[0]),
  'keep',
)
await check(
  'and its button reads pressed',
  () =>
    page.$eval('.card[data-current] .verdicts button[data-v="keep"]', e =>
      e.getAttribute('aria-pressed'),
    ),
  'true',
)
await check('the progress line counts it', () => text('#done'), '1 of 5 judged')
await check(
  'and the tally names it',
  () => text('#tally'),
  '1 keep · 0 edit · 0 reject',
)
await page.keyboard.press('1')
await check(
  'the same digit again takes the verdict off',
  () => verdictOf(ids[0]),
  '',
)
await check(
  'and the count comes back down',
  () => text('#done'),
  '0 of 5 judged',
)
await page.keyboard.press('3')
await check('3 rejects', () => verdictOf(ids[0]), 'reject')
await check('and the cursor has not moved', current, ids[0])

// The point of painting one card rather than rebuilding the list: a reviewer
// forty cards deep keeps their place, and the captures — 2 MB of inline base64
// in a real portal — are not thrown away and decoded again. Scroll position
// cannot show that here, since a rebuilt list of the same cards is the same
// height; the element surviving is the mechanism itself.
const held = await page.$(`.card[data-id="${ids[2]}"]`)
await page.$eval(
  `.card[data-id="${ids[2]}"] .verdicts button[data-v="edit"]`,
  e => {
    e.click()
  },
)
await check(
  'a verdict repaints the card in place',
  () => held.evaluate(e => e.isConnected),
  true,
)
await check('and the verdict landed', () => verdictOf(ids[2]), 'edit')

await page.select('#vf', 'unreviewed')
await check(
  'the unreviewed filter drops the judged cards',
  () => page.$$eval('.card', e => e.length),
  3,
)
await page.keyboard.press('j')
await page.keyboard.press('2')
await check(
  'judging under that filter takes the card out of the list',
  () => page.$$eval('.card', e => e.length),
  2,
)
await check(
  'and the cursor closes over the gap rather than vanishing',
  current,
  await page.$$eval('.card', els => els[0].dataset.id),
)

await page.select('#vf', 'all')
await page.keyboard.press('/')
await check(
  '/ focuses the search box',
  () => page.evaluate(() => document.activeElement.id),
  'q',
)
await page.keyboard.type('1')
await check(
  'a digit typed there is text, not a verdict',
  () => page.$eval('#q', e => e.value),
  '1',
)
await page.keyboard.press('Escape')
await check(
  'Escape leaves the box',
  () => page.evaluate(() => document.activeElement.id),
  '',
)
await page.$eval('#q', e => {
  e.value = ''
  e.dispatchEvent(new Event('input', { bubbles: true }))
})

await check(
  'the key legend starts hidden',
  () => page.$eval('#keys', e => e.hidden),
  true,
)
await page.keyboard.press('?')
await check('? shows it', () => page.$eval('#keys', e => e.hidden), false)
await page.click('#keysbtn')
await check(
  'and the button puts it away',
  () => page.$eval('#keys', e => e.hidden),
  true,
)

const stored = () =>
  page.evaluate(() =>
    JSON.parse(
      localStorage.getItem(
        Object.keys(localStorage).find(k => k.startsWith('gene-review:')),
      ),
    ),
  )
const before = await stored()
await page.reload({ waitUntil: 'load' })
await check(
  'verdicts come back from localStorage',
  async () => (await stored()).verdicts,
  before.verdicts,
)
await check(
  'and the progress line agrees',
  () => text('#done'),
  '3 of 5 judged',
)

// A rerun with a smaller --max keeps the portalId, so the earlier verdicts are
// still in storage. Counting them reads as more judged than there are cards.
await page.evaluate(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith('gene-review:'))
  const s = JSON.parse(localStorage.getItem(k))
  s.verdicts['a-model-this-build-does-not-carry'] = 'keep'
  s.verdicts['nor-this-one'] = 'reject'
  localStorage.setItem(k, JSON.stringify(s))
})
await page.reload({ waitUntil: 'load' })
await check(
  'a verdict for a model this build has no card for is not counted',
  () => text('#done'),
  '3 of 5 judged',
)
await check(
  'and the bar stops at its own end',
  () =>
    page.$$eval('.bar span', els =>
      els.reduce((a, e) => a + Number.parseFloat(e.style.width || 0), 0),
    ),
  60,
)
await check(
  'but it stays in storage, for the wider rerun that has a card for it',
  async () => 'nor-this-one' in (await stored()).verdicts,
  true,
)

const tsv = [
  'model_id\tclass\tlocus\texons\tstrand\treference_genes\tverdict',
  `${ids[0]}\tx\tx\t1\t+\t\tkeep`,
  `${ids[1]}\tx\tx\t1\t+\t\treject`,
  `${ids[3]}\tx\tx\t1\t+\t\tunreviewed`,
  'some-other-model\tx\tx\t1\t+\t\tedit',
].join('\n')
await page.evaluate(t => {
  const dt = new DataTransfer()
  dt.items.add(
    new File([t], 'decisions.tsv', { type: 'text/tab-separated-values' }),
  )
  const input = document.getElementById('importfile')
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
}, tsv)
await page.waitForFunction(
  () => document.getElementById('msg').textContent !== '',
  { timeout: 5000 },
)
await check(
  'an imported verdict lands on its card',
  () => verdictOf(ids[0]),
  'keep',
)
await check(
  'and overwrites the one that was there',
  () => verdictOf(ids[1]),
  'reject',
)
await check('an imported "unreviewed" clears one', () => verdictOf(ids[3]), '')
await check(
  'and the count separates the rows it could place from the rows it could not',
  () => text('#msg'),
  '3 verdicts read in, 1 for models this portal does not carry.',
)

await check('the page logged nothing', () => errors, [])

await browser.close()
fs.rmSync(tmp, { recursive: true, force: true })

if (failures) {
  console.log(`\n${failures} check${failures === 1 ? '' : 's'} failed`)
  process.exit(1)
}
console.log('\nall browser checks passed')
