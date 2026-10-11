// Does a session change on its own while it boots? Loads a config's default
// session, touches nothing, and diffs the sessionStorage autosave mirror over
// time. Run against a build: node browser-tests/probe-boot-session-churn.ts
import puppeteer from 'puppeteer'

import { delay, findByText, navigateToUrl, setPort } from './helpers.ts'
import { startServerOnFreePort } from './server.ts'

const { server, port } = await startServerOnFreePort(3000)
setPort(port)
const configs = (process.argv[2] ?? 'test_data/volvox/config.json').split(',')

function changedKeys(a: unknown, b: unknown, path = ''): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) {
    return []
  }
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return [path || '(root)']
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].flatMap(k =>
    changedKeys(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
      `${path}.${k}`,
    ),
  )
}

const browser = await puppeteer.launch({ headless: true })
for (const config of configs) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  await navigateToUrl(page, `config=${config}`)
  await findByText(page, 'Help')
  const samples: { t: number; session: unknown }[] = []
  const start = Date.now()
  for (const t of [0, 500, 1500, 3000, 6000]) {
    await delay(Math.max(0, t - (Date.now() - start)))
    const raw = await page.evaluate(() => sessionStorage.getItem('current'))
    samples.push({ t, session: raw ? JSON.parse(raw).session : undefined })
  }
  console.log(`\n${config}`)
  for (let i = 1; i < samples.length; i++) {
    const diff = changedKeys(samples[i - 1]!.session, samples[i]!.session)
    console.log(
      `  ${samples[i - 1]!.t}ms -> ${samples[i]!.t}ms: ${diff.length ? diff.slice(0, 8).join(', ') : 'unchanged'}`,
    )
  }
  await page.close()
}
await browser.close()
server.close()
