// Validates the cross-references between docs and code that can go stale
// silently. The list below is the count; don't restate its length in this line,
// which said "four kinds" against five entries the day a section heading in
// ARCHITECTURAL_LIMITS.md was found asserting "five places" over a list of six.
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
//   4. Every relative markdown link between docs (`](../ARCHITECTURE.md#x)`),
//      the same check as 3 for the way agent-docs actually cross-links itself.
//      Its CLAUDE.md warns that other docs cite sections by title and to rename
//      one only after grepping — which is a rule that wants a checker.
//   5. Every backticked identifier in developer-guide and ARCHITECTURE.md prose
//      — `PascalCase`, or `camelCase` with an internal capital — checked to
//      appear somewhere in source. Catches a symbol renamed out from under the
//      prose (e.g. `AlignmentsFeatureDetailWidget` for what is really
//      `AlignmentsFeatureWidget`, or `renderProps` for a method deleted with the
//      server-side block system) — the fence checks above can't see prose, and
//      `sync-doc-snippets` only guards fences that opted into an include.
//   6. Every section citation by quoted title — `ARCHITECTURE.md §"Display
//      stacks"` (a real one: this comment is inside the scan) —
//      checked so a heading still starts with the quoted text. This is the
//      checker 4 asks for, and the only reference that runs *from* code *into*
//      the docs, so it scans source as well as docs.
//
// They are all the same failure — a plausible-looking reference that no longer
// resolves — and nothing else in CI reads doc code fences, prose paths, blob or
// relative anchors, prose symbols, or section citations. Scans both the website
// guides (website/docs) and the agent-docs knowledge base.
//
// Only workspace-local `@jbrowse/*` specifiers are checked; third-party and
// out-of-workspace scopes are skipped, as are relative imports. Path references
// are only held to account when their package anchor is real, so illustrative
// placeholder paths pass. Run: `pnpm check-doc-imports`.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { isFile, reportProblems, walkFiles } from './check-utils.ts'
import { CODE_FENCE_LANGS, FENCE } from './docFenceRegions.ts'
import { docRelative, docsDir, repoRoot } from './paths.ts'

// The agent-docs knowledge base (ARCHITECTURE.md et al.) is where architecture
// prose accumulates the most path/symbol drift as code moves between packages —
// scan it with the same checks as the website guides.
const agentDocsDir = join(repoRoot, 'agent-docs')

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
    const abs = join(repoRoot, base)
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
  // Bundler query suffixes (`?worker`, `?raw`, `?url`) are Vite's, not part of
  // the package's exports map — the embedded docs' worker snippet imports
  // `.../esm/rpcWorker?worker`, which resolves to the plain `./esm/rpcWorker`
  // export. Strip it before matching so the real subpath is what gets checked.
  const specifierPath = specifier.split('?')[0]!
  const m = /^(@[^/]+\/[^/]+)(\/.*)?$/.exec(specifierPath)
  const pkgName = m ? m[1] : specifierPath
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

const IMPORT_FROM = /(?:from|import)\s+['"]([^'"]+)['"]/g

