// Run one of this directory's python helpers against a fixture, for the tests
// beside it.
//
// These scripts are downloaded and run by readers -- the pangenome tutorials
// tell them to `curl -fO` the file and pipe real data through it -- and until
// now nothing checked any of them. That surface has a measured failure rate
// rather than a theoretical one: the five-strain rebuild found five bugs that
// had already shipped (minimap2 needing -X, `--adapterType` being in no
// released CLI, a download cache keyed on strain name, cactus hardcoding six
// halSynteny pairs, vg giraffe rewriting its own .dist), and a sixth was found
// later in the untangle identity workaround.
//
// Shelling out rather than porting the logic to TypeScript, because the file a
// reader downloads is the thing worth testing. A port would pass while the
// script rotted.
//
// Kept out of `*.test.ts` so jest treats it as a module rather than a suite
// with no tests in it.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

export interface PythonRun {
  status: number
  stdout: string
  stderr: string
}

/**
 * python3 is a stated prerequisite of every tutorial that ships one of these,
 * so its absence is reported rather than skipped over. A suite that quietly
 * skips reads as a passing suite, which is the failure mode these tests exist
 * to close.
 */
export function assertPython3() {
  const probe = spawnSync('python3', ['--version'], { encoding: 'utf8' })
  if (probe.error ?? probe.status !== 0) {
    throw new Error(
      'python3 is required to test the scripts/ helpers, and these tests do ' +
        'not skip without it: a silent skip would report the helpers as ' +
        'checked. Install python3, which every tutorial shipping one of these ' +
        'already lists as a prerequisite.',
    )
  }
}

export function runPython(script: string, args: string[]): PythonRun {
  const result = spawnSync('python3', [path.join(__dirname, script), ...args], {
    encoding: 'utf8',
  })
  if (result.error) {
    throw result.error
  }
  return {
    status: result.status ?? -1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

/**
 * Write `files` into a throwaway directory and return a resolver for paths in
 * it, including ones the script is about to create.
 */
export function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'jb-scripts-'))
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content)
  }
  return (name: string) => path.join(dir, name)
}

/** Split a TSV body into rows, dropping the trailing blank line. */
export function tsvRows(text: string) {
  return text
    .split('\n')
    .filter(line => line !== '')
    .map(line => line.split('\t'))
}
