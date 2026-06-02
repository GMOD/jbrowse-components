import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const websiteRoot = path.resolve(__dirname, '..')
export const imgDir = path.resolve(websiteRoot, 'static', 'img')
export const reportPath = path.resolve(__dirname, 'screenshot-review.json')

// Directories scanned for doc usages of each image
const docRoots = ['docs', 'blog', 'src/pages'].map(d =>
  path.resolve(websiteRoot, d),
)

export interface DocUsage {
  file: string // relative to websiteRoot
  line: number
  caption: string // Figure caption / markdown alt text
  context: string // surrounding descriptive text
}

export interface Verdict {
  name: string
  status: 'good' | 'bad'
  note: string
  reviewedAt: string
}

// One reviewable screenshot. `hasSpec` means generate-screenshots.ts can
// reproduce it; otherwise it's a hand-captured image kept only in static/img
// (e.g. UI-flow walkthroughs, the gallery read-vs-ref shot).
export interface Screenshot {
  name: string
  usages: DocUsage[]
  hasSpec: boolean
  exists: boolean
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

// Every image-name a single line references. Matches the `/img/<name>.png`
// segment in any form the docs use — <Figure src="/img/x.png"/>,
// ![alt](/jb2/img/x.png), and absolute github-raw URLs that point back at this
// repo's website/static/img/x.png (used in blog posts so external aggregators
// resolve the image). Third-party github-raw images (jb2export, plugin-list)
// also match here but get dropped later because their PNG isn't on disk.
function imageNamesOnLine(line: string): string[] {
  const names: string[] = []
  const re = /\/img\/([A-Za-z0-9_/-]+)\.png/g
  let m: RegExpExecArray | null = re.exec(line)
  while (m) {
    names.push(m[1]!)
    m = re.exec(line)
  }
  return names
}

// Scan every markdown file once, building name -> usages. Re-reading per-name
// was O(names × files); this is O(files) and shared across both review tools.
function buildUsageIndex(): Map<string, DocUsage[]> {
  const index = new Map<string, DocUsage[]>()
  for (const file of markdownFiles) {
    // a doc file can be deleted/regenerated between the startup scan and now
    // (e.g. autogen rewriting docs/config/*.md); a vanished file is just not a
    // usage, so skip it rather than crashing
    const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
    if (!text.includes('/img/')) {
      continue
    }
    const lines = text.split('\n')
    const rel = path.relative(websiteRoot, file)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const names = imageNamesOnLine(line)
      if (names.length > 0) {
        const isFigure = line.includes('<Figure')
        const usage: DocUsage = {
          file: rel,
          line: i + 1,
          caption: isFigure
            ? extractFigureCaption(line)
            : extractMarkdownAlt(line),
          context: isFigure ? '' : gatherFollowingParagraph(lines, i),
        }
        for (const name of names) {
          const list = index.get(name)
          if (list) {
            list.push(usage)
          } else {
            index.set(name, [usage])
          }
        }
      }
    }
  }
  return index
}

let usageIndex: Map<string, DocUsage[]> | undefined

function getUsageIndex() {
  if (!usageIndex) {
    usageIndex = buildUsageIndex()
  }
  return usageIndex
}

function pngExists(name: string) {
  return fs.existsSync(path.join(imgDir, `${name}.png`))
}

// The full reviewable set: every generate-screenshots spec PLUS every image a
// doc references that actually lives in static/img. The union means gallery and
// hand-captured UI-flow images get reviewed too, not just the spec-driven ones.
// A doc-referenced name with no spec and no PNG on disk is a third-party remote
// image (not ours to review) and is excluded.
export function collectScreenshots(specNames: string[]): Screenshot[] {
  const specSet = new Set(specNames)
  const index = getUsageIndex()
  const names = new Set(specNames)
  for (const [name, usages] of index) {
    if (usages.length > 0 && pngExists(name)) {
      names.add(name)
    }
  }
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({
      name,
      usages: index.get(name) ?? [],
      hasSpec: specSet.has(name),
      exists: pngExists(name),
    }))
}

export function loadReport(): Record<string, Verdict> {
  if (fs.existsSync(reportPath)) {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Record<
      string,
      Verdict
    >
  }
  return {}
}

export function saveReport(report: Record<string, Verdict>) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`)
}
