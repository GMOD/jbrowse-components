// Single entry point for every generated-and-committed artifact.
//
//   pnpm autogen           rewrite everything
//   pnpm autogen --check   verify everything (what CI runs)
//   pnpm autogen gallery   limit to generators whose name contains 'gallery'
//   pnpm autogen --skip-figure-dependent   drop the three that read the figure
//                          corpus or figures.lock (see `figureDependent` below)
//
// CI used to list each generator as its own `run:` step, which meant a run
// reported only the FIRST stale artifact — fix it, push, discover the next.
// This runs all of them and reports every stale one at once, and gives the
// failure a single answer: `pnpm autogen`.
//
// --check prefers each generator's own read-only `--check`. An entry with no
// check mode (`diffPaths`) rewrites its output and diffs it instead, so
// --check is not side-effect free for those.

import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { figureRootPulled } from '../website/scripts/figure-paths.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const check = args.includes('--check')
const skipFigureDependent = args.includes('--skip-figure-dependent')
const filters = args.filter(a => !a.startsWith('--'))

interface Generator {
  // Shown in the summary, and what the failure line names.
  name: string
  argv: string[]
  // Set when the generator has no `--check`: run it, then diff these git
  // pathspecs. Globs are passed to git verbatim, not expanded by the shell.
  diffPaths?: string[]
  // Reads the figure corpus or figures.lock, so its answer is only CI's answer
  // when the two agree. `--skip-figure-dependent` drops these; the pre-push
  // hook passes it when `pnpm figures:check` says they don't, so it can still
  // REGENERATE the other twenty-two instead of degrading the whole run to a
  // report. Nothing DERIVED from a figure belongs in this list — those left
  // autogen entirely (see the tutorial-card note below).
  figureDependent?: boolean
  // Rewrite scheduling, which is decided by what a generator WRITES.
  //
  // `exclusive` rewrites a package.json. That file is not addressed to one
  // reader — every node process resolves modules through it — so it runs with
  // nothing else in flight rather than beside a process that would read it
  // half-written.
  //
  // `independent` writes only files no other generator writes OR READS, so it
  // runs alongside the ordered chain below instead of in line with it. The
  // entry's comment names its output. Everything without either flag splices
  // blocks into `website/docs` and `agent-docs`, where two generators
  // rewriting one page at once lose one of the two blocks, and so keeps this
  // list's order.
  exclusive?: boolean
  independent?: boolean
  // Generators whose OUTPUT this one reads, so a rewrite starts it only once
  // they have finished. Order in this list already says it for two chain
  // neighbours; this is for the pair the scheduler would otherwise run at once.
  needs?: string[]
  // A rewrite skips this generator when the named one is also running, because
  // that one redoes the whole job. `--check` still runs it: there it is what
  // names the stale artifact.
  redundantWith?: string
  // The figure corpus this generator needs on disk. When the worktree holds
  // none of what figures.lock lists under it, the generator is SKIPPED with a
  // warning instead of run — the asset-shaped version of verify.ts's
  // `optionalBinary`, and safe for the same reason: the input is absent, so
  // there is nothing here to be out of date against, and CI pulls figures so
  // the check still happens before merge.
  //
  // Narrow on purpose, because the alternative trades a false alarm for a
  // silent one. Figure bytes are gitignored and arrive via `pnpm figures:pull`,
  // so a fresh `git worktree add` has an EMPTY corpus and the two generators
  // below both failed on bytes nobody wrote — one of them by throwing, which
  // this runner then reported as staleness. A corpus holding even one figure is
  // an installed corpus: from there a missing file or a stale render fails
  // exactly as it did before.
  figureRoot?: string
}

const web = (script: string) => ['node', `website/scripts/${script}`]
const api = (script: string) => web(`api-docs/${script}`)

