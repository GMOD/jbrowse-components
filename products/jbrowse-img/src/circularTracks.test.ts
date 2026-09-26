/**
 * @jest-environment jsdom
 *
 * Which tracks a circular render opens. `--track` used to be parsed, warned
 * about as having no effect, and dropped: the view took every track in the
 * config, which over a `--hub` is hundreds of them, and the only way to pick
 * was to hand-write a `--spec`.
 *
 * jsdom and the fetch shim for the reasons renderSessionInit.test.ts gives.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { enableStaticRendering } from 'mobx-react'

import { renderRegion } from './renderRegion.ts'

import type { Entry } from './parseArgv.ts'

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

// The same VCF under two ids, so the chords a run draws count the tracks it
// opened: both is twice one, and neither is the bare ideogram.
function twoChordTracks() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-circular-'))
  const file = path.join(dir, 'config.json')
  const track = (trackId: string) => ({
    type: 'VariantTrack',
    trackId,
    name: trackId,
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: { localPath: path.join(volvox, 'volvox.dup.vcf.gz') },
      index: {
        location: { localPath: path.join(volvox, 'volvox.dup.vcf.gz.tbi') },
      },
    },
  })
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
      tracks: [track('sv_one'), track('sv_two')],
    }),
  )
  return file
}

function renderCircular(config: string, ...tracks: string[][]) {
  return renderRegion({
    config,
    mode: 'circular',
    noRasterize: true,
    width: 600,
    showTracks: tracks.map((vals): Entry => ['track', vals]),
  })
}

const pathCount = (svg: string) => (svg.match(/<path/g) ?? []).length

test('--track opens the tracks it names, and nothing else', async () => {
  const config = twoChordTracks()
  const both = pathCount(await renderCircular(config))
  const one = pathCount(await renderCircular(config, ['sv_one']))
  const named = pathCount(await renderCircular(config, ['sv_one'], ['sv_two']))
  expect(one).toBeGreaterThan(2)
  expect(one).toBeLessThan(both)
  expect(named).toBe(both)
}, 90000)

// The near-match suggestions resolveTrackId gives, rather than a render that
// quietly drew the whole config instead of the one track asked for.
test('--track naming no track in the config fails', async () => {
  await expect(renderCircular(twoChordTracks(), ['sv_three'])).rejects.toThrow(
    /not found in the config/,
  )
}, 60000)

// The modifiers name slots on the LINEAR displays, a variant track here draws
// chords, and a key a display does not declare fails the whole export — so
// `height:400` beside a --vcfgz drew a chord plot until this view read
// `--track`, and carrying the snapshot over killed the render instead. Both a
// named modifier and a slot-path write land in the same warning, since neither
// reaches the view. A typo'd value is covered by the same line, which is why
// nothing here parses one.
test('a modifier the chord display has no slot for is said, not applied', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const config = twoChordTracks()
  const plain = await renderCircular(config, ['sv_one'])
  const modified = await renderCircular(config, [
    'sv_one',
    'height:400',
    'force:true',
    'color.field=SVTYPE',
  ])
  expect(modified).toBe(plain)
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('have no effect on a circular view'),
  )
  warn.mockRestore()
}, 90000)
