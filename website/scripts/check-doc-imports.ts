// Validates four kinds of code references in the docs so they can't go stale:
//
//   1. Every `@jbrowse/*` import in a fenced code block, resolved against the
//      actual workspace package `exports` maps / on-disk files. Catches e.g. a
//      snippet importing `@jbrowse/core/gpu/renderBlock` when the module lives
//      at `@jbrowse/render-core/renderBlock`.
//   2. Every repo file-path reference in prose (`packages/...`, `plugins/...`,
//      `products/...`, `agent-docs/...`), checked to exist on disk. Catches a
//      path left behind when code moves (e.g. `packages/core/src/gpu`).
//   3. Every GitHub `blob/<ref>/<path>#<anchor>` link into this repo, checked so
//      the file exists and — when it's a markdown target — a heading slugifies
//      to the anchor. Catches a cross-doc deep link (e.g. the developer guides
//      pointing at `agent-docs/ARCHITECTURE.md#three-upload-patterns`, and the
//      reverse) left dangling by a renamed heading.
//   4. Every backticked `PascalCase` identifier in developer-guide prose,
//      checked to appear somewhere in source. Catches a symbol renamed out from
//      under the prose (e.g. `AlignmentsFeatureDetailWidget` for what is really
//      `AlignmentsFeatureWidget`, or `PluggableElement` for
//      `PluggableElementType`) — the fence checks above can't see prose, and
//      `sync-doc-snippets` only guards fences that opted into an include.
//
// All four are the same failure — a plausible-looking reference that no longer
// resolves — and nothing else in CI reads doc code fences, prose paths, blob
// anchors, or prose symbols. Scans both the website guides (website/docs) and
// the agent-docs knowledge base.
//
// Only workspace-local `@jbrowse/*` specifiers are checked; third-party and
// out-of-workspace scopes are skipped, as are relative imports. Path references
// are only held to account when their package anchor is real, so illustrative
// placeholder paths pass. Run: `pnpm check-doc-imports`.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { isFile, reportProblems, walkFiles } from './check-utils.ts'

const root = join(import.meta.dirname, '..', '..')
const docsDir = join(import.meta.dirname, '..', 'docs')
// The agent-docs knowledge base (ARCHITECTURE.md et al.) is where architecture
// prose accumulates the most path/symbol drift as code moves between packages —
// scan it with the same checks as the website guides.
const agentDocsDir = join(root, 'agent-docs')

interface PkgInfo {
  dir: string
  exports?: Record<string, unknown>
  main?: string
}

// Build name -> package-info map from every workspace package.json. The
// package.json is parsed once here so checkSpecifier never re-reads it.
function collectPackages(dirs: string[]) {
  const map = new Map<string, PkgInfo>()
  for (const base of dirs) {
    const abs = join(root, base)
    for (const name of readdirSync(abs)) {
      const pkgDir = join(abs, name)
      try {
        const pkg = JSON.parse(
          readFileSync(join(pkgDir, 'package.json'), 'utf8'),
        )
        if (pkg.name) {
          const exports =
            pkg.exports && typeof pkg.exports === 'object'
              ? pkg.exports
              : undefined
          map.set(pkg.name, { dir: pkgDir, exports, main: pkg.main })
        }
      } catch {
        // not a package dir, skip
      }
    }
  }
  return map
}

const packages = collectPackages(['packages', 'plugins', 'products'])

const CODE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '']

function fileExists(target: string) {
  const candidates = target.endsWith('/')
    ? []
    : CODE_EXTS.map(ext => target + ext)
  const withIndex = CODE_EXTS.filter(Boolean).map(ext =>
    join(target, `index${ext}`),
  )
  return [...candidates, ...withIndex].some(isFile)
}

