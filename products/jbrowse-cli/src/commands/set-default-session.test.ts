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
  tracks: [
    {
      type: 'AlignmentsTrack',
      trackId: 'simple',
      name: 'simple',
      assemblyNames: ['testAssembly'],
      adapter: {
        type: 'BamAdapter',
        bamLocation: {
          uri: 'simple.bam',
          locationType: 'UriLocation',
        },
        index: {
          indexType: 'BAI',
          location: {
            uri: 'simple.bam.bai',
            locationType: 'UriLocation',
          },
        },
        sequenceAdapter: {
          type: 'testSeqAdapter',
          twoBitLocation: {
            uri: 'test.2bit',
            locationType: 'UriLocation',
          },
        },
      },
    },
  ],
}

const simpleBam = dataDir('simple.bam')
const simpleDefaultSession = dataDir('sampleDefaultSession.json')
const testConfig = dataDir('test_config.json')

const setupWithAddTrack = setup
  .do(async ctx => {
    await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))
    await rename(
      path.join(ctx.dir, path.basename(testConfig)),
      path.join(ctx.dir, 'config.json'),
    )
  })
  .command(['add-track', simpleBam, '--load', 'copy'])

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

  setupWithAddTrack
    .do(async ctx => {
      await copyFile(testConfig, path.join(ctx.dir, path.basename(testConfig)))

      await rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['set-default-session', '--tracks', 'simple'])
    .exit(130)
    .it('fails when specifying a track without specifying a view')
  setupWithAddTrack
    .command([
      'set-default-session',
      '--view',
      'LinearGenomeView',
      '--tracks',
      'track-non-exist',
    ])
    .exit(140)
    .it('fails when specifying a track that does not exist')
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
        tracks: [],
        defaultSession: undefined,
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
        tracks: [],
        defaultSession: {
          name: 'test new session',
          views: [
            {
              id: '823WX',
              type: 'LinearGenomeView',
              tracks: [
                {
                  type: 'AlignmentsTrack',
                  configuration: 'simple',
                },
              ],
            },
          ],
        },
      })
    })
  setupWithAddTrack
    .command([
      'set-default-session',
      '--view',
      'LinearGenomeView',
      '--tracks',
      'simple',
    ])
    .it(
      'adds a default session that is a linear genome view and a simple track',
      async ctx => {
        const contents = readConf(ctx)
        expect(contents).toEqual({
          ...defaultConfig,
          defaultSession: {
            name: 'New Default Session',
            views: [
              {
                id: 'LinearGenomeView-1',
                type: 'LinearGenomeView',
                tracks: [
                  {
                    type: 'AlignmentsTrack',
                    configuration: 'simple',
                  },
                ],
              },
            ],
          },
        })
      },
    )
})
