// Every docs validator that has no fix mode (unlike the generators behind
// `pnpm autogen`, a failure here is something only a human can resolve).
//
//   pnpm check-docs
//
// Runs all of them and reports every failure, rather than stopping at the
// first, so one push clears the whole set.
//
// They run POOLED, not in sequence. Each is its own process reading the tree
// and writing nothing, so the only thing sequence bought was tidy output, and
// it cost the sum of every validator instead of the slowest one. Output is
// captured per validator and printed whole when it finishes, so a run's blocks
// arrive in completion order rather than list order; the summary at the end is
// in list order either way.
//
// The pool is deliberately smaller than the core count: two of these are
// whole-repo TypeScript programs, and check-config-cli runs a pool of CLI
// processes of its own.

import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { availableParallelism } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

interface Validator {
  name: string
  argv: string[]
  // Built before the validator runs, when `built` is missing or older than
  // anything under `sources`. A stale build is the worse of the two: the
  // validator runs against last month's CLI and reports the docs as broken.
  needsBuild?: { built: string; sources: string[]; argv: string[] }
}

function newestMtime(target: string): number {
  const stat = statSync(target)
  return stat.isDirectory()
    ? readdirSync(target).reduce(
        (max, entry) => Math.max(max, newestMtime(join(target, entry))),
        0,
      )
    : stat.mtimeMs
}

function needsRebuild({
  built,
  sources,
}: {
  built: string
  sources: string[]
}) {
  const builtPath = join(root, built)
  return existsSync(builtPath)
    ? sources.some(
        source => newestMtime(join(root, source)) > newestMtime(builtPath),
      )
    : true
}

const web = (script: string, ...args: string[]) => [
  'node',
  `website/scripts/${script}`,
  ...args,
]

