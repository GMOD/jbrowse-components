import path from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer from 'puppeteer'

import { servePageBridge } from './pageBridge.ts'
import { NOT_DRAWN, TASKS, drawnPass } from './tasks.ts'

const prefix = process.argv[2] ?? 'fr-'
const build =
  process.argv[3] ??
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../products/jbrowse-web/build',
  )
const bridge = await servePageBridge(build)
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 900 })
const run = async (code: string, answer = '') =>
  bridge.evaluate(code, {
    timeoutMs: 300_000,
    answer,
    page: await bridge.waitForPage(90_000),
  })
async function fresh(config: string, setup?: string) {
  await page.goto(`${bridge.url}?config=${encodeURIComponent(config)}`)
  await run(
    `for (let i = 0; i < 400 && !window.jb; i++) { await new Promise(r => setTimeout(r, 250)) }
     return !!window.jb`,
  )
  if (setup) {
    await run(setup)
  }
}
let bad = 0
try {
  for (const t of TASKS.filter(t => t.name.startsWith(prefix) && t.grade)) {
    const problems: string[] = []
    try {
      await fresh(t.config!, t.setup)
      const before = (await run(t.grade!)) as { pass: boolean; detail: unknown }
      if (before.pass) {
        problems.push(`passes baseline ${JSON.stringify(before.detail)}`)
      }
      await fresh(t.config!, t.setup)
      const answer = await run(t.solution!)
      const after = (await run(
        t.grade!,
        typeof answer === 'string' ? answer : '',
      )) as { pass: boolean; detail: unknown }
      if (!after.pass) {
        problems.push(`fails solution ${JSON.stringify(after.detail)}`)
      }
      if (after.pass && t.draws) {
        const notDrawn = await run(NOT_DRAWN)
        if (!drawnPass(t, after.pass, notDrawn)) {
          problems.push(`solution leaves undrawn ${JSON.stringify(notDrawn)}`)
        }
      }
      console.log(
        `${problems.length ? 'BAD' : 'ok '} ${t.name} ${problems.join('; ').slice(0, 900) || JSON.stringify(after.detail).slice(0, 300)}`,
      )
    } catch (e) {
      problems.push(String(e).slice(0, 600))
      console.log(`BAD ${t.name} ${problems.join('; ')}`)
    }
    bad += problems.length ? 1 : 0
  }
} finally {
  await browser.close()
  bridge.close()
}
process.exitCode = bad ? 1 : 0
