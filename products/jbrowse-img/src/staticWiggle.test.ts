/**
 * @jest-environment <rootDir>/config/jest/jsdom.cjs
 *
 * The environment and the fetch shim for the reasons
 * renderSessionInit.test.ts gives.
 */
/**
 * A quantitative track drawn with no session, `staticWiggleSvg` over a
 * `staticLgvFrame`, against the same track drawn the way jb2export draws it
 * today: a session, a launched view, and the display's `renderSvg` once the
 * view settles. The display's whole node must come out the same: every element
 * the display draws in the track's body group, its trailing y axis included.
 */
import path from 'node:path'

import Plugin from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { staticLgvFrame } from '@jbrowse/plugin-linear-genome-view'
import { staticWiggleSvg } from '@jbrowse/plugin-wiggle/staticSvg'
import { registerWiggleAdapters } from '@jbrowse/plugin-wiggle/tables'
import { enableStaticRendering } from 'mobx-react'

import { DEFAULT_FONT_FAMILY } from './options.ts'
import { readData } from './readData.ts'
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
const testData = path.join(__dirname, '..', '..', '..', 'test_data', 'volvox')
const fasta = path.join(volvoxDir, 'volvox.fa')
const bigwig = path.join(volvoxDir, 'volvox-sorted.bam.coverage.bw')
const multiwig = ['v1', 'v2', 'v3', 'v4']
  .map(n => path.join(testData, `${n}.cram.bw`))
  .join(',')
const width = 800
const ctgA = {
  assemblyName: 'volvox.fa',
  refName: 'ctgA',
  start: 0,
  end: 50001,
}

class WigglePlugin extends Plugin {
  name = 'StaticWigglePlugin'
  install(pluginManager: PluginManager) {
    registerWiggleAdapters(pluginManager)
  }
}

const pluginManager = new PluginManager([new WigglePlugin()])
pluginManager.createPluggableElements()
pluginManager.configure()

// the text style the LGV's export hands each display, its fontSize default
// included: the view's chrome, which a static caller states itself
const svgOpts = {
  rasterizeLayers: false,
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: 13,
}

function parse(svg: string) {
  return new DOMParser().parseFromString(svg, 'image/svg+xml')
}

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

const serialize = (nodes: Element[]) =>
  nodes
    .map(node => new XMLSerializer().serializeToString(node))
    .join('\n')
    .replaceAll('><', '>\n<')

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

interface Case {
  name: string
  loc: string
  window?: { windowStartBp: number; windowWidthBp: number }
  track: ['bigwig' | 'multiwig', string]
  trackOpts: string[]
  display?: Record<string, unknown>
}

const adapterOf = (track: Case['track']) =>
  readData({ fasta, trackList: [[track[0], [track[1]]]] }).tracks[0]!.adapter!

async function staticDisplayNodes({
  window,
  display,
  track,
  id,
}: Case & { id: string }) {
  const frame = staticLgvFrame({
    displayedRegions: [ctgA],
    width,
    ...window,
  })
  const body = await staticWiggleSvg(pluginManager, {
    adapterConfig: adapterOf(track),
    display,
    frame,
    id,
    opts: svgOpts,
  })
  const markup = wrapSvgExport({
    theme: undefined,
    width,
    height: 400,
    children: body,
  })
  const separators = frame.settledDynamicBlocks.filter(
    b => b.isRightEndOfDisplayedRegion,
  ).length
  return { nodes: fromDisplayClip(parse(markup)).nodes, separators }
}

const exported = ({ loc, track, trackOpts }: Case) =>
  renderRegion({
    fasta,
    trackList: [[track[0], [track[1], ...trackOpts]]],
    loc,
    width,
    noRasterize: true,
  })

const ctgAWindow = {
  loc: 'ctgA:1-8000',
  window: { windowStartBp: 0, windowWidthBp: 8000 },
}

const cases: Case[] = [
  {
    name: 'an xyplot in a window inside a contig',
    ...ctgAWindow,
    track: ['bigwig', bigwig],
    trackOpts: [],
  },
  {
    name: 'an xyplot of a whole contig',
    loc: 'ctgA',
    track: ['bigwig', bigwig],
    trackOpts: [],
  },
  {
    name: 'a configured line plot',
    ...ctgAWindow,
    track: ['bigwig', bigwig],
    trackOpts: ['height:60', 'mark.type=line'],
    display: { height: 60, mark: { type: 'line' } },
  },
  {
    name: 'a density plot',
    ...ctgAWindow,
    track: ['bigwig', bigwig],
    trackOpts: ['mark.type=rect'],
    display: { mark: { type: 'rect' } },
  },
  {
    name: 'a multi-wiggle drawn a row per source',
    ...ctgAWindow,
    track: ['multiwig', multiwig],
    trackOpts: ['height:200'],
    display: { height: 200 },
  },
  {
    name: 'a multi-wiggle narrowed to two sources, its chip line left out',
    ...ctgAWindow,
    track: ['multiwig', multiwig],
    trackOpts: ['height:200', 'rows.kept=v1.cram,v2.cram'],
    display: { height: 200, rows: { kept: ['v1.cram', 'v2.cram'] } },
  },
]

test.each(cases)(
  'the static path draws $name as jb2export does',
  async c => {
    const session = fromDisplayClip(parse(await exported(c)))
    const { nodes, separators } = await staticDisplayNodes({
      ...c,
      id: session.id,
    })
    const drawn = serialize(nodes)
    expect(drawn).toMatch(/<(path|rect)/)
    expect(drawn).toBe(
      serialize(sessionDisplayNodes(session.nodes, separators)),
    )
  },
  60000,
)
