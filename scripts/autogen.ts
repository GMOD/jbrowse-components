// Every generated-and-committed artifact, in one run. Every generator has its
// own `--check`, so a check writes nothing and reports every stale artifact at
// once; the fix is always `pnpm autogen`.
//
//   pnpm autogen                          rewrite everything
//   pnpm autogen --check                  verify everything (CI)
//   pnpm autogen --fix-stale              verify everything, then rewrite only
//                                         what the verify found stale (the hooks)
//   pnpm autogen gallery                  only generators whose name contains 'gallery'
//   pnpm autogen --skip-figure-dependent  drop the generators that read the
//                                         figure corpus or figures.lock
//   pnpm autogen --skip-whole-repo-program drop the generators that build a
//                                         TypeScript program over the whole
//                                         tree (the pre-push hook; CI runs
//                                         them)

import { spawn } from 'node:child_process'
import { availableParallelism } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { figureRootPulled } from '../website/scripts/figure-paths.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const FLAGS = [
  '--check',
  '--fix-stale',
  '--skip-figure-dependent',
  '--skip-whole-repo-program',
]
const args = process.argv.slice(2)
const unknownFlags = args.filter(a => a.startsWith('--') && !FLAGS.includes(a))
if (unknownFlags.length > 0) {
  console.error(
    `Unknown flag(s): ${unknownFlags.join(', ')}. Known: ${FLAGS.join(', ')}`,
  )
  process.exit(1)
}
const fixStale = args.includes('--fix-stale')
const skipFigureDependent = args.includes('--skip-figure-dependent')
const skipWholeRepoProgram = args.includes('--skip-whole-repo-program')
// `--fix-stale` starts as a check and flips once it knows what to rewrite.
let checking = args.includes('--check') || fixStale
const filters = args.filter(a => !a.startsWith('--'))

interface Generator {
  name: string
  argv: string[]
  // Reads the figure corpus or figures.lock, so its answer is only CI's answer
  // when the two agree. `--skip-figure-dependent` drops these.
  figureDependent?: boolean
  // Builds a TypeScript program over every source in the tree, which costs
  // whole seconds however little has changed and cannot be narrowed to a push.
  // `--skip-whole-repo-program` drops these; see the flag's own note.
  wholeRepoProgram?: boolean
  // Rewrites a package.json, which every node process resolves modules
  // through, so a rewrite runs it with nothing else in flight.
  exclusive?: boolean
  // Writes only files no other generator writes or reads, so a rewrite runs it
  // in a pool beside the ordered doc chain. Everything without either flag
  // splices blocks into `website/docs` and `agent-docs`, where two generators
  // rewriting one page at once lose a block, and so keeps this list's order.
  independent?: boolean
  // Generators whose output this one reads; a rewrite waits for them.
  needs?: string[]
  // A rewrite skips this generator when the named one is also running, because
  // that one redoes the whole job. `--check` still runs it: it names the stale
  // table where the other can only name the directory.
  redundantWith?: string
  // Skipped with a warning when the worktree holds none of the figures
  // figures.lock lists under this root. Figure bytes are gitignored and arrive
  // via `pnpm figures:pull`, so a fresh worktree has an empty corpus and
  // nothing here to be out of date against; CI pulls them.
  figureRoot?: string
}

const web = (script: string) => ['node', `website/scripts/${script}`]
const api = (script: string) => web(`api-docs/${script}`)
const rootScript = (script: string) => [
  'node',
  '--experimental-strip-types',
  `scripts/${script}`,
]

