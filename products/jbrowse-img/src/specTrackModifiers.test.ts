/**
 * @jest-environment jsdom
 */
/**
 * A session spec track entry's `modifiers`, the route Desktop and jb2capture
 * take, applied by the linear view's own launch to a real alignments display.
 */
import path from 'node:path'

import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { renderToSvg } from '@jbrowse/plugin-linear-genome-view'
import { createViewStateAsync } from '@jbrowse/react-app2'
import { when } from 'mobx'
import { enableStaticRendering } from 'mobx-react'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

enableStaticRendering(true)

// jsdom's realm has no `fetch`, which the bgzf wasm loader reads its inlined
// `data:` URL through (as in renderSessionInit.test.ts)
global.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input)
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
  return {
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  }
}) as unknown as typeof fetch

const volvox = path.join(__dirname, '..', 'data', 'volvox')

async function launched(entry: { trackId: string } & Record<string, unknown>) {
  const model = await createViewStateAsync({
    config: {
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
          type: 'AlignmentsTrack',
          trackId: 'reads',
          assemblyNames: ['volvox'],
          adapter: {
            type: 'BamAdapter',
            bamLocation: { localPath: path.join(volvox, 'volvox-sorted.bam') },
            index: {
              location: {
                localPath: path.join(volvox, 'volvox-sorted.bam.bai'),
              },
            },
          },
          displays: [
            {
              type: 'LinearAlignmentsDisplay',
              displayId: 'reads-display',
              filter: [{ field: 'tags.HP', equal: '1' }],
            },
          ],
        },
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
        },
      ],
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  const view = model.session.addView('LinearGenomeView', {
    assembly: 'volvox',
    loc: 'ctgA:1000-6000',
    tracks: [entry],
  }) as LinearGenomeViewModel
  view.setWidth(800)
  await when(() => view.tracks.length > 0 && view.pendingLaunch === undefined, {
    timeout: 20000,
  })
  // the reads finish loading before the test ends, or they outlive jest's teardown
  await renderToSvg(view, {})
  return {
    view,
    session: model.session,
    display: () =>
      getSnapshot(
        (view.tracks[0]!.displays[0] as { configuration: object })
          .configuration,
      ) as Record<string, unknown>,
    messages: () =>
      model.session.snackbarMessages.map((m: { message: string }) => m.message),
  }
}

test('modifiers write over the entry, and sort at the navigated center', async () => {
  const { display } = await launched({
    trackId: 'reads',
    height: 120,
    modifiers: [
      'height:150',
      'color:strand',
      'sort:base',
      'filterTag:RG:lane3',
    ],
  })
  expect(display()).toMatchObject({
    height: 150,
    sort: { field: 'base', refName: 'ctgA' },
    filter: [
      { field: 'tags.HP', equal: '1' },
      { field: 'tags.RG', equal: 'lane3' },
    ],
  })
  const { pos } = display().sort as { pos: number }
  expect(Math.abs(pos - 3500)).toBeLessThan(10)
}, 60000)

test("a modifier writes the fields it names over the entry's own", async () => {
  const { display } = await launched({
    trackId: 'reads',
    filter: [
      { field: 'flags.SECONDARY', equal: false },
      { field: 'tags.SA', equal: '1' },
    ],
    modifiers: ['mapq:20', 'filterTag:RG:lane3'],
  })
  expect(display().filter).toEqual([
    { field: 'flags.SECONDARY', equal: false },
    { field: 'tags.SA', equal: '1' },
    { field: 'mapq', gte: 20 },
    { field: 'tags.RG', equal: 'lane3' },
  ])
}, 60000)

test("the entry's display type picks what a modifier writes", async () => {
  const { view, messages } = await launched({
    trackId: 'genes',
    type: 'LinearMarkDisplay',
    modifiers: ['featureHeight:compact'],
  })
  expect(view.tracks[0]!.displays[0]).toMatchObject({
    type: 'LinearMarkDisplay',
  })
  expect(messages()).toContainEqual(
    expect.stringContaining('"featureHeight" has no effect'),
  )
}, 60000)

test('a bad modifier is reported, and the track still opens', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { display, messages } = await launched({
    trackId: 'reads',
    height: 120,
    modifiers: ['height:150', 'mapq:x'],
  })
  expect(error).toHaveBeenCalledWith(
    expect.objectContaining({
      message: 'Invalid mapq value "x". Expected a number.',
    }),
  )
  error.mockRestore()
  expect(display()).toMatchObject({ height: 120 })
  expect(messages()).toContainEqual(
    expect.stringContaining('Invalid mapq value "x"'),
  )
}, 60000)

test('a display the track cannot open as leaves it opening with its own', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {})
  const { view } = await launched({
    trackId: 'reads',
    modifiers: ['display:Nonexistent'],
  })
  error.mockRestore()
  expect(view.tracks[0]!.displays[0]).toMatchObject({
    type: 'LinearAlignmentsDisplay',
  })
}, 60000)
