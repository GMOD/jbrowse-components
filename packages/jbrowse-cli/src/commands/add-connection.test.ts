/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'

import { setup } from '../testUtil'

const fsPromises = fs.promises

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

function mockDateNow() {
  return 1
}

let originalDateNow: () => number

describe('add-track', () => {
  beforeEach(() => {
    originalDateNow = Date.now
    Date.now = mockDateNow
  })
  afterEach(() => {
    Date.now = originalDateNow
  })

  setup
    .command(['add-connection', 'testAssembly', 'https://example.com'])
    .exit(10)
    .it('fails if no config file')
  setup
    .command(['add-connection', 'testAssembly', '.'])
    .exit(80)
    .it('fails if data directory is not a url')
  setup
    .nock('https://mysite.com', site => site.head('/notafile.txt').reply(500))
    .command([
      'add-connection',
      'testAssembly',
      'https://mysite.com/notafile.txt',
    ])
    .exit(100)
    .it('fails when fetching from url fails')
  setup
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['add-connection', 'nonexistAssembly', 'https://example.com'])
    .exit(40)
    .it('fails if not a matching assembly name')
  setup
    .do(async () => {
      await fsPromises.unlink('manifest.json')
    })
    .command(['add-connection', 'testAssembly', 'https://example.com'])
    .exit(50)
    .it('fails if no manifest.json found in cwd')
  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', 'This Is Invalid JSON')
    })
    .command(['add-connection', 'testAssembly', 'https://example.com'])
    .exit(60)
    .it("fails if it can't parse manifest.json")

  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', '{"name":"NotJBrowse"}')
    })
    .command(['add-connection', 'testAssembly', 'https://example.com'])
    .exit(70)
    .it('fails if "name" in manifest.json is not "JBrowse"')

  setup
    .nock('https://mysite.com', site => site.head('/data/hub.txt').reply(200))
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-connection',
      'testAssembly',
      'https://mysite.com/data/hub.txt',
    ])
    .it('adds an UCSCTrackHubConnection connection from a url', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        connections: [
          {
            type: 'UCSCTrackHubConnection',
            assemblyName: 'testAssembly',
            connectionId: `UCSCTrackHubConnection-testAssembly-1`,
            hubTxtLocation: {
              uri: 'https://mysite.com/data/hub.txt',
            },
            name: `UCSCTrackHubConnection-testAssembly-1`,
          },
        ],
      })
    })
  setup
    .nock('https://mysite.com', site => site.head('/jbrowse/data').reply(200))
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-connection',
      'testAssembly',
      'https://mysite.com/jbrowse/data',
    ])
    .it('adds an JBrowse1 connection from a url', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        connections: [
          {
            type: 'JBrowse1Connection',
            assemblyName: 'testAssembly',
            connectionId: `JBrowse1Connection-testAssembly-1`,
            dataDirLocation: {
              uri: 'https://mysite.com/jbrowse/data',
            },
            name: `JBrowse1Connection-testAssembly-1`,
          },
        ],
      })
    })
  setup
    .nock('https://mysite.com', site => site.head('/custom').reply(200))
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-connection',
      'testAssembly',
      'https://mysite.com/custom',
      '--type',
      'newType',
      '--connectionId',
      'newConnectionId',
      '--name',
      'newName',
    ])
    .it('adds a custom connection with user set fields', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        connections: [
          {
            type: 'newType',
            assemblyName: 'testAssembly',
            connectionId: `newConnectionId`,
            url: {
              uri: 'https://mysite.com/custom',
            },
            name: `newName`,
          },
        ],
      })
    })
  setup
    .nock('https://mysite.com', site => site.head('/custom').reply(200))
    .do(async ctx => {
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'add-connection',
      'testAssembly',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
    ])
    .nock('https://mysite.com', site => site.head('/custom').reply(200))
    .command([
      'add-connection',
      'testAssembly',
      'https://mysite.com/custom',
      '--connectionId',
      'newConnectionId',
    ])
    .exit(40)
    .it('Fails to add a duplicate connection Id')
})
