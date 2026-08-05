// Single entry point for every generated-and-committed artifact.
//
//   pnpm autogen           rewrite everything
//   pnpm autogen --check   verify everything (what CI runs)
//   pnpm autogen gallery   limit to generators whose name contains 'gallery'
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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const check = args.includes('--check')
const filters = args.filter(a => !a.startsWith('--'))

interface Generator {
  // Shown in the summary, and what the failure line names.
  name: string
  argv: string[]
  // Set when the generator has no `--check`: run it, then diff these git
  // pathspecs. Globs are passed to git verbatim, not expanded by the shell.
  diffPaths?: string[]
}

const web = (script: string) => ['node', `website/scripts/${script}`]
const api = (script: string) => web(`api-docs/${script}`)

const GENERATORS: Generator[] = [
  {
    name: 'core exports',
    argv: ['node', 'packages/core/scripts/generateExports.mjs'],
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
  { name: 'guide indexes', argv: web('generate-guide-indexes.ts') },
  { name: 'ADR index', argv: web('generate-adr-index.ts') },
  {
    // agent-docs/CLAUDE.md makes reading a directory's `description:` lines the
    // way to find the right reference doc, which meant opening all 36 of them.
    // This renders them into one page and, more to the point, fails when a doc
    // carries no frontmatter — the convention was previously enforced by nothing.
    name: 'reference index',
    argv: web('generate-reference-index.ts'),
  },
  // Before the README is mirrored into the docs site, since this rewrites it.
  { name: 'jbrowse-img README commands', argv: web('sync-img-readme.ts') },
  { name: 'jbrowse-img doc', argv: web('generate-img-doc.ts') },
  { name: 'CLI doc', argv: web('generate-cli-doc.ts') },
  { name: 'gallery links', argv: web('gen-gallery-links.ts') },
  {
    // Cards are cropped from the figures the tutorials embed, and nothing
    // regenerates them on a figure change. Four had drifted from figures
    // recommitted days later before this gate existed.
    name: 'tutorial card thumbnails',
    argv: web('gen-tutorial-thumbs.ts'),
  },
  { name: 'homepage images', argv: web('gen-home-images.ts') },
  { name: 'doc snippets', argv: web('sync-doc-snippets.ts') },
  { name: 'color tables', argv: api('generateColorDocs.ts') },
  { name: 'jexl catalog', argv: api('generateJexlDocs.ts') },
  { name: 'extension point index', argv: api('generateExtensionPointDocs.ts') },
  { name: 'file type tables', argv: api('generateFileTypeDocs.ts') },
  {
    name: 'display foundations table',
    argv: api('generateDisplayFoundationDocs.ts'),
  },
  { name: 'fetch autoruns table', argv: api('generateFetchAutorunDocs.ts') },
  { name: 'palette keys table', argv: api('generatePaletteDocs.ts') },
  { name: 'helper package table', argv: api('generateHelperPackageDocs.ts') },
  { name: 're-export module table', argv: api('generateReExportDocs.ts') },
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

const stale: string[] = []
const selected =
  filters.length > 0
    ? GENERATORS.filter(g => filters.some(f => g.name.includes(f)))
    : GENERATORS

if (selected.length === 0) {
  console.error(`No generator matches ${filters.join(', ')}`)
  process.exit(1)
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
      stale.push(`${name} (generator failed)`)
    } else if (check) {
      const after = changedFiles(diffPaths).filter(f => !before.has(f))
      if (after.length > 0) {
        showDiff(after)
        stale.push(name)
      }
    }
  } else if (run(argv, check ? ['--check'] : []).status !== 0) {
    stale.push(name)
  }
}

if (stale.length > 0) {
  console.error(
    `\n${stale.length} generated artifact(s) out of date:\n${stale
      .map(n => `  - ${n}`)
      .join('\n')}\n\nRun 'pnpm autogen' and commit the result.`,
  )
  process.exit(1)
}

console.log(check ? '\nAll generated artifacts up to date' : '\nRegenerated')
