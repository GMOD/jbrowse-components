/**
 * @jest-environment jsdom
 *
 * jsdom and the fetch shim for the reasons renderSessionInit.test.ts gives.
 */
/**
 * What `--track <id> <modifiers>` draws and says for a track whose config
 * already sets its display up: the modifiers arrive the way `main.ts` hands
 * them over, as the entries `parseArgv` makes of the command line.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { enableStaticRendering } from 'mobx-react'

import { parseArgv } from './parseArgv.ts'
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

const volvox = path.join(__dirname, '..', 'data', 'volvox')
const loc = 'ctgA:1-25000'

function configWith(display: Record<string, unknown>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-configured-'))
  const file = path.join(dir, 'config.json')
  fs.writeFileSync(
    file,
    JSON.stringify({
      assemblies: [
        {
          name: 'volvox',
          sequence: {
            type: 'ReferenceSequenceTrack',
            trackId: 'volvox_refseq',
            adapter: {
              type: 'TwoBitAdapter',
              twoBitLocation: { localPath: path.join(volvox, 'volvox.2bit') },
            },
          },
        },
      ],
      tracks: [
        {
          type: 'FeatureTrack',
          trackId: 'genes',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'BedTabixAdapter',
            bedGzLocation: {
              localPath: path.join(volvox, 'volvox-bed12.bed.gz'),
            },
            index: {
              location: {
                localPath: path.join(volvox, 'volvox-bed12.bed.gz.tbi'),
              },
            },
          },
          displays: [{ displayId: 'genes-display', ...display }],
        },
      ],
    }),
  )
  return file
}

function exportTrack(config: string, modifiers: string[] = [], locs = [loc]) {
  const argv = parseArgv([
    '--config',
    config,
    ...locs.flatMap(l => ['--loc', l]),
    '--track',
    'genes',
    ...modifiers,
  ])
  return renderRegion({
    config,
    loc: locs[0],
    argv,
    mode: locs.length > 1 ? 'breakpoint' : 'linear',
    showTracks: argv.filter(([key]) => key === 'track'),
    noRasterize: true,
    width: 800,
  })
}

const basic = { type: 'LinearBasicDisplay' }
const byName = { field: 'name', domain: ['EDEN.1', 'EDEN.2'] }
const byStrand = { field: 'strand', domain: ['1'] }

describe('a path write into a setting the config already writes', () => {
  test('changes that member and keeps the rest, as the config saying it would', async () => {
    const written = await exportTrack(
      configWith({ ...basic, color: byName, facet: byStrand }),
      ['color.domain=EDEN.2,EDEN.1', 'facet.domain=-1,1'],
    )
    const stated = await exportTrack(
      configWith({
        ...basic,
        color: { ...byName, domain: ['EDEN.2', 'EDEN.1'] },
        facet: { ...byStrand, domain: ['-1', '1'] },
      }),
    )
    expect(written).toBe(stated)
  }, 60000)

  test('reaches every panel of a breakpoint view the same way', async () => {
    const panels = ['ctgA:1-12000', 'ctgA:15000-25000']
    const written = await exportTrack(
      configWith({ ...basic, color: byName, facet: byStrand }),
      ['color.domain=EDEN.2,EDEN.1', 'facet.domain=-1,1'],
      panels,
    )
    const stated = await exportTrack(
      configWith({
        ...basic,
        color: { ...byName, domain: ['EDEN.2', 'EDEN.1'] },
        facet: { ...byStrand, domain: ['-1', '1'] },
      }),
      [],
      panels,
    )
    expect(written).toBe(stated)
  }, 60000)

  test('lands on a named modifier the same way in either order', async () => {
    const config = configWith(basic)
    const pathFirst = await exportTrack(config, [
      'color.domain=EDEN.2,EDEN.1',
      'color:red',
    ])
    const namedFirst = await exportTrack(config, [
      'color:red',
      'color.domain=EDEN.2,EDEN.1',
    ])
    expect(pathFirst).toBe(namedFirst)
    expect(pathFirst).toContain('fill="rgb(255,0,0)"')
  }, 60000)
})
