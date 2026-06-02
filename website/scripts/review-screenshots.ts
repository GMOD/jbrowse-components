/* eslint-disable no-console */
import { spawn } from 'child_process'
import path from 'path'
import readline from 'readline'

import {
  collectScreenshots,
  imgDir,
  loadReport,
  reportPath,
  saveReport,
  websiteRoot,
} from './screenshot-review-lib.ts'
import { specs } from './screenshot-specs.ts'

const cliArgs = process.argv.slice(2)
const filterArg = cliArgs.find(a => a.startsWith('--filter='))
const filter = filterArg?.split('=')[1]
const exact = cliArgs.includes('--exact')
const reviewAll = cliArgs.includes('--all') // re-review names that already have a verdict
const noOpen = cliArgs.includes('--no-open') // don't launch the image viewer

function openImage(file: string) {
  const opener =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'start'
        : 'xdg-open'
  const child = spawn(opener, [file], { stdio: 'ignore', detached: true })
  child.on('error', () => {
    console.log(`    (could not auto-open; view manually: ${file})`)
  })
  child.unref()
}

// Line reader that queues input lines so it works with both an interactive
// TTY and piped stdin (readline/promises drops buffered lines over a pipe).
function createPrompter() {
  const rl = readline.createInterface({ input: process.stdin })
  const queue: string[] = []
  const waiters: ((line: string) => void)[] = []
  let closed = false
  rl.on('line', line => {
    const waiter = waiters.shift()
    if (waiter) {
      waiter(line)
    } else {
      queue.push(line)
    }
  })
  rl.on('close', () => {
    closed = true
    while (waiters.length > 0) {
      waiters.shift()!('')
    }
  })
  return {
    ask(prompt: string): Promise<string> {
      process.stdout.write(prompt)
      const queued = queue.shift()
      if (queued !== undefined) {
        process.stdout.write('\n')
        return Promise.resolve(queued)
      }
      return closed
        ? Promise.resolve('')
        : new Promise<string>(resolve => {
            waiters.push(resolve)
          })
    },
    close() {
      rl.close()
    },
  }
}

async function main() {
  const all = collectScreenshots(specs.map(s => s.name))
  const selected = filter
    ? all.filter(s => (exact ? s.name === filter : s.name.includes(filter)))
    : all

  if (selected.length === 0) {
    console.error(`No screenshots match filter: ${filter}`)
    process.exit(1)
  }

  const report = loadReport()
  const toReview = selected.filter(s => reviewAll || !report[s.name])

  console.log(
    `${selected.length} screenshot(s) selected, ${toReview.length} to review` +
      `${reviewAll ? ' (re-reviewing all)' : ' (already-reviewed skipped; use --all to redo)'}\n`,
  )

  const rl = createPrompter()

  let reviewed = 0
  for (const spec of toReview) {
    const { name, usages, hasSpec, exists } = spec
    const imgPath = path.join(imgDir, `${name}.png`)

    console.log('━'.repeat(72))
    console.log(
      `${name}   ${hasSpec ? '' : '(manual capture, no generator)'}${exists ? '' : '  ⚠️ image file missing'}`,
    )
    console.log(`  file: ${path.relative(websiteRoot, imgPath)}`)

    if (usages.length === 0) {
      console.log('  docs: (not referenced in any doc/blog/gallery page)')
    } else {
      console.log('  docs:')
      for (const u of usages) {
        console.log(`    • ${u.file}:${u.line}`)
        if (u.caption) {
          console.log(`        caption: ${u.caption}`)
        }
        if (u.context) {
          console.log(`        context: ${u.context}`)
        }
      }
    }

    const prev = report[name]
    if (prev) {
      console.log(
        `  previous verdict: ${prev.status}${prev.note ? ` — ${prev.note}` : ''}`,
      )
    }

    if (exists && !noOpen) {
      openImage(imgPath)
    }

    const answer = (await rl.ask('  good? [y]es / [n]o / [s]kip / [q]uit: '))
      .trim()
      .toLowerCase()

    if (answer === 'q') {
      break
    }
    if (answer === 's' || answer === '') {
      console.log('  skipped\n')
      continue
    }

    const status = answer === 'y' ? 'good' : 'bad'
    const note = (
      await rl.ask(
        status === 'bad'
          ? "  what's wrong with it? (optional): "
          : '  note (optional): ',
      )
    ).trim()

    report[name] = {
      name,
      status,
      note,
      reviewedAt: new Date().toISOString(),
    }
    saveReport(report)
    reviewed++
    console.log(`  recorded: ${status}\n`)
  }

  rl.close()

  const specNames = new Set(specs.map(s => s.name))
  const bad = Object.values(report).filter(v => v.status === 'bad')
  console.log('━'.repeat(72))
  console.log(
    `Reviewed ${reviewed} this session. Report: ${path.relative(websiteRoot, reportPath)}`,
  )
  if (bad.length > 0) {
    const regen = bad.filter(v => specNames.has(v.name))
    const manual = bad.filter(v => !specNames.has(v.name))
    if (regen.length > 0) {
      console.log(`\n${regen.length} marked bad — regenerate with:`)
      for (const v of regen) {
        console.log(
          `  node --experimental-strip-types scripts/generate-screenshots.ts --filter=${v.name} --exact` +
            `${v.note ? `   # ${v.note}` : ''}`,
        )
      }
    }
    if (manual.length > 0) {
      console.log(
        `\n${manual.length} marked bad with no generator (re-capture by hand):`,
      )
      for (const v of manual) {
        console.log(`  ${v.name}${v.note ? `   # ${v.note}` : ''}`)
      }
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
