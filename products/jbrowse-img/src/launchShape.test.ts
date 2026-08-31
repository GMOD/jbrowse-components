/**
 * @jest-environment jsdom
 *
 * The views this tool builds itself — dotplot, synteny, circular, breakpoint —
 * get their settings written directly on the view object. Nesting them under
 * `init` still works and still renders, so nothing in the picture says which
 * shape was passed; the deprecation warning is the only witness, and it fires
 * once per view the tool opens.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { enableStaticRendering } from 'mobx-react'

import { renderRegion } from './renderRegion.ts'

enableStaticRendering(true)

// jsdom's realm has no `fetch`, and the bgzf wasm loader reads itself from an
// inlined `data:` URL through one. Decoding data: is all that is wanted; nothing
// below touches the network.
global.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  const payload = url.slice(url.indexOf(',') + 1)
  const buf = Buffer.from(
    url.includes(';base64,') ? payload : decodeURIComponent(payload),
    url.includes(';base64,') ? 'base64' : 'utf8',
  )
  return {
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  }
}) as unknown as typeof fetch

const configFile = path.join(__dirname, '..', 'data', 'volvox', 'config.json')

function writeSpec(spec: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-spec-'))
  const file = path.join(dir, 'spec.json')
  fs.writeFileSync(file, JSON.stringify(spec))
  return file
}

let warn: jest.SpyInstance
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  warn.mockRestore()
})

const deprecations = () =>
  warn.mock.calls.map(c => `${c[0]}`).filter(m => m.includes('"init"'))

test('a circular render opens its view without nesting anything', async () => {
  const svg = await renderRegion({
    config: configFile,
    mode: 'circular',
    noRasterize: true,
    width: 800,
  })
  expect(svg).toContain('<svg')
  expect(deprecations()).toEqual([])
}, 60000)

test('a --spec render opens its view without nesting anything', async () => {
  const svg = await renderRegion({
    config: configFile,
    noRasterize: true,
    width: 800,
    spec: writeSpec({
      type: 'CircularView',
      assembly: 'volvox',
      tracks: ['volvox_sv'],
    }),
  })
  expect(svg).toContain('<svg')
  expect(deprecations()).toEqual([])
}, 60000)
