/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { setup, readConf } from '../testUtil'

const twoPath = path.join(__dirname, '..', '..', 'test', 'data', 'simple.2bit')

// Cleaning up exitCode in Node.js 20, xref https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

describe('add-assembly', () => {
  setup
    .do(ctx =>
      fs.copyFileSync(twoPath, path.join(ctx.dir, path.basename(twoPath))),
    )
    .command(['add-assembly', 'simple.2bit', '--load', 'copy'])
    .command(['add-track', 'simple.bam', '--load', 'inPlace'])
    .command(['remove-track', 'simple'])
    .it('can use --out to make a new directory', async ctx => {
      const contents = readConf(ctx)
      expect(contents.assemblies.length).toBe(1)
      expect(contents.tracks.length).toBe(0)
    })
})
