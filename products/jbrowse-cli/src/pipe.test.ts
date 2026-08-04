/**
 * @jest-environment node
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { diedOfSigpipe } from './commands/process-utils.ts'
import { ctxDir, dataDir, readConf, runInTmpDir } from './testUtil.ts'

// These spawn the CLI as a real child process. What is under test is how our
// process behaves when a pipe peer appears or goes away, and an in-process
// runCommand — whose stdout is a jest mock and whose stdin is jest's — cannot
// reproduce either side of that.
const bin = path.join(__dirname, 'bin.ts')

// `set -o pipefail` so the CLI's exit status survives the pipe rather than being
// masked by the downstream command's 0
function pipe(command: string, opts: { cwd?: string; input?: string } = {}) {
  return spawnSync('bash', ['-c', `set -o pipefail; ${command}`], {
    encoding: 'utf8',
    cwd: opts.cwd,
    input: opts.input,
  })
}

describe('diedOfSigpipe', () => {
  test.each([
    [{ code: null, signal: 'SIGPIPE' as const }, true],
    // sh reports a pipeline member's SIGPIPE death as 128+13 rather than
    // propagating the signal, so the numeric spelling counts too
    [{ code: 141, signal: null }, true],
    [{ code: 0, signal: null }, false],
    [{ code: 1, signal: null }, false],
    [{ code: null, signal: 'SIGKILL' as const }, false],
  ])('%j -> %s', (exit, expected) => {
    expect(diedOfSigpipe(exit)).toBe(expected)
  })
})

describe('sort output survives a consumer that stops reading', () => {
  // 660KB of GFF, comfortably past the 64KB pipe buffer, so `head` really does
  // close the pipe under the running sort
  const bigGff = dataDir('au9_scaffold_subset_sync.gff3')

  test('exits cleanly and silently when piped into head', () => {
    const { status, stdout, stderr } = pipe(
      `node ${bin} sort-gff ${bigGff} | head -2`,
    )
    // it used to exit 1 with "Sort process exited with code 141"
    expect(stderr).toBe('')
    expect(status).toBe(0)
    expect(stdout.split('\n').filter(Boolean)).toHaveLength(2)
  })

  test('still sorts the whole file when the consumer reads it all', () => {
    const { status, stdout, stderr } = pipe(`node ${bin} sort-gff ${bigGff}`)
    expect(stderr).toBe('')
    expect(status).toBe(0)
    const lines = stdout.split('\n').filter(Boolean)
    expect(lines).toHaveLength(
      fs.readFileSync(bigGff, 'utf8').split('\n').filter(Boolean).length,
    )
    // comments hoisted to the top, then sorted by refName and start
    expect(lines[0]!.startsWith('#')).toBe(true)
  })
})

describe('"-" reads JSON from stdin', () => {
  const minimalConfig = {
    assemblies: [
      {
        name: 'volvox',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'volvox-rst',
          adapter: { type: 'TwoBitAdapter', twoBitLocation: { uri: 'v.2bit' } },
        },
      },
    ],
    tracks: [],
  }

  test('add-track-json takes the track config on stdin', async () => {
    await runInTmpDir(async ctx => {
      fs.writeFileSync(
        ctxDir(ctx, 'config.json'),
        JSON.stringify(minimalConfig),
      )
      const track = {
        type: 'FeatureTrack',
        trackId: 'piped',
        name: 'Piped',
        assemblyNames: ['volvox'],
        adapter: { type: 'BedAdapter', bedLocation: { uri: 'x.bed' } },
      }
      const { status, stderr } = pipe(`node ${bin} add-track-json -`, {
        cwd: ctx.dir,
        input: JSON.stringify(track),
      })
      expect(stderr).toBe('')
      expect(status).toBe(0)
      expect(readConf(ctx).tracks).toEqual([track])
    })
  })

  test('set-default-session takes the session on stdin', async () => {
    await runInTmpDir(async ctx => {
      fs.writeFileSync(
        ctxDir(ctx, 'config.json'),
        JSON.stringify(minimalConfig),
      )
      const { status, stderr } = pipe(
        `node ${bin} set-default-session --session -`,
        { cwd: ctx.dir, input: '{"name":"Piped session","views":[]}' },
      )
      expect(stderr).toBe('')
      expect(status).toBe(0)
      expect(readConf(ctx).defaultSession).toEqual({
        name: 'Piped session',
        views: [],
      })
    })
  })
})
