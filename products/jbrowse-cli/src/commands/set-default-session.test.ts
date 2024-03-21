/**
 * @jest-environment node
 */

import fs from 'fs'
import path from 'path'
import { setup, readConf, dataDir } from '../testUtil'

const { copyFile, rename } = fs.promises

const defaultConfig = {
  assemblies: [
    {
      name: 'testAssembly',
      sequence: {
        adapter: {
          twoBitLocation: {
            locationType: 'UriLocation',
            uri: 'test.2bit',
          },
          type: 'testSeqAdapter',
        },
        trackId: '',
        type: 'testSequenceTrack',
      },
    },
  ],
  configuration: {},
  connections: [],
  defaultSession: {
    name: 'New Session',
  },
  tracks: [
    {
      adapter: {
        bamLocation: {
          locationType: 'UriLocation',
          uri: 'simple.bam',
        },
        index: {
          indexType: 'BAI',
          location: {
            locationType: 'UriLocation',
            uri: 'simple.bam.bai',
          },
        },
        sequenceAdapter: {
          twoBitLocation: {
            locationType: 'UriLocation',
            uri: 'test.2bit',
          },
          type: 'testSeqAdapter',
        },
        type: 'BamAdapter',
      },
      assemblyNames: ['testAssembly'],
      name: 'simple',
      trackId: 'simple',
      type: 'AlignmentsTrack',
    },
  ],
}

const simpleBam = dataDir('simple.bam')
const simpleDefaultSession = dataDir('sampleDefaultSession.json')
const testConfig = dataDir('test_config.json')

// Cleaning up exitCode in Node.js 20, xref
// https://github.com/jestjs/jest/issues/14501
afterAll(() => (process.exitCode = 0))

describe('set-default-session', () => {
  setup
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['set-default-session'])
    .exit(120)
    .it('fails when no necessary default session information is provided')
  setup
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))
      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['set-default-session', '--session', '{}'])
    .exit(150)
    .it('fails when default session is not readable')
  setup
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))
      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command([
      'set-default-session',
      '--session',
      path.join(simpleDefaultSession, 'nonexist.json'),
    ])
    .exit(150)
    .it('fails when file does not exist')
  setup
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['set-default-session', '--session', simpleBam])
    .exit(160)
    .it('fails when file is does not have a default session to read')

  setup
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['set-default-session', '--delete'])
    .it('deletes a default session', async ctx => {
      const contents = readConf(ctx)

      expect(contents).toEqual({
        ...defaultConfig,
        defaultSession: undefined,
        tracks: [],
      })
    })
  setup
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['set-default-session', '--session', simpleDefaultSession])
    .it('adds a default session from a file', async ctx => {
      const contents = readConf(ctx)
      expect(contents).toEqual({
        ...defaultConfig,
        defaultSession: {
          name: 'test new session',
          views: [
            {
              id: '823WX',
              tracks: [
                {
                  configuration: 'simple',
                  type: 'AlignmentsTrack',
                },
              ],
              type: 'LinearGenomeView',
            },
          ],
        },
        tracks: [],
      })
    })
})