const VALIDATORS: Validator[] = [
  {
    name: 'doc code/path references resolve',
    argv: web('check-doc-imports.ts'),
  },
  {
    // The one check that reads SOURCE comments for a claim about the source.
    // A rename sweeps every use of a name including, fatally, the sentence
    // recording the rename — which is written in the old name, so the sweep
    // turns it into "the current name was the bad one". tsc resolves it and
    // every doc checker sees a live symbol; three landed in one file.
    name: 'no comment says a live local name is the old one',
    argv: web('check-rename-archaeology.ts'),
  },
  {
    // The half of `agent-docs/` the check above cannot cover. It
    // resolves a name against the tree, which those docs are exempt from because
    // most of the names they carry were never ours; this asks the narrower
    // question its exemption comment identified as the gap — a doc naming a
    // symbol WE deleted, which is drift however the sentence is worded.
    name: 'no agent-doc names a symbol we deleted',
    argv: web('check-doc-removed-symbols.ts'),
  },
  {
    name: 'every doc reachable from the sidebar',
    argv: web('check-sidebar.ts'),
  },
  {
    // `sync-measurements` gates the measurement TABLES on a public page; this
    // is the prose around them, which is where most of the figures are. An
    // existence check, so it pins a distinctive figure and not a round one —
    // its own header says which. It earned the slot by finding two sections
    // quoting a doc the page never linked.
    name: 'quoted figures trace to a recorded measurement',
    argv: web('check-quoted-figures.ts'),
  },
  {
    name: 'no link duplicates its target title',
    argv: web('check-wiki-titles.ts'),
  },
  {
    name: 'docs JSON config blocks follow the convention',
    argv: web('check-config-blocks.ts'),
  },
  {
    // Offline: both forms a fence may name — a demos/ URL and a relative
    // test_data/ path — are published out of this repo, so the trackIds are
    // checkable against their source. Nothing here asks whether the deploy
    // happened; check-session-urls.ts says what does and how far it reaches.
    name: 'session live links open what they name',
    argv: web('check-session-urls.ts'),
  },
  {
    // The bash counterpart to sync-doc-snippets, which covers TS only because
    // a shell fence used to have no source to point at. A tutorial's
    // subject-file command now comes out of its build_*.sh, so a flag renamed
    // there has a page to go stale. Checks tools and flags rather than text,
    // since the page deliberately carries the general form.
    name: 'tutorial commands still run in their build script',
    argv: web('check-script-commands.ts'),
  },
  {
    // The other direction: check-script-commands asks whether a command shown
    // is still real, this asks whether a tool a page tells the reader to
    // install is shown at all. A prerequisite nothing on the page uses is a
    // page that stopped teaching the analysis it prepared for.
    name: 'prerequisite tools are invoked on their own page',
    argv: web('check-prereq-tools.ts'),
  },
  {
    // The case neither of those two sees: a tutorial that shows no command at
    // all, so its reader never learns which tool made the figure. Ratcheted
    // rather than forbidden, since a handful of pages genuinely have no tool
    // to show.
    name: 'tutorials show a command from their build script',
    argv: web('check-unshown-tools.ts', '--check'),
  },
  // The figure recipes' round-trip lives in `pnpm autogen` instead, because the
  // other half of that script WRITES spec-recipe-unmapped.txt. Reporting the
  // list stale here only sent people to run the regeneration by hand.
  {
    // The spec-list mistakes that render a plausible figure instead of failing:
    // a duplicate name (one PNG, two specs), a compose part that names no spec
    // (keeps stacking the renamed part's stale image), fields an embedded
    // capture ignores. Plus the ratchet on hand-placed viewport coordinates,
    // which is the same shape of mistake one step earlier: a callout or a click
    // that names a pixel renders a plausible figure of the wrong thing.
    name: 'screenshot specs are well formed',
    argv: web('check-specs.ts'),
  },
  {
    // The same question of the tours, which had nobody asking it: a duplicate
    // name (one mp4, two specs), a spec no page embeds, an embed whose spec was
    // renamed and which now renders without the live session link that is half
    // of what a tour is for. Plus the frame arithmetic, because an odd viewport
    // side fails the encode after the filming.
    name: 'video specs pair up with the pages that embed them',
    argv: web('check-video-specs.ts'),
  },
  {
    // Offline half only; the published half is --network, which needs
    // jbrowse.org and so has no place in a push build.
    name: 'figure live links name a config that ships',
    argv: web('check-live-configs.ts'),
  },
  {
    // Reads figures.lock, not the disk: figure bytes are gitignored, so a
    // checkout that has not pulled would report every figure as missing.
    name: 'doc figure references name a figure in the store',
    argv: web('check-figure-refs.ts'),
  },
  {
    // A tour that films a config being pasted is documenting the page only
    // while its string and the page's fence are one text, and the film is the
    // half nobody re-reads.
    name: 'tour paste configs match a fence on their page',
    argv: web('check-paste-configs.ts'),
  },
  {
    // Round-trips every `json addtrack`/`json addassembly` doc block through
    // the real `jbrowse add-track`/`add-assembly`.
    name: 'addtrack config/CLI blocks round-trip',
    argv: web('check-config-cli.ts'),
    needsBuild: {
      built: 'products/jbrowse-cli/dist/bin.js',
      sources: [
        'products/jbrowse-cli/src',
        'products/jbrowse-cli/package.json',
      ],
      argv: ['pnpm', '--filter', '@jbrowse/cli', 'build'],
    },
  },
  {
    // The only check on slot VALUES. A retired enum value or a dropped slot
    // survives both checks above (shape and CLI round-trip) and MST itself,
    // which stores an unknown displayDefaults key verbatim without warning.
    name: 'doc config slots and values match their schemas',
    argv: web('check-doc-slots.ts'),
  },
  {
    // The session-spec launchers and the embedded mount options each declare
    // what they accept as a type, and a guide restates it as prose; both had
    // drifted into a subset. Resolves the types through the TypeScript checker
    // and requires the docs to name each field.
    name: 'public API surfaces are documented',
    argv: web('check-doc-surfaces.ts'),
  },
  {
    name: 'menu paths use the → separator',
    argv: web('check-menu-paths.ts'),
  },
  {
    // The separator check above says nothing about whether the labels are still
    // the app's. A renamed menu item leaves every page walking a reader to it
    // wrong, and only a reader who goes looking finds out.
    name: 'menu-path labels still exist in the source',
    argv: web('check-menu-labels.ts'),
  },
  {
    // Ratchets a tracked list, like check-spec-recipes above: `--check` fails
    // when a caption newly runs long, the bare run records the current set.
    name: 'no new over-length figure captions',
    argv: web('check-captions.ts', '--check'),
  },
  {
    // Not a ratchet, because the corpus is at zero: the sweep that motivated
    // this check also cleared it. A page missing its TL;DR entirely is the
    // other half, and is the half nothing else would ever surface.
    name: 'TL;DR paragraphs are present and unsalesy',
    argv: web('check-tldr.ts'),
  },
  {
    // Same ratchet shape, guarding what a scheduled figure sweep will fetch:
    // `--check` fails when a spec newly points at a server we do not run.
    name: 'no new third-party hosts in figure specs',
    argv: web('check-remote-hosts.ts', '--check'),
  },
  {
    // Not a ratchet and never should be: the allowed set is what `sessionSpec`
    // puts in a url, and the whole point is that a capture-only parameter added
    // there reaches every website visitor. `autogen --check` cannot see this —
    // a pinned link is correctly generated from a builder with wrong content.
    name: 'gallery links carry no capture-only parameters',
    argv: web('check-gallery-links.ts'),
  },
  {
    // The one doc `pnpm release` renders, commits, tags and pushes in a single
    // run — so unlike every other page here, a mistake in it is published
    // before anyone can read it back. Checked from the day the draft lands.
    name: 'release announcement drafts are well formed',
    argv: web('check-release-drafts.ts'),
  },
  {
    // agent-docs/TODO.md indexes its own headings by hand, which is the
    // sentence-plus-stale-table shape agent-docs/CLAUDE.md warns about. It
    // cannot be generated (two of its three columns are editorial), so the
    // derivable half is checked instead.
    name: 'the backlog index matches the backlog',
    argv: web('check-todo-index.ts'),
  },
  {
    // The reference docs a site page should point at, against the ones it
    // should not. Ratcheted, because the uncited set predates the check and
    // several of its entries want an editorial pass rather than a link; what
    // it holds today is that a NEW reference doc is cited, or says in its own
    // frontmatter that it is internal.
    name: 'no new uncited reference docs',
    argv: web('check-reference-citations.ts'),
  },
  {
    name: 'tutorial build scripts are valid',
    argv: ['python3', 'scripts/check-build-scripts.py'],
  },
  {
    name: "ARCHITECTURE.md's rule index points somewhere",
    argv: web('check-architecture-checklist.ts'),
  },
]