// Pull the first string target out of an exports entry (string or conditional
// object like { types, import, default }).
function exportTarget(entry: unknown): string | undefined {
  if (typeof entry === 'string') {
    return entry
  }
  if (entry && typeof entry === 'object') {
    for (const key of ['import', 'default', 'require', 'types']) {
      const v = (entry as Record<string, unknown>)[key]
      if (typeof v === 'string') {
        return v
      }
    }
  }
  return undefined
}

interface Problem {
  file: string
  line: number
  specifier: string
  reason: string
}

// Returns a problem string if the specifier is a broken workspace import, or
// undefined if it resolves (or is external and thus skipped).
function checkSpecifier(specifier: string): string | undefined {
  const m = /^(@[^/]+\/[^/]+)(\/.*)?$/.exec(specifier)
  const pkgName = m ? m[1] : specifier
  const subpath = m?.[2] ? `.${m[2]}` : '.'

  const pkg = packages.get(pkgName!)
  if (!pkg) {
    return undefined // external / not in this workspace — can't validate
  }

  if (pkg.exports) {
    if (!(subpath in pkg.exports)) {
      return `"${subpath}" is not an export of ${pkgName}`
    }
    const target = exportTarget(pkg.exports[subpath])
    return target && !fileExists(join(pkg.dir, target))
      ? `${pkgName} maps "${subpath}" to "${target}" but that file is missing`
      : undefined
  }

  // No exports map: resolve against main (bare) or src/<subpath>.
  const target =
    subpath === '.'
      ? join(pkg.dir, pkg.main || 'index')
      : join(pkg.dir, 'src', subpath.slice(2))
  return fileExists(target)
    ? undefined
    : `cannot resolve "${specifier}" under ${pkgName}`
}

const FENCE = /^\s*```(\S*)/
const CODE_LANGS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'typescript',
  'javascript',
])
const IMPORT_FROM = /(?:from|import)\s+['"]([^'"]+)['"]/g

function scanImports(path: string, lines: string[]): Problem[] {
  const problems: Problem[] = []
  let inCode = false
  lines.forEach((line, i) => {
    const fence = FENCE.exec(line)
    if (fence) {
      // Any ``` line closes an open block; only a known code language opens one
      // (so ```slang / ```bash / ```text blocks are skipped entirely).
      inCode = inCode ? false : CODE_LANGS.has(fence[1]!.toLowerCase())
      return
    }
    if (inCode && line.includes('@jbrowse/')) {
      for (const match of line.matchAll(IMPORT_FROM)) {
        const spec = match[1]!
        if (spec.startsWith('@jbrowse/')) {
          const reason = checkSpecifier(spec)
          if (reason) {
            problems.push({
              file: path,
              line: i + 1,
              specifier: spec,
              reason,
            })
          }
        }
      }
    }
  })
  return problems
}

// Repo file-path references in prose (e.g. `packages/core/src/gpu`) can go stale
// when code moves — the same class of bug as a broken import, but not an import
// so the check above can't see it. A path is only validated when its package
// "anchor" is a real directory; that lets illustrative placeholder paths like
// `plugins/myplugin/src/...` through while still flagging a moved real path.
const REPO_PATH =
  /(?:packages|plugins|products|example-plugins|component_tests|agent-docs)\/[A-Za-z0-9_./-]+/g
const ANCHORED = new Set([
  'packages',
  'plugins',
  'products',
  'example-plugins',
  'component_tests',
])
// Autogenerated dirs are rebuilt from source and embed GitHub blob URLs, so we
// only path-check hand-written guides.
const AUTOGEN_DIRS = new Set(['config', 'models', 'api'])

function repoPathExists(rel: string) {
  try {
    statSync(join(root, rel))
    return true
  } catch {
    return false
  }
}

function anchorOf(p: string) {
  const segs = p.split('/')
  return ANCHORED.has(segs[0]!) ? segs.slice(0, 2).join('/') : segs[0]!
}

