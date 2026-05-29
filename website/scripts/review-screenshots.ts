/* eslint-disable no-console */
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { fileURLToPath } from 'url'

import { specs } from './screenshot-specs.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const cliArgs = process.argv.slice(2)
const filterArg = cliArgs.find(a => a.startsWith('--filter='))
const filter = filterArg?.split('=')[1]
const exact = cliArgs.includes('--exact')
const reviewAll = cliArgs.includes('--all') // re-review names that already have a verdict
const noOpen = cliArgs.includes('--no-open') // don't launch the image viewer

const websiteRoot = path.resolve(__dirname, '..')
const imgDir = path.resolve(websiteRoot, 'static', 'img')
const reportPath = path.resolve(__dirname, 'screenshot-review.json')

// Directories scanned for doc usages of each image
const docRoots = ['docs', 'blog', 'src/pages'].map(d =>
  path.resolve(websiteRoot, d),
)

interface DocUsage {
  file: string // relative to websiteRoot
  line: number
  caption: string // Figure caption / markdown alt text
  context: string // surrounding descriptive text
}

interface Verdict {
  name: string
  status: 'good' | 'bad'
  note: string
  reviewedAt: string
}

function walkMarkdown(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full))
    } else if (/\.mdx?$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const markdownFiles = docRoots
  .filter(d => fs.existsSync(d))
  .flatMap(d => walkMarkdown(d))

// Pull the caption="..." attribute out of a <Figure .../> line if present
function extractFigureCaption(line: string) {
  const m = /caption=("|')([\s\S]*?)\1/.exec(line)
  return m?.[2] ?? ''
}

// Pull the alt text out of a markdown image ![alt](src)
function extractMarkdownAlt(line: string) {
  const m = /!\[([^\]]*)\]/.exec(line)
  return m?.[1] ?? ''
}

// Gather the descriptive paragraph following a markdown image (gallery style),
// stopping at a separator or the next image
function gatherFollowingParagraph(lines: string[], startIdx: number) {
  const collected: string[] = []
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    const done = line === '---' || line.startsWith('![') || line.startsWith('#')
    if (done) {
      if (collected.length > 0) {
        break
      }
    } else if (line !== '') {
      collected.push(line)
    } else if (collected.length > 0) {
      break
    }
  }
  return collected.join(' ')
}

function findUsages(name: string): DocUsage[] {
  // Matches both /img/<name>.png (docs) and /jb2/img/<name>.png (gallery)
  const needle = `/img/${name}.png`
  const usages: DocUsage[] = []
  for (const file of markdownFiles) {
    const text = fs.readFileSync(file, 'utf8')
    if (!text.includes(needle)) {
      continue
    }
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      if (line.includes(needle)) {
        const isFigure = line.includes('<Figure')
        usages.push({
          file: path.relative(websiteRoot, file),
          line: i + 1,
          caption: isFigure
            ? extractFigureCaption(line)
            : extractMarkdownAlt(line),
          context: isFigure ? '' : gatherFollowingParagraph(lines, i),
        })
      }
    }
  }
  return usages
}

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

function loadReport(): Record<string, Verdict> {
  if (fs.existsSync(reportPath)) {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Record<
      string,
      Verdict
    >
  }
  return {}
}

function saveReport(report: Record<string, Verdict>) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
}

async function main() {
  const selected = filter
    ? specs.filter(s => (exact ? s.name === filter : s.name.includes(filter)))
    : specs

  if (selected.length === 0) {
    console.error(`No specs match filter: ${filter}`)
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
    const { name } = spec
    const imgPath = path.join(imgDir, `${name}.png`)
    const exists = fs.existsSync(imgPath)

    console.log('━'.repeat(72))
    console.log(`${name}   ${exists ? '' : '  ⚠️ image file missing'}`)
    console.log(`  file: ${path.relative(websiteRoot, imgPath)}`)

    const usages = findUsages(name)
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
      console.log(`  previous verdict: ${prev.status}${prev.note ? ` — ${prev.note}` : ''}`)
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

  const bad = Object.values(report).filter(v => v.status === 'bad')
  console.log('━'.repeat(72))
  console.log(`Reviewed ${reviewed} this session. Report: ${path.relative(websiteRoot, reportPath)}`)
  if (bad.length > 0) {
    console.log(`\n${bad.length} marked bad — regenerate with:`)
    for (const v of bad) {
      console.log(
        `  node --experimental-strip-types scripts/generate-screenshots.ts --filter=${v.name} --exact` +
          `${v.note ? `   # ${v.note}` : ''}`,
      )
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
