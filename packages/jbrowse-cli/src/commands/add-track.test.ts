/**
 * @jest-environment node
 */

import fs from 'fs'
import * as path from 'path'

import { setup } from '../testUtil'

interface Config {
  assemblies: []
}
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

const simpleBam = path.join(__dirname, '..', '..', 'test', 'data', 'simple.bam')
const testConfig = path.join(
  __dirname,
  '..',
  '..',
  'test',
  'data',
  'test_config.json',
)

describe('add-track', () => {
  setup
    .command(['add-track', '{}'])
    .exit(90)
    .it('fails if no data directory is specified')
  setup
    .command(['add-track', simpleBam])
    .exit(10)
    .it('fails if load flag isnt passed')
  setup
    .do(async () => {
      await fsPromises.unlink('manifest.json')
    })
    .command(['add-track', simpleBam])
    .exit(50)
    .it('fails if no manifest.json found in cwd')
  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', 'This Is Invalid JSON')
    })
    .command(['add-track', simpleBam])
    .exit(60)
    .it("fails if it can't parse manifest.json")

  setup
    .do(async () => {
      await fsPromises.writeFile('manifest.json', '{"name":"NotJBrowse"}')
    })
    .command(['add-track', simpleBam])
    .exit(70)
    .it('fails if "name" in manifest.json is not "JBrowse"')
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
    .command(['add-track', simpleBam, '--load', 'copy'])
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(40)
    .it('Cannot add a track with the same track id')
  setup
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(30)
    .it('Cannot add a track if there is no config file')
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
      await fsPromises.writeFile(
        path.join(ctx.dir, 'config.json'),
        '{"assemblies":[]}',
      )
    })
    .command(['add-track', simpleBam, '--load', 'copy'])
    .exit(100)
    .it('fails if it cannot assume the assemblyname')

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
    .command(['add-track', simpleBam, '--load', 'copy'])
    .it('adds a track', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        tracks: [
          {
            type: 'AlignmentsTrack',
            trackId: 'simple',
            name: 'simple',
            assemblyNames: ['testAssembly'],
            adapter: {
              type: 'BamAdapter',
              bamLocation: {
                localPath: 'simple.bam',
              },
              index: {
                location: {
                  localPath: 'simple.bam.bai',
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
      })
    })
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
      'add-track',
      simpleBam,
      '--load',
      'copy',
      '--name',
      'customName',
      '--trackId',
      'customTrackId',
      '--description',
      'new description',
      '--type',
      'CustomTrackType',
      '--category',
      'newcategory',
      '--assemblyNames',
      'customAssemblyName',
      '--config',
      '{"defaultrendering": "test"}',
    ])
    .it('adds a track with all the custom fields', async ctx => {
      const contents = await fsPromises.readFile(
        path.join(ctx.dir, 'config.json'),
        { encoding: 'utf8' },
      )
      expect(JSON.parse(contents)).toEqual({
        ...defaultConfig,
        tracks: [
          {
            type: 'CustomTrackType',
            trackId: 'customTrackId',
            name: 'customName',
            description: 'new description',
            category: ['newcategory'],
            assemblyNames: ['customAssemblyName'],
            adapter: {
              type: 'BamAdapter',
              bamLocation: {
                localPath: 'simple.bam',
              },
              index: {
                location: {
                  localPath: 'simple.bam.bai',
                },
              },
            },
            defaultrendering: 'test',
          },
        ],
      })
    })
})