function scanFilePaths(path: string, lines: string[]): Problem[] {
  const problems: Problem[] = []
  lines.forEach((line, i) => {
    for (const match of line.matchAll(REPO_PATH)) {
      // `.../` is an explicit abbreviation marker, not a literal path segment.
      if (match[0].includes('...')) {
        continue
      }
      // A path embedded in a GitHub blob URL is owned by scanBlobAnchors (which
      // also validates its anchor); skip it here so it isn't reported twice.
      if (/\/blob\/[^/]+\/$/.test(line.slice(0, match.index))) {
        continue
      }
      const ref = match[0].replace(/[./]+$/, '')
      // Only hold a path to account when its package anchor really exists —
      // otherwise it's a placeholder/example path, not a live repo reference.
      if (repoPathExists(anchorOf(ref)) && !repoPathExists(ref)) {
        problems.push({
          file: path,
          line: i + 1,
          specifier: ref,
          reason: `path does not exist in the repo`,
        })
      }
    }
  })
  return problems
}

// GitHub's heading-anchor algorithm (github-slugger, ASCII subset): lowercase,
// drop html + punctuation (keeping word chars, spaces, hyphens), then spaces →
// hyphens with NO run-collapsing — so a heading with ` / ` yields a double
// hyphen. Matches what the guides link to.
function slugify(heading: string) {
  return heading
    .toLowerCase()
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll(/[^\w\s-]/g, '')
    .trim()
    .replaceAll(/\s/g, '-')
}

// Cache heading-slug sets so a doc linked many times is read once.
const slugCache = new Map<string, Set<string>>()

function headingSlugs(absPath: string): Set<string> {
  const cached = slugCache.get(absPath)
  if (cached) {
    return cached
  }
  const set = new Set<string>()
  const counts = new Map<string, number>()
  let inFence = false
  for (const line of readFileSync(absPath, 'utf8').split('\n')) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
    } else if (!inFence) {
      const m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
      if (m) {
        const base = slugify(m[2]!)
        const n = counts.get(base) ?? 0
        counts.set(base, n + 1)
        // github-slugger appends -1, -2 … to repeated slugs; the first keeps
        // the bare form.
        set.add(n === 0 ? base : `${base}-${n}`)
      }
    }
  }
  slugCache.set(absPath, set)
  return set
}

