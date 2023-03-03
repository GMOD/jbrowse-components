/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'

import { setup, readConf } from '../testUtil'

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

const originalDateNow = Date.now

const setupWithDateMock = setup
  .do(() => {
    Date.now = jest.fn(() => 1)
  })
  .finally(() => {
    Date.now = originalDateNow
  })

describe('add-connection', () => {
  setup
    .nock('https://example.com', site => site.head('/hub.txt').reply(200))
    .command(['add-connection', 'https://example.com/hub.txt'])
    .catch(/no such file or directory/)
    .it('fails if no config file')
  setup
    .command(['add-connection', '.'])
    .exit(160)
    .it('fails if data directory is not an url')
  setup
    .nock('https://mysite.com', site => site.head('/notafile.txt').reply(500))
    .command(['add-connection', 'https://mysite.com/notafile.txt'])
    .exit(170)
    .it('fails when fetching from url fails')
  setup
    .nock('https://example.com', site => site.head('/hub.txt').reply(200))
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-connection',
      'https://example.com/hub.txt',
      '--assemblyName',
      'nonexistAssembly',
    ])
    .exit(130)
    .it('fails if not a matching assembly name')

  setupWithDateMock
    .nock('https://mysite.com', site => site.head('/data/hub.txt').reply(200))
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['add-connection', 'https://mysite.com/data/hub.txt'])
    .it('adds an UCSCTrackHubConnection connection from a url', async ctx => {
      const contents = readConf(ctx)
      expect(contents).toEqual({
        ...defaultConfig,
        connections: [
          {
            type: 'UCSCTrackHubConnection',
            assemblyName: 'testAssembly',
            connectionId: 'UCSCTrackHubConnection-testAssembly-1',
            hubTxtLocation: {
              uri: 'https://mysite.com/data/hub.txt',
              locationType: 'UriLocation',
            },
            name: 'UCSCTrackHubConnection-testAssembly-1',
          },
        ],
      })
    })
  setupWithDateMock
    .nock('https://mysite.com', site => site.head('/jbrowse/data').reply(200))
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['add-connection', 'https://mysite.com/jbrowse/data'])
    .it('adds an JBrowse1 connection from a url', async ctx => {
      const contents = readConf(ctx)
      expect(contents).toEqual({
        ...defaultConfig,
        connections: [
          {
            type: 'JBrowse1Connection',
            assemblyName: 'testAssembly',
            connectionId: 'JBrowse1Connection-testAssembly-1',
            dataDirLocation: {
              uri: 'https://mysite.com/jbrowse/data',
              locationType: 'UriLocation',
            },
            name: 'JBrowse1Connection-testAssembly-1',
          },
        ],
      })
    })
  setup
    .nock('https://mysite.com', site => site.head('/custom').reply(200))
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-connection',
      'https://mysite.com/custom',
      '--type',
      'newType',
      '--connectionId',
      'newConnectionId',
      '--name',
      'newName',
    ])
    .exit(140)
    .it('fails if custom without a config object')
  setup
    .nock('https://mysite.com', site => site.head('/custom').reply(200))
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-connection',
      'https://mysite.com/custom',
      '--type',
      'newType',
      '--connectionId',
      'newConnectionId',
      '--name',
      'newName',
      '--assemblyName',
      'testAssembly',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"}, "locationType": "UriLocation"}',
    ])
    .it('adds a custom connection with user set fields', async ctx => {
      const contents = readConf(ctx)
      expect(contents).toEqual({
        ...defaultConfig,
        connections: [
          {
            type: 'newType',
            assemblyName: 'testAssembly',
            connectionId: 'newConnectionId',
            locationType: 'UriLocation',
            url: {
              uri: 'https://mysite.com/custom',
            },
            name: 'newName',
          },
        ],
      })
    })
  setup
    .nock('https://mysite.com', site => site.head('/custom').reply(200))
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-connection',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"}, "locationType": "UriLocation"}',
    ])
    .nock('https://mysite.com', site => site.head('/custom').reply(200))
    .command([
      'add-connection',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"}, "locationType": "UriLocation"}',
    ])
    .exit(150)
    .it('Fails to add a duplicate connection Id')
  setup
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-connection',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"}, "locationType": "UriLocation"}',
      '--force',
    ])
    .command([
      'add-connection',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
      '--config',
      '{"url":{"uri":"https://mysite.com/custom"}, "locationType": "UriLocation"}',
      '--force',
    ])
    .it(
      'overwrites an existing custom connection and does not check URL',
      async ctx => {
        const contents = readConf(ctx)
        expect(contents).toEqual({
          ...defaultConfig,
          connections: [
            {
              type: 'custom',
              assemblyName: 'testAssembly',
              connectionId: 'newConnectionId',
              locationType: 'UriLocation',
              url: {
                uri: 'https://mysite.com/custom',
              },
              name: 'newConnectionId',
            },
          ],
        })
      },
    )
})