const GENERATORS: Generator[] = [
  {
    // Writes packages/core/package.json.
    name: 'core exports',
    argv: ['node', 'packages/core/scripts/generateExports.mjs'],
    exclusive: true,
  },
  {
    // The other half of the same job for the packages whose `exports` map is a
    // hand-curated allowlist rather than derived from usage: keeps
    // publishConfig in step with it, since only publishConfig is what an
    // installed consumer resolves against.
    name: 'publishConfig exports',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/generate-publish-exports.ts',
    ],
    exclusive: true,
  },
  {
    // The bring-your-own-overlays docs quote what the chrome layer costs. This
    // bundles both entry points for real so the claim is measured rather than
    // remembered, and the byo landing page imports the result from
    // scripts/chromeBundleSizes.json.
    name: 'chrome bundle sizes',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/measureChromeBundle.ts',
    ],
    independent: true,
  },
  {
    // Writes tsconfig.build.json and each package's tsconfig.build.esm.json.
    name: 'tsconfig references',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/generate-tsconfig-references.ts',
    ],
    independent: true,
  },
  {
    // Only component_tests/*/packed/ is uploaded to the component-test job,
    // which runs off a fresh checkout — so it installs from the *committed*
    // manifests and pack.ts's rewrite never reaches it. Without this, a new
    // cross-package dependency edge falls through to the npm registry for an
    // unpublished version and only surfaces when that job fails, one missing
    // name per run. Writes component_tests/*/package.json and their
    // pnpm-workspace.yaml.
    name: 'component-test pins',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/gen-component-test-pins.ts',
    ],
    independent: true,
  },
  {
    // Writes spec-recipe-unmapped.txt — and recipe-path-labels.ts, when an
    // exemption there has stopped covering anything — and on the way
    // round-trips every figure's jbrowse:// link through Desktop's
    // parseProtocolUrl and app-core's parseSessionSpecUrl. A broken link fails
    // either way; the list regenerates here so a new unmapped field is a
    // one-file commit rather than a docs check telling you which command to
    // run.
    name: 'spec recipe unmapped list',
    argv: web('check-spec-recipes.ts'),
    independent: true,
  },
  { name: 'guide indexes', argv: web('generate-guide-indexes.ts') },
  { name: 'ADR index', argv: web('generate-adr-index.ts') },
  {
    // Which doc embeds which diagram, off the docs themselves. diagrams.ts ties
    // a source to the figure it rendered and check-figure-refs.ts ties a doc to
    // the store, so between them a diagram can lose its last reader with every
    // gate green — this is the one that notices.
    name: 'diagram usage table',
    argv: web('gen-diagram-usage.ts'),
  },
  {
    // agent-docs/CLAUDE.md makes reading a directory's `description:` lines the
    // way to find the right doc, which meant opening all of them. This renders
    // them into one page per directory (reference/ and ideas/) and, more to the
    // point, fails when a doc carries no frontmatter — the convention was
    // previously enforced by nothing.
    name: 'doc indexes',
    argv: web('generate-doc-indexes.ts'),
  },
  {
    // agent-docs/TODO.md's three tables, from the entries under agent-docs/todo/.
    // Hand-maintained until 2026-08-27, guarded by a checker because two of the
    // columns are editorial — but an entry carries those judgements in its own
    // frontmatter now, so the table is derived and the checker is gone.
    name: 'backlog index',
    argv: web('generate-todo-index.ts'),
  },
  {
    // DISPLAYCHROME.md's adoption map, read off the DisplayType registrations.
    // The hand-maintained version was already short by one (LDTrackDisplay),
    // which is the same way the display-foundations table drifted before it
    // was generated. Covers both chromes: the on-screen one off `ReactComponent`
    // and `SvgChrome` off `stateModel`'s `renderSvg`, since the two drift apart.
    name: 'DisplayChrome adoption map',
    argv: web('generate-display-chrome-adoption.ts'),
  },
  {
    // ARCHITECTURE.md's display-hook table. The foundations and cross-cutting
    // tables answer "what did this display compose"; this one answers which
    // displays override which hook, i.e. which are sitting on a default — and
    // every one of those defaults keeps working while doing less, which is the
    // failure class the whole doc is organized around. It also asserts each
    // hook is still declared by the file owning its default, so a rename that
    // leaves consumers reading a name nothing declares fails here.
    name: 'display hook override table',
    argv: web('generate-display-hook-overrides.ts'),
  },
  {
    // ARCHITECTURE.md's slot-vs-property census, which argues that the config
    // slot is a display's default state home. It argued it with three pairs of
    // numbers typed into the prose until 2026-08, and they had already drifted:
    // alignments moved 45 -> 47 -> 48 -> 46 while the sentence still said 45.
    // No checker could see it — check-doc-imports resolves the identifiers a
    // doc names, never the counts it states about them, which is the gap this
    // closes for one section.
    name: 'display state census',
    argv: web('generate-display-state-census.ts'),
  },
  {
    // SVG_EXPORT.md's roster of who answers `dataCurrent` by signature compare.
    // Same gap as the census above, one doc over: the prose said HiC and LD
    // compared a viewport snapshot for weeks after they had stopped, and
    // `isDataCurrent`'s own JSDoc counted four callers when there were six.
    // Neither is reachable by check-doc-imports — it resolves the identifiers a
    // doc names, never the claims about how many, and `agent-docs/reference/`
    // is outside its scope besides.
    name: 'freshness signature census',
    argv: web('generate-freshness-census.ts'),
  },
  // Before the README is mirrored into the docs site, since this rewrites it.
  {
    name: 'jbrowse-img README commands',
    argv: web('sync-img-readme.ts'),
    figureDependent: true,
  },
  {
    // Mirrors the README's example images into website/static/img, so it reads
    // jbrowse-img's corpus as an input and throws naming the first absent one.
    name: 'jbrowse-img doc',
    argv: web('generate-img-doc.ts'),
    figureDependent: true,
    figureRoot: 'products/jbrowse-img/img',
  },
  { name: 'CLI doc', argv: web('generate-cli-doc.ts') },
  { name: 'jbrowse-capture doc', argv: web('generate-capture-doc.ts') },
  // Both write one file under website/src/lib and read no doc.
  {
    name: 'gallery links',
    argv: web('gen-gallery-links.ts'),
    independent: true,
  },
  { name: 'live links', argv: web('gen-live-links.ts'), independent: true },
  // The tutorial cards and homepage images used to be gated here. They are
  // cropped from other figures, so a figure republished without them left this
  // check failing on bytes nobody had written — the fix was always the same
  // mechanical regenerate-and-push. They are computed by `website`'s dev, build
  // and index now, and the store skips them (isDerivedFigure in
  // figure-store.ts). Nothing derived from a figure belongs in this list.
  {
    // The social card is NOT that: it is rendered from the wordmark outlines,
    // the inline logo paths and a handful of layout constants — all tracked in
    // git, none of them figures — so it can only go stale against a source this
    // same commit changed, and generating it at build would mean a headless
    // renderer in every website build. It had no script entry, no autogen entry
    // and no CI step before this — a by-hand `node
    // website/scripts/generate-og-image.ts` and the honour system.
    // It is figureDependent all the same: it writes a png into the corpus and
    // checks it against figures.lock, so it is stale exactly when the corpus is
    // ahead of the lock, which is the case the flag exists for.
    // And that is why it names a `figureRoot` too: its inputs are all tracked,
    // but the render it compares them against is a figure, so a corpus nobody
    // pulled leaves it reporting the one word regenerating cannot fix —
    // missing.
    name: 'social card image',
    argv: web('generate-og-image.ts'),
    independent: true,
    figureDependent: true,
    figureRoot: 'website/static/img',
  },
  { name: 'doc snippets', argv: web('sync-doc-snippets.ts') },
  {
    // The tables in the `agent-docs/` docs that own each measurement, rendered
    // from `agent-docs/measurements/<id>.json`. The head of the chain: before
    // this, a benchmark's numbers were typed into a doc by hand and no check
    // read them, so a re-measured arm left the ratio beside it describing the
    // previous run.
    name: 'measurement tables',
    argv: web('generate-measurement-tables.ts'),
  },
  {
    // The public optimizations page's copy of those tables. BELOW the entry
    // above, and the order is load-bearing: this one reads the doc tables that
    // one writes, so running it first publishes the previous render.
    name: 'published measurement tables',
    argv: web('sync-measurements.ts'),
  },
  {
    // The single values a sentence quotes out of one of those tables, spliced
    // in place. The table generators above cannot see this failure: prose
    // restating a cell goes stale when the table is regenerated, and
    // `check-quoted-figures` still finds the old figure in the doc it was
    // copied from. One of the three was already wrong when converted.
    name: 'inline figures',
    argv: web('sync-inline-figures.ts'),
  },
  {
    // The 28 `<!-- TABLE START -->` blocks spliced into the hand-written guides
    // and agent-docs. One entry, not one per table: each was its own `node`
    // process paying ~2.5s to load TypeScript before scanning, and gendocs
    // below then generated them all again.
    //
    // They keep an entry of their own for the reporting. gendocs' diff now
    // covers the same docs, but it can only say "config/model/api docs" — this
    // names the stale table, and `markers.ts <label>` narrows a development
    // loop to one of them. It is also the cheap half: one TypeScript load
    // against gendocs' whole-repo program.
    name: 'marker tables',
    argv: api('markers.ts'),
    redundantWith: 'config/model/api docs',
  },
  {
    // The adapter -> track type map the add-track guessers and `jbrowse
    // add-track` share, from the `#trackType` tag on each adapter's config
    // schema. The map used to be hand-written beside the format table, which is
    // the drift the table was extracted to end.
    name: 'adapter track type map',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/generateTrackTypeMap.ts',
    ],
    independent: true,
    diffPaths: ['packages/add-track-core/src/trackTypes.generated.ts'],
  },
  {
    // The config-slot manifest `jbrowse validate` checks against, read out of
    // the live ConfigurationSchema objects. It rides autogen so a new slot (or a
    // renamed one) can't leave the validator reporting a correct config as
    // broken — the failure that makes a checker worth ignoring. Also emits the
    // jbrowse-authoring skill's config-types.md index.
    //
    // Finishes BEFORE the doc generators below, which the `needs` on gendocs
    // says now that a rewrite no longer runs this list in one sequence:
    // generateConfigDocs reads the shorthand keys out of this manifest, so
    // generating it second would document the previous run's answer and leave
    // `pnpm autogen` needing two passes to settle after a normalizer changes.
    name: 'config schema manifest',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/generateConfigManifest.ts',
    ],
    independent: true,
    // It bundles the live source tree, add-track-core's generated map included.
    needs: ['adapter track type map'],
    diffPaths: [
      'products/jbrowse-cli/src/commands/validate/configManifest.generated.ts',
      '.claude/skills/jbrowse-authoring/references/config-types.md',
    ],
  },
  {
    // The whole of `website/docs` and `agent-docs`, not the generated
    // directories alone, because gendocs also rewrites the marker blocks
    // embedded in the hand-written guides (DISPLAY_TYPES, which needs the
    // whole-repo DisplayType scan generate.ts does, FILE_TYPES, and
    // PROMOTABLE_SLOTS in display_defaults.md).
    //
    // Anything gendocs can WRITE has to be listed here, and listing the
    // generated directories only was both halves of that wrong.
    // `DISPLAY_VIEW_TYPES` renders in `developer_guides/creating_display.md`
    // and needs the program, so it is not one of markers.ts's either: a stale
    // one passed `pnpm autogen --check` with the table in front of it naming a
    // view type nothing registers. And because `restore()` only puts back what
    // it diffed, that same --check REWROTE the file and left it rewritten —
    // the tree-dirtying its own comment exists to prevent.
    //
    // api-docs/coverage-gaps.txt is the doc-coverage list (missing #example,
    // a type that fell back to the General category, ...). It rides this same
    // diff so a type documented thinly shows up as a `+ Name` line in the PR
    // rather than as a console.warn nothing reads. Gaps the repo has driven to
    // zero graduate out of the list into a throw inside gendocs — an untagged
    // #slot, and a slot whose Description cell would render blank — since a
    // list regenerated by the same command that fixes it cannot hold a count at
    // zero.
    //
    // The `*/README.md` globs cover writeApiReadmes, which mirrors each
    // package's `#api` exports into its README between API_DOCS markers.
    name: 'config/model/api docs',
    argv: ['pnpm', 'gendocs'],
    // generateConfigDocs reads the shorthand keys out of the manifest.
    needs: ['config schema manifest'],
    diffPaths: [
      // the generated pages, plus every hand-written guide a marker block
      // landed in — including `urlparams.md`'s SPEC_KEYS blocks, what a session
      // spec may set on each view type, rendered from the views' own
      // declarations
      'website/docs',
      // the marker blocks in the architecture spec and the reference docs. The
      // marker-tables entry above gates their content; this is what keeps a
      // --check from leaving one rewritten.
      'agent-docs',
      'website/scripts/api-docs/coverage-gaps.txt',
      'packages/*/README.md',
      'plugins/*/README.md',
      'products/*/README.md',
    ],
  },
]

