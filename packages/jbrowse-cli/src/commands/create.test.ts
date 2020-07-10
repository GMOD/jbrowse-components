/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'
import { Scope } from 'nock'
import { setup } from '../testUtil'

const fsPromises = fs.promises

function mockVersionsJson(s3: Scope) {
  return s3.get('/jbrowse.org/jb2_releases/versions.json').reply(200, {
    versions: ['0.0.1'],
  })
}

function mockZipFile(s3: Scope) {
  return s3
    .get('/jbrowse.org/jb2_releases/JBrowse2_version_0.0.1.zip')
    .replyWithFile(
      200,
      path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
    )
}

describe('create', () => {
  setup
    .command(['create'])
    .catch(err => {
      expect(err.message).toContain('Missing 1 required arg:')
      expect(err.message).toContain(
        'localPath  Location where JBrowse 2 will be installed',
      )
      expect(err.message).toContain('See more help with --help')
    })
    .it('fails if no path is provided to the command')
  setup
    .command(['create', '--force'])
    .catch(err => {
      expect(err.message).toContain('Missing 1 required arg:')
      expect(err.message).toContain(
        'localPath  Location where JBrowse 2 will be installed',
      )
      expect(err.message).toContain('See more help with --help')
    })
    .it('fails if no path is provided to the command even with force')
  setup
    .command(['create', '.'])
    .exit(10)
    .it(
      'fails if user selects a directory that already has existing files, no force flag',
    )
  setup
    .nock('https://s3.amazonaws.com', mockVersionsJson)
    .nock('https://s3.amazonaws.com', mockZipFile)
    .command(['create', 'jbrowse'])
    .it('download and unzips JBrowse 2 to new directory', async ctx => {
      expect(await fsPromises.readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
        'manifest.json',
      )
    })
  setup
    .nock('https://s3.amazonaws.com', mockZipFile)
    .command(['create', 'jbrowse', '0.0.1', '--force'])
    .it(
      'overwrites and succeeds in downloading JBrowse in a non-empty directory with version #',
      async ctx => {
        expect(
          await fsPromises.readdir(path.join(ctx.dir, 'jbrowse')),
        ).toContain('manifest.json')
      },
    )
  setup
    .nock('https://s3.amazonaws.com', aws =>
      aws
        .get('/jbrowse.org/jb2_releases/JBrowse2_version_999.999.999.zip')
        .reply(500),
    )
    .command(['create', 'jbrowse', '999.999.999', '--force'])
    .exit(40)
    .it('fails to download a version that does not exist')
  setup
    .nock('https://s3.amazonaws.com', mockVersionsJson)
    .nock('https://s3.amazonaws.com', mockZipFile)
    .command(['create', 'jbrowse'])
    .command(['create', 'jbrowse'])
    .exit(10)
    .it('fails because this directory is already set up')
  setup
    .nock('https://s3.amazonaws.com', mockVersionsJson)
    .command(['create', '--listVersions'])
    .catch(/0/)
    .it('lists versions', ctx => {
      expect(ctx.stdoutWrite).toHaveBeenCalledWith(
        'All JBrowse versions: 0.0.1\n',
      )
    })
})
