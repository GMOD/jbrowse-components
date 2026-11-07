/**
 * @jest-environment <rootDir>/config/jest/jsdom.cjs
 *
 * The environment and the fetch shim for the reasons
 * renderSessionInit.test.ts gives.
 */
/**
 * A mark display drawn with no session, `staticMarkSvg` over a
 * `staticLgvFrame`, against the same track drawn the way jb2export draws it
 * today: a session, a launched view, and the display's `renderSvg` once the
 * view settles. The display's whole node must come out the same, its trailing
 * y axis included, and so must the key the view draws beside it.
 */
import { createElement } from 'react'

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { SvgLegend } from '@jbrowse/display-kit/renderDisplaySvg'
import { parseArgv } from '@jbrowse/launch-args'
import { staticLgvFrame } from '@jbrowse/plugin-linear-genome-view'
import { staticMarkSvg } from '@jbrowse/plugin-marks/staticSvg'
import { registerVariantAdapters } from '@jbrowse/plugin-variants/tables'
import { registerWiggleAdapters } from '@jbrowse/plugin-wiggle/tables'
import { enableStaticRendering } from 'mobx-react'

import { DEFAULT_FONT_FAMILY } from './options.ts'
import { renderRegion } from './renderRegion.ts'

import type { HiddenCategory } from '@jbrowse/plugin-marks'

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
const local = (file: string) => ({ localPath: path.join(volvox, file) })
const width = 800
const ctgA = {
  assemblyName: 'volvox',
  refName: 'ctgA',
  start: 0,
  end: 50001,
}
const loc = 'ctgA:1-8000'
const window = { windowStartBp: 0, windowWidthBp: 8000 }

const bigwig = {
  type: 'QuantitativeTrack',
  adapter: {
    type: 'BigWigAdapter',
    bigWigLocation: local('volvox-sorted.bam.coverage.bw'),
  },
}
const vcf = {
  type: 'VariantTrack',
  adapter: {
    type: 'VcfTabixAdapter',
    vcfGzLocation: local('volvox.filtered.vcf.gz'),
    index: { location: local('volvox.filtered.vcf.gz.tbi') },
  },
}

class StaticMarkPlugin extends Plugin {
  name = 'StaticMarkPlugin'
  install(pluginManager: PluginManager) {
    registerWiggleAdapters(pluginManager)
    registerVariantAdapters(pluginManager)
  }
}

const pluginManager = new PluginManager([new StaticMarkPlugin()])
pluginManager.createPluggableElements()
pluginManager.configure()

// the text style the LGV's export hands each display, its fontSize default
// included: the view's chrome, which a static caller states itself
const svgOpts = {
  rasterizeLayers: false,
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: 13,
}

interface Case {
  name: string
  track: typeof bigwig | typeof vcf
  display: Record<string, unknown>
  hiddenCategories?: HiddenCategory[]
  /** what the case must draw, so a case drawing nothing cannot pass */
  draws: RegExp
  keyed: boolean
}

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'jb2export-mark-'))
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true })
})

const writeJson = (name: string, value: unknown) => {
  const file = path.join(fs.mkdtempSync(path.join(scratch, 'case-')), name)
  fs.writeFileSync(file, JSON.stringify(value))
  return file
}

const configOf = ({ track, display }: Case) =>
  writeJson('config.json', {
    assemblies: [
      {
        name: 'volvox',
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: 'volvox_refseq',
          adapter: {
            type: 'TwoBitAdapter',
            twoBitLocation: local('volvox.2bit'),
          },
        },
      },
    ],
    tracks: [
      {
        ...track,
        trackId: 'marks',
        assemblyNames: ['volvox'],
        displays: [
          { type: 'LinearMarkDisplay', displayId: 'marks-display', ...display },
        ],
      },
    ],
  })

/**
 * The session path as jb2export takes it: `--config` and `--track`, or a
 * session whose track recipe carries the categories the key hides.
 */
function exported(c: Case) {
  const config = configOf(c)
  if (c.hiddenCategories) {
    return renderRegion({
      config,
      noRasterize: true,
      width,
      session: writeJson('session.json', {
        session: {
          name: 'hidden categories',
          views: [
            {
              id: 'view',
              type: 'LinearGenomeView',
              assembly: 'volvox',
              loc,
              tracks: [
                { trackId: 'marks', hiddenCategories: c.hiddenCategories },
              ],
            },
          ],
        },
      }),
    })
  }
  const argv = parseArgv(['--config', config, '--loc', loc, '--track', 'marks'])
  return renderRegion({
    config,
    loc,
    argv,
    mode: 'linear',
    showTracks: argv.filter(([key]) => key === 'track'),
    noRasterize: true,
    width,
  })
}

function parse(svg: string) {
  return new DOMParser().parseFromString(svg, 'image/svg+xml')
}

const serialize = (nodes: Element[]) =>
  nodes
    .map(node => new XMLSerializer().serializeToString(node))
    .join('\n')
    .replaceAll('><', '>\n<')

/**
 * The display's nodes and what follows them in their group: from the `<defs>`
 * holding the display's clip, the first node the display shell draws, to the
 * group's end.
 */
