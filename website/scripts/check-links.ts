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
// checked; external URLs, mailto: and tel: are skipped. `#fragment` targets are
// validated too, against the ids the target page emitted — a renamed heading
// changes its slug, and a cross-page `/docs/page#anchor` written against the old
// one still resolves to a real page, so nothing else here would catch it.
// Run: `pnpm check-links`.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  assertBaseMatches,
  isFile,
  reportProblems,
  walkFiles,
} from './check-utils.ts'
import { distDir } from './paths.ts'

const BASE = process.env.SITE_BASE_PATH || '/jb2'

// The file dist emitted for a site-absolute path (already stripped of BASE,
// hash, query), or undefined. Don't guess page-vs-asset by extension —
// version-number routes like `.../v1.3.3/` look like a `.3` asset. Just test
// both shapes: a static file at the path, or a `<route>/index.html` page
// (trailingSlash:always).
function resolveFile(sitePath: string): string | undefined {
  const clean = sitePath.replace(/\/+$/, '')
  const candidates =
    clean === ''
      ? [join(distDir, 'index.html')]
      : [
          join(distDir, clean, 'index.html'),
          join(distDir, clean),
          join(distDir, `${clean}.html`),
        ]
  return candidates.find(isFile)
}

const ATTR = /(?:href|src)="([^"]*)"/g
const ID_ATTR = /\b(?:id|name)="([^"]+)"/g

// Anchor targets a page offers. Read from the RAW html, scripts included: an id
// this misses turns a working `#fragment` into a reported break, while an extra
// one only makes the check quieter, so err toward finding too many.
const idCache = new Map<string, Set<string>>()
function pageIds(htmlPath: string) {
  let ids = idCache.get(htmlPath)
  if (!ids) {
    ids = new Set(
      [...readFileSync(htmlPath, 'utf8').matchAll(ID_ATTR)].map(m => m[1]!),
    )
    idCache.set(htmlPath, ids)
  }
  return ids
}

// A fragment written into an href may be percent-encoded where the id it names
// is not, so a target counts as found under either spelling.
function hasAnchor(htmlPath: string, fragment: string) {
  const ids = pageIds(htmlPath)
  if (ids.has(fragment)) {
    return true
  }
  try {
    return ids.has(decodeURIComponent(fragment))
  } catch {
    return false
  }
}

interface Problem {
  file: string
  link: string
  // the page resolved but its `#fragment` names no id on it — a link that lands
  // on the right page at the wrong place, which reads as working until you
  // follow it. This is the class a heading rename creates.
  anchor?: boolean
}

function isExternal(url: string) {
  return (
    /^[a-z]+:/i.test(url) || // http:, https:, mailto:, tel:, data:, javascript:
    url.startsWith('//') || // protocol-relative
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
    const hash = raw.indexOf('#')
    const fragment = hash === -1 ? '' : raw.slice(hash + 1)
    const beforeHash = hash === -1 ? raw : raw.slice(0, hash)
    // A bare `#fragment` is this page's own anchor, so it has a target to check;
    // a bare `#` is a placeholder href and has none.
    const samePage = beforeHash === '' && fragment !== ''
    if (isExternal(beforeHash) && !samePage) {
      continue
    }
    // Strip the query before resolving to a file.
    const url = beforeHash.replace(/\?.*$/, '')
    // Base-prefixed absolute links (the norm after rehype-base-urls); anything
    // else absolute lives outside our BASE and can't be resolved locally.
    let target: string | undefined
    if (samePage) {
      target = htmlPath
    } else if (url.startsWith(`${BASE}/`) || url === BASE) {
      target = resolveFile(url.slice(BASE.length))
    } else if (url.startsWith('/')) {
      // Absolute but not under BASE — a real 404 in a based deploy.
      problems.push({ file: htmlPath, link: raw })
      continue
    } else {
      // Relative link — resolve against this page's directory.
      const pageRoute = dirname(htmlPath).slice(distDir.length)
      target = resolveFile(join(pageRoute, url))
    }
    if (!target) {
      problems.push({ file: htmlPath, link: raw })
    } else if (
      fragment !== '' &&
      target.endsWith('.html') &&
      !hasAnchor(target, fragment)
    ) {
      problems.push({ file: htmlPath, link: raw, anchor: true })
    }
  }
  return problems
}

if (!isFile(join(distDir, 'index.html'))) {
  console.error('dist/ not found or empty — run `pnpm build` first.')
  process.exit(1)
}
assertBaseMatches(distDir, BASE)

const problems = walkFiles(distDir, name => name.endsWith('.html')).flatMap(
  checkFile,
)

// Reported apart, because they are different repairs: a dead page means the
// link's target moved or was never emitted, a dead anchor means the page is
// right and the heading it points into was renamed.
const errorLines: string[] = []
for (const [anchor, label] of [
  [false, 'broken internal link(s)'],
  [true, 'link(s) to a missing #anchor'],
] as const) {
  const group = problems.filter(p => !!p.anchor === anchor)
  if (group.length === 0) {
    continue
  }
  const byFile = new Map<string, string[]>()
  for (const p of group) {
    const rel = p.file.slice(distDir.length + 1)
    const links = byFile.get(rel)
    if (links) {
      links.push(p.link)
    } else {
      byFile.set(rel, [p.link])
    }
  }
  errorLines.push(`Found ${group.length} ${label}:\n`)
  for (const [file, links] of byFile) {
    errorLines.push(`  ${file}`)
    for (const link of links) {
      errorLines.push(`    → ${link}`)
    }
  }
  errorLines.push('')
}
reportProblems(errorLines, 'All internal links and #anchors resolve.')
