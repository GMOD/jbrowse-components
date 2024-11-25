/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { runCommand } from '@oclif/test'
import { readConf, runInTmpDir } from '../testUtil'

const twoPath = path.join(__dirname, '..', '..', 'test', 'data', 'simple.2bit')

// Cleaning up exitCode in Node.js 20, xref
// https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

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