function fromDisplayClip(doc: Document) {
  const defs = doc.querySelector('clipPath[id^="display-clip-"]')?.parentElement
  const group = defs?.parentElement
  if (!defs?.firstElementChild || !group) {
    throw new Error('no display clip in the export')
  }
  const nodes = [...group.children]
  return {
    id: defs.firstElementChild.id.replace(/^display-clip-/, ''),
    nodes: nodes.slice(nodes.indexOf(defs)),
  }
}

/** The key: the group the legend draws, which the view places beside the plot. */
function legendNodes(doc: Document) {
  const legend = doc.querySelector('[data-testid="color-legend"]')
  return legend ? [legend] : []
}

/**
 * The session's track body group holds the display's nodes, then the view's
 * region separators: one 3px rect per displayed region whose right end is on
 * screen. Those are the view's chrome, not the display's, and are split off
 * here by count, each checked to be a separator.
 */
function sessionDisplayNodes(nodes: Element[], separators: number) {
  const chrome = nodes.slice(nodes.length - separators)
  for (const node of chrome) {
    expect(node.tagName).toBe('rect')
    expect(node.getAttribute('width')).toBe('3')
  }
  return nodes.slice(0, nodes.length - separators)
}

async function staticNodes(c: Case, id: string) {
  const frame = staticLgvFrame({ displayedRegions: [ctgA], width, ...window })
  const { svg, legend } = await staticMarkSvg(pluginManager, {
    adapterConfig: c.track.adapter,
    display: c.display,
    hiddenCategories: c.hiddenCategories,
    frame,
    id,
    opts: svgOpts,
  })
  const keyHeight = 400
  const markup = wrapSvgExport({
    theme: undefined,
    width,
    height: 400,
    children: createElement(
      'g',
      null,
      createElement('g', null, svg),
      createElement(SvgLegend, { model: legend, width, height: keyHeight }),
    ),
  })
  const doc = parse(markup)
  const separators = frame.settledDynamicBlocks.filter(
    b => b.isRightEndOfDisplayedRegion,
  ).length
  return {
    nodes: fromDisplayClip(doc).nodes,
    legend: legendNodes(doc),
    separators,
  }
}

const pointsByRef = {
  marks: [{ mark: 'point', encoding: { y: 'QUAL', color: { field: 'REF' } } }],
}

const cases: Case[] = [
  {
    name: "a bar over a bigwig's score",
    track: bigwig,
    display: { marks: [{ mark: 'bar', encoding: { y: 'score' } }] },
    draws: /<rect/,
    keyed: false,
  },
  {
    name: 'a line and a rule over the score on a log axis',
    track: bigwig,
    display: {
      height: 120,
      encoding: { y: { scale: { type: 'log' } } },
      marks: [
        { mark: 'line', encoding: { y: 'score' } },
        { mark: 'rule', encoding: { y: 'score' } },
      ],
    },
    draws: /<path/,
    keyed: false,
  },
  {
    name: 'points colored by a categorical field, with its key',
    track: vcf,
    display: pointsByRef,
    draws: /<(path|circle)/,
    keyed: true,
  },
  {
    name: 'a count and a mean over a shared bin',
    track: vcf,
    display: {
      transform: [{ type: 'bin', step: 1000 }],
      marks: [
        {
          mark: 'bar',
          transform: [{ type: 'aggregate', ops: [{ op: 'count' }] }],
        },
        {
          mark: 'point',
          encoding: { y: 'mean_QUAL' },
          transform: [
            { type: 'aggregate', ops: [{ op: 'mean', field: 'QUAL' }] },
          ],
        },
      ],
    },
    draws: /<rect/,
    keyed: false,
  },
  {
    name: 'points with a key category hidden',
    track: vcf,
    display: pointsByRef,
    hiddenCategories: [{ field: 'REF', value: 'T' }],
    draws: /<(path|circle)/,
    keyed: true,
  },
  {
    name: 'a row per value of a field, labelled beside the plot',
    track: vcf,
    display: {
      height: 160,
      rows: 'REF',
      marks: [{ mark: 'point', encoding: { y: 'QUAL' } }],
    },
    draws: /<text/,
    keyed: false,
  },
]

test.each(cases)(
  'the static path draws $name as jb2export does',
  async c => {
    const session = parse(await exported(c))
    const display = fromDisplayClip(session)
    const { nodes, legend, separators } = await staticNodes(c, display.id)
    const drawn = serialize(nodes)
    expect(drawn).toMatch(c.draws)
    expect(drawn).toBe(
      serialize(sessionDisplayNodes(display.nodes, separators)),
    )
    const sessionLegend = legendNodes(session)
    expect(sessionLegend.length > 0).toBe(c.keyed)
    expect(serialize(legend)).toBe(serialize(sessionLegend))
  },
  60000,
)

test('a region over the byte limit is refused, as the features export refuses it', async () => {
  await expect(
    staticMarkSvg(pluginManager, {
      adapterConfig: vcf.adapter,
      display: pointsByRef,
      frame: staticLgvFrame({ displayedRegions: [ctgA], width, ...window }),
      byteLimit: 1,
    }),
  ).rejects.toThrow(/over the 1-byte limit/)
})
