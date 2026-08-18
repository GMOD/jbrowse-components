/**
 * @jest-environment node
 */

import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { Readable } from 'node:stream'

import { indexableAdapters, isSupportedIndexingAdapter } from '../util.ts'
import {
  getLocalOrRemoteStream,
  guessAdapterFromFileName,
  isURL,
  makeLocation,
  sanitizeForFilename,
} from './common.ts'

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

describe('sanitizeForFilename', () => {
  it('replaces forward slash with underscore', () => {
    expect(sanitizeForFilename('test_a/b-index')).toBe('test_a_b-index')
  })
  it('replaces all Windows-invalid characters', () => {
    expect(sanitizeForFilename(String.raw`a\b/c:d*e?f"g<h>i|j`)).toBe(
      'a_b_c_d_e_f_g_h_i_j',
    )
  })
  it('leaves safe characters unchanged', () => {
    expect(sanitizeForFilename('track-name_1234.index')).toBe(
      'track-name_1234.index',
    )
  })
  it('escapes Windows reserved device names', () => {
    expect(sanitizeForFilename('NUL')).toBe('_NUL')
    expect(sanitizeForFilename('con')).toBe('_con')
    expect(sanitizeForFilename('COM1')).toBe('_COM1')
    // reserved word as a substring is fine
    expect(sanitizeForFilename('NULsomething')).toBe('NULsomething')
  })
  it('strips trailing dots and spaces', () => {
    expect(sanitizeForFilename('assembly. ')).toBe('assembly')
  })
})

describe('utils for text indexing', () => {
  const local = './volvox.sort.gff3.gz'
  const gff =
    'https://jbrowse.org/genomes/CHM13/genes/chm13.draft_v1.1.gene_annotation.v4.sorted.gff.gz'
  const gff3 =
    'https://s3.amazonaws.com/jbrowse.org/genomes/GRCh38/gencode/gencode.v36.annotation.sort.gff3.gz'
  const vcf =
    'https://ftp.ncbi.nlm.nih.gov/pub/clinvar/vcf_GRCh37/clinvar.vcf.gz'
  const unsupported =
    'https://s3.amazonaws.com/jbrowse.org/genomes/hg19/amplicon_deep_seq/out.marked.bam'
  it('test isURL', () => {
    const test1_result = isURL(local)
    const test2_result = isURL(gff3)
    expect(test1_result).toBe(false)
    expect(test2_result).toBeTruthy()
  })
  it('test makeLocation', () => {
    const location1 = makeLocation(local, 'localPath')
    const location2 = makeLocation(gff3, 'uri')
    expect(location1.locationType).toBe('LocalPathLocation')
    expect(location2.locationType).toBe('UriLocation')
  })
  it('test guess adapter from file name', () => {
    const conf1 = guessAdapterFromFileName(gff3)
    expect(conf1.adapter?.type).toBe('Gff3TabixAdapter')
    expect(isSupportedIndexingAdapter(conf1.adapter?.type)).toBe(true)
    const conf2 = guessAdapterFromFileName(gff)
    expect(conf2.adapter?.type).toBe('Gff3TabixAdapter')
    const conf3 = guessAdapterFromFileName(vcf)
    expect(conf3.adapter?.type).toBe('VcfTabixAdapter')
    expect(() => {
      guessAdapterFromFileName(unsupported)
    }).toThrow(`Unsupported file type ${unsupported}`)
  })
  it('guesses GtfAdapter for plain and gzipped gtf', () => {
    // Both variants land on GtfAdapter here because this guesser serves
    // `text-index --file`, which streams the whole file and never opens a .tbi,
    // and gtfLocation unzips on the suffix. GtfTabixAdapter is what a track in a
    // config.json gets, and indexableAdapters covers it — see the test below.
    expect(guessAdapterFromFileName('genes.gtf').adapter).toMatchObject({
      type: 'GtfAdapter',
      gtfLocation: { locationType: 'LocalPathLocation' },
    })
    expect(guessAdapterFromFileName('genes.gtf.gz').adapter?.type).toBe(
      'GtfAdapter',
    )
    // regression: the guess regex was /\.gtf?$/i, which matched `.gt`
    expect(() => {
      guessAdapterFromFileName('genes.gt')
    }).toThrow('Unsupported file type')
  })
})

