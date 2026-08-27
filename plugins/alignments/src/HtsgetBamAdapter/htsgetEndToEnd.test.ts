import fs from 'node:fs'

import { firstValueFrom, toArray } from 'rxjs'

import HtsgetBamAdapter from './HtsgetBamAdapter.ts'
import configSchema from './configSchema.ts'

// Nothing exercised this adapter end to end — no fixture names it, no config in
// test_data uses it — which is how it shipped for years with no `fetch` passed
// at all. A real htsget server is not needed to fix that: the protocol's answer
// to a ticket request is a list of urls whose bodies concatenate into a BAM
// stream, so one url serving a whole small BAM is a valid ticket, and it drives
// the real @gmod/bam ticket -> blocks -> unzip -> recordsOffset -> readBamFeatures
// path this repo otherwise never runs.
const BAM = fs.readFileSync(
  require.resolve('../../test_data/volvox-sorted.bam'),
)

const BASE = 'https://htsget.example.com/reads'
const BLOCK = 'https://blocks.example.net/volvox/0'

const requested: string[] = []

// Everything not htsget falls through to the real fetch, and that is
// load-bearing rather than tidy: @gmod/bgzf-filehandle loads its decompression
// wasm with `fetch(<data url>)`, so a mock that answers every url leaves it
// instantiating an empty buffer and every unzip throws CompileError.
const realFetch = globalThis.fetch

function serve(url: string, init?: RequestInit) {
  if (url.startsWith(BLOCK)) {
    requested.push(url)
    return new Response(BAM)
  }
  if (url.startsWith(BASE)) {
    requested.push(url)
    return new Response(
      JSON.stringify({ htsget: { urls: [{ url: BLOCK }] } }),
      {
        headers: { 'content-type': 'application/json' },
      },
    )
  }
  return realFetch(url, init)
}

beforeEach(() => {
  requested.length = 0
  globalThis.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) =>
      serve(typeof input === 'string' ? input : String(input), init),
  )
})

afterAll(() => {
  globalThis.fetch = realFetch
})

function makeAdapter() {
  return new HtsgetBamAdapter(
    configSchema.create({
      type: 'HtsgetBamAdapter',
      htsgetBase: BASE,
      htsgetTrackId: 'volvox',
    }),
  )
}

test('the adapter reads a header out of a ticket', async () => {
  expect(await makeAdapter().getRefNames()).toContain('ctgA')

  // class=header is the only parameter the spec permits alongside format
  expect(requested[0]).toBe(`${BASE}/volvox?class=header&format=BAM`)
})

test('the adapter reads features out of a ticket', async () => {
  const features = await firstValueFrom(
    makeAdapter()
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 200,
      })
      .pipe(toArray()),
  )

  expect(features.length).toBeGreaterThan(0)
  for (const f of features) {
    expect(f.get('refName')).toBe('ctgA')
    expect(f.get('start')).toBeLessThan(200)
  }
})

// recordsOffset seeks past the BAM header rather than dropping the first block,
// because whether the header is its own url is up to the server. A block layout
// that carries header and records together — htsget-rs does this, and it is
// what this fixture is — must not have its first records eaten.
test('records that share a block with the header are not dropped', async () => {
  const viaHtsget = await firstValueFrom(
    makeAdapter()
      .getFeatures({
        assemblyName: 'volvox',
        refName: 'ctgA',
        start: 0,
        end: 20000,
      })
      .pipe(toArray()),
  )

  expect(viaHtsget.length).toBe(3809)
})

test('the ticket names the blocks, and the blocks are what get fetched', async () => {
  await makeAdapter().getRefNames()

  expect(requested).toEqual([`${BASE}/volvox?class=header&format=BAM`, BLOCK])
})