const GENERATORS: Generator[] = [
  {
    // packages/core/package.json's `exports`, derived from in-repo import sites.
    name: 'core exports',
    argv: ['node', 'packages/core/scripts/generateExports.mjs'],
    exclusive: true,
  },
  {
    // publishConfig for the packages whose `exports` map is hand-curated.
    name: 'publishConfig exports',
    argv: rootScript('generate-publish-exports.ts'),
    exclusive: true,
  },
  {
    // scripts/chromeBundleSizes.json, measured by bundling both entry points.
    name: 'chrome bundle sizes',
    argv: rootScript('measureChromeBundle.ts'),
    independent: true,
  },
  {
    // tsconfig.build.json and each package's tsconfig.build.esm.json.
    name: 'tsconfig references',
    argv: rootScript('generate-tsconfig-references.ts'),
    independent: true,
  },
  {
    // component_tests/*/package.json and pnpm-workspace.yaml: the component-test
    // job installs from the committed manifests off a fresh checkout.
    name: 'component-test pins',
    argv: rootScript('gen-component-test-pins.ts'),
    independent: true,
  },
  {
    // spec-recipe-unmapped.txt, and recipe-path-labels.ts when an exemption
    // there has stopped covering anything.
    name: 'spec recipe unmapped list',
    argv: web('check-spec-recipes.ts'),
    independent: true,
  },
  { name: 'guide indexes', argv: web('generate-guide-indexes.ts') },
  { name: 'ADR index', argv: web('generate-adr-index.ts') },
  { name: 'diagram usage table', argv: web('gen-diagram-usage.ts') },
  {
    // The v5 ABI-removal tables in upgrading_v5.md and PLUGIN_ABI_STABILITY.md,
    // from the two ABI baselines, core's published `exports` map and
    // publishedPluginBreaks.json.
    name: 'ABI removal tables',
    argv: web('generate-abi-removals.ts'),
  },
  { name: 'doc indexes', argv: web('generate-doc-indexes.ts') },
  { name: 'backlog index', argv: web('generate-todo-index.ts') },
  {
    name: 'DisplayChrome adoption map',
    argv: web('generate-display-chrome-adoption.ts'),
  },
  {
    name: 'display hook override table',
    argv: web('generate-display-hook-overrides.ts'),
  },
  {
    name: 'display state census',
    argv: web('generate-display-state-census.ts'),
  },
  {
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
    // Mirrors the README the entry above rewrites.
    name: 'jbrowse-img doc',
    argv: web('generate-img-doc.ts'),
    needs: ['jbrowse-img README commands'],
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
  {
    // Rendered from tracked sources (wordmark outlines, logo paths) into the
    // figure corpus and checked against figures.lock, so it is stale exactly
    // when the corpus is ahead of the lock. Nothing DERIVED from a figure
    // belongs in this list: the tutorial cards and homepage crops are computed
    // by `website`'s build (isDerivedFigure in figure-store.ts).
    name: 'social card image',
    argv: web('generate-og-image.ts'),
    independent: true,
    figureDependent: true,
    figureRoot: 'website/static/img',
  },
  { name: 'doc snippets', argv: web('sync-doc-snippets.ts') },
  {
    // The tables in the agent-docs that own each measurement, from
    // agent-docs/measurements/<id>.json.
    name: 'measurement tables',
    argv: web('generate-measurement-tables.ts'),
  },
  {
    // The public optimizations page's copy of those tables. Reads what the
    // entry above writes.
    name: 'published measurement tables',
    argv: web('sync-measurements.ts'),
    needs: ['measurement tables'],
  },
  {
    // Single values a sentence quotes out of one of those tables.
    name: 'inline figures',
    argv: web('sync-inline-figures.ts'),
  },
  {
    // The marker-block tables that need no TypeScript program, in one process.
    // gendocs writes them too; this entry is what names the stale table, and
    // `markers.ts <label>` narrows a development loop to one.
    name: 'marker tables',
    argv: api('markers.ts'),
    redundantWith: 'config/model/api docs',
  },
  {
    // packages/add-track-core/src/trackTypes.generated.ts, from the #trackType
    // tag on each adapter's config schema.
    name: 'adapter track type map',
    argv: rootScript('generateTrackTypeMap.ts'),
    independent: true,
  },
  {
    // packages/synteny-core/src/syntenyFeatureLanes.generated.ts, from the
    // synteny RPC payload's lane table in syntenyLaneSchema.ts.
    name: 'synteny lane types',
    argv: rootScript('generateSyntenyLanes.ts'),
    independent: true,
  },
  {
    // The config-slot manifest `jbrowse validate` checks against, read out of
    // the live ConfigurationSchema objects, plus the jbrowse-authoring skill's
    // config-types.md index. It bundles the live source tree, add-track-core's
    // generated map included.
    name: 'config schema manifest',
    argv: rootScript('generateConfigManifest.ts'),
    independent: true,
    needs: ['adapter track type map'],
  },
  {
    // The generated pages under website/docs/{config,models,api}, the marker
    // blocks that need the whole-repo program (DISPLAY_TYPES, GOTCHA,
    // PROMOTABLE_SLOTS, SPEC_KEYS, ...), each package's API_DOCS README block,
    // and api-docs/coverage-gaps.txt. generateConfigDocs reads the shorthand
    // keys out of the manifest.
    name: 'config/model/api docs',
    argv: api('generate.ts'),
    needs: ['config schema manifest'],
    wholeRepoProgram: true,
  },
]

// V8's code cache, shared by every child: each is a fresh node compiling the
// same TypeScript module graphs from source.
const childEnv = {
  ...process.env,
  NODE_COMPILE_CACHE: join(root, 'node_modules/.cache/node-compile'),
}

// `stream` inherits stdio for the lane whose output order is the order the work
// happened in. Otherwise the output is captured and printed whole when the
// generator finishes, since six interleaved processes are unreadable. Async
// either way: a spawnSync would block the loop and leave the pooled children's
// pipes undrained.
function run(argv: string[], stream: boolean) {
  return new Promise<{ status: number | null; output: string }>(resolve => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd: root,
      stdio: stream ? 'inherit' : 'pipe',
      shell: process.platform === 'win32',
      env: childEnv,
    })
    let output = ''
    if (!stream) {
      for (const pipe of [child.stdout!, child.stderr!]) {
        pipe.setEncoding('utf8')
        pipe.on('data', (chunk: string) => {
          output += chunk
        })
      }
    }
    child.on('error', e => {
      resolve({ status: 1, output: `${output}${String(e)}\n` })
    })
    child.on('close', status => {
      resolve({ status, output })
    })
  })
}

