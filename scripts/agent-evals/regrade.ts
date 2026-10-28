import fs from 'node:fs'

import puppeteer from 'puppeteer'

import { servePageBridge } from './pageBridge.ts'
import { TASKS } from './tasks.ts'

// Regrades stored runs of hosted tasks with the current graders, against the
// live hub. Usage: node regrade.ts <buildDir> <run.json>...
const [build, ...files] = process.argv.slice(2)
const bridge = await servePageBridge(build!)
const browser = await puppeteer.launch({
  headless: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
const run = async (code: string, answer = '') =>
  bridge.evaluate(code, {
    timeoutMs: 300_000,
    answer,
    page: await bridge.waitForPage(90_000),
  })
try {
  for (const file of files) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
    const row = doc.row
    const task = TASKS.find(t => t.name === row.task)
    if (!task?.grade || !task.config) {
      console.log(`skip ${file}`)
      continue
    }
    await page.goto(`${bridge.url}?config=${encodeURIComponent(task.config)}`)
    await run(
      `for (let i = 0; i < 400 && !window.jb; i++) { await new Promise(r => setTimeout(r, 250)) }
       return !!window.jb`,
    )
    const verdict = (await run(task.grade, row.answer ?? '')) as {
      pass: boolean
      detail: unknown
    }
    if (verdict.pass !== row.pass) {
      row.regraded = { from: row.pass, detail: row.detail, at: new Date().toISOString() }
      row.pass = verdict.pass
      row.detail = verdict.detail
      fs.writeFileSync(file, JSON.stringify(doc, null, 2))
    }
    console.log(`${verdict.pass ? 'pass' : 'FAIL'} ${row.regraded ? '(changed)' : ''} ${file.split('/').slice(-2).join('/')} ${JSON.stringify(verdict.detail).slice(0, 160)}`)
  }
} finally {
  await browser.close()
  bridge.close()
}
