/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import nock from 'nock'
import { runCommand } from '@oclif/test'

// locals
import { runInTmpDir } from '../testUtil'

const { readdir } = fs.promises

const releaseArray = [
  {
    tag_name: 'v0.0.1',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/jbrowse-web-v0.0.1.zip',
        name: 'jbrowse-web-v0.0.1.zip',
      },
    ],
  },
]

function mockReleases() {
  nock('https://api.github.com')
    .get('/repos/GMOD/jbrowse-components/releases?page=1')
    .reply(200, releaseArray)
}

function mockZip() {
  nock('https://example.com')
    .get('/jbrowse-web-v0.0.1.zip')
    .replyWithFile(
      200,
      path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
      { 'Content-Type': 'application/zip' },
    )
}

// Cleaning up exitCode in Node.js 20, xref
// https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

test('fails if no path is provided to the command', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['create'])
    expect(error).toMatchSnapshot()
  })
})

test('fails if no path is provided to the command, even with force', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['create', '--force'])
    expect(error).toMatchSnapshot()
  })
})

test('fails if user selects a directory that already has existing files', async () => {
  await runInTmpDir(async () => {
    nock('https://example.com')
      .get('/jbrowse-web-v0.0.1.json')
      .reply(200, 'I am the wrong type', { 'Content-Type': 'application/json' })
    const { error } = await runCommand(['create', '.'])
    expect(error).toMatchSnapshot()
  })
})
test('fails if the fetch does not return the right file', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand([
      'create',
      'jbrowse',
      '--url',
      'https://example.com/jbrowse-web-v0.0.1.json',
    ])
    expect(error).toMatchSnapshot()
  })
})

test('download and unzips to new directory', async () => {
  await runInTmpDir(async ctx => {
    mockReleases()
    mockZip()
    await runCommand(['create', 'jbrowse'])
    expect(await readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
      'manifest.json',
    )
  })
})

test('downloads from a url', async () => {
  await runInTmpDir(async ctx => {
    mockZip()
    await runCommand([
      'create',
      'jbrowse',
      '--url',
      'https://example.com/jbrowse-web-v0.0.1.zip',
    ])
    expect(await readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
      'manifest.json',
    )
  })
})

test('overwrites and succeeds in download in a non-empty directory with tag', async () => {
  await runInTmpDir(async ctx => {
    nock('https://api.github.com')
      .get('/repos/GMOD/jbrowse-components/releases/tags/v0.0.1')
      .reply(200, releaseArray[0])
    mockZip()
    await runCommand(['create', 'jbrowse', '--tag', 'v0.0.1', '--force'])
    expect(await readdir(path.join(ctx.dir, 'jbrowse'))).toContain(
      'manifest.json',
    )
  })
})

test('fails to download a version that does not exist', async () => {
  await runInTmpDir(async () => {
    nock('https://api.github.com')
      .get('/repos/GMOD/jbrowse-components/releases/tags/v999.999.999')
      .reply(404, {})
    const { error } = await runCommand([
      'create',
      'jbrowse',
      '--tag',
      'v999.999.999',
      '--force',
    ])
    expect(error).toMatchSnapshot()
  })
})

test('fails because this directory is already set up', async () => {
  await runInTmpDir(async () => {
    mockReleases()
    mockZip()
    await runCommand(['create', 'jbrowse'])
    const { error } = await runCommand(['create', 'jbrowse'])
    expect(error).toMatchSnapshot()
  })
})

test('lists versions', async () => {
  await runInTmpDir(async () => {
    nock('https://api.github.com')
      .get('/repos/GMOD/jbrowse-components/releases?page=1')
      .reply(200, releaseArray)
      .get('/repos/GMOD/jbrowse-components/releases?page=2')
      .reply(200, [])
    const { stdout } = await runCommand(['create', '--listVersions'])
    expect(stdout).toBe('All JBrowse versions:\nv0.0.1\n')
  })
})
