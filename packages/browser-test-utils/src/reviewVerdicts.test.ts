/**
 * @jest-environment node
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { loadReport, saveReport, updateReport } from './reviewVerdicts.ts'

import type { Verdict } from './reviewVerdicts.ts'

// These reports are written by several processes at once — two review servers
// can run, flip-review.ts writes from the CLI, and a reviewer is often live in
// the UI while an agent works. Before the lock and the atomic save, that made
// the file unparseable within a second and silently dropped verdicts. Everything
// below is a guard against reintroducing either.

// __dirname, not import.meta.url: jest transpiles to CJS, where import.meta is
// a syntax error.
const libPath = path.resolve(__dirname, 'reviewVerdicts.ts')

let dir: string
let reportPath: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reviewverdicts-'))
  reportPath = path.join(dir, 'report.json')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function verdict(name: string): Verdict {
  return {
    name,
    status: 'good',
    note: 'x'.repeat(200),
    reviewedAt: '2026-01-01T00:00:00.000Z',
    hash: 'deadbeef',
  }
}

function seed(count: number) {
  const report: Record<string, Verdict> = {}
  for (let i = 0; i < count; i++) {
    report[`seed-${i}`] = verdict(`seed-${i}`)
  }
  saveReport(reportPath, report)
  return report
}

function strays() {
  return fs.readdirSync(dir).filter(f => f !== 'report.json')
}

test('a saved report is complete and leaves no staging file behind', () => {
  const report = seed(50)
  expect(loadReport(reportPath)).toEqual(report)
  expect(strays()).toEqual([])
})

test('an unreadable report is fatal rather than silently empty', () => {
  // Returning {} here would be the worst possible failure: the next save would
  // write that empty map straight back, turning a recoverable parse error into
  // the loss of every verdict in the file.
  seed(10)
  fs.writeFileSync(reportPath, '{"truncated": {"name"')
  expect(() => loadReport(reportPath)).toThrow(/not valid JSON/)
})

test('a mutate that changes nothing leaves the file alone', () => {
  // the servers run updateReport on the REJECTED path of a precondition check
  // too, so a refused write must not create the report, bump its mtime, or
  // reformat a hand-edit — it must do nothing at all
  expect(fs.existsSync(reportPath)).toBe(false)
  const seen = updateReport(reportPath, r => Object.keys(r).length)
  expect(seen).toBe(0)
  expect(fs.existsSync(reportPath)).toBe(false)

  const report = seed(10)
  const before = fs.statSync(reportPath).mtimeMs
  updateReport(reportPath, r => r['seed-0'])
  expect(fs.statSync(reportPath).mtimeMs).toBe(before)
  expect(loadReport(reportPath)).toEqual(report)
})

test('a mutate that throws releases the lock and writes nothing', () => {
  const report = seed(10)
  expect(() =>
    updateReport(reportPath, r => {
      r.wrecked = verdict('wrecked')
      throw new Error('boom')
    }),
  ).toThrow('boom')
  expect(fs.existsSync(`${reportPath}.lock`)).toBe(false)
  expect(loadReport(reportPath)).toEqual(report)
})

test('a lock left behind by a dead process is broken at once', async () => {
  seed(10)
  const victim = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 1e6)'])
  await new Promise(resolve => {
    victim.on('spawn', resolve)
  })
  const deadPid = victim.pid!
  victim.kill('SIGKILL')
  await new Promise(resolve => {
    victim.on('exit', resolve)
  })

  fs.writeFileSync(`${reportPath}.lock`, String(deadPid))
  updateReport(reportPath, r => {
    r.after = verdict('after')
  })
  expect(loadReport(reportPath).after).toBeDefined()
  expect(fs.existsSync(`${reportPath}.lock`)).toBe(false)
})

// The one property that cannot be checked in a single process. Each writer
// rewrites the WHOLE map, so an unlocked write drops every entry recorded since
// it read, and a non-atomic save leaves the file truncated for anyone reading.
test('concurrent writers lose nothing, and no reader sees a partial file', async () => {
  const WRITERS = 6
  const WRITES = 25
  const seeded = seed(300)

  const worker = path.join(dir, 'worker.mjs')
  fs.writeFileSync(
    worker,
    `import { updateReport } from ${JSON.stringify(libPath)}
const [, , reportPath, tag, writes] = process.argv
for (let i = 0; i < Number(writes); i++) {
  updateReport(reportPath, report => {
    report[\`\${tag}-\${i}\`] = {
      name: \`\${tag}-\${i}\`,
      status: 'good',
      note: 'x'.repeat(200),
      reviewedAt: new Date().toISOString(),
      hash: 'deadbeef',
    }
  })
}
`,
  )

  const children = Array.from({ length: WRITERS }, (_, i) =>
    spawn(process.execPath, [worker, reportPath, `w${i}`, String(WRITES)], {
      stdio: ['ignore', 'ignore', 'pipe'],
    }),
  )
  const stderr: string[] = []
  for (const child of children) {
    child.stderr.on('data', d => {
      stderr.push(String(d))
    })
  }

  // Read the file as hard as we can for as long as they run. Every read has to
  // parse: with a truncate-then-write save, these fail in bulk.
  let reads = 0
  let unparseable = 0
  const reader = setInterval(() => {
    for (let i = 0; i < 40; i++) {
      reads++
      try {
        loadReport(reportPath)
      } catch {
        unparseable++
      }
    }
  }, 1)

  const codes = await Promise.all(
    children.map(
      child =>
        new Promise<number>(resolve => {
          child.on('exit', code => {
            resolve(code ?? -1)
          })
        }),
    ),
  )
  clearInterval(reader)

  expect(stderr.join('')).toBe('')
  expect(codes).toEqual(Array.from({ length: WRITERS }, () => 0))

  const final = loadReport(reportPath)
  const expected: string[] = []
  for (let w = 0; w < WRITERS; w++) {
    for (let i = 0; i < WRITES; i++) {
      expected.push(`w${w}-${i}`)
    }
  }
  expect(
    Object.keys(final)
      .filter(k => k.startsWith('w'))
      .sort(),
  ).toEqual(expected.sort())
  // the writers must have merged onto what was already there, not replaced it
  expect(Object.keys(final).filter(k => k.startsWith('seed-'))).toHaveLength(
    Object.keys(seeded).length,
  )
  expect(reads).toBeGreaterThan(0)
  expect(unparseable).toBe(0)
  expect(strays().filter(f => f !== 'worker.mjs')).toEqual([])
}, 60000)
