// Every docs validator that has no fix mode (unlike the generators behind
// `pnpm autogen`, a failure here is something only a human can resolve).
//
//   pnpm check-docs
//
// Runs all of them and reports every failure, rather than stopping at the
// first, so one push clears the whole set.

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

interface Validator {
  name: string
  argv: string[]
  // Built before the validator runs, when `built` is missing.
  needsBuild?: { built: string; argv: string[] }
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
    name: 'every doc reachable from the sidebar',
    argv: web('check-sidebar.ts'),
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
    // Round-trips every figure's jbrowse:// link through Desktop's
    // parseProtocolUrl and app-core's parseSessionSpecUrl.
    name: 'figure recipes round-trip',
    argv: web('check-spec-recipes.ts', '--check'),
  },
  {
    // Offline half only; the published half is --network, which needs
    // jbrowse.org and so has no place in a push build.
    name: 'figure live links name a config that ships',
    argv: web('check-live-configs.ts'),
  },
  {
    // Round-trips every `json addtrack`/`json addassembly` doc block through
    // the real `jbrowse add-track`/`add-assembly`.
    name: 'addtrack config/CLI blocks round-trip',
    argv: web('check-config-cli.ts'),
    needsBuild: {
      built: 'products/jbrowse-cli/dist/bin.js',
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
    name: 'tutorial build scripts are valid',
    argv: ['python3', 'scripts/check-build-scripts.py'],
  },
]

function run(argv: string[]) {
  return spawnSync(argv[0]!, argv.slice(1), {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  }).status
}

const failed: string[] = []

for (const { name, argv, needsBuild } of VALIDATORS) {
  console.log(`\n=== ${name}`)
  const buildFailed =
    needsBuild &&
    !existsSync(join(root, needsBuild.built)) &&
    run(needsBuild.argv) !== 0
  if (buildFailed) {
    // Say so here rather than letting the validator fail on a missing binary,
    // which reads as a docs problem.
    console.error(`could not build ${needsBuild.built}`)
    failed.push(`${name} (prerequisite build failed)`)
  } else if (run(argv) !== 0) {
    failed.push(name)
  }
}

if (failed.length > 0) {
  console.error(
    `\n${failed.length} docs check(s) failed:\n${failed
      .map(n => `  - ${n}`)
      .join('\n')}`,
  )
  process.exit(1)
}

console.log('\nAll docs checks passed')