// V8's code cache, shared by every child below. Each of these is a fresh node
// compiling the same TypeScript module graphs from source, which is most of
// what the cheap ones cost at all. Nothing about what runs changes: a stale
// entry is recompiled and a missing directory is written on the first run.
const compileCache = join(root, 'node_modules/.cache/node-compile')

const childEnv = { ...process.env, NODE_COMPILE_CACHE: compileCache }

// Inherited stdio, so this lane's generator streams as it works. Async rather
// than spawnSync even though the lane is a sequence: spawnSync blocks the event
// loop, which leaves the pooled children beside it unread — their output fills
// a 64KB pipe nobody is draining and they stop there until the sequence ends.
function run(argv: string[], extra: string[] = []) {
  return new Promise<number | null>(resolve => {
    const child = spawn(argv[0]!, [...argv.slice(1), ...extra], {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: childEnv,
    })
    child.on('error', () => {
      resolve(1)
    })
    child.on('close', resolve)
  })
}

// The same, captured rather than inherited, for the pooled runs below — each
// one's output is held and printed whole when it finishes.
function runCaptured(argv: string[], extra: string[] = []) {
  return new Promise<{ status: number | null; output: string }>(resolve => {
    const child = spawn(argv[0]!, [...argv.slice(1), ...extra], {
      cwd: root,
      shell: process.platform === 'win32',
      env: childEnv,
    })
    let output = ''
    for (const stream of [child.stdout, child.stderr]) {
      stream.setEncoding('utf8')
      stream.on('data', (chunk: string) => {
        output += chunk
      })
    }
    child.on('error', e => {
      resolve({ status: 1, output: `${output}${String(e)}\n` })
    })
    child.on('close', status => {
      resolve({ status, output })
    })
  })
}

