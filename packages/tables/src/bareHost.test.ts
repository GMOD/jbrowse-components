import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  TextDecoder as NodeTextDecoder,
  TextEncoder as NodeTextEncoder,
} from 'node:util'
import { gunzipSync, gzipSync } from 'node:zlib'

import {
  TextDecoderShim,
  TextEncoderShim,
  fetchShim,
  inflatedSize,
  installBareHostGlobals,
} from './bareHost.ts'

function lcg(seed: number) {
  let x = seed
  return () => {
    x = (x * 1103515245 + 12345) % 2 ** 31
    return x / 2 ** 31
  }
}

test('decodes UTF-8 as the WHATWG decoder does, valid or not', () => {
  const rand = lcg(7)
  const cases: number[][] = [
    [0xe9, 0x0a, 0x40, 0x53, 0x51],
    [0xff, 0x41],
    [0xe0, 0x80, 0x80],
    [0xed, 0xa0, 0x80],
    [0xf4, 0x90, 0x80, 0x80],
    [0xf0, 0x9f, 0x98, 0x80, 0x41],
    [0xc3],
  ]
  for (let n = 0; n < 2000; n++) {
    // weighted toward the bytes that start and continue sequences
    cases.push(
      Array.from({ length: 1 + Math.floor(rand() * 8) }, () =>
        rand() < 0.5
          ? Math.floor(rand() * 256)
          : 0x80 + Math.floor(rand() * 0x78),
      ),
    )
  }
  const node = new NodeTextDecoder()
  const shim = new TextDecoderShim()
  for (const c of cases) {
    expect(shim.decode(new Uint8Array(c))).toBe(node.decode(new Uint8Array(c)))
  }
  expect(() =>
    new TextDecoderShim('utf-8', { fatal: true }).decode(
      new Uint8Array([0xff]),
    ),
  ).toThrow(TypeError)
})

test('encodes into a buffer as the WHATWG encoder does, whole characters only', () => {
  const node = new NodeTextEncoder()
  const shim = new TextEncoderShim()
  const texts = [
    '',
    'abc',
    'na\u00EFve',
    'C+m,1,3;G-m\u{1F600}x',
    '\u4E2D\u6587',
  ]
  for (const text of texts) {
    for (const size of [0, 1, 2, 3, 5, 8, 64]) {
      const a = new Uint8Array(size)
      const b = new Uint8Array(size)
      expect(shim.encodeInto(text, a)).toEqual(node.encodeInto(text, b))
      expect(a).toEqual(b)
    }
    expect(shim.encode(text)).toEqual(node.encode(text))
  }
})

test('a range past the end of the file answers 416, as a server does', async () => {
  installBareHostGlobals(() => ({
    status: 206,
    size: 10,
    bytes: new Uint8Array(0),
  }))
  const res = await fetchShim('file:///x', {
    headers: { range: 'bytes=10-19' },
  })
  expect(res.status).toBe(416)
  expect(res.headers.get('content-range')).toBe('bytes */10')
})

test('a file read whole weighs what it inflates to', () => {
  const tbi = readFileSync(
    path.resolve(
      'test_data/breakpoint/hs37d5.HG002-SequelII-CCS.sv.vcf.gz.tbi',
    ),
  )
  const text = new TextEncoder().encode('ctgA\t1\n'.repeat(10_000))
  expect(inflatedSize(tbi)).toBe(gunzipSync(tbi).length)
  expect(inflatedSize(gzipSync(text))).toBe(text.length)
  expect(inflatedSize(text)).toBe(text.length)
})
