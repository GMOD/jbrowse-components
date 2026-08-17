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

import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  // REGENERATE the other fifteen instead of degrading the whole run to a
  // report. Nothing DERIVED from a figure belongs in this list — those left
  // autogen entirely (see the tutorial-card note below).
  figureDependent?: boolean
}

const web = (script: string) => ['node', `website/scripts/${script}`]
const api = (script: string) => web(`api-docs/${script}`)

const GENERATORS: Generator[] = [
  {
    name: 'core exports',
    argv: ['node', 'packages/core/scripts/generateExports.mjs'],
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
  },
  {
    // The bring-your-own-overlays docs quote what the chrome layer costs. This
    // bundles both entry points for real so the claim is measured rather than
    // remembered, and the byo landing page imports the result.
    name: 'chrome bundle sizes',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/measureChromeBundle.ts',
    ],
  },
  {
    name: 'tsconfig references',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/generate-tsconfig-references.ts',
    ],
  },
  {
    // Only component_tests/*/packed/ is uploaded to the component-test job,
    // which runs off a fresh checkout — so it installs from the *committed*
    // manifests and pack.ts's rewrite never reaches it. Without this, a new
    // cross-package dependency edge falls through to the npm registry for an
    // unpublished version and only surfaces when that job fails, one missing
    // name per run.
    name: 'component-test pins',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/gen-component-test-pins.ts',
    ],
  },
  {
    // Writes spec-recipe-unmapped.txt, and on the way round-trips every
    // figure's jbrowse:// link through Desktop's parseProtocolUrl and
    // app-core's parseSessionSpecUrl. A broken link fails either way; the list
    // regenerates here so a new unmapped field is a one-file commit rather
    // than a docs check telling you which command to run.
    name: 'spec recipe unmapped list',
    argv: web('check-spec-recipes.ts'),
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
  // Before the README is mirrored into the docs site, since this rewrites it.
  {
    name: 'jbrowse-img README commands',
    argv: web('sync-img-readme.ts'),
    figureDependent: true,
  },
  {
    name: 'jbrowse-img doc',
    argv: web('generate-img-doc.ts'),
    figureDependent: true,
  },
  { name: 'CLI doc', argv: web('generate-cli-doc.ts') },
  { name: 'jbrowse-capture doc', argv: web('generate-capture-doc.ts') },
  { name: 'gallery links', argv: web('gen-gallery-links.ts') },
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
    name: 'social card image',
    argv: web('generate-og-image.ts'),
    figureDependent: true,
  },
  { name: 'doc snippets', argv: web('sync-doc-snippets.ts') },
  {
    // The measurement tables the public optimizations page shows, lifted from
    // the `agent-docs/reference/` doc that owns each one. Same failure as the
    // doc snippets above, one content type over: a re-measurement updates the
    // reference doc and the published number keeps quoting the old one.
    name: 'measurement tables',
    argv: web('sync-measurements.ts'),
  },
  {
    // The ten `<!-- TABLE START -->` blocks spliced into the hand-written
    // guides and agent-docs. One entry, not ten: each was its own `node`
    // process paying ~2.5s to load TypeScript before scanning, and gendocs
    // below then generated all ten again. They still need an entry of their
    // own — five of the blocks land in `developer_guides`/`agent-docs`, which
    // gendocs' diffPaths do not cover. `markers.ts <label>` narrows to one.
    name: 'marker tables',
    argv: api('markers.ts'),
  },
  {
    // The config-slot manifest `jbrowse validate` checks against, read out of
    // the live ConfigurationSchema objects. It rides autogen so a new slot (or a
    // renamed one) can't leave the validator reporting a correct config as
    // broken — the failure that makes a checker worth ignoring. Also emits the
    // jbrowse-authoring skill's config-types.md index.
    //
    // Runs BEFORE the doc generators below, not after: generateConfigDocs
    // reads the shorthand keys out of this manifest, so generating it second
    // would document the previous run's answer and leave `pnpm autogen`
    // needing two passes to settle after a normalizer changes.
    name: 'config schema manifest',
    argv: [
      'node',
      '--experimental-strip-types',
      'scripts/generateConfigManifest.ts',
    ],
    diffPaths: [
      'products/jbrowse-cli/src/commands/validate/configManifest.generated.ts',
      '.claude/skills/jbrowse-authoring/references/config-types.md',
    ],
  },
  {
    // config_guides and user_guides are in the diff because gendocs also
    // rewrites the marker blocks embedded in the hand-written guides
    // (DISPLAY_TYPES, which needs the whole-repo DisplayType scan generate.ts
    // does, FILE_TYPES, and PROMOTABLE_SLOTS in display_defaults.md).
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
    diffPaths: [
      'website/docs/config',
      'website/docs/models',
      'website/docs/api',
      'website/docs/config_guides',
      'website/docs/user_guides',
      // the SPEC_KEYS blocks: what a session spec may set on each view type,
      // rendered from the views' own declarations
      'website/docs/urlparams.md',
      'website/scripts/api-docs/coverage-gaps.txt',
      'packages/*/README.md',
      'plugins/*/README.md',
      'products/*/README.md',
    ],
  },
]

function run(argv: string[], extra: string[] = []) {
  return spawnSync(argv[0]!, [...argv.slice(1), ...extra], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
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
// (`after` is computed by excluding `before`), so it cannot discard anyone's
// work in progress.
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

for (const { name, argv, diffPaths } of selected) {
  console.log(`\n=== ${name}`)
  if (diffPaths) {
    // A generator with no --check has to write to be compared, so anything
    // already modified when it started is not evidence of staleness — without
    // this, a local --check over a work-in-progress tree reports every
    // uncommitted doc edit. CI runs off a clean checkout, so `before` is empty
    // there and nothing is excluded.
    const before = new Set(check ? changedFiles(diffPaths) : [])
    const { status } = run(argv)
    if (status !== 0) {
      crashed.push({ name, status })
    } else if (check) {
      const after = changedFiles(diffPaths).filter(f => !before.has(f))
      if (after.length > 0) {
        showDiff(after)
        stale.push(name)
      }
      // Unconditionally, not just when stale: a generator can rewrite a file to
      // byte-identical content and still leave it looking touched to tooling
      // that stats rather than diffs.
      restore(after)
    }
  } else if (run(argv, check ? ['--check'] : []).status !== 0) {
    stale.push(name)
  }
}

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
  console.error(
    `\n${stale.length} generated artifact(s) out of date:\n${stale
      .map(n => `  - ${n}`)
      .join('\n')}\n\nRun 'pnpm autogen' and commit the result.`,
  )
}
if (crashed.length > 0 || stale.length > 0) {
  process.exit(1)
}

// Drops the nag the post-merge hook leaves for pre-commit to print. A clean run
// IS the condition it reports on, so clearing it anywhere else would be a
// second opinion about the same question.
const gitDir = spawnSync('git', ['rev-parse', '--git-common-dir'], {
  encoding: 'utf8',
})
if (gitDir.status === 0) {
  rmSync(join(gitDir.stdout.trim(), 'autogen-stale'), { force: true })
}

console.log(check ? '\nAll generated artifacts up to date' : '\nRegenerated')
