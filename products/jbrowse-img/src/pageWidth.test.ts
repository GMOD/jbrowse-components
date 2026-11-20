/**
 * @jest-environment <rootDir>/config/jest/jsdom.cjs
 *
 * jsdom via the environment, plus the fetch shim below, for the reasons
 * renderSessionInit.test.ts gives.
 */
import path from 'node:path'

import { enableStaticRendering } from 'mobx-react'

import { renderRegion } from './renderRegion.ts'

enableStaticRendering(true)

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

const opts = {
  config: path.join(__dirname, '..', 'data', 'volvox', 'config.json'),
  width: 800,
  noRasterize: true,
  pageWidth: '183mm',
}

function rootOf(svg: string) {
  return /<svg\b[^>]*>/.exec(svg)?.[0] ?? ''
}

test.each([
  [
    'breakpoint',
    {
      type: 'BreakpointSplitView',
      views: [
        { assembly: 'volvox', loc: 'ctgA:1-4000' },
        { assembly: 'volvox', loc: 'ctgA:20000-24000' },
      ],
    },
  ],
  [
    'synteny',
    {
      type: 'LinearSyntenyView',
      views: [
        { assembly: 'volvox', loc: 'ctgA:1-4000' },
        { assembly: 'volvox', loc: 'ctgA:1-4000' },
      ],
    },
  ],
] as const)(
  'a %s figure at --pageWidth fills the page and states its size',
  async (mode, spec) => {
    const root = rootOf(
      await renderRegion({ ...opts, mode, spec: JSON.stringify(spec) }),
    )
    expect(root).toContain('width="183mm"')
    expect(root).toMatch(/viewBox="0 0 963 /)
  },
  60000,
)
