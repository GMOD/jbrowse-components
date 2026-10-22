/**
 * @jest-environment jsdom
 */
/**
 * The read-filter modifiers against a real alignments display whose config
 * already filters: each composes onto what the config said, as the track menu
 * would, instead of resetting its siblings to the schema defaults.
 */
import path from 'node:path'

import { createViewStateAsync } from '@jbrowse/react-app2'
import { enableStaticRendering } from 'mobx-react'

import { applyDisplayOpts } from './applyTrackOpts.ts'

import type { ReadFilterSnapshot } from '@jbrowse/launch-args/displaySettings'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

enableStaticRendering(true)

const volvox = path.join(__dirname, '..', 'data', 'volvox')

async function filtered(configured: Record<string, unknown>, opts: string[]) {
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
            uri: path.join(volvox, 'volvox-sorted.bam'),
          },
          displays: [
            {
              type: 'LinearAlignmentsDisplay',
              displayId: 'reads-display',
              filter: configured,
            },
          ],
        },
      ],
      configuration: { rpc: { defaultDriver: 'MainThreadRpcDriver' } },
    },
  })
  const view = (await model.session.launchView(
    'LinearGenomeView',
    {},
  )) as LinearGenomeViewModel
  const spec = await applyDisplayOpts(view, 'reads', 'alignments', opts)
  const display = view.tracks[0]!.displays[0] as {
    readFilter: ReadFilterSnapshot
    junctionFilter: Record<string, unknown>
  }
  return { display, spec }
}

test('a category edit leaves the flag masks the track config set', async () => {
  const { display } = await filtered({ flagExclude: 1796 }, ['split:only'])
  expect(display.readFilter).toMatchObject({ flagExclude: 1796, split: 'only' })
})

test('an omitted half of flags keeps the configured mask', async () => {
  const { display } = await filtered({ flagInclude: 2, flagExclude: 1796 }, [
    'flags::256',
  ])
  expect(display.readFilter).toMatchObject({ flagInclude: 2, flagExclude: 256 })
})

test('a tag filter is a second condition, not a replacement', async () => {
  const { display } = await filtered({ tags: [{ tag: 'HP', value: '1' }] }, [
    'filterTag:RG:lane3',
  ])
  expect(display.readFilter.tags).toEqual([
    { tag: 'HP', value: '1' },
    { tag: 'RG', value: 'lane3' },
  ])
})

test('a junction filter in a settings bag keeps the configured members', async () => {
  const { display } = await filtered({ junctions: { minReads: 7 } }, [
    '{"filter":{"junctions":{"nonCanonical":"exclude"}}}',
    'split:only',
  ])
  expect(display.junctionFilter).toEqual({
    minReads: 7,
    nonCanonical: 'exclude',
  })
  expect(display.readFilter).toMatchObject({ split: 'only' })
})

test('a category at all unsets an earlier modifier and the config alike', async () => {
  const { display } = await filtered({ svSignal: 'only' }, [
    'split:only',
    'split:all',
    'svSignal:all',
  ])
  expect(display.readFilter.split).toBeUndefined()
  expect(display.readFilter.svSignal).toBeUndefined()
})

test('the returned spec carries the read filter as drawn', async () => {
  const { spec } = await filtered(
    { flagExclude: 1796, tags: [{ tag: 'HP', value: '1' }] },
    ['split:only', 'filterTag:RG:lane3'],
  )
  expect(spec.filter).toMatchObject({
    flagExclude: 1796,
    split: 'only',
    tags: [
      { tag: 'HP', value: '1' },
      { tag: 'RG', value: 'lane3' },
    ],
  })
})