function scanImports(path: string, lines: string[]): Problem[] {
  const problems: Problem[] = []
  let inCode = false
  lines.forEach((line, i) => {
    const fence = FENCE.exec(line)
    if (fence) {
      // Any ``` line closes an open block; only a known code language opens one
      // (so ```slang / ```bash / ```text blocks are skipped entirely).
      inCode = inCode ? false : CODE_FENCE_LANGS.has(fence[1]!.toLowerCase())
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
    statSync(join(repoRoot, rel))
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
      // A path inside `git show <rev>:<path>` names a file at that revision,
      // and the interesting ones are precisely the deleted files a doc is
      // pointing at because they no longer exist — an ADR that a later commit
      // removed, say. Resolving it against the worktree asks the wrong
      // question, and the alternative is to stop citing the reasoning behind a
      // decision once its file is gone.
      if (/git show \S*:$/.test(line.slice(0, match.index))) {
        continue
      }
      const ref = match[0].replace(/[./]+$/, '')
      // A path INTO build output is absent by definition on a fresh checkout —
      // these directories are gitignored, so CI has none of them and a developer
      // has whichever ones they last built. Holding such a path to account asks
      // the machine-dependent question, and the docs that name one are naming it
      // precisely to say a fresh worktree has not built it. Same reasoning as
      // BUILD_DIRS on the symbol side, where a stale local `esm/` made the
      // checker disagree with CI about whether a reference resolved.
      if (ref.split('/').some(seg => BUILD_DIRS.has(seg))) {
        continue
      }
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
        !headingSlugs(join(repoRoot, ref)).has(anchor)
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

// A relative markdown link between two docs in the same tree —
// `[text](reference/FOO.md#some-heading)`, `[text](../ARCHITECTURE.md#x)` — held
// to the same standard as the GitHub blob links above. It is the *same* check
// with a different way of naming the target, and it was the half not covered:
// the agent-docs knowledge base cross-links itself relatively rather than
// through github.com, and its own CLAUDE.md warns that "other docs and a few
// source comments cite their sections by title — rename one only after grepping
// for it", which is precisely a rule that wants a checker rather than a
// reminder. ARCHITECTURE.md pointed at
// `ARCHITECTURAL_LIMITS.md#ordering-is-the-contract-in-five-places` for as long
// as it took someone to shorten that heading.
//
// Resolved against the linking doc's own directory, and only for targets inside
// the repo. Anything that escapes the tree, or is a URL, is left alone.
const RELATIVE_MD =
  /\]\((\.{0,2}\/?[A-Za-z0-9_./-]*\.mdx?)(#[A-Za-z0-9._-]+)?\)/g

function scanRelativeAnchors(path: string, lines: string[]): Problem[] {
  const problems: Problem[] = []
  const dir = dirname(path)
  lines.forEach((line, i) => {
    for (const match of line.matchAll(RELATIVE_MD)) {
      const target = resolve(dir, match[1]!)
      const anchor = match[2]?.slice(1).toLowerCase()
      const shown = `${match[1]}${match[2] ?? ''}`
      if (!target.startsWith(repoRoot)) {
        continue
      }
      if (!isFile(target)) {
        problems.push({
          file: path,
          line: i + 1,
          specifier: shown,
          reason: `linked doc does not exist`,
        })
      } else if (anchor && !headingSlugs(target).has(anchor)) {
        problems.push({
          file: path,
          line: i + 1,
          specifier: shown,
          reason: `no heading in ${match[1]} slugifies to "#${anchor}"`,
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
// Scoped to developer_guides plus agent-docs/ARCHITECTURE.md: the tutorials and
// FAQ are full of gene symbols (`CDKN2A`), accession IDs, and third-party type
// names that legitimately don't appear in this repo. The rest of agent-docs is
// exempt because HISTORICAL.md and the ADRs deliberately record superseded
// names — but ARCHITECTURE.md declares itself the canonical *current* spec, so
// that exemption is the opposite of what it wants. It named `renderProps` as
// the live precedent for the `rpcProps()`/`gpuProps()` super-capture pattern
// for however long after the server-side block system that owned `renderProps`
// was deleted, because a camelCase claim matched no pattern here.
//
// agent-docs/reference/ was scanned once to see whether the exemption should be
// narrowed per-doc, and it should not. Of the identifiers it names that no
// source file has, all but three were deliberate — "the retired
// `FeatureRendererType` path", "`BaseLinearDisplayComponent` ... are all gone",
// "the deleted machinery (`userByteLimit`, `resolveForceLoadLimits`, ...)",
// `hasRects`/`hasLines` offered as the shape a renderer must NOT cache. That
// "it used to be X, and here is why it isn't" idiom is most of what those docs
// are *for*, so an allowlist would grow past the drift it catches, one entry per
// sentence. The three that were real drift (a chord component, a clustering
// action, a context-menu anchor — each also wrong about more than its name) were
// fixed directly. Re-run the scan after a big refactor rather than wiring it up.
const SYMBOL_DIRS = [join(docsDir, 'developer_guides')]
const SYMBOL_FILES = new Set([join(repoRoot, 'agent-docs', 'ARCHITECTURE.md')])
// Every CLAUDE.md is symbol-checked too — see claudeDocs() below for why, and
// for the baseline. They describe current practice by definition, so the
// "records superseded names on purpose" exemption that keeps reference/ out
// does not apply to them.
const isClaudeDoc = (path: string) => path.endsWith('/CLAUDE.md')
// PascalCase, plus camelCase with an internal capital. The internal capital is
// what keeps this from flagging ordinary backticked prose (`true`, `undefined`,
// `error`) while still catching `renderProps`, `canvasWidthPx`, `isCacheValid`.
//
// The name may close on a backtick OR an open paren, because these docs write a
// method as `foo()` at least as often as `foo` — 153 references in the checked
// scope take the call shape, and requiring the backtick made the checker blind
// to every one of them. That is not hypothetical: the data-fetching guide
// published a method name for the byte gate's while-blocked re-measure that no
// such method has ever had, while REGION_TOO_LARGE.md explained at length why
// that path deliberately doesn't exist, and this check ran over the guide the
// whole time. No allowlist entry was needed to close it — every call-shaped
// reference in scope resolved once that one was fixed.
//
// Deliberately without the offending name: `collectSymbols` walks
// `website/scripts`, so a source comment here that spelled it would add it to
// the symbol set and whitelist it in every doc, repo-wide and invisibly. That
// applies to any comment anywhere under the collected roots — `DOC_ABSENT_ON_PURPOSE`
// is the supported way for a *doc* to name something gone, and there is no
// equivalent escape for source, because source naming a dead symbol is the
// thing this check has no way to tell apart from source defining a live one.
const TICKED_SYMBOL =
  /`([A-Z][A-Za-z0-9]{4,}|[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)[`(]/g
// Two placeholder conventions, both standing in for a name the reader supplies:
// `My*` in the guides (`MyAdapterConfig`, `MyPlugin`), and `Xxx` as an infix in
// the architecture spec, where a rule holds across a family of per-plugin
// symbols (`GpuXxxRenderer`, `drawXxxToCtx`, `XxxSvgBody`).
const PLACEHOLDER = /^My[A-Z]|Xxx/
// Symbols a doc names in order to say they are *gone* or must not be written.
// Their absence from the tree is the claim, so absence must not fail the check.
// Keep each entry pinned to the sentence that needs it — if that sentence goes,
// so does the entry.
const DOC_ABSENT_ON_PURPOSE = new Set([
  // ARCHITECTURE.md §"Theme-derived render inputs are session getters": the
  // volatile-plus-useEffect shape it rules out, contrasted with the getter.
  'setColorPalette',
  // ARCHITECTURE.md §"`rpcProps()` / `gpuProps()` pattern": names the removed
  // server-side-block predecessor precisely to stop the next reader grepping
  // for it. It was a live-precedent claim here until 2026-08.
  'renderProps',
  // packages/app-core/CLAUDE.md, "It is also the only 'arrange the panels like
  // this' channel": names the volatile second channel that was deleted, in the
  // past tense, so the reader doesn't go looking for it.
  'pendingMove',
  // packages/app-core/CLAUDE.md, "This replaced a try/finally flag": names the
  // suppression flag dockview's mutation brackets made unnecessary, and says
  // not to reintroduce one. The name is the thing a reader would otherwise
  // grep for.
  'withSuppressedPanelRemoval',
  // packages/app-core/CLAUDE.md, "If you are reading an old comment or commit
  // that talks about ... all of it is gone": the layout-echo comparison that
  // went with dockview. Its sentence-mate above is here for the same reason,
  // and a doc whose whole purpose is to list departed names is the one place
  // naming an absent symbol is the point rather than a mistake.
  'layoutsEqual',
])

// Symbols belonging to a DEPENDENCY, named because our behaviour turns on
// theirs. Absent from our tree by definition, and unlike DOC_ABSENT_ON_PURPOSE
// the claim is that they exist — just not here. Kept separate so the two
// reasons stay legible: an entry moving between the sets would mean something
// quite different.
//
// Deliberately small. A doc naming an upstream symbol is usually better off
// quoting the behaviour than the identifier; the ones here are cases where the
// identifier is the evidence, because a reader checking the claim has to find
// it in node_modules.
const DOC_THIRD_PARTY = new Set([
  // packages/app-core/CLAUDE.md, "the one method upstream does not wrap in
  // `withOrigin('api')`": dockview's own internal wrapper, and the asymmetry is
  // the caveat that section exists to record.
  'withOrigin',
  // products/jbrowse-build-your-own/examples-site/CLAUDE.md: a rolldown config
  // key, named because that section records what happened when the lever was
  // pulled (104 KB a page worse) so nobody pulls it again. Naming the option is
  // the whole point of the note, and it is not ours to define.
  'advancedChunks',
])

// Build output, which must not contribute symbols. `esm/` holds a `.d.ts` per
// module and so matched the old `.tsx?$` filter: a symbol deleted from `src/`
// went on "existing" in a stale local build, and — since these are gitignored —
// CI, which has no build at all, disagreed with the developer's machine about
// whether a doc reference resolved. The set is now a pure function of `src/`.
const BUILD_DIRS = new Set(['node_modules', 'dist', 'esm', 'cjs', 'build'])

function collectSymbols() {
  const set = new Set<string>()
  // Not just .ts/.tsx. A doc naming a shader entry point (`screenToClip`,
  // `bpToLinear` — the architecture spec's shader section invites exactly that)
  // or a build/probe script's export would otherwise be reported as a dead
  // symbol claim, which reads as a checker bug and gets the line deleted rather
  // than the name fixed. The set only ever answers "does this exist anywhere",
  // so a wider net over real sources costs nothing but the read.
  const isSource = (name: string) => /\.(tsx?|jsx?|mjs|cjs|slang)$/.test(name)
  const add = (file: string) => {
    for (const m of readFileSync(file, 'utf8').matchAll(
      /\b(?:[A-Z][A-Za-z0-9]{4,}|[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)\b/g,
    )) {
      set.add(m[0])
    }
  }
  // `scripts` and `website/scripts` are in here for the same reason as the root
  // config below: a doc naming a generator's marker (`GOTCHA`) or a build
  // script's export is making a real reference, and the tooling is simply not
  // under a workspace directory.
  for (const base of [
    'packages',
    'plugins',
    'products',
    'example-plugins',
    'scripts',
    'website/scripts',
  ]) {
    for (const file of walkFiles(join(repoRoot, base), isSource, BUILD_DIRS)) {
      add(file)
    }
  }
  // Repo-root tooling config, non-recursively. A doc that tells you to add an
  // entry to `jest.config.js` names its keys (`testMatch`,
  // `collectCoverageFrom`), and those are real references — they just don't
  // live under a workspace directory. Without this the check calls them dead
  // and the honest fix looks like deleting the sentence.
  for (const name of readdirSync(repoRoot)) {
    if (isSource(name) || name.endsWith('.json')) {
      const file = join(repoRoot, name)
      if (isFile(file)) {
        add(file)
      }
    }
  }
  return set
}

let symbolCache: Set<string> | undefined

function scanSymbols(path: string, lines: string[]): Problem[] {
  if (
    !SYMBOL_DIRS.some(d => path.startsWith(d)) &&
    !SYMBOL_FILES.has(path) &&
    !isClaudeDoc(path)
  ) {
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
        if (
          !PLACEHOLDER.test(id) &&
          !DOC_ABSENT_ON_PURPOSE.has(id) &&
          !DOC_THIRD_PARTY.has(id) &&
          !symbolCache!.has(id)
        ) {
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

// A source comment or doc that cites a section by quoted title —
// `ARCHITECTURAL_LIMITS.md §"Ordering is the contract"` — is a link with no
// link syntax, so checks 2 and 3 never see it and CI never notices when the
// heading is reworded. This is the one reference direction that was entirely
// unguarded, and it drifted: `assertDisplayContract.ts` cited "…, in four
// places" against a heading that had since said five, over a list of six.
//
// Numbers in a heading are the common way this happens, which is why the
// convention is now to keep a count out of any heading a citation can name.
const SECTION_CITE = /([\w./-]*\.md)\s*§\s*"([^"]+)"/g
// A citation may quote a stable prefix of a longer heading (`§"Synteny +
// dotplot"` for "Synteny + dotplot: window-relative Float32 cumulative-bp"), so
// prefix — not equality — is the test. Case, backticks and `*` emphasis are all
// noise: a citation reasonably drops them, as the one naming "The same disease
// rots the docs" does for a heading that italicizes *docs*. Underscores are
// left alone — they appear in identifiers, not as emphasis, in these headings.
function normalizeHeading(s: string) {
  return s.toLowerCase().replaceAll(/[`*]/g, '').replaceAll(/\s+/g, ' ').trim()
}

const headingTextCache = new Map<string, string[] | undefined>()

function headingTexts(absPath: string) {
  if (!headingTextCache.has(absPath)) {
    let texts: string[] | undefined
    try {
      texts = readFileSync(absPath, 'utf8')
        .split('\n')
        .map(l => /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(l)?.[1])
        .filter(t => t !== undefined)
        .map(normalizeHeading)
    } catch {
      texts = undefined // unreadable / missing — reported by the caller
    }
    headingTextCache.set(absPath, texts)
  }
  return headingTextCache.get(absPath)
}

// Resolve the doc a citation names. A path resolves from the repo root; a bare
// `CLAUDE.md` is the nearest one at or above the citing file (that is what a
// sibling-doc reference means); any other bare basename is looked up in
// agent-docs, which is where the cited knowledge base lives.
function resolveCitedDoc(ref: string, fromFile: string) {
  if (ref.includes('/')) {
    const abs = join(repoRoot, ref)
    return isFile(abs) ? abs : undefined
  }
  if (ref === 'CLAUDE.md') {
    for (let dir = fromFile; dir.includes('/');) {
      dir = dir.slice(0, dir.lastIndexOf('/'))
      const abs = join(dir, 'CLAUDE.md')
      if (isFile(abs)) {
        return abs
      }
      if (dir === repoRoot) {
        break
      }
    }
    return undefined
  }
  return walkFiles(agentDocsDir, name => name === ref)[0]
}

function scanSectionCites(path: string, lines: string[]): Problem[] {
  const problems: Problem[] = []
  const strip = (l: string) => l.replace(/^\s*(\/\/|\*|\/\*\*?)\s?/, '')
  lines.forEach((line, i) => {
    // A citation may wrap across two comment lines; only join when this line
    // opens a quote it doesn't close, so a single-line hit isn't matched twice.
    const opensUnclosed = /§\s*"[^"]*$/.test(line)
    const text = opensUnclosed
      ? `${strip(line)} ${strip(lines[i + 1] ?? '')}`
      : line
    for (const m of text.matchAll(SECTION_CITE)) {
      const ref = m[1]!
      const title = m[2]!
      const doc = resolveCitedDoc(ref, path)
      const problem = (reason: string) => {
        problems.push({
          file: path,
          line: i + 1,
          specifier: `${ref} §"${title}"`,
          reason,
        })
      }
      const texts = doc && headingTexts(doc)
      if (!texts) {
        problem(`cannot resolve the cited doc "${ref}"`)
      } else {
        const want = normalizeHeading(title)
        if (!texts.some(h => h.startsWith(want))) {
          problem(`no heading in ${ref} starts with "${title}"`)
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
    AUTOGEN_DIRS.has(docRelative(file).split('/')[0]!)
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

// The CLAUDE.md files scattered through packages/plugins/products. They are the
// highest-traffic docs in the tree — loaded into an agent's context by being in
// the directory, rather than opened deliberately — and until now the only ones
// nothing checked at all, since they live outside both website/docs and
// agent-docs. A stale name in one misleads every session that touches that
// directory, which is the worst reach-per-error ratio here.
//
// Scanned at a measured baseline of zero: 25 files, five apparent claims, all
// five legitimate (two jest config keys, a tsx option, an elided method name
// since written out in full, and one deliberate past-tense mention below).
function claudeDocs() {
  return ['packages', 'plugins', 'products', 'example-plugins'].flatMap(base =>
    walkFiles(join(repoRoot, base), n => n === 'CLAUDE.md', BUILD_DIRS),
  )
}

// Read each doc once; imports are checked everywhere, prose paths only in
// hand-written guides (autogen dirs embed GitHub blob URLs, not repo paths).
const isDoc = (name: string) => /\.mdx?$/.test(name)
const problems = [
  ...walkFiles(docsDir, isDoc),
  ...walkFiles(agentDocsDir, isDoc),
  ...claudeDocs(),
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
          ...scanRelativeAnchors(file, lines),
          ...scanSymbols(file, lines),
          ...scanSectionCites(file, lines),
        ]),
  ]
})

// Section citations are the one reference that points *from* the code *into*
// the docs, so this walk is over source rather than over docs. Cheap: the same
// tree collectSymbols already reads, and only files containing `§` are parsed.
// `esm/` and `dist/` are build output — they carry a stale copy of every
// comment until the next build, so checking them reports the previous edit.
//
// Same roots and the same net as collectSymbols, for the same stated reason: a
// citation in `eslint.config.mjs`, `scripts/` or `website/scripts/` is as real
// as one in a plugin, and the tooling is simply not under a workspace
// directory. The narrower `packages|plugins|products` × `.tsx?` version missed
// eight of them — including three in eslint.config.mjs pointing at an
// "SVG export pipeline" heading that has said "SVG export" for some time, and
// one in a generated file's source citing "The three readiness axes" against a
// heading that says two. `.py` is here because a pipeline script cites the
// graph reference; the parse is a substring test, so the language is irrelevant.
// BUILD_DIRS, not just the `/esm/`+`/dist/` test the narrow version used: with
// `.tsx?` only, a `node_modules` bundle could never match, so widening the
// extensions is what made the directory reachable. A storybook cache under
// products/ ships a bundled copy of a plugin's source comments, citation and
// all — reported against a `CLAUDE.md` that resolves to the wrong package.
const isSource = (name: string) => /\.(tsx?|jsx?|mjs|cjs|py)$/.test(name)
const isBuildOutput = (file: string) =>
  file.includes('/esm/') || file.includes('/dist/')
for (const base of [
  'packages',
  'plugins',
  'products',
  'example-plugins',
  'scripts',
  'website/scripts',
]) {
  for (const file of walkFiles(join(repoRoot, base), isSource, BUILD_DIRS)) {
    if (isBuildOutput(file)) {
      continue
    }
    const text = readFileSync(file, 'utf8')
    if (text.includes('§')) {
      problems.push(...scanSectionCites(file, text.split('\n')))
    }
  }
}
// Repo-root tooling config, non-recursively — the citation twin of the root
// scan collectSymbols does. `eslint.config.mjs` carries three citations in
// rule messages, which is the most read-by-a-human place one can be.
for (const name of readdirSync(repoRoot)) {
  const file = join(repoRoot, name)
  if (isSource(name) && isFile(file)) {
    const text = readFileSync(file, 'utf8')
    if (text.includes('§')) {
      problems.push(...scanSectionCites(file, text.split('\n')))
    }
  }
}

const errorLines: string[] = []
if (problems.length > 0) {
  errorLines.push(`Found ${problems.length} broken reference(s) in docs:\n`)
  for (const p of problems) {
    const rel = p.file.slice(repoRoot.length + 1)
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
