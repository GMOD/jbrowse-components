/**
 * @jest-environment node
 */

import fs from 'node:fs'
import path from 'node:path'

import { readConf, runCommand, runInTmpDir } from '../testUtil.ts'

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

beforeAll(() => (Date.now = jest.fn(() => 1)))

test('fails if no config file', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand([
      'add-connection',
      'https://example.com/hub.txt',
    ])
    // not a snapshot: the message names the absolute config path, which is a
    // different tmp dir on every run
    expect(error?.message).toContain('No JBrowse config found at')
    expect(error?.message).toContain('jbrowse create <dir>')
  })
})

test('fails if data directory is not an url', async () => {
  const { error } = await runCommand(['add-connection .'])
  expect(error?.message).toMatchSnapshot()
})

test('adds an UCSCTrackHubConnection connection from a url', async () => {
  await runInTmpDir(async ctx => {
    await copyConf(ctx)
    await runCommand(['add-connection', 'https://mysite.com/data/hub.txt'])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})

test('adds JBrowse1 connection from a url', async () => {
  await runInTmpDir(async ctx => {
    await copyConf(ctx)
    await runCommand(['add-connection', 'https://mysite.com/jbrowse/data'])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})

test('adds a JB2TrackHubConnection from a config.json url', async () => {
  await runInTmpDir(async ctx => {
    await copyConf(ctx)
    await runCommand(['add-connection', 'https://mysite.com/jb2/config.json'])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})

test('adds a custom connection with user set fields', async () => {
  await runInTmpDir(async ctx => {
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
    await copyConf(ctx)
    await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--type',
      'newType',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
    ])
    const { error } = await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--type',
      'newType',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
    ])
    expect(error?.message).toMatchSnapshot()
  })
})

test('can use --force to overwrite an existing connection', async () => {
  await runInTmpDir(async ctx => {
    await copyConf(ctx)
    await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--type',
      'newType',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
      '--force',
    ])
    await runCommand([
      'add-connection',
      'https://mysite.com/custom',
      '--type',
      'newType',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"},"locationType":"UriLocation"}',
      '--force',
    ])
    expect(readConf(ctx).connections).toMatchSnapshot()
  })
})

// the connection type is inferred from the URL's path, not the whole href: a
// query string used to hide a hub.txt filename from path.basename, and to fake a
// jbrowse/data path that wasn't in the path at all
test('infers the connection type from the URL path', async () => {
  await runInTmpDir(async ctx => {
    await copyConf(ctx)
    await runCommand([
      'add-connection',
      'https://mysite.com/path/to/hub.txt?token=1',
      '--connectionId',
      'testId',
    ])
    expect(readConf(ctx).connections[0].type).toBe('UCSCTrackHubConnection')
  })
})

// a type nothing registers wrote an entry with the URL nowhere in it, which
// the app dropped on load
test('refuses a URL whose type it cannot infer, query string included', async () => {
  await runInTmpDir(async ctx => {
    await copyConf(ctx)
    const { error } = await runCommand([
      'add-connection',
      'https://mysite.com/data?p=jbrowse/data',
      '--connectionId',
      'testId',
    ])
    expect(error?.message).toMatch(/Cannot infer the connection type/)
    expect(readConf(ctx).connections).toEqual([])
  })
})