// Everything under `paths` that differs from HEAD, including files a generator
// just created (`git diff` alone would miss those).
function changedFiles(paths: string[]) {
  const git = (argv: string[]) =>
    spawnSync('git', [...argv, '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
    }).stdout.trim()
  return [
    ...git(['diff', '--name-only', 'HEAD']).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard']).split('\n'),
  ].filter(Boolean)
}

function showDiff(paths: string[]) {
  spawnSync('git', ['diff', '--stat', 'HEAD', '--', ...paths], {
    cwd: root,
    stdio: 'inherit',
  })
}

// Put back what a `--check` run dirtied, so a check leaves the tree as it found
// it. Only ever called with the files that were clean before the generator ran
// (`after` is computed by excluding `before`), so it cannot discard work that
// was already there.
//
// It CAN discard work that appears while it runs, and an untracked file it
// deletes outright — `before` is a snapshot taken when the generator starts. A
// doc written into `agent-docs/` during the gendocs step went that way, its
// index line reverted and the new file removed, which is the concrete form of
// "run `pnpm autogen` on a clean tree and let it finish".
//
// Without this, `--check` is a command that silently modifies the tree, and the
// modifications look exactly like your own: a `git add -A` after one sweeps
// regenerated docs into an unrelated commit. That happened three times in one
// session in this repo, twice caught only by reading `git status` carefully
// before committing. The tree-dirtying is inherent — a generator with no
// `--check` of its own has to write to be compared — but it does not have to
// survive the run.
function restore(paths: string[]) {
  if (paths.length === 0) {
    return
  }
  const tracked = new Set(
    spawnSync('git', ['ls-files', '--', ...paths], {
      cwd: root,
      encoding: 'utf8',
    })
      .stdout.trim()
      .split('\n')
      .filter(Boolean),
  )
  const known = paths.filter(p => tracked.has(p))
  if (known.length > 0) {
    spawnSync('git', ['checkout', 'HEAD', '--', ...known], { cwd: root })
  }
  for (const p of paths.filter(f => !tracked.has(f))) {
    rmSync(join(root, p), { force: true })
  }
}

