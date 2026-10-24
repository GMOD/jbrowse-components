/**
 * @jest-environment jsdom
 */
/**
 * The read-filter modifiers against a real alignments display whose config
 * already filters: each composes onto what the config said, by field, as the
 * track menu would, instead of resetting its siblings to the defaults.
 */
import path from 'node:path'

import { createViewStateAsync } from '@jbrowse/react-app2'
import { enableStaticRendering } from 'mobx-react'

import { applyDisplayOpts } from './applyTrackOpts.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

enableStaticRendering(true)

const volvox = path.join(__dirname, '..', 'data', 'volvox')

interface FieldPredicate {
  field: string
  [test: string]: unknown
}

async function filtered(configured: FieldPredicate[], opts: string[]) {
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
    writtenFilter: FieldPredicate[]
    junctionFilter: Record<string, unknown>
  }
  return { display, spec }
}

test('a category edit leaves the flag fields the track config set', async () => {
  const { display } = await filtered(
    [{ field: 'flags.SECONDARY', equal: false }],
    ['split:only'],
  )
  expect(display.writtenFilter).toEqual([
    { field: 'flags.SECONDARY', equal: false },
    { field: 'split', equal: true },
  ])
})

test('flags writes every flag field, an omitted half as mask 0', async () => {
  const { display } = await filtered(
    [
      { field: 'flags.PROPER_PAIR', equal: true },
      { field: 'flags.SECONDARY', equal: false },
      { field: 'tags.HP', equal: '1' },
    ],
    ['flags::256'],
  )
  // exclude 256 alone, as `samtools view -F 256` says: SECONDARY out, the
  // configured include cleared, and the three default exclusions lifted by
  // their bare fields
  expect(display.writtenFilter).toEqual([
    { field: 'flags.SECONDARY', equal: false },
    { field: 'tags.HP', equal: '1' },
    { field: 'flags.UNMAP' },
    { field: 'flags.QCFAIL' },
    { field: 'flags.DUP' },
  ])
})

test('a tag filter is a second condition, not a replacement', async () => {
  const { display } = await filtered(
    [{ field: 'tags.HP', equal: '1' }],
    ['filterTag:RG:lane3'],
  )
  expect(display.writtenFilter).toEqual([
    { field: 'tags.HP', equal: '1' },
    { field: 'tags.RG', equal: 'lane3' },
  ])
})

test('a junction filter in a settings bag keeps the configured fields', async () => {
  const { display } = await filtered(
    [{ field: 'junction.reads', gte: 7 }],
    ['{"filter":[{"field":"junction.canonical","equal":true}]}', 'split:only'],
  )
  expect(display.junctionFilter).toEqual({
    minReads: 7,
    nonCanonical: 'exclude',
  })
  expect(display.writtenFilter).toContainEqual({ field: 'split', equal: true })
})

test('a category at all unsets an earlier modifier and the config alike', async () => {
  const { display } = await filtered(
    [{ field: 'svSignal', equal: true }],
    ['split:only', 'split:all', 'svSignal:all'],
  )
  expect(display.writtenFilter).toEqual([])
})

test('the returned spec carries the filter as written', async () => {
  const { spec } = await filtered(
    [
      { field: 'flags.SECONDARY', equal: false },
      { field: 'tags.HP', equal: '1' },
    ],
    ['split:only', 'filterTag:RG:lane3'],
  )
  expect(spec.filter).toEqual([
    { field: 'flags.SECONDARY', equal: false },
    { field: 'tags.HP', equal: '1' },
    { field: 'split', equal: true },
    { field: 'tags.RG', equal: 'lane3' },
  ])
})
