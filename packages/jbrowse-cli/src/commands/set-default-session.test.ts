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
  tracks: [
    [
      {
        type: 'AlignmentsTrack',
        trackId: 'simple',
        name: 'simple',
        assemblyNames: ['testAssembly'],
        adapter: {
          type: 'BamAdapter',
          bamLocation: {
            uri: 'simple.bam',
          },
          index: {
            location: {
              uri: 'simple.bam.bai',
            },
          },
          sequenceAdapter: {
            type: 'testSeqAdapter',
            twoBitLocation: {
              uri: 'test.2bit',
            },
          },
        },
      },
    ],
  ],
}

const simpleBam = path.join(__dirname, '..', '..', 'test', 'data', 'simple.bam')
const simpleDefaultSession = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'sampleDefaultSession.json',
)

const testConfig = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'test_config.json',
)

const setupWithAddTrack = setup
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
  .command(['add-track', simpleBam, '--load', 'copy'])

describe('set-default-session', () => {
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
    .command(['set-default-session'])
    .exit(15)
    .it('fails when no necessary default session information is provided')
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
    .command(['set-default-session', '{}'])
    .exit(40)
    .it('fails when default session is not readable')
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
    .command(['set-default-session', '--tracks', 'track-id-nonexist'])
    .exit(10)
    .it('fails when specifying a track that is not in the config yet')
  setup
    .do(async () => {
      await fsPromises.unlink('manifest.json')
    })
    .command(['set-default-session', simpleDefaultSession])
    .exit(10)
    .it('fails if no manifest.json found in cwd')
  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', 'This Is Invalid JSON')
    })
    .command(['set-default-session', simpleDefaultSession])
    .exit(20)
    .it("fails if it can't parse manifest.json")

  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', '{"name":"NotJBrowse"}')
    })
    .command(['set-default-session', simpleDefaultSession])
    .exit(30)
    .it('fails if "name" in manifest.json is not "JBrowse"')
})
