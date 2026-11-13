/**
 * @jest-environment <rootDir>/config/jest/jsdom.cjs
 *
 * Which tracks a circular render opens. `--track` used to be parsed, warned
 * about as having no effect, and dropped: the view took every track in the
 * config, which over a `--genome` is hundreds of them, and the only way to pick
 * was to hand-write a `--spec`.
 *
 * jsdom and the fetch shim for the reasons renderSessionInit.test.ts gives.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getEnv } from '@jbrowse/core/util'
import { createViewStateAsync } from '@jbrowse/react-app2'
import { enableStaticRendering } from 'mobx-react'

import { circularTrackInit, renderRegion } from './renderRegion.ts'

import type { Entry } from '@jbrowse/launch-args'

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
function twoChordTracks(display: Record<string, unknown> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-circular-'))
  const file = path.join(dir, 'config.json')
  const track = (trackId: string) => ({
    type: 'VariantTrack',
    trackId,
    name: trackId,
    assemblyNames: ['volvox'],
    ...(Object.keys(display).length > 0
      ? { displays: [{ type: 'ChordVariantDisplay', ...display }] }
      : {}),
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

// A slot-path write names a linear display's slot, and a key a display does
// not declare fails the whole export, so it is said and not applied; a named
// option the chord display has no slot for warns the same way a linear track's
// does.
test('an option the chord display has no slot for is said, not applied', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const config = twoChordTracks()
  const plain = await renderCircular(config, ['sv_one'])
  const modified = await renderCircular(config, [
    'sv_one',
    'height:400',
    'encoding.color.field=SVTYPE',
  ])
  expect(modified).toBe(plain)
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('has no effect on a circular view'),
  )
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('has no effect on ChordVariantDisplay'),
  )
  warn.mockRestore()
}, 90000)

// volvox's one contig is too small for the chord gate to stop a fetch, so the
// launch entry is the witness: `force:true` lands as the chord display's
// `forceLoad`, and an option it has no slot for does not.
test('force:true reaches the chord display as forceLoad', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  const model = await createViewStateAsync({ config: { assemblies: [] } })
  const { pluginManager } = getEnv(model)
  const tracks = [{ type: 'VariantTrack', trackId: 'sv', adapter: {} }]
  expect(
    circularTrackInit(pluginManager, tracks, {
      trackId: 'sv',
      opts: ['force:true', 'height:400'],
    }),
  ).toEqual({ trackId: 'sv', forceLoad: true })
  expect(
    circularTrackInit(pluginManager, tracks, { trackId: 'sv', opts: [] }),
  ).toBe('sv')
  warn.mockRestore()
}, 60000)