// Two different outcomes, kept apart because the remedy is not the same. An
// artifact that is merely out of date is fixed by `pnpm autogen` and a commit.
// A generator that CRASHED produced nothing to commit, and telling someone to
// run it again and commit the result is advice that cannot work — which is
// exactly how one crash got reported onward as "the config manifest generator
// is broken" when the generator was fine and the tree it reads was mid-edit.
const stale: string[] = []
const skipped: string[] = []
const crashed: { name: string; status: number | null }[] = []
const eligible = skipFigureDependent
  ? GENERATORS.filter(g => !g.figureDependent)
  : GENERATORS
const selected =
  filters.length > 0
    ? eligible.filter(g => filters.some(f => g.name.includes(f)))
    : eligible

if (selected.length === 0) {
  console.error(`No generator matches ${filters.join(', ')}`)
  process.exit(1)
}

// Named, not counted: a silent skip reads as "everything is current".
if (skipFigureDependent) {
  console.log(
    `Skipping the figure-dependent generators: ${GENERATORS.filter(
      g => g.figureDependent,
    )
      .map(g => g.name)
      .join(', ')}`,
  )
}

const timings: { name: string; ms: number }[] = []

// A worktree with no corpus cannot answer this generator's question, and says
// so rather than reporting the absence as staleness.
function skipsForMissingFigures({ name, figureRoot }: Generator) {
  const missing = figureRoot !== undefined && !figureRootPulled(figureRoot)
  if (missing) {
    console.warn(
      `\n=== ${name}: SKIPPED — this worktree holds none of the figures ` +
        `figures.lock lists under ${figureRoot}. Figure bytes are gitignored: ` +
        `run \`pnpm figures:pull\`, or symlink the corpus, to check this one. ` +
        `CI pulls them, so it still runs before merge.`,
    )
    skipped.push(name)
  }
  return missing
}

