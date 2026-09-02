/**
 * @jest-environment jsdom
 *
 * jsdom via the environment, plus the fetch shim below, for the reasons
 * renderSessionInit.test.ts gives: importing jsdom directly drags in an ESM-only
 * transitive dep, and the bgzf wasm loader reads itself through a `data:` URL.
 */
/**
 * What a --session is allowed to decide. A non-linear mode used to build its
 * view settings from the CLI flags BEFORE it could adopt the view the session
 * carried, so `jb2export breakpoint --session sv.json` failed on the missing
 * --loc; and a session holding some other view type was added alongside and
 * silently dropped instead of being reported.
 */
import fs from 'node:fs'
import os from 'node:os'
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

const volvoxDir = path.join(__dirname, '..', 'data', 'volvox')
const configFile = path.join(volvoxDir, 'config.json')
const bigwig = path.join(volvoxDir, 'volvox-sorted.bam.coverage.bw')
const paf = path.join(volvoxDir, 'volvox-self.paf')

function writeSession(session: unknown) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-adopt-'))
  const file = path.join(dir, 'session.json')
  fs.writeFileSync(file, JSON.stringify({ session }))
  return file
}

const opts = {
  config: configFile,
  assembly: 'volvox',
  width: 800,
  noRasterize: true,
}

test('a breakpoint --session renders with no --loc of its own', async () => {
  const svg = await renderRegion({
    ...opts,
    mode: 'breakpoint' as const,
    session: writeSession({
      name: 'sv',
      views: [
        {
          type: 'BreakpointSplitView',
          views: [
            { assembly: 'volvox', loc: 'ctgA:1-4000', tracks: ['volvox_sv'] },
            {
              assembly: 'volvox',
              loc: 'ctgA:20000-24000',
              tracks: ['volvox_sv'],
            },
          ],
        },
      ],
    }),
  })
  expect(svg).toContain('<svg')
  // each panel labels the region it navigated to, so this fails on empty panels
  expect(svg).toContain('ctgA')
}, 60000)

describe('a session holding a view the subcommand cannot draw', () => {
  const lgvSession = () =>
    writeSession({
      name: 'lgv',
      views: [
        { type: 'LinearGenomeView', assembly: 'volvox', loc: 'ctgA:1-4000' },
      ],
    })

  it('names the held type and the subcommand that draws it', async () => {
    await expect(
      renderRegion({ ...opts, mode: 'dotplot', session: lgvSession() }),
    ).rejects.toThrow(
      /--session holds a LinearGenomeView; render it with "jb2export lgv"/,
    )
  }, 60000)

  it('says the same for synteny rather than adding a second view', async () => {
    await expect(
      renderRegion({ ...opts, mode: 'synteny', session: lgvSession() }),
    ).rejects.toThrow(/holds a LinearGenomeView/)
  }, 60000)

  it('lets a --spec win, since that describes a view to construct', async () => {
    const svg = await renderRegion({
      ...opts,
      mode: 'circular',
      session: lgvSession(),
      spec: JSON.stringify({
        type: 'CircularView',
        assembly: 'volvox',
        tracks: ['volvox_sv'],
      }),
    })
    expect(svg).toContain('<svg')
  }, 60000)
})

describe('file-type track flags a comparative view never opens', () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    warn.mockRestore()
  })

  const dropped = () =>
    warn.mock.calls.map(c => `${c[0]}`).filter(m => m.includes('no effect on'))

  // Each render below fails on the single-assembly config it is given, which is
  // after the warning has been decided and long before anything is drawn.
  const attempt = async (o: Parameters<typeof renderRegion>[0]) => {
    await expect(renderRegion(o)).rejects.toThrow()
  }

  it('names the flag on a dotplot', async () => {
    await attempt({
      ...opts,
      mode: 'dotplot',
      trackList: [['bigwig', [bigwig]]],
    })
    expect(dropped()).toEqual([
      'Warning: --bigwig has no effect on a dotplot view',
    ])
  }, 60000)

  it('says nothing about the synteny files that make the levels', async () => {
    await attempt({ ...opts, mode: 'synteny', trackList: [['paf', [paf]]] })
    expect(dropped()).toEqual([])
  }, 60000)

  it('says nothing on a breakpoint view, which opens them', async () => {
    await attempt({
      ...opts,
      mode: 'breakpoint',
      trackList: [['bigwig', [bigwig]]],
    })
    expect(dropped()).toEqual([])
  }, 60000)
})
