/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'
import { setup } from '../testUtil'

const fsPromises = fs.promises

describe('create', () => {
  setup
    .command(['create', '{}'])
    .exit()
    .it('fails if no path is provided to the command')
  setup
    .command(['create', '~/Documents/Github'])
    .exit()
    .it(
      'fails if user selects a directory that already has existing files, no force flag',
    )
  setup
    .command(['create', '{}', '--force'])
    .exit()
    .it('fails if no path provided even with force flag')

  setup
    .do(async ctx => {
      const newDir = path.join(
        __dirname,
        '..',
        '..',
        'test',
        'data',
        'createTestDir',
      )
      await fsPromises.mkdir(newDir)
    })
    .command(['create', '../../test/data/createTestDir'])
    .it('download and unzips Jbrowse 2 to new directory', async ctx => {
      expect(await fsPromises.readdir(ctx.dir)).toContain('manifest.json')
    })
})
