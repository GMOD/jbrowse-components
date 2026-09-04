/**
 * @jest-environment node
 */

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

import {
  dataDir,
  mockGlobalFetch,
  openWebStream,
  runCommand,
  runInTmpDir,
} from '../../testUtil.ts'

afterEach(() => {
  jest.restoreAllMocks()
})

const configPath = dataDir('indexing_config.json')
const volvoxDir = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'test_data',
  'volvox',
)

const ixLoc = (loc: string, b = 'volvox') => path.join(loc, 'trix', `${b}.ix`)
const ixxLoc = (loc: string, b = 'volvox') => path.join(loc, 'trix', `${b}.ixx`)

function readText(str: string) {
  return fs.readFileSync(str, 'utf8')
}

function readJSON(str: string) {
  return JSON.parse(readText(str))
}

function readTrix(d: string, s: string) {
  return readText(path.join(d, 'trix', s))
}
function readTrixJSON(d: string, s: string) {
  return JSON.parse(readTrix(d, s), (key, value) =>
    key === 'dateCreated' ? 'test' : value,
  )
}

function verifyIxxFiles(ctx: string, base = 'volvox') {
  const ixdata = readText(ixLoc(ctx, base))
  const ixxdata = readText(ixxLoc(ctx, base))
  expect(ixdata.slice(0, 1000)).toMatchSnapshot()
  expect(ixdata.slice(-1000)).toMatchSnapshot()
  expect(ixdata.length).toMatchSnapshot()
  expect(ixxdata).toMatchSnapshot()
}

test('fails if no track ids are provided with --tracks flag.', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['text-index', '--tracks'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('indexes all supported tracks when --tracks flag is not provided', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    const config = {
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'TwoBitAdapter',
              twoBitLocation: {
                uri: 'volvox.2bit',
                locationType: 'UriLocation',
              },
            },
          },
        },
      ],
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'gff3_track_1',
          assemblyNames: ['volvox'],
          name: 'GFF3 Track 1',
          adapter: {
            type: 'Gff3TabixAdapter',
            gffGzLocation: {
              uri: 'volvox.sort.gff3.gz',
              locationType: 'UriLocation',
            },
          },
        },
        {
          type: 'AlignmentsTrack',
          trackId: 'bam_track',
          assemblyNames: ['volvox'],
          name: 'BAM Track (should be skipped)',
          adapter: {
            type: 'BamAdapter',
            bamLocation: { uri: 'test.bam', locationType: 'UriLocation' },
          },
        },
      ],
    }
    fs.writeFileSync(path.join(ctx.dir, 'config.json'), JSON.stringify(config))

    await runCommand([
      'text-index',
      '--target=config.json',
      '--attributes',
      'Name,ID,Note',
      '--excludeTracks',
      'gff3_custom_tooltips,gff3_mouseover_attr',
    ])

    expect(fs.existsSync(ixLoc(ctx.dir))).toBe(true)
    expect(fs.existsSync(ixxLoc(ctx.dir))).toBe(true)

    const metaPath = path.join(ctx.dir, 'trix', 'volvox_meta.json')
    expect(fs.existsSync(metaPath)).toBe(true)
    const meta = readJSON(metaPath)
    expect(meta.tracks).toHaveLength(1)
    expect(meta.tracks[0].trackId).toBe('gff3_track_1')
  })
})

test('fails if there is an invalid flag', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['text-index', '--Command'])
    expect(error?.message).toMatchSnapshot()
  })
})

