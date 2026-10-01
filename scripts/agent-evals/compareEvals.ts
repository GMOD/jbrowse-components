// Usage: node scripts/agent-evals/compareEvals.ts <baseline dir> <variant dir>
//
// Two eval:mcp result directories side by side, per task and in total: passes
// over runs, then the variant's median minus the baseline's for turns,
// run_javascript calls, errored calls and dollars. A negative delta is the
// variant spending less.
import fs from 'node:fs'
import path from 'node:path'

interface Median {
  task: string
  passes: number
  runs: number
  turns?: number
  runJavascript: number
  errored: number
  usd?: number
}

interface Summary {
  commit?: string
  model: string
  client: string
  set: string
  passed: number
  total: number
  tasksPassingEveryRun: number
  totals: { turns: number; usd: number; runJavascript: number; errored: number }
  medians: Median[]
}

const [baseDir, variantDir] = process.argv.slice(2)
if (!baseDir || !variantDir) {
  throw new Error('usage: compareEvals.ts <baseline dir> <variant dir>')
}
const read = (dir: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8')) as Summary
const base = read(baseDir)
const variant = read(variantDir)

const label = (s: Summary) =>
  `${s.commit ?? '?'} ${s.model} ${s.set} ${s.client}`
const delta = (a = 0, b = 0, digits = 0) => {
  const d = b - a
  const text = d.toFixed(digits)
  return d > 0 ? `+${text}` : text
}

console.log(`baseline ${label(base)}\nvariant  ${label(variant)}\n`)
console.log(`${'task'.padEnd(28)} ${'passes'.padEnd(11)} turns  js   err  usd`)
const byTask = new Map(base.medians.map(m => [m.task, m]))
for (const v of variant.medians) {
  const b = byTask.get(v.task)
  if (!b) {
    console.log(`${v.task.padEnd(28)} (not in baseline)`)
    continue
  }
  console.log(
    `${v.task.padEnd(28)} ${`${b.passes}/${b.runs}→${v.passes}/${v.runs}`.padEnd(11)} ${delta(b.turns, v.turns).padEnd(6)} ${delta(b.runJavascript, v.runJavascript).padEnd(4)} ${delta(b.errored, v.errored).padEnd(4)} ${delta(b.usd, v.usd, 3)}`,
  )
}
const per = (s: Summary, key: keyof Summary['totals']) =>
  s.totals[key] / s.total
console.log(
  `\npassed ${base.passed}/${base.total} → ${variant.passed}/${variant.total}; every run ${base.tasksPassingEveryRun} → ${variant.tasksPassingEveryRun} tasks`,
)
console.log(
  `per run: turns ${per(base, 'turns').toFixed(1)} → ${per(variant, 'turns').toFixed(1)}, js ${per(base, 'runJavascript').toFixed(1)} → ${per(variant, 'runJavascript').toFixed(1)}, errored ${per(base, 'errored').toFixed(2)} → ${per(variant, 'errored').toFixed(2)}, $${per(base, 'usd').toFixed(3)} → $${per(variant, 'usd').toFixed(3)}`,
)
