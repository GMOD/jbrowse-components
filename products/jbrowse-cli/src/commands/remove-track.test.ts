/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { readConf, runCommand, runInTmpDir } from '../testUtil.ts'

const twoPath = path.join(__dirname, '..', '..', 'test', 'data', 'simple.2bit')

test('remove track', async () => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(twoPath, path.join(ctx.dir, path.basename(twoPath)))
    await runCommand(['add-assembly', 'simple.2bit', '--load', 'copy'])
    await runCommand(['add-track', 'simple.bam', '--load', 'inPlace'])
    await runCommand(['remove-track', 'simple'])
    const contents = readConf(ctx)
    expect(contents.assemblies.length).toBe(1)
    expect(contents.tracks.length).toBe(0)
  })
})

test('remove track prints message when trackId not found', async () => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(twoPath, path.join(ctx.dir, path.basename(twoPath)))
    await runCommand(['add-assembly', 'simple.2bit', '--load', 'copy'])
    await runCommand(['add-track', 'simple.bam', '--load', 'inPlace'])
    const { stdout } = await runCommand(['remove-track', 'nonexistent'])
    expect(stdout).toContain('No track found with trackId: nonexistent')
    // original track should be untouched
    expect(readConf(ctx).tracks?.length).toBe(1)
  })
})
