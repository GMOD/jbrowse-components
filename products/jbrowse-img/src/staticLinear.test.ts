/**
 * @jest-environment <rootDir>/config/jest/jsdom.cjs
 *
 * The environment and the fetch shim for the reasons
 * renderSessionInit.test.ts gives.
 */
/**
 * A linear genome view of quantitative tracks drawn with no session,
 * `staticLinearSvg`, against the same command line drawn the way jb2export
 * draws it today: the whole document, chrome and bodies, byte for byte.
 */
import path from 'node:path'

import { tablesPluginManager } from '@jbrowse/tables'
import { enableStaticRendering } from 'mobx-react'

import { DEFAULT_FONT_FAMILY } from './options.ts'
import { readData } from './readData.ts'
import { renderRegion } from './renderRegion.ts'
import { staticLinearSvg } from './staticLinear.ts'

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

const volvoxDir = path.join(__dirname, '..', 'data', 'volvox')
const testData = path.join(__dirname, '..', '..', '..', 'test_data', 'volvox')
const fasta = path.join(volvoxDir, 'volvox.fa')
const aliases = path.join(volvoxDir, 'volvox.aliases.txt')
const bigwig = path.join(volvoxDir, 'volvox-sorted.bam.coverage.bw')
const altnameBigwig = path.join(testData, 'volvox_microarray.altname.bw')
const multiwig = ['v1', 'v2', 'v3', 'v4']
  .map(n => path.join(testData, `${n}.cram.bw`))
  .join(',')
const width = 800

const pluginManager = tablesPluginManager()

interface Case {
  name: string
  genome: Entry
  loc: string
  tracks: Entry[]
  display?: Record<string, unknown>
}

const plainFasta: Entry = ['fasta', [fasta]]

const cases: Case[] = [
  {
    name: 'an xyplot in a window inside a contig',
    genome: plainFasta,
    loc: 'ctgA:1-8000',
    tracks: [['bigwig', [bigwig]]],
  },
  {
    name: 'an xyplot of a whole contig, its region separator drawn',
    genome: plainFasta,
    loc: 'ctgA',
    tracks: [['bigwig', [bigwig]]],
  },
  {
    name: 'a configured line plot',
    genome: plainFasta,
    loc: 'ctgA:1001-9000',
    tracks: [['bigwig', [bigwig, 'height:60', 'mark.type=line']]],
    display: { height: 60, mark: { type: 'line' } },
  },
  {
    name: 'a density plot, its label over the plot and its key beside it',
    genome: plainFasta,
    loc: 'ctgA:1-8000',
    tracks: [['bigwig', [bigwig, 'mark.type=rect']]],
    display: { mark: { type: 'rect' } },
  },
  {
    name: 'a multi-wiggle drawn a row per source',
    genome: plainFasta,
    loc: 'ctgA:1-8000',
    tracks: [['multiwig', [multiwig, 'height:200']]],
    display: { height: 200 },
  },
  {
    name: 'a file naming its contig by an alias, at a locString in that alias',
    genome: ['fasta', [fasta, `aliases:${aliases}`]],
    loc: 'contigA:1-8000',
    tracks: [['bigwig', [altnameBigwig]]],
  },
]

const lines = (svg: string) => svg.replaceAll('><', '>\n<')

async function staticSvg({ genome, loc, tracks, display }: Case) {
  const data = readData({ argv: [genome], trackList: tracks })
  return staticLinearSvg({
    pluginManager,
    assembly: data.assembly,
    loc,
    width,
    tracks: data.tracks.map(track => ({
      trackId: track.trackId,
      name: typeof track.name === 'string' ? track.name : undefined,
      adapterConfig: track.adapter!,
      display,
    })),
    opts: { rasterizeLayers: false, fontFamily: DEFAULT_FONT_FAMILY },
  })
}

test.each(cases)(
  'the static path draws $name as jb2export does',
  async c => {
    const session = await renderRegion({
      argv: [c.genome],
      trackList: c.tracks,
      loc: c.loc,
      width,
      noRasterize: true,
    })
    const drawn = await staticSvg(c)
    expect(drawn).toMatch(/clip-path="url\(#svgcanvas-clip-\d+\)"><(path|rect)/)
    expect(lines(drawn)).toBe(lines(session))
  },
  60000,
)