test('indexes a local non-gz gff3 file', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('au9_scaffold_subset_sync.gff3')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})
test('indexes a local gz gff3 file', async () => {
  await runInTmpDir(async ctx => {
    // Gzipped File
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=gff3tabix_genes',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})
test('indexes a remote gz gff3 file', async () => {
  await runInTmpDir(async ctx => {
    mockGlobalFetch(async () => ({
      body: openWebStream(dataDir('volvox.sort.gff3.gz')),
    }))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=online_gff3tabix_genes',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes a remote non-gz gff3 file', async () => {
  await runInTmpDir(async ctx => {
    mockGlobalFetch(async () => ({
      body: openWebStream(dataDir('au9_scaffold_subset_sync.gff3')),
    }))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=online_au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes multiple local gff3 files', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('volvox.sort.gff3.gz')
    const gff3File2 = dataDir('au9_scaffold_subset_sync.gff3')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(gff3File2, path.join(ctx.dir, path.basename(gff3File2)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=gff3tabix_genes,au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes multiple remote gff3 file', async () => {
  await runInTmpDir(async ctx => {
    mockGlobalFetch(async url => {
      if (url.includes('volvox.sort.gff3.gz')) {
        return { body: openWebStream(dataDir('volvox.sort.gff3.gz')) }
      }
      return {
        body: openWebStream(dataDir('au9_scaffold_subset_sync.gff3')),
      }
    })
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=online_gff3tabix_genes,online_au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes a remote and a local file', async () => {
  await runInTmpDir(async ctx => {
    mockGlobalFetch(async () => ({
      body: openWebStream(dataDir('au9_scaffold_subset_sync.gff3')),
    }))
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=gff3tabix_genes,online_au9_scaffold',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

test('indexes a track using only the attributes tag', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=noAttributes',
      '--target=config.json',
      '--attributes=ID',
    ])
    verifyIxxFiles(ctx.dir)
  })
})

// no attributes in track
test('indexes a track with no attributes in the config', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    await runCommand([
      'text-index',
      '--tracks=noAttributes',
      '--target=config.json',
    ])
    verifyIxxFiles(ctx.dir)
  })
})
test('indexes with multiple per-file args', async () => {
  await runInTmpDir(async ctx => {
    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })
    await runCommand([
      'text-index',
      '--file',
      'volvox.sort.gff3.gz',
      '--file',
      'volvox.filtered.vcf.gz',
    ])
    verifyIxxFiles(ctx.dir, 'aggregate')
  })
})

test('indexes with  single per-file arg', async () => {
  await runInTmpDir(async ctx => {
    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })
    await runCommand(['text-index', '--file', 'volvox.sort.gff3.gz'])
    verifyIxxFiles(ctx.dir, 'volvox.sort.gff3.gz')
  })
})

test('indexes single assembly volvox config', async () => {
  await runInTmpDir(async ctx => {
    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })
    const volvoxConfig = readJSON(path.join(ctx.dir, 'config.json'))
    const assembly = volvoxConfig.assemblies[0]
    volvoxConfig.assemblies = undefined
    fs.writeFileSync(
      path.join(ctx.dir, 'config.json'),
      JSON.stringify({ ...volvoxConfig, assembly }),
    )

    const preVolvoxIx = readTrix(ctx.dir, 'volvox.ix')
    const preVolvoxIxx = readTrix(ctx.dir, 'volvox.ixx')
    const preVolvoxMeta = readTrixJSON(ctx.dir, 'volvox_meta.json')
    await runCommand([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    // tracks excluded from indexing carry metadata.skipTextIndex in the volvox
    // config (gff3_custom_tooltips, gff3_mouseover_attr, volvox_variants_vcf,
    // gff3tabix_genes_jexl_color), so no --excludeTracks flag is needed.
    // to update (e.g. if volvox config is updated) run:
    // jbrowse text-index --out ../../test_data/volvox/ --attributes Name,ID,Note --force
    expect(readTrix(ctx.dir, 'volvox.ix')).toEqual(preVolvoxIx)
    expect(readTrix(ctx.dir, 'volvox.ixx')).toEqual(preVolvoxIxx)
    expect(readTrixJSON(ctx.dir, 'volvox_meta.json')).toEqual(preVolvoxMeta)
  })
})

test('indexes entire volvox config', async () => {
  await runInTmpDir(async ctx => {
    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })

    const preVolvoxIx = readTrix(ctx.dir, 'volvox.ix')
    const preVolvoxIxx = readTrix(ctx.dir, 'volvox.ixx')
    const preVolvoxMeta = readTrixJSON(ctx.dir, 'volvox_meta.json')
    await runCommand([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    // tracks excluded from indexing carry metadata.skipTextIndex in the volvox
    // config (gff3_custom_tooltips, gff3_mouseover_attr, volvox_variants_vcf,
    // gff3tabix_genes_jexl_color), so no --excludeTracks flag is needed.
    // to update (e.g. if volvox config is updated) run:
    // jbrowse text-index --out ../../test_data/volvox/ --attributes Name,ID,Note --force
    expect(readTrix(ctx.dir, 'volvox.ix')).toEqual(preVolvoxIx)
    expect(readTrix(ctx.dir, 'volvox.ixx')).toEqual(preVolvoxIxx)
    expect(readTrixJSON(ctx.dir, 'volvox_meta.json')).toEqual(preVolvoxMeta)
  })
})

// Integration test with real HTTP server - tests fix for remote gz file streaming
// This tests the ReadableStream.from() fix in @jbrowse/text-indexing
describe('real HTTP server integration', () => {
  let server: http.Server
  let serverPort: number

  beforeAll(done => {
    server = http.createServer((req, res) => {
      const gzFilePath = dataDir('volvox.sort.gff3.gz')
      if (req.url?.includes('volvox.sort.gff3.gz')) {
        const stat = fs.statSync(gzFilePath)
        res.writeHead(200, {
          'Content-Type': 'application/gzip',
          'Content-Length': stat.size,
        })
        fs.createReadStream(gzFilePath).pipe(res)
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })
    server.listen(0, () => {
      const addr = server.address()
      if (addr && typeof addr === 'object') {
        serverPort = addr.port
      }
      done()
    })
  })

  afterAll(done => {
    server.close(done)
  })

  test('indexes a remote gz gff3 file from real HTTP server', async () => {
    await runInTmpDir(async ctx => {
      const config = {
        assemblies: [
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              adapter: {
                type: 'TwoBitAdapter',
                twoBitLocation: {
                  uri: 'volvox.2bit',
                  locationType: 'UriLocation',
                },
              },
            },
          },
        ],
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'remote_gff3_gz',
            assemblyNames: ['volvox'],
            name: 'Remote GFF3 GZ',
            adapter: {
              type: 'Gff3TabixAdapter',
              gffGzLocation: {
                uri: `http://localhost:${serverPort}/volvox.sort.gff3.gz`,
                locationType: 'UriLocation',
              },
            },
          },
        ],
      }
      fs.writeFileSync(
        path.join(ctx.dir, 'config.json'),
        JSON.stringify(config),
      )

      await runCommand([
        'text-index',
        '--tracks=remote_gff3_gz',
        '--target=config.json',
      ])

      // Verify index files were created
      expect(fs.existsSync(ixLoc(ctx.dir))).toBe(true)
      expect(fs.existsSync(ixxLoc(ctx.dir))).toBe(true)
      verifyIxxFiles(ctx.dir)
    })
  })
})

// --dryrun only prints what it would index, so it must not touch disk
test('dryrun does not create a trix directory', async () => {
  await runInTmpDir(async ctx => {
    fs.copyFileSync(configPath, path.join(ctx.dir, 'config.json'))
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))

    const { stdout } = await runCommand(['text-index', '--dryrun'])
    expect(stdout).toContain('Gff3TabixAdapter')
    expect(fs.existsSync(path.join(ctx.dir, 'trix'))).toBe(false)
  })
})

