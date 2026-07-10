// Validates every internal link in the *built* site so a moved/renamed page or
// a typo'd cross-link can't ship as a 404. The docs use a lot of hand-written
// cross-links, and the content loader lowercases/remaps ids (see
// src/content.config.ts) — `astro build` happily emits a dangling href, and
// nothing else checks that the target actually exists.
//
// This is the fast *local* equivalent of the CI link check — push.yml runs
// untitaker/hyperlink over the built site (with --check-anchors), which is more
// thorough but only convenient in CI. Run `pnpm build && pnpm check-links` to
// catch a dangling href before pushing.
//
// Operates on `dist/` (run `pnpm build` first). Only internal links are
// checked; external URLs, mailto:, tel:, and pure `#fragment` anchors are
// skipped. Fragment *targets* within a page are not validated — only that the
// page itself was emitted. Run: `pnpm check-links`.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { isFile, reportProblems, walkFiles } from './check-utils.ts'

const distDir = join(import.meta.dirname, '..', 'dist')
const BASE = process.env.SITE_BASE_PATH || '/jb2'

// A site-absolute path (already stripped of BASE, hash, query) resolves if dist
// emitted a file for it. Don't guess page-vs-asset by extension — version-number
// routes like `.../v1.3.3/` look like a `.3` asset. Just test both shapes: a
// static file at the path, or a `<route>/index.html` page (trailingSlash:always).
function resolves(sitePath: string) {
  const clean = sitePath.replace(/\/+$/, '')
  if (clean === '') {
    return isFile(join(distDir, 'index.html'))
  }
  return (
    isFile(join(distDir, clean, 'index.html')) ||
    isFile(join(distDir, clean)) ||
    isFile(join(distDir, `${clean}.html`))
  )
}

const ATTR = /(?:href|src)="([^"]*)"/g

interface Problem {
  file: string
  link: string
}

function isExternal(url: string) {
  return (
    /^[a-z]+:/i.test(url) || // http:, https:, mailto:, tel:, data:, javascript:
    url.startsWith('//') || // protocol-relative
    url.startsWith('#') || // in-page anchor
    url === ''
  )
}

function checkFile(htmlPath: string): Problem[] {
  // Drop <script>/<style> bodies first: inlined JS/CSS can contain href=/src=
  // inside string templates (e.g. the search page's `<a href="${item.url}">`),
  // which aren't real document links.
  const html = readFileSync(htmlPath, 'utf8').replaceAll(
    /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,
    '',
  )
  const problems: Problem[] = []
  for (const match of html.matchAll(ATTR)) {
    const raw = match[1]!
    if (isExternal(raw)) {
      continue
    }
    // Strip hash + query before resolving to a file.
    const url = raw.replace(/[#?].*$/, '')
    // Base-prefixed absolute links (the norm after rehype-base-urls); anything
    // else absolute lives outside our BASE and can't be resolved locally.
    let sitePath: string
    if (url.startsWith(`${BASE}/`) || url === BASE) {
      sitePath = url.slice(BASE.length)
    } else if (url.startsWith('/')) {
      // Absolute but not under BASE — a real 404 in a based deploy.
      problems.push({ file: htmlPath, link: raw })
      continue
    } else {
      // Relative link — resolve against this page's directory.
      const pageRoute = dirname(htmlPath).slice(distDir.length)
      sitePath = join(pageRoute, url)
    }
    if (!resolves(sitePath)) {
      problems.push({ file: htmlPath, link: raw })
    }
  }
  return problems
}

if (!isFile(join(distDir, 'index.html'))) {
  console.error('dist/ not found or empty — run `pnpm build` first.')
  process.exit(1)
}

const problems = walkFiles(distDir, name => name.endsWith('.html')).flatMap(
  checkFile,
)

const errorLines: string[] = []
if (problems.length > 0) {
  const byFile = new Map<string, string[]>()
  for (const p of problems) {
    const rel = p.file.slice(distDir.length + 1)
    byFile.set(rel, [...(byFile.get(rel) ?? []), p.link])
  }
  errorLines.push(`Found ${problems.length} broken internal link(s):\n`)
  for (const [file, links] of byFile) {
    errorLines.push(`  ${file}`)
    for (const link of links) {
      errorLines.push(`    → ${link}`)
    }
  }
}
reportProblems(errorLines, 'All internal links resolve.')