// A rewrite skips a generator whose whole job another selected generator redoes
// (see `redundantWith`). Named rather than dropped silently: a run that says
// "regenerated" while a table was never written is what this file exists to
// prevent.
const superseded = check
  ? []
  : selected.filter(
      g =>
        g.redundantWith !== undefined &&
        selected.some(other => other.name === g.redundantWith),
    )
for (const { name, redundantWith } of superseded) {
  console.log(`Skipping ${name}: ${redundantWith} rewrites the same tables`)
}
const running = selected.filter(g => !superseded.includes(g))

const workers = Math.min(6, Math.max(1, availableParallelism() - 2))

// Run `queue` through `runOne`, `workers` at a time. A generator's `needs` name
// an entry earlier in the list, so a worker blocked on one is never blocked on
// one still queued behind it.
async function pool(
  queue: Generator[],
  runOne: (g: Generator) => Promise<void>,
) {
  const pending = [...queue]
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (pending.length > 0) {
        await runOne(pending.shift()!)
      }
    }),
  )
}

// One generator with its output streaming, for the lane where the order of the
// output is the order the work happened in.
async function runInline(generator: Generator) {
  const { name, argv, diffPaths } = generator
  if (!skipsForMissingFigures(generator)) {
    console.log(`\n=== ${name}`)
    const started = performance.now()
    if (diffPaths) {
      // A generator with no --check has to write to be compared, so anything
      // already modified when it started is not evidence of staleness — without
      // this, a local --check over a work-in-progress tree reports every
      // uncommitted doc edit. CI runs off a clean checkout, so `before` is empty
      // there and nothing is excluded.
      const before = new Set(check ? changedFiles(diffPaths) : [])
      const status = await run(argv)
      if (status !== 0) {
        crashed.push({ name, status })
      } else if (check) {
        const after = changedFiles(diffPaths).filter(f => !before.has(f))
        if (after.length > 0) {
          showDiff(after)
          stale.push(name)
        }
        // Unconditionally, not just when stale: a generator can rewrite a file
        // to byte-identical content and still leave it looking touched to
        // tooling that stats rather than diffs.
        restore(after)
      }
    } else if ((await run(argv, check ? ['--check'] : [])) !== 0) {
      stale.push(name)
    }
    timings.push({ name, ms: performance.now() - started })
  }
}

// One generator with its output captured and printed whole, for the pooled
// lanes: interleaved output from six processes at once is unreadable.
async function runPooled(generator: Generator, extra: string[] = []) {
  if (!skipsForMissingFigures(generator)) {
    const { name, argv, diffPaths } = generator
    const started = performance.now()
    const { status, output } = await runCaptured(argv, extra)
    if (status !== 0) {
      // A rewrite that exits nonzero produced nothing to commit; only a
      // generator that ran to completion can have left an artifact behind.
      if (diffPaths && !check) {
        crashed.push({ name, status })
      } else {
        stale.push(name)
      }
    }
    console.log(`\n=== ${name}\n${output}`.trimEnd())
    timings.push({ name, ms: performance.now() - started })
  }
}

// A generator with its own `--check` writes nothing, so in check mode there is
// nothing for one to race another over and they run pooled. The `diffPaths`
// ones write to be compared, so they stay in sequence AND stay after the pool:
// what they rewrite (the docs, the manifest) is what the pool reads.
async function checkAll() {
  await pool(
    running.filter(g => !g.diffPaths),
    generator => runPooled(generator, ['--check']),
  )
  for (const generator of running.filter(g => g.diffPaths)) {
    await runInline(generator)
  }
}

