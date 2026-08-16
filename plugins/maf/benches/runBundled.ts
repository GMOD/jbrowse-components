// Bundle a bench with esbuild and run the bundle under node, forwarding flags.
//
//   node plugins/maf/benches/runBundled.ts <bench.ts> [--flags...]
//
// reference/BENCHMARKING.md's rule — bundle the module under test and run it
// under node — with a second reason here: node's strip-only TypeScript cannot
// load a module that uses a parameter property, and `mafWirePacker.ts`'s
// `Column` does. esbuild erases it, so the bundle imports what the source
// cannot.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const [, , entry, ...flags] = process.argv
if (!entry) {
  console.error('usage: node runBundled.ts <bench.ts> [flags...]')
  process.exit(2)
}

const root = join(import.meta.dirname, '..', '..', '..')
const out = join(
  mkdtempSync(join(tmpdir(), 'jb-bundle-')),
  `${basename(entry, '.ts')}.mjs`,
)

execFileSync(
  join(root, 'node_modules', '.bin', 'esbuild'),
  [
    entry,
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node22',
    `--outfile=${out}`,
    '--log-level=warning',
    // the tabix checkout under test is outside the repo, so the bench names it
    // by a stable specifier and the path arrives from the environment
    ...(process.env.TABIX_PR_SRC
      ? [`--alias:@gmod/tabix-pr=${process.env.TABIX_PR_SRC}`]
      : []),
  ],
  { cwd: root, stdio: 'inherit' },
)

const run = spawnSync(process.execPath, ['--expose-gc', out, ...flags], {
  stdio: 'inherit',
})
process.exit(run.status ?? 1)
