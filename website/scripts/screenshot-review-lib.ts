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

export function findUsages(name: string): DocUsage[] {
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