// V8's code cache, shared by every child below. Each of these is a fresh node
// compiling the same TypeScript module graphs from source, which is most of
// what the cheap ones cost at all. Nothing about what runs changes: a stale
// entry is recompiled and a missing directory is written on the first run.
const compileCache = join(root, 'node_modules/.cache/node-compile')

// stdout and stderr both go to `output` in arrival order, so a validator's
// diagnostic still reads the way it did when it wrote straight to the terminal.
function run(argv: string[]) {
  return new Promise<{ status: number | null; output: string }>(resolve => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd: root,
      shell: process.platform === 'win32',
      env: { ...process.env, NODE_COMPILE_CACHE: compileCache },
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

// LONGEST FIRST, off what the last run measured. A pool finishes when its
// slowest member does, so starting a 30s validator once the 1s ones have taken
// the workers costs the whole 30s at the end — which is what the list order
// did, since the slowest of them sits two thirds of the way down it. A
// validator nothing has timed yet sorts first: an unknown cost is more likely
// to be the new long pole than the new short one.
//
// The file is a cache and is treated like one — a missing or unparseable one is
// simply the unsorted order, never an error.
const timingCache = join(root, 'node_modules/.cache/check-docs-timings.json')

function lastRunMs() {
  try {
    return new Map(
      Object.entries(
        JSON.parse(readFileSync(timingCache, 'utf8')) as Record<string, number>,
      ),
    )
  } catch {
    return new Map<string, number>()
  }
}

const failed: string[] = []
const timings: { name: string; ms: number }[] = []
const known = lastRunMs()
const queue = [...VALIDATORS].sort(
  (a, b) =>
    (known.get(b.name) ?? Number.POSITIVE_INFINITY) -
    (known.get(a.name) ?? Number.POSITIVE_INFINITY),
)

await Promise.all(
  Array.from(
    { length: Math.min(4, Math.max(1, availableParallelism() - 1)) },
    async () => {
      while (queue.length > 0) {
        const { name, argv, needsBuild } = queue.shift()!
        const started = performance.now()
        const build =
          needsBuild && needsRebuild(needsBuild)
            ? { built: needsBuild.built, ...(await run(needsBuild.argv)) }
            : undefined
        if (build && build.status !== 0) {
          // Say so here rather than letting the validator fail on a missing
          // binary, which reads as a docs problem.
          failed.push(`${name} (prerequisite build failed)`)
          console.log(
            `\n=== ${name}\n${build.output}could not build ${build.built}`.trimEnd(),
          )
        } else {
          const { status, output } = await run(argv)
          if (status !== 0) {
            failed.push(name)
          }
          console.log(
            `\n=== ${name}\n${build?.output ?? ''}${output}`.trimEnd(),
          )
        }
        timings.push({ name, ms: performance.now() - started })
      }
    },
  ),
)

try {
  mkdirSync(dirname(timingCache), { recursive: true })
  writeFileSync(
    timingCache,
    JSON.stringify(
      Object.fromEntries(timings.map(t => [t.name, Math.round(t.ms)])),
    ),
  )
} catch {
  // a cache that cannot be written just means the next run sorts on the run
  // before it, or on nothing
}

console.log('\ntimings (ms):')
for (const { name, ms } of [...timings].sort((a, b) => b.ms - a.ms)) {
  console.log(`  ${Math.round(ms).toString().padStart(6)}  ${name}`)
}
console.log(
  `  ${Math.round(timings.reduce((a, t) => a + t.ms, 0))
    .toString()
    .padStart(6)}  TOTAL`,
)

if (failed.length > 0) {
  console.error(
    `\n${failed.length} docs check(s) failed:\n${failed
      .map(n => `  - ${n}`)
      .join('\n')}`,
  )
  process.exit(1)
}

console.log('\nAll docs checks passed')
