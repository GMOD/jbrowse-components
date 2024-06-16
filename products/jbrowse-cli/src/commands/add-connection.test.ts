/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { setup, readConf, runInTmpDir } from '../testUtil'
import nock from 'nock'
import { runCommand } from '@oclif/test'

const { copyFile, rename } = fs.promises

const defaultConfig = {
  assemblies: [
    {
      name: 'testAssembly',
      sequence: {
        type: 'testSequenceTrack',
        trackId: '',
        adapter: {
          type: 'testSeqAdapter',
          twoBitLocation: {
            uri: 'test.2bit',
            locationType: 'UriLocation',
          },
        },
      },
    },
  ],
  configuration: {},
  connections: [],
  defaultSession: {
    name: 'New Session',
  },
  tracks: [],
}

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
// const originalDateNow = Date.now

// const setupWithDateMock = setup
//   .do(() => {
//     Date.now = jest.fn(() => 1)
//   })
//   .finally(() => {
//     Date.now = originalDateNow
//   })

// Cleaning up exitCode in Node.js 20, xref https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))
beforeAll(() => (Date.now = jest.fn(() => 1)))

test('fails if no config file', async () => {
  nock('https://example.com').head('/hub.txt').reply(200)

  const { error } = await runCommand([
    'add-connection https://example.com/hub.txt',
  ])
  expect(error).toMatchSnapshot()
})

test('fails if data directory is not an url', async () => {
  const { error } = await runCommand(['add-connection .'])
  expect(error).toMatchSnapshot()
})

test('fails when fetching from url fails', async () => {
  nock('https://mysite.com').head('/notafile.txt').reply(500)
  const { error } = await runCommand([
    'add-connection https://mysite.com/notafile.txt',
  ])
  expect(error).toMatchSnapshot()
})

test('adds an UCSCTrackHubConnection connection from a url', async () => {
  await runInTmpDir(async ctx => {
    nock('https://mysite.com').head('/data/hub.txt').reply(200)
    await copyConf(ctx)
    await runCommand(['add-connection', 'https://mysite.com/data/hub.txt'])
    expect(readConf(ctx)).toMatchSnapshot()
  })
})

test('adds JBrowse1 connection from a url', async () => {
  await runInTmpDir(async ctx => {
    nock('https://mysite.com').head('/jbrowse/data').reply(200)
    await copyConf(ctx)
    await runCommand(['add-connection', 'https://mysite.com/jbrowse/data'])
    expect(readConf(ctx)).toMatchSnapshot()
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
    expect(readConf(ctx)).toMatchSnapshot()
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
    expect(error).toMatchSnapshot()
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
    expect(readConf(ctx)).toMatchSnapshot()
  })
})
