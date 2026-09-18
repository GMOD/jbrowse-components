/**
 * @jest-environment node
 */

import http from 'node:http'

import {
  resolveAgainstConfig,
  resolveAssemblyName,
  resolveTrackId,
} from './catalog.ts'

import type { Catalog } from './catalog.ts'
import type { AddressInfo } from 'node:net'

const tracks = [
  { trackId: 'hg38-ncbiRefSeqCurated', name: 'NCBI RefSeq Curated' },
  { trackId: 'hg38-clinvarMain', name: 'ClinVar Main' },
  { trackId: 'hg38-clinvarCnv', name: 'ClinVar CNVs' },
  { trackId: 'hg38-phyloP100way', name: 'phyloP 100way' },
]

const catalog: Catalog = {
  assemblies: [{ name: 'hg38', aliases: ['GRCh38'] }],
  tracks,
}

test.each([
  ['an exact trackId', 'hg38-clinvarMain', 'hg38-clinvarMain'],
  ['the id without its assembly prefix', 'clinvarMain', 'hg38-clinvarMain'],
  ['any case', 'NCBIREFSEQCURATED', 'hg38-ncbiRefSeqCurated'],
  ['the display name', 'clinvar main', 'hg38-clinvarMain'],
])('%s resolves', (_name, input, id) => {
  expect(resolveTrackId(tracks, input, 'hg38')).toBe(id)
})

test('a miss names the tracks it might have meant', () => {
  expect(() => resolveTrackId(tracks, 'clinvar', 'hg38')).toThrow(
    '--track "clinvar" is not in the config. Did you mean: hg38-clinvarMain, hg38-clinvarCnv?',
  )
})

test('an unrelated miss says so without suggestions', () => {
  expect(() => resolveTrackId(tracks, 'nope-xyz', 'hg38')).toThrow(
    /is not in the config$/,
  )
})

test('an alias resolves to the name the census publishes', () => {
  expect(resolveAssemblyName(catalog, 'grch38')).toBe('hg38')
})

test('an assembly the config lacks names the ones it has', () => {
  expect(() => resolveAssemblyName(catalog, 'mm39')).toThrow(
    'assembly "mm39" is not in the config, which has hg38',
  )
  expect(() => resolveAssemblyName({}, 'mm39')).toThrow(
    'assembly "mm39" is not in the config, which has none',
  )
})

describe('against a served config', () => {
  let server: http.Server
  let base: string

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/data/config.json') {
        res.end(JSON.stringify(catalog))
      } else {
        res.statusCode = 404
        res.end()
      }
    })
    await new Promise<void>(resolve => server.listen(0, resolve))
    base = `http://localhost:${(server.address() as AddressInfo).port}/`
  })

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve))
  })

  // relative, the way the app resolves it: against the instance
  test('tracks and assembly come back spelled the way the config spells them', async () => {
    await expect(
      resolveAgainstConfig({
        instance: base,
        config: 'data/config.json',
        assembly: 'GRCh38',
        tracks: ['clinvarMain', 'phyloP 100way'],
      }),
    ).resolves.toMatchObject({
      assembly: 'hg38',
      tracks: ['hg38-clinvarMain', 'hg38-phyloP100way'],
    })
  })

  test('a typo fails before any browser launches', async () => {
    await expect(
      resolveAgainstConfig({
        instance: base,
        config: 'data/config.json',
        tracks: ['clinvr'],
      }),
    ).rejects.toThrow('--track "clinvr" is not in the config')
  })

  test('a config it cannot fetch leaves the options for the app to judge', async () => {
    const options = {
      instance: base,
      config: 'missing.json',
      tracks: ['whatever'],
    }
    await expect(resolveAgainstConfig(options)).resolves.toBe(options)
  })

  test('a spec passes through unread', async () => {
    const options = {
      instance: base,
      config: 'data/config.json',
      spec: { views: [] },
    }
    await expect(resolveAgainstConfig(options)).resolves.toBe(options)
  })
})