// A rewrite writes, so what runs beside what is decided by what each generator
// writes — `exclusive` and `independent` on the interface above say which is
// which. The exclusive ones go first, alone; then two lanes at once, the
// ordered doc chain and a pool of the generators writing nothing another one
// reads. This used to be one sequence, which meant the whole run waited on the
// chain.
async function rewriteAll() {
  const gate = new Map(
    running.map(g => [g.name, Promise.withResolvers<void>()]),
  )
  // A needed generator the filters left out of this run is not in `gate`, and
  // is nothing to wait for: it is not going to write anything either.
  const afterNeeds = async ({ needs = [] }: Generator) => {
    await Promise.all(
      needs.flatMap(name => {
        const gated = gate.get(name)
        return gated === undefined ? [] : [gated.promise]
      }),
    )
  }
  for (const generator of running.filter(g => g.exclusive)) {
    await afterNeeds(generator)
    await runInline(generator)
    gate.get(generator.name)!.resolve()
  }
  const rest = running.filter(g => !g.exclusive)
  await Promise.all([
    pool(
      rest.filter(g => g.independent),
      async generator => {
        await afterNeeds(generator)
        await runPooled(generator)
        gate.get(generator.name)!.resolve()
      },
    ),
    (async () => {
      for (const generator of rest.filter(g => !g.independent)) {
        await afterNeeds(generator)
        await runInline(generator)
        gate.get(generator.name)!.resolve()
      }
    })(),
  ])
}

await (check ? checkAll() : rewriteAll())

console.log('\ntimings (ms):')
for (const { name, ms } of [...timings].sort((a, b) => b.ms - a.ms)) {
  console.log(`  ${Math.round(ms).toString().padStart(6)}  ${name}`)
}
console.log(
  `  ${Math.round(timings.reduce((a, t) => a + t.ms, 0))
    .toString()
    .padStart(6)}  TOTAL`,
)

if (crashed.length > 0) {
  console.error(
    `\n${crashed.length} generator(s) did not run to completion:\n${crashed
      .map(c => `  - ${c.name} (exited ${c.status ?? 'on a signal'})`)
      .join('\n')}\n\n` +
      `Their diagnostic is above, inline. This is NOT a stale artifact and ` +
      `re-running will not help until the cause is fixed.\n` +
      `Some generators compile and execute the live source tree (the config ` +
      `schema manifest bundles every core plugin), so the usual cause is the ` +
      `tree itself: a syntax error, a half-finished edit, or a stale install ` +
      `after a dependency change. Check the tree builds before suspecting the ` +
      `generator.`,
  )
}
if (stale.length > 0) {
  const named = stale.map(n => `  - ${n}`).join('\n')
  console.error(
    check
      ? `\n${stale.length} generated artifact(s) out of date:\n${named}\n\nRun 'pnpm autogen' and commit the result.`
      : // A REWRITE that exits nonzero is a generator refusing to write, not an
        // artifact behind its sources — `pnpm autogen` is what just ran, so
        // reporting it as staleness sends someone round a loop that cannot
        // converge.
        `\n${stale.length} generator(s) refused to write:\n${named}\n\nEach one's reason is above, inline. Re-running will not clear it.`,
  )
}
if (crashed.length > 0 || stale.length > 0) {
  process.exit(1)
}

// Drops the nag the post-merge hook leaves for pre-commit to print. A clean run
// IS the condition it reports on, so clearing it anywhere else would be a
// second opinion about the same question.
//
// `-since` is the head that nag first fired at, which is what lets it age
// itself rather than restamp the newest land. It has to go with the nag: left
// behind, the next unrelated staleness inherits this one's age and reports
// itself as dozens of commits old on the land that introduced it.
const gitDir = spawnSync('git', ['rev-parse', '--git-common-dir'], {
  encoding: 'utf8',
})
if (gitDir.status === 0) {
  const dir = gitDir.stdout.trim()
  rmSync(join(dir, 'autogen-stale'), { force: true })
  rmSync(join(dir, 'autogen-stale-since'), { force: true })
}

// Named, not counted, for the reason the --skip-figure-dependent banner above
// is: a run that says "up to date" while two artifacts were never looked at is
// the silent failure this whole file exists to prevent.
console.log(
  (check ? '\nAll generated artifacts up to date' : '\nRegenerated') +
    (skipped.length > 0 ? ` (skipped: ${skipped.join(', ')})` : ''),
)
