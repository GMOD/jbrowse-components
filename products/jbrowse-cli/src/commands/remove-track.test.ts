/**
 * @jest-environment node
 */

import fs from 'fs'

import {
  ctxDir,
  dataDir,
  readConf,
  runCommand,
  runInTmpDir,
} from '../testUtil.ts'

test('remove track', async () => {
  await runInTmpDir(async ctx => {
    await fs.promises.mkdir(ctxDir(ctx, 'data'), { recursive: true })
    fs.copyFileSync(dataDir('simple.2bit'), ctxDir(ctx, 'data/simple.2bit'))
    fs.copyFileSync(dataDir('simple.bam'), ctxDir(ctx, 'data/simple.bam'))
    await runCommand(['add-assembly', 'data/simple.2bit', '--load', 'copy'])
    await runCommand(['add-track', 'data/simple.bam', '--load', 'inPlace'])
    await runCommand(['remove-track', 'simple'])
    const contents = readConf(ctx)
    expect(contents.assemblies.length).toBe(1)
    expect(contents.tracks.length).toBe(0)
  })
})

test('remove track prints message when trackId not found', async () => {
  await runInTmpDir(async ctx => {
    await fs.promises.mkdir(ctxDir(ctx, 'data'), { recursive: true })
    fs.copyFileSync(dataDir('simple.2bit'), ctxDir(ctx, 'data/simple.2bit'))
    fs.copyFileSync(dataDir('simple.bam'), ctxDir(ctx, 'data/simple.bam'))
    await runCommand(['add-assembly', 'data/simple.2bit', '--load', 'copy'])
    await runCommand(['add-track', 'data/simple.bam', '--load', 'inPlace'])
    const { stdout } = await runCommand(['remove-track', 'nonexistent'])
    expect(stdout).toContain('No track found with trackId: nonexistent')
    // original track should be untouched
    expect(readConf(ctx).tracks?.length).toBe(1)
  })
})
