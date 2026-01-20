/**
 * @jest-environment node
 */

import fs from 'fs'
import http from 'http'
import path from 'path'

import {
  dataDir,
  mockFetch,
  openWebStream,
  runCommand,
  runInTmpDir,
} from '../../testUtil.ts'

jest.mock('../../fetchWithProxy')

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
    mockFetch(async () => ({
      body: await openWebStream(dataDir('volvox.sort.gff3.gz')),
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
    mockFetch(async () => ({
      body: await openWebStream(dataDir('au9_scaffold_subset_sync.gff3')),
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
    mockFetch(async url => {
      if (url.includes('volvox.sort.gff3.gz')) {
        return { body: await openWebStream(dataDir('volvox.sort.gff3.gz')) }
      }
      return {
        body: await openWebStream(dataDir('au9_scaffold_subset_sync.gff3')),
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
    mockFetch(async () => ({
      body: await openWebStream(dataDir('au9_scaffold_subset_sync.gff3')),
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
    let preVolvoxIx = ''
    let preVolvoxIxx = ''
    let preVolvoxMeta = ''

    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })
    const volvoxConfig = readJSON(path.join(ctx.dir, 'config.json'))
    const assembly = volvoxConfig.assemblies[0]
    volvoxConfig.assemblies = undefined
    fs.writeFileSync(
      path.join(ctx.dir, 'config.json'),
      JSON.stringify({ ...volvoxConfig, assembly }),
    )

    preVolvoxIx = readTrix(ctx.dir, 'volvox.ix')
    preVolvoxIxx = readTrix(ctx.dir, 'volvox.ixx')
    preVolvoxMeta = readTrixJSON(ctx.dir, 'volvox_meta.json')
    await runCommand([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    // to update (e.g. if volvox config is updated) run:
    // bin/run text-index --out ../../test_data/volvox/ --attributes Name,ID,Note --force
    expect(readTrix(ctx.dir, 'volvox.ix')).toEqual(preVolvoxIx)
    expect(readTrix(ctx.dir, 'volvox.ixx')).toEqual(preVolvoxIxx)
    expect(readTrixJSON(ctx.dir, 'volvox_meta.json')).toEqual(preVolvoxMeta)
  })
})

test('indexes entire volvox config', async () => {
  await runInTmpDir(async ctx => {
    let preVolvoxIx = ''
    let preVolvoxIxx = ''
    let preVolvoxMeta = ''

    fs.cpSync(volvoxDir, ctx.dir, { recursive: true, force: true })

    preVolvoxIx = readTrix(ctx.dir, 'volvox.ix')
    preVolvoxIxx = readTrix(ctx.dir, 'volvox.ixx')
    preVolvoxMeta = readTrixJSON(ctx.dir, 'volvox_meta.json')
    await runCommand([
      'text-index',
      '--target=config.json',
      '--force',
      '--attributes',
      'Name,ID,Note',
    ])
    // to update (e.g. if volvox config is updated) run:
    // bin/run text-index --out ../../test_data/volvox/ --attributes Name,ID,Note --force
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
    // Unmock fetchWithProxy for this test to use real fetch
    const originalFetch = jest.requireActual('../../fetchWithProxy.ts').default
    const fetchWithProxy = require('../../fetchWithProxy.ts')
      .default
    fetchWithProxy.mockImplementation(originalFetch)

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
