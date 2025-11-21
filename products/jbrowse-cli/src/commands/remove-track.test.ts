/**
 * @vitest-environment node
 */

import fs from 'fs'
import path from 'path'

import { expect, test } from 'vitest'

import { readConf, runCommand, runInTmpDir } from '../testUtil'

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