const failed: { name: string; status: number | null }[] = []
const skipped: string[] = []
const timings: { name: string; ms: number }[] = []
const startedAt = performance.now()

const matched =
  filters.length > 0
    ? GENERATORS.filter(g =>
        filters.some(f => g.name.toLowerCase().includes(f.toLowerCase())),
      )
    : GENERATORS
if (matched.length === 0) {
  console.error(`No generator matches ${filters.join(', ')}`)
  process.exit(1)
}

// Named, not counted: a silent skip reads as "everything is current".
const figureSkipped = skipFigureDependent
  ? matched.filter(g => g.figureDependent)
  : []
if (figureSkipped.length > 0) {
  console.log(
    `Skipping the figure-dependent generators: ${figureSkipped
      .map(g => g.name)
      .join(', ')}`,
  )
  skipped.push(...figureSkipped.map(g => g.name))
}
const programSkipped = skipWholeRepoProgram
  ? matched.filter(g => g.wholeRepoProgram)
  : []
if (programSkipped.length > 0) {
  console.log(
    `Skipping the whole-repo-program generators: ${programSkipped
      .map(g => g.name)
      .join(', ')}`,
  )
  skipped.push(...programSkipped.map(g => g.name))
}
const selected = matched.filter(
  g => !figureSkipped.includes(g) && !programSkipped.includes(g),
)

// A rewrite drops the generators another one in the same run redoes; a check
// keeps them, since that one names the stale table where the other can only
// name the directory.
function forRewrite(set: Generator[]) {
  const superseded = set.filter(
    g =>
      g.redundantWith !== undefined &&
      set.some(other => other.name === g.redundantWith),
  )
  for (const { name, redundantWith } of superseded) {
    console.log(`Skipping ${name}: ${redundantWith} rewrites the same tables`)
  }
  return set.filter(g => !superseded.includes(g))
}

let running = checking ? selected : forRewrite(selected)

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

async function runGenerator(generator: Generator, stream: boolean) {
  if (!skipsForMissingFigures(generator)) {
    const { name, argv } = generator
    if (stream) {
      console.log(`\n=== ${name}`)
    }
    const started = performance.now()
    const { status, output } = await run(
      checking ? [...argv, '--check'] : argv,
      stream,
    )
    if (status !== 0) {
      failed.push({ name, status })
    }
    if (!stream) {
      console.log(`\n=== ${name}\n${output}`.trimEnd())
    }
    timings.push({ name, ms: performance.now() - started })
  }
}

