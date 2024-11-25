/**
 * @jest-environment node
 */

import fs, { mkdirSync } from 'fs'
import path from 'path'
import { runCommand } from '@oclif/test'
import nock from 'nock'
import { runInTmpDir } from '../testUtil'

const { stat, readdir, writeFile } = fs.promises

const releaseArray = [
  {
    tag_name: 'v0.0.2',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/JBrowse2-0.0.2.zip',
        name: 'jbrowse-web-v0.0.2.zip',
      },
    ],
  },
  {
    tag_name: 'v0.0.1',
    prerelease: false,
    assets: [
      {
        browser_download_url: 'https://example.com/JBrowse2-0.0.1.zip',
        name: 'jbrowse-web-v0.0.1.zip',
      },
    ],
  },
]

// Cleaning up exitCode in Node.js 20, xref
// https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

test('fails if user selects a directory that does not have a installation', async () => {
  await runInTmpDir(async () => {
    mkdirSync('jbrowse')
    const { error } = await runCommand(['upgrade', 'jbrowse'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('fails if user selects a directory that does not exist', async () => {
  const { error } = await runCommand(['upgrade', 'jbrowse'])
  expect(error?.message).toMatchSnapshot()
})

test('upgrades a directory', async () => {
  await runInTmpDir(async ctx => {
    nock('https://api.github.com')
      .get('/repos/GMOD/jbrowse-components/releases?page=1')
      .reply(200, releaseArray)
    nock('https://example.com')
      .get('/JBrowse2-0.0.2.zip')
      .replyWithFile(
        200,
        path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
      )
    await writeFile('manifest.json', '{"name":"JBrowse"}')
    const prevStat = await stat(path.join(ctx.dir, 'manifest.json'))
    await runCommand(['upgrade'])
    expect(await readdir(ctx.dir)).toContain('manifest.json')
    // upgrade successful if it updates stats of manifest json
    expect(await stat('manifest.json')).not.toEqual(prevStat)
  })
})

test('upgrades a directory with a specific version', async () => {
  await runInTmpDir(async ctx => {
    nock('https://api.github.com')
      .get('/repos/GMOD/jbrowse-components/releases/tags/v0.0.1')
      .reply(200, releaseArray[1])
    nock('https://example.com')
      .get('/JBrowse2-0.0.1.zip')
      .replyWithFile(
        200,
        path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
        { 'Content-Type': 'application/zip' },
      )

    await writeFile('manifest.json', '{"name":"JBrowse"}')
    await runCommand(['upgrade', '--tag', 'v0.0.1'])
    expect(await readdir(ctx.dir)).toContain('manifest.json')
  })
})

test('upgrades a directory from a url', async () => {
  await runInTmpDir(async ctx => {
    nock('https://example.com')
      .get('/JBrowse2-0.0.1.zip')
      .replyWithFile(
        200,
        path.join(__dirname, '..', '..', 'test', 'data', 'JBrowse2.zip'),
        { 'Content-Type': 'application/zip' },
      )
    await writeFile('manifest.json', '{"name":"JBrowse"}')
    await runCommand([
      'upgrade',
      '--url',
      'https://example.com/JBrowse2-0.0.1.zip',
    ])
    expect(await readdir(ctx.dir)).toContain('manifest.json')
  })
})

test('fails to upgrade if version does not exist', async () => {
  nock('https://api.github.com')
    .get('/repos/GMOD/jbrowse-components/releases/tags/v999.999.999')
    .reply(404, {})

  const { error } = await runCommand(['upgrade', '--tag', 'v999.999.999'])
  expect(error?.message).toMatchSnapshot()
})
test('fails if the fetch does not return the right file', async () => {
  nock('https://example.com')
    .get('/JBrowse2-0.0.1.json')
    .reply(200, 'I am the wrong type', { 'Content-Type': 'application/json' })
  const { error } = await runCommand([
    'upgrade',
    '--url',
    'https://example.com/JBrowse2-0.0.1.json',
  ])
  expect(error?.message).toMatchSnapshot()
})
