/**
 * @jest-environment node
 */

import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { indexGff3 } from './gff3Adapter.ts'

const testDataDir = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'products',
  'jbrowse-cli',
  'test',
  'data',
)

describe('indexGff3', () => {
  test('indexes a local non-gz gff3 file', async () => {
    const results: string[] = []
    const generator = indexGff3({
      config: { trackId: 'test-track' },
      attributesToIndex: ['ID', 'Name'],
      inLocation: path.join(testDataDir, 'au9_scaffold_subset_sync.gff3'),
      outDir: testDataDir,
      featureTypesToExclude: [],
      onStart: () => {},
      onUpdate: () => {},
    })

    for await (const record of generator) {
      results.push(record)
    }

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toContain('test-track')
  })

  test('indexes a local gz gff3 file', async () => {
    const results: string[] = []
    const generator = indexGff3({
      config: { trackId: 'test-track-gz' },
      attributesToIndex: ['ID', 'Name'],
      inLocation: path.join(testDataDir, 'volvox.sort.gff3.gz'),
      outDir: testDataDir,
      featureTypesToExclude: [],
      onStart: () => {},
      onUpdate: () => {},
    })

    for await (const record of generator) {
      results.push(record)
    }

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toContain('test-track-gz')
  })

  test('skips truncated/malformed lines without throwing', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gff3-index-'))
    const file = path.join(tmpDir, 'malformed.gff3')
    // a well-formed feature, then a truncated line missing column 9
    fs.writeFileSync(
      file,
      [
        'ctgA\t.\tgene\t1\t100\t.\t+\t.\tID=gene1;Name=good',
        'ctgA\t.\tgene\t200\t300',
        '',
      ].join('\n'),
    )

    const results: string[] = []
    const generator = indexGff3({
      config: { trackId: 'malformed-track' },
      attributesToIndex: ['ID', 'Name'],
      inLocation: file,
      outDir: tmpDir,
      featureTypesToExclude: [],
      onStart: () => {},
      onUpdate: () => {},
    })

    for await (const record of generator) {
      results.push(record)
    }

    fs.rmSync(tmpDir, { recursive: true, force: true })

    expect(results).toHaveLength(1)
    expect(results[0]).toContain('gene1')
  })

  describe('real HTTP server integration', () => {
    let server: http.Server
    let serverPort: number

    beforeAll(done => {
      server = http.createServer((req, res) => {
        const gzFilePath = path.join(testDataDir, 'volvox.sort.gff3.gz')
        const nonGzFilePath = path.join(
          testDataDir,
          'au9_scaffold_subset_sync.gff3',
        )

        if (req.url?.includes('volvox.sort.gff3.gz')) {
          const stat = fs.statSync(gzFilePath)
          res.writeHead(200, {
            'Content-Type': 'application/gzip',
            'Content-Length': stat.size,
          })
          fs.createReadStream(gzFilePath).pipe(res)
        } else if (req.url?.includes('au9_scaffold_subset_sync.gff3')) {
          const stat = fs.statSync(nonGzFilePath)
          res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Content-Length': stat.size,
          })
          fs.createReadStream(nonGzFilePath).pipe(res)
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
      const results: string[] = []
      const generator = indexGff3({
        config: { trackId: 'remote-gz-track' },
        attributesToIndex: ['ID', 'Name'],
        inLocation: `http://localhost:${serverPort}/volvox.sort.gff3.gz`,
        outDir: testDataDir,
        featureTypesToExclude: [],
        onStart: () => {},
        onUpdate: () => {},
      })

      for await (const record of generator) {
        results.push(record)
      }

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toContain('remote-gz-track')
    })

    test('indexes a remote non-gz gff3 file from real HTTP server', async () => {
      const results: string[] = []
      const generator = indexGff3({
        config: { trackId: 'remote-track' },
        attributesToIndex: ['ID', 'Name'],
        inLocation: `http://localhost:${serverPort}/au9_scaffold_subset_sync.gff3`,
        outDir: testDataDir,
        featureTypesToExclude: [],
        onStart: () => {},
        onUpdate: () => {},
      })

      for await (const record of generator) {
        results.push(record)
      }

      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toContain('remote-track')
    })
  })
})
