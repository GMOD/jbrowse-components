// Proves each eval grader discriminates, without an agent. For every task in
// tasks.ts it stages the volvox baseline and the task's setup, then requires
// the grader to FAIL the untouched state, and to PASS after the task's
// `solution` has run. A grader that passes the baseline, or fails a correct
// end state, costs an agent-eval run its verdict and looks like an agent
// failure; this finds it for the price of one headless page.
//
// It drives jbrowse-web in headless Chromium through pageBridge.ts, the same
// route webAgentEval.ts grades by, so a grader runs here in the page it runs
// in there. The state graders read is model state, which software rendering
// draws identically.
//
// Prereqs: `pnpm --filter @jbrowse/web build`.
//
// Usage: node scripts/agent-evals/selfCheck.ts [--build dir] [--filter name]
//        [--set dev|heldout|all]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer from 'puppeteer'

import { servePageBridge } from './pageBridge.ts'
import { BASELINE_SPEC, selectTasks } from './tasks.ts'

import type { TaskSet } from './tasks.ts'

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)
const args = process.argv.slice(2)
function flag(name: string, fallback: string) {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : (args[i + 1] ?? fallback)
}
const buildDir = path.resolve(
  flag('build', path.join(repoRoot, 'products/jbrowse-web/build')),
)
const set = flag('set', 'all') as TaskSet
const tasks = selectTasks(set, flag('filter', ''), 'web')

if (!fs.existsSync(path.join(buildDir, 'index.html'))) {
  throw new Error(
    `no jbrowse-web build at ${buildDir}: pnpm --filter @jbrowse/web build`,
  )
}

const bridge = await servePageBridge(buildDir)
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox'],
})
const failures: string[] = []

// The page polls between jobs, not during one, so a call issued right after a
// long job finds no live page until the next poll lands.
async function run(code: string, answer = '') {
  const page = await bridge.waitForPage(30_000)
  return bridge.evaluate(code, { timeoutMs: 120_000, answer, page })
}

async function stage(setup?: string) {
  await run(BASELINE_SPEC)
  if (setup) {
    await run(setup)
  }
}

async function verdict(grade: string, answer = '') {
  const value = (await run(grade, answer)) as {
    pass?: boolean
    detail?: unknown
  } | null
  return { pass: value?.pass === true, detail: value?.detail }
}

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  await page.goto(`${bridge.url}?config=test_data/volvox/config.json`)
  await bridge.waitForPage(60_000)
  await run(
    `for (let i = 0; i < 200 && !window.jb; i++) { await new Promise(r => setTimeout(r, 250)) }
     if (!window.jb) { throw new Error('window.jb never appeared') }
     return true`,
  )
  for (const task of tasks) {
    const problems: string[] = []
    try {
      await stage(task.setup)
      const before = await verdict(task.grade)
      if (before.pass) {
        problems.push(
          `grader passes the untouched state ${JSON.stringify(before.detail)}`,
        )
      }
      if (task.solution) {
        await stage(task.setup)
        const answer = await run(task.solution.replaceAll('DATA', repoRoot))
        const after = await verdict(
          task.grade,
          typeof answer === 'string' ? answer : '',
        )
        if (!after.pass) {
          problems.push(
            `grader fails the solution ${JSON.stringify(after.detail)}`,
          )
        }
      }
    } catch (e) {
      problems.push(`${e}`.slice(0, 400))
    }
    const label = task.solution
      ? 'fails baseline, passes solution'
      : 'fails baseline only'
    console.log(
      `${problems.length ? 'BAD ' : 'ok  '} ${task.name.padEnd(28)} ${problems.length ? problems.join('; ') : label}`,
    )
    if (problems.length) {
      failures.push(task.name)
    }
  }
} finally {
  await browser.close()
  bridge.close()
}

console.log(
  failures.length
    ? `\n${failures.length}/${tasks.length} graders need a fix: ${failures.join(', ')}`
    : `\nall ${tasks.length} graders discriminate`,
)
process.exitCode = failures.length ? 1 : 0