// `jbrowse add-track` writes a tabix adapter for every bgzipped indexable
// format, and the table is what decides whether `jbrowse text-index` then sees
// that track. GtfTabixAdapter was missing from it, so a bgzipped GTF — which is
// what `jbrowse sort-gff genes.gtf | bgzip` and add-track produce together — was
// skipped in silence while the identical .gff.gz path indexed. Assert the pair
// rather than the list, since the failure was an asymmetry between them.
describe('indexableAdapters', () => {
  it.each([
    ['Gff3Adapter', 'Gff3TabixAdapter'],
    ['GtfAdapter', 'GtfTabixAdapter'],
    ['VcfAdapter', 'VcfTabixAdapter'],
  ])('covers %s and its tabix sibling %s', (plain, tabix) => {
    expect(indexableAdapters[plain]).toBeDefined()
    expect(indexableAdapters[tabix]).toBeDefined()
    expect(indexableAdapters[tabix]!.format).toBe(
      indexableAdapters[plain]!.format,
    )
  })
})

describe('getLocalOrRemoteStream', () => {
  let server: http.Server
  let serverPort: number

  beforeAll(done => {
    server = http.createServer((req, res) => {
      const filePath = path.join(testDataDir, 'volvox.sort.gff3.gz')
      const stat = fs.statSync(filePath)
      res.writeHead(200, {
        'Content-Type': 'application/gzip',
        'Content-Length': stat.size,
      })
      fs.createReadStream(filePath).pipe(res)
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

  it('returns a readable node stream from a web ReadableStream (webstream regression)', async () => {
    const stream = await getLocalOrRemoteStream({
      file: `http://localhost:${serverPort}/volvox.sort.gff3.gz`,
      out: testDataDir,
      onStart: () => {},
      onUpdate: () => {},
    })
    expect(stream).toBeInstanceOf(Readable)
    const chunks: Uint8Array[] = []
    await new Promise<void>((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk as Uint8Array))
      stream.on('end', resolve)
      stream.on('error', reject)
    })
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
    expect(totalLength).toBeGreaterThan(0)
  })

  it('handles a web ReadableStream from a foreign realm (Chromium DOM stream regression)', async () => {
    // A body that quacks like a WHATWG ReadableStream (has getReader) but is
    // not an instance of node:stream/web's ReadableStream — mirroring
    // Chromium's DOM ReadableStream in the Electron indexing worker, which made
    // the old Readable.fromWeb path throw "must be an instance of
    // ReadableStream. Received an instance of ReadableStream".
    const payload = Buffer.from('col1\tcol2\nval1\tval2\n')
    let sent = false
    const foreignBody = {
      getReader() {
        return {
          read() {
            const chunk = sent
              ? { done: true, value: undefined }
              : { done: false, value: new Uint8Array(payload) }
            sent = true
            return Promise.resolve(chunk)
          },
        }
      },
    }
    const originalFetch = globalThis.fetch
    globalThis.fetch = () =>
      Promise.resolve({
        ok: true,
        headers: { get: () => String(payload.length) },
        body: foreignBody,
      } as unknown as Response)
    try {
      const stream = await getLocalOrRemoteStream({
        file: 'https://example.com/data.tsv',
        out: testDataDir,
        onStart: () => {},
        onUpdate: () => {},
      })
      expect(stream).toBeInstanceOf(Readable)
      const chunks: Uint8Array[] = []
      await new Promise<void>((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk as Uint8Array))
        stream.on('end', resolve)
        stream.on('error', reject)
      })
      expect(Buffer.concat(chunks).toString()).toBe(payload.toString())
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('cancels the foreign-realm reader when the stream is destroyed early', async () => {
    // Destroying the adapted Readable (e.g. an aborted index) must cancel the
    // underlying web reader so the fetch connection is released.
    let cancelled = false
    const foreignBody = {
      getReader() {
        return {
          read() {
            return new Promise(() => {}) // never resolves; only cancel ends it
          },
          cancel() {
            cancelled = true
            return Promise.resolve()
          },
        }
      },
    }
    const originalFetch = globalThis.fetch
    globalThis.fetch = () =>
      Promise.resolve({
        ok: true,
        headers: { get: () => '0' },
        body: foreignBody,
      } as unknown as Response)
    try {
      const stream = await getLocalOrRemoteStream({
        file: 'https://example.com/data.tsv',
        out: testDataDir,
        onStart: () => {},
        onUpdate: () => {},
      })
      await new Promise<void>((resolve, reject) => {
        stream.on('close', resolve)
        stream.on('error', reject)
        stream.destroy()
      })
      expect(cancelled).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
