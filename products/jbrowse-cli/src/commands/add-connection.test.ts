/**
 * @vitest-environment node
 */

import fs from 'fs'
import path from 'path'

import { beforeAll, expect, test, vi } from 'vitest'

import { mockFetch, readConf, runCommand, runInTmpDir } from '../testUtil'

vi.mock('../fetchWithProxy')

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

beforeAll(() => (Date.now = vi.fn(() => 1)))

test('fails if no config file', async () => {
  mockFetch({})
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
  mockFetch({ ok: false, status: 500 })
  const { error } = await runCommand([
    'add-connection',
    'https://mysite.com/notafile.txt',
  ])
  expect(error?.message).toMatchSnapshot()
})

test('adds an UCSCTrackHubConnection connection from a url', async () => {
  await runInTmpDir(async ctx => {
    mockFetch({})
    await copyConf(ctx)
    await runCommand(['add-connection', 'https://mysite.com/data/hub.txt'])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})

test('adds JBrowse1 connection from a url', async () => {
  await runInTmpDir(async ctx => {
    mockFetch({})
    await copyConf(ctx)
    await runCommand(['add-connection', 'https://mysite.com/jbrowse/data'])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})

test('adds a custom connection with user set fields', async () => {
  await runInTmpDir(async ctx => {
    mockFetch({})
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
    mockFetch({})
    await copyConf(ctx)
    await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
    ])
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
    mockFetch({})
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
