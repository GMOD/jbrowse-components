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
    .exit(120)
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
    .command(['set-default-session', '--session', '{}'])
    .exit(150)
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
    .command([
      'set-default-session',
      '--session',
      path.join(simpleDefaultSession, 'nonexist.json'),
    ])
    .exit(150)
    .it('fails when file does not exist')
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
    .command(['set-default-session', '--session', simpleBam])
    .exit(160)
    .it('fails when file is does not have a default session to read')
  setup
    .do(async () => {
      await fsPromises.unlink('manifest.json')
    })
    .command(['set-default-session', '--session', simpleDefaultSession])
    .exit(10)
    .it('fails if no manifest.json found in cwd')
  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', 'This Is Invalid JSON')
    })
    .command(['set-default-session', '--session', simpleDefaultSession])
    .exit(20)
    .it("fails if it can't parse manifest.json")

  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', '{"name":"NotJBrowse"}')
    })
    .command(['set-default-session', '--session', simpleDefaultSession])
    .exit(30)
    .it('fails if "name" in manifest.json is not "JBrowse"')
  setupWithAddTrack
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
      await fsPromises.copyFile(
        testConfig,
        path.join(ctx.dir, path.basename(testConfig)),
      )

      await fsPromises.rename(
        path.join(ctx.dir, path.basename(testConfig)),
        path.join(ctx.dir, 'config.json'),
      )
    })
    .command(['set-default-session', '--session', simpleDefaultSession])
    .it('adds a default session from a file', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
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
        const contents = await fsPromises.readFile(
          path.join(ctx.dir, 'config.json'),
          { encoding: 'utf8' },
        )
        expect(JSON.parse(contents)).toEqual({
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
