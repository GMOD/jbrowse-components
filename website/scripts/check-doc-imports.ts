// Validates two kinds of code references in the docs so they can't go stale:
//
//   1. Every `@jbrowse/*` import in a fenced code block, resolved against the
//      actual workspace package `exports` maps / on-disk files. Catches e.g. a
//      snippet importing `@jbrowse/core/gpu/renderBlock` when the module lives
//      at `@jbrowse/render-core/renderBlock`.
//   2. Every repo file-path reference in prose (`packages/...`, `plugins/...`,
//      `products/...`, `agent-docs/...`), checked to exist on disk. Catches a
//      path left behind when code moves (e.g. `packages/core/src/gpu`).
//
// Both are the same failure — a plausible-looking reference that no longer
// resolves — and nothing else in CI reads doc code fences or prose paths.
//
// Only workspace-local `@jbrowse/*` specifiers are checked; third-party and
// out-of-workspace scopes are skipped, as are relative imports. Path references
// are only held to account when their package anchor is real, so illustrative
// placeholder paths pass. Run: `pnpm check-doc-imports`.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..')
const docsDir = join(import.meta.dirname, '..', 'docs')

// Build name -> package-dir map from every workspace package.json.
function collectPackages(dirs: string[]) {
  const map = new Map<string, string>()
  for (const base of dirs) {
    const abs = join(root, base)
    for (const name of readdirSync(abs)) {
      const pkgDir = join(abs, name)
      const pkgJson = join(pkgDir, 'package.json')
      try {
        const { name: pkgName } = JSON.parse(readFileSync(pkgJson, 'utf8'))
        if (pkgName) {
          map.set(pkgName, pkgDir)
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
  return [...candidates, ...withIndex].some(p => {
    try {
      return statSync(p).isFile()
    } catch {
      return false
    }
  })
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

  const pkgDir = packages.get(pkgName!)
  if (!pkgDir) {
    return undefined // external / not in this workspace — can't validate
  }

  const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
  const exportsMap = pkgJson.exports

  if (exportsMap && typeof exportsMap === 'object') {
    if (!(subpath in exportsMap)) {
      return `"${subpath}" is not an export of ${pkgName}`
    }
    const target = exportTarget(exportsMap[subpath])
    if (target && !fileExists(join(pkgDir, target))) {
      return `${pkgName} maps "${subpath}" to "${target}" but that file is missing`
    }
    return undefined
  }

  // No exports map: resolve against main (bare) or src/<subpath>.
  const target =
    subpath === '.'
      ? join(pkgDir, pkgJson.main || 'index')
      : join(pkgDir, 'src', subpath.slice(2))
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

function scanFile(path: string): Problem[] {
  const problems: Problem[] = []
  const lines = readFileSync(path, 'utf8').split('\n')
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

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      return walk(full)
    }
    return /\.mdx?$/.test(entry.name) ? [full] : []
  })
}

// Repo file-path references in prose (e.g. `packages/core/src/gpu`) can go stale
// when code moves — the same class of bug as a broken import, but not an import
// so the check above can't see it. A path is only validated when its package
// "anchor" is a real directory; that lets illustrative placeholder paths like
// `plugins/myplugin/src/...` through while still flagging a moved real path.
const REPO_PATH = /(?:packages|plugins|products|agent-docs)\/[A-Za-z0-9_./-]+/g
const ANCHORED = new Set(['packages', 'plugins', 'products'])
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

function scanFilePaths(path: string): Problem[] {
  const problems: Problem[] = []
  const lines = readFileSync(path, 'utf8').split('\n')
  lines.forEach((line, i) => {
    for (const match of line.matchAll(REPO_PATH)) {
      const ref = match[0].replace(/[./]+$/, '')
      // Only hold a path to account when its package anchor really exists —
      // otherwise it's a placeholder/example path, not a live repo reference.
      if (repoPathExists(anchorOf(ref)!) && !repoPathExists(ref)) {
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

const allDocs = walk(docsDir)
const handwritten = allDocs.filter(
  f => !AUTOGEN_DIRS.has(f.slice(docsDir.length + 1).split('/')[0]!),
)

const problems = [
  ...allDocs.flatMap(scanFile),
  ...handwritten.flatMap(scanFilePaths),
]

if (problems.length > 0) {
  console.error(`Found ${problems.length} broken reference(s) in docs:\n`)
  for (const p of problems) {
    const rel = p.file.slice(root.length + 1)
    console.error(`  ${rel}:${p.line}`)
    console.error(`    ${p.specifier}`)
    console.error(`    → ${p.reason}\n`)
  }
  process.exit(1)
} else {
  console.log('All @jbrowse imports and repo paths in docs resolve.')
}