const MD_EXT = /\.mdx?$/
// GitHub blob links into this repo: capture the repo-relative path (the class
// excludes `#`, `)`, and quotes, so it stops cleanly) and an optional anchor.
const BLOB =
  /github\.com\/GMOD\/jbrowse-components\/blob\/[^/]+\/([A-Za-z0-9_./-]+)(#[A-Za-z0-9._-]+)?/g

function scanBlobAnchors(path: string, lines: string[]): Problem[] {
  const problems: Problem[] = []
  lines.forEach((line, i) => {
    for (const match of line.matchAll(BLOB)) {
      const ref = match[1]!.replace(/[./]+$/, '')
      const anchor = match[2]?.slice(1).toLowerCase()
      if (!repoPathExists(ref)) {
        problems.push({
          file: path,
          line: i + 1,
          specifier: `${ref}${match[2] ?? ''}`,
          reason: `linked repo file does not exist`,
        })
      } else if (
        anchor &&
        MD_EXT.test(ref) &&
        !headingSlugs(join(root, ref)).has(anchor)
      ) {
        problems.push({
          file: path,
          line: i + 1,
          specifier: `${ref}#${anchor}`,
          reason: `no heading in ${ref} slugifies to "#${anchor}"`,
        })
      }
    }
  })
  return problems
}

// A backticked PascalCase token in prose is almost always a symbol claim ("the
// `BaseFeatureWidget` base class"), and it goes stale silently when the symbol
// is renamed. Membership in the source-wide symbol set is a weak but very cheap
// test: it can't tell you the symbol is being described *correctly*, only that
// it still exists somewhere. That is enough to catch renames, which is the
// failure that actually happens.
//
// Scoped to developer_guides: the tutorials and FAQ are full of gene symbols
// (`CDKN2A`), accession IDs, and third-party type names that legitimately don't
// appear in this repo, and agent-docs deliberately records superseded names.
const SYMBOL_DIR = join(docsDir, 'developer_guides')
const TICKED_SYMBOL = /`([A-Z][A-Za-z0-9]{4,})`/g
// `My*` is the guides' placeholder convention (`MyAdapterConfig`, `MyPlugin`),
// standing in for a symbol the reader will name themselves.
const PLACEHOLDER = /^My[A-Z]/

function collectSymbols() {
  const set = new Set<string>()
  const isSource = (name: string) => /\.tsx?$/.test(name)
  for (const base of ['packages', 'plugins', 'products', 'example-plugins']) {
    for (const file of walkFiles(join(root, base), isSource)) {
      for (const m of readFileSync(file, 'utf8').matchAll(
        /\b[A-Z][A-Za-z0-9]{4,}\b/g,
      )) {
        set.add(m[0])
      }
    }
  }
  return set
}

let symbolCache: Set<string> | undefined

function scanSymbols(path: string, lines: string[]): Problem[] {
  if (!path.startsWith(SYMBOL_DIR)) {
    return []
  }
  symbolCache ??= collectSymbols()
  const problems: Problem[] = []
  let inCode = false
  lines.forEach((line, i) => {
    if (FENCE.test(line)) {
      inCode = !inCode
    } else if (!inCode) {
      for (const match of line.matchAll(TICKED_SYMBOL)) {
        const id = match[1]!
        if (!PLACEHOLDER.test(id) && !symbolCache!.has(id)) {
          problems.push({
            file: path,
            line: i + 1,
            specifier: id,
            reason: `no such identifier in packages/plugins/products/example-plugins`,
          })
        }
      }
    }
  })
  return problems
}

function isAutogen(file: string) {
  // Only website/docs has autogenerated subtrees; agent-docs is all hand-written.
  return (
    file.startsWith(docsDir) &&
    AUTOGEN_DIRS.has(file.slice(docsDir.length + 1).split('/')[0]!)
  )
}

// Point-in-time docs describe a proposed or historical layout rather than the
// current tree, so their paths/imports aren't held to resolve: RFCs / idea
// dumps / plans (forward-looking, proposed layouts) and ADRs (a decision as of
// when it was written — often pre-migration; rewriting one to chase moved code
// would falsify the record). Only docs describing the code as it stands today
// are checked.
function isPointInTimeDoc(file: string) {
  const name = file.slice(file.lastIndexOf('/') + 1)
  return (
    file.includes('/architecture-decision-records/') ||
    name.startsWith('RFC-') ||
    name === 'OTHER_IDEAS.md' ||
    name.endsWith('_PLAN.md')
  )
}

// Read each doc once; imports are checked everywhere, prose paths only in
// hand-written guides (autogen dirs embed GitHub blob URLs, not repo paths).
const isDoc = (name: string) => /\.mdx?$/.test(name)
const problems = [
  ...walkFiles(docsDir, isDoc),
  ...walkFiles(agentDocsDir, isDoc),
].flatMap(file => {
  if (isPointInTimeDoc(file)) {
    return []
  }
  const lines = readFileSync(file, 'utf8').split('\n')
  return [
    ...scanImports(file, lines),
    ...(isAutogen(file)
      ? []
      : [
          ...scanFilePaths(file, lines),
          ...scanBlobAnchors(file, lines),
          ...scanSymbols(file, lines),
        ]),
  ]
})

const errorLines: string[] = []
if (problems.length > 0) {
  errorLines.push(`Found ${problems.length} broken reference(s) in docs:\n`)
  for (const p of problems) {
    const rel = p.file.slice(root.length + 1)
    errorLines.push(
      `  ${rel}:${p.line}`,
      `    ${p.specifier}`,
      `    → ${p.reason}\n`,
    )
  }
}
reportProblems(
  errorLines,
  'All @jbrowse imports and repo paths in docs resolve.',
)
