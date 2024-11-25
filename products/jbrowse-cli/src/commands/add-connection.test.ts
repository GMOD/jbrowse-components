/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { runCommand } from '@oclif/test'
import nock from 'nock'
import { readConf, runInTmpDir } from '../testUtil'

const { copyFile, rename } = fs.promises

const testConfig = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'test_config.json',
)

async function copyConf(ctx: { dir: string }) {
  await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

  await rename(
    path.join(ctx.dir, path.basename(testConfig)),
    path.join(ctx.dir, 'config.json'),
  )
}

// Cleaning up exitCode in Node.js 20, xref
// https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))
beforeAll(() => (Date.now = jest.fn(() => 1)))

test('fails if no config file', async () => {
  nock('https://example.com').head('/hub.txt').reply(200)

  const { error } = await runCommand([
    'add-connection',
    'https://example.com/hub.txt',
  ])
  expect(error?.message).toMatchSnapshot()
})

test('fails if data directory is not an url', async () => {
  const { error } = await runCommand(['add-connection .'])
  expect(error?.message).toMatchSnapshot()
})

test('fails when fetching from url fails', async () => {
  nock('https://mysite.com').head('/notafile.txt').reply(500)
  const { error } = await runCommand([
    'add-connection',
    'https://mysite.com/notafile.txt',
  ])
  expect(error?.message).toMatchSnapshot()
})

test('adds an UCSCTrackHubConnection connection from a url', async () => {
  await runInTmpDir(async ctx => {
    nock('https://mysite.com').head('/data/hub.txt').reply(200)
    await copyConf(ctx)
    await runCommand(['add-connection', 'https://mysite.com/data/hub.txt'])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})

test('adds JBrowse1 connection from a url', async () => {
  await runInTmpDir(async ctx => {
    nock('https://mysite.com').head('/jbrowse/data').reply(200)
    await copyConf(ctx)
    await runCommand(['add-connection', 'https://mysite.com/jbrowse/data'])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})
test('adds a custom connection with user set fields', async () => {
  await runInTmpDir(async ctx => {
    nock('https://mysite.com').head('/custom').reply(200)
    await copyConf(ctx)
    await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--type',
      'newType',
      '--connectionId',
      'newConnectionId',
      '--name',
      'newName',
      '--assemblyNames',
      'testAssembly',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
    ])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})
test('fails to add a duplicate connection', async () => {
  await runInTmpDir(async ctx => {
    nock('https://mysite.com').head('/custom').reply(200)
    await copyConf(ctx)
    await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
    ])
    nock('https://mysite.com').head('/custom').reply(200)
    const { error } = await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
    ])
    expect(error?.message).toMatchSnapshot()
  })
})
test('overwrites an existing custom connection and does not check URL', async () => {
  await runInTmpDir(async ctx => {
    nock('https://mysite.com').head('/custom').reply(200)
    await copyConf(ctx)
    await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
      '--force',
    ])
    nock('https://mysite.com').head('/custom').reply(200)
    await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
      '--force',
    ])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})
