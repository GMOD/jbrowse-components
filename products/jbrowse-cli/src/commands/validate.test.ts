/**
 * @jest-environment node
 */
import fs from 'node:fs'
import path from 'node:path'

import { runCommand, runInTmpDir } from '../testUtil.ts'

const config = {
  assemblies: [{ name: 'volvox', uri: 'volvox.2bit' }],
  tracks: [
    {
      type: 'AlignmentsTrack',
      trackId: 'reads',
      assemblyNames: ['volvox'],
      adapter: { type: 'BamAdapter', uri: 'volvox.bam' },
    } as Record<string, unknown>,
  ],
  defaultSession: {
    views: [
      { type: 'LinearGenomeView', assembly: 'volvox', tracks: ['reads'] },
    ] as Record<string, unknown>[],
  },
}

test('a valid config passes', async () => {
  await runInTmpDir(async ctx => {
    fs.writeFileSync(path.join(ctx.dir, 'config.json'), JSON.stringify(config))
    const { stdout, error } = await runCommand(['validate'])
    expect(error).toBeUndefined()
    expect(stdout).toContain('config.json looks good')
  })
})

test('a misspelt slot, a wrong value and a dangling trackId fail the run', async () => {
  await runInTmpDir(async ctx => {
    const broken = structuredClone(config)
    broken.tracks[0]!.adapter = { type: 'BamAdapter', bamLocatoin: 'x' }
    broken.tracks[0]!.displays = [
      { type: 'LinearAlignmentsDisplay', height: 'tall' },
    ]
    broken.defaultSession.views[0]!.tracks = ['reeds']
    fs.writeFileSync(path.join(ctx.dir, 'bad.json'), JSON.stringify(broken))
    const { stdout, error } = await runCommand(['validate', 'bad.json'])
    expect(error?.message).toContain('3 error(s)')
    expect(stdout).toContain(
      'error: tracks[0].adapter.bamLocatoin: unknown slot "bamLocatoin" — did you mean "bamLocation"?',
    )
    expect(stdout).toContain(
      'error: tracks[0].displays[0].height: expected a number or a "jexl:" expression, got "tall"',
    )
    expect(stdout).toContain(
      'error: defaultSession.views[0].tracks[0]: trackId "reeds" is not defined in this config — did you mean "reads"?',
    )
  })
})

test('--json reports the same findings as data', async () => {
  await runInTmpDir(async ctx => {
    const broken = structuredClone(config)
    broken.tracks[0]!.adapter = { type: 'BamAdapter', bamLocatoin: 'x' }
    fs.writeFileSync(path.join(ctx.dir, 'bad.json'), JSON.stringify(broken))
    const { stdout } = await runCommand(['validate', 'bad.json', '--json'])
    const result = JSON.parse(stdout) as {
      ok: boolean
      problems: { level: string; where: string }[]
    }
    expect(result.ok).toBe(false)
    expect(result.problems).toEqual([
      expect.objectContaining({
        level: 'error',
        where: 'tracks[0].adapter.bamLocatoin',
      }),
    ])
  })
})