// --out/--target take either the install dir or its config.json everywhere else;
// the --file path used to mkdir config.json/trix and die with ENOTDIR
test('indexes a file list when --out names the config.json', async () => {
  await runInTmpDir(async ctx => {
    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })
    fs.rmSync(path.join(ctx.dir, 'trix'), { recursive: true, force: true })

    const { error } = await runCommand([
      'text-index',
      '--file',
      'volvox.sort.gff3.gz',
      '--out',
      path.join(ctx.dir, 'config.json'),
    ])
    expect(error).toBeUndefined()
    expect(fs.existsSync(ixLoc(ctx.dir, 'volvox.sort.gff3.gz'))).toBe(true)
  })
})

// a missing config.json is the most common mistake, so it must say which one it
// looked for rather than leaking a bare readFileSync ENOENT
test('reports the missing config when there is none to index', async () => {
  await runInTmpDir(async () => {
    const { error } = await runCommand(['text-index'])
    expect(error?.message).toContain('No JBrowse config found at')
  })
})

// The .ix write used the raw name while generateMeta and createTrixAdapter both
// sanitized, so a trackId with a slash aimed the write at a trix/ subdirectory
// that does not exist. The other Windows-invalid characters were quieter: the
// file wrote, under a name no search would look for.
test('a trackId with a slash indexes to the path its adapter names', async () => {
  await runInTmpDir(async ctx => {
    const gff3File = dataDir('volvox.sort.gff3.gz')
    fs.copyFileSync(gff3File, path.join(ctx.dir, path.basename(gff3File)))
    fs.writeFileSync(
      path.join(ctx.dir, 'config.json'),
      JSON.stringify({
        assemblies: [
          {
            name: 'volvox',
            sequence: {
              type: 'ReferenceSequenceTrack',
              trackId: 'volvox_refseq',
              adapter: {
                type: 'TwoBitAdapter',
                twoBitLocation: {
                  uri: 'volvox.2bit',
                  locationType: 'UriLocation',
                },
              },
            },
          },
        ],
        tracks: [
          {
            type: 'FeatureTrack',
            trackId: 'test_a/b-1234',
            assemblyNames: ['volvox'],
            name: 'test A/B',
            adapter: {
              type: 'Gff3TabixAdapter',
              gffGzLocation: {
                uri: 'volvox.sort.gff3.gz',
                locationType: 'UriLocation',
              },
            },
          },
        ],
      }),
    )

    const { error } = await runCommand([
      'text-index',
      '--perTrack',
      '--target=config.json',
    ])
    expect(error).toBeUndefined()

    const conf = readJSON(path.join(ctx.dir, 'config.json'))
    const adapter = conf.tracks[0].textSearching.textSearchAdapter
    expect(adapter.ixFilePath.uri).toBe('trix/test_a_b-1234.ix')
    for (const uri of [
      adapter.ixFilePath.uri,
      adapter.ixxFilePath.uri,
      adapter.metaFilePath.uri,
    ]) {
      expect(fs.existsSync(path.join(ctx.dir, uri))).toBe(true)
    }
  })
})
