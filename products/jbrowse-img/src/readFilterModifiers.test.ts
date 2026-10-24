/**
 * @jest-environment jsdom
 */
/**
 * The read-filter modifiers against a real alignments display whose config
 * already filters: each composes onto what the config said, by field, as the
 * track menu would, instead of resetting its siblings to the defaults.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { parseArgv } from '@jbrowse/launch-args'
import { createViewStateAsync } from '@jbrowse/react-app2'
import { enableStaticRendering } from 'mobx-react'

import { applyDisplayOpts } from './applyTrackOpts.ts'
import { renderRegionReport } from './renderRegion.ts'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

enableStaticRendering(true)

// the bgzf wasm loader reads itself from a data: URL, renderSessionInit.test.ts
// says why
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

interface FieldPredicate {
  field: string
  [test: string]: unknown
}

function volvoxConfig(configured: FieldPredicate[]) {
  return {
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
  }
}

async function filtered(configured: FieldPredicate[], opts: string[]) {
  const model = await createViewStateAsync({
    config: {
      ...volvoxConfig(configured),
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

test("a second value on a tag is an alternative that replaces the config's", async () => {
  const { display } = await filtered(
    [
      { field: 'tags.RG', equal: 'lane1' },
      { field: 'tags.HP', equal: '1' },
    ],
    ['filterTag:RG:lane2', 'filterTag:RG:lane3'],
  )
  expect(display.writtenFilter).toEqual([
    { field: 'tags.RG', oneOf: ['lane2', 'lane3'] },
    { field: 'tags.HP', equal: '1' },
  ])
})

test("a settings bag after a modifier keeps the modifier's filter", async () => {
  const { display } = await filtered(
    [{ field: 'tags.HP', equal: '1' }],
    ['mapq:20', '{"filter":[{"field":"split","equal":true}]}'],
  )
  expect(display.writtenFilter).toEqual([
    { field: 'tags.HP', equal: '1' },
    { field: 'mapq', gte: 20 },
    { field: 'split', equal: true },
  ])
})

test('a settings bag entry with a misspelled test is refused', async () => {
  await expect(
    filtered([], ['{"filter":[{"field":"flags.DUP","equals":true}]}']),
  ).rejects.toThrow(/has no test "equals"/)
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

function exported(
  configured: FieldPredicate[],
  locs: string[],
  opts: string[],
) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-filter-'))
  const config = path.join(dir, 'config.json')
  fs.writeFileSync(config, JSON.stringify(volvoxConfig(configured)))
  const argv = parseArgv([
    '--config',
    config,
    ...locs.flatMap(loc => ['--loc', loc]),
    '--track',
    'reads',
    ...opts,
  ])
  return renderRegionReport({
    config,
    loc: locs[0],
    argv,
    mode: locs.length > 1 ? 'breakpoint' : 'linear',
    showTracks: argv.filter(([key]) => key === 'track'),
    noRasterize: true,
    width: 800,
  })
}

test("a breakpoint panel's filter is the config's, edited by field", async () => {
  const { spec } = await exported(
    [{ field: 'tags.HP', equal: '1' }],
    ['ctgA:1-5000', 'ctgA:10000-15000'],
    ['split:only'],
  )
  const panels = spec?.views as { tracks: { filter?: unknown }[] }[]
  expect(panels).toHaveLength(2)
  for (const { tracks } of panels) {
    expect(tracks[0]!.filter).toEqual([
      { field: 'tags.HP', equal: '1' },
      { field: 'split', equal: true },
    ])
  }
}, 60000)

test('a filter field no read has fails the export', async () => {
  await expect(
    exported([], ['ctgA:1-5000'], ['{"filter":[{"field":"mapqq","gte":20}]}']),
  ).rejects.toThrow(/track "reads" filter: no field "mapqq" on an alignment/)
}, 60000)