const workers = Math.min(6, Math.max(1, availableParallelism() - 2))

// `queue` through `runOne`, `workers` at a time. A generator's `needs` name an
// entry earlier in the list, so a worker blocked on one is never blocked on one
// still queued behind it.
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

// Nothing writes, so nothing needs an order.
async function checkAll() {
  await pool(running, g => runGenerator(g, false))
}

// The exclusive ones first, alone; then two lanes at once, the ordered doc
// chain and a pool of the generators writing nothing another one reads.
async function rewriteAll() {
  const gate = new Map(
    running.map(g => [g.name, Promise.withResolvers<void>()]),
  )
  // A needed generator the filters left out is not in `gate` and is nothing
  // to wait for: it is not going to write anything either.
  const afterNeeds = async ({ needs = [] }: Generator) => {
    await Promise.all(
      needs.flatMap(name => {
        const gated = gate.get(name)
        return gated === undefined ? [] : [gated.promise]
      }),
    )
  }
  const inLane = async (generator: Generator, stream: boolean) => {
    await afterNeeds(generator)
    await runGenerator(generator, stream)
    gate.get(generator.name)!.resolve()
  }
  for (const generator of running.filter(g => g.exclusive)) {
    await inLane(generator, true)
  }
  const rest = running.filter(g => !g.exclusive)
  await Promise.all([
    pool(
      rest.filter(g => g.independent),
      generator => inLane(generator, false),
    ),
    (async () => {
      for (const generator of rest.filter(g => !g.independent)) {
        await inLane(generator, true)
      }
    })(),
  ])
}

await (checking ? checkAll() : rewriteAll())

// `--fix-stale`: the check just paid for every generator, so rewrite the ones it
// found stale rather than the whole list. Several here build a whole-repo
// TypeScript program and cost the same in both passes — running all of them
// again to reach the four that moved was most of what a push waited on.
if (fixStale && failed.length > 0) {
  const rewriting = new Set(failed.map(f => f.name))
  // Its output is a downstream generator's input, so a rewrite here leaves that
  // one stale however its own check just answered.
  for (let grew = true; grew;) {
    grew = false
    for (const { name, needs = [] } of selected) {
      if (!rewriting.has(name) && needs.some(n => rewriting.has(n))) {
        rewriting.add(name)
        grew = true
      }
    }
  }
  const downstream = [...rewriting].filter(
    name => !failed.some(f => f.name === name),
  )
  console.log(
    `\nChecked in ${Math.round(performance.now() - startedAt)}ms. Rewriting ` +
      `${rewriting.size} of ${selected.length}${
        downstream.length > 0
          ? `, ${downstream.join(' and ')} downstream of them`
          : ''
      }`,
  )
  failed.length = 0
  timings.length = 0
  checking = false
  running = forRewrite(selected.filter(g => rewriting.has(g.name)))
  await rewriteAll()
}

const ms = (n: number) => Math.round(n).toString().padStart(6)
console.log('\ntimings (ms):')
for (const t of [...timings].sort((a, b) => b.ms - a.ms)) {
  console.log(`  ${ms(t.ms)}  ${t.name}`)
}
console.log(`  ${ms(performance.now() - startedAt)}  wall clock`)

if (failed.length > 0) {
  const named = failed
    .map(f => `  - ${f.name} (exited ${f.status ?? 'on a signal'})`)
    .join('\n')
  console.error(
    checking
      ? `\n${failed.length} generator(s) reported a stale artifact or failed:\n${named}\n\n` +
          `Run 'pnpm autogen' and commit the result. A generator whose output ` +
          `above is a crash rather than a stale-artifact report needs its cause ` +
          `fixed first: several compile and execute the live source tree, so a ` +
          `half-finished edit or a stale install fails them.`
      : `\n${failed.length} generator(s) refused to write:\n${named}\n\n` +
          `Each one's reason is above, inline. Re-running will not clear it.`,
  )
  process.exit(1)
}

console.log(
  (checking ? '\nAll generated artifacts up to date' : '\nRegenerated') +
    (skipped.length > 0 ? ` (skipped: ${skipped.join(', ')})` : ''),
)
