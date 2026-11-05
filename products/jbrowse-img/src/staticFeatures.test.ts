/**
 * @jest-environment <rootDir>/config/jest/jsdom.cjs
 *
 * The environment and the fetch shim for the reasons
 * renderSessionInit.test.ts gives.
 */
/**
 * A feature track drawn with no session, `staticFeaturesSvg` over a
 * `staticLgvFrame`, against the same track drawn the way jb2export draws it
 * today: a session, a launched view, and the display's `renderSvg` once the
 * view settles. The display's whole node must come out the same: every
 * element the display draws in the track's body group.
 */
import path from 'node:path'

import PluginManager from '@jbrowse/core/PluginManager'
import { wrapSvgExport } from '@jbrowse/core/svg/wrapSvgExport'
import { staticFeaturesSvg } from '@jbrowse/plugin-features/staticSvg'
import GFF3Plugin from '@jbrowse/plugin-gff3'
import { staticLgvFrame } from '@jbrowse/plugin-linear-genome-view'
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
const fasta = path.join(volvoxDir, 'volvox.fa')
const gff = path.join(volvoxDir, 'volvox.sort.gff3.gz')
const width = 800
const ctgA = {
  assemblyName: 'volvox.fa',
  refName: 'ctgA',
  start: 0,
  end: 50001,
}

const pluginManager = new PluginManager([new GFF3Plugin()])
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
  trackOpts: string[]
  display?: Record<string, unknown>
  /** What the case must draw, so a body that drops it fails here too. */
  draws: RegExp[]
}

const adapterConfig = readData({ fasta, trackList: [['gff', [gff]]] })
  .tracks[0]!.adapter!

async function staticDisplayNodes({
  window,
  display,
  id,
}: Case & { id: string }) {
  const frame = staticLgvFrame({
    displayedRegions: [ctgA],
    width,
    ...window,
  })
  const body = await staticFeaturesSvg(pluginManager, {
    adapterConfig,
    display,
    frame,
    id,
    opts: svgOpts,
  })
  const markup = wrapSvgExport({
    theme: undefined,
    width,
    height: 2000,
    children: body,
  })
  const separators = frame.settledDynamicBlocks.filter(
    b => b.isRightEndOfDisplayedRegion,
  ).length
  return { nodes: fromDisplayClip(parse(markup)).nodes, separators }
}

const exported = ({ loc, trackOpts }: Case) =>
  renderRegion({
    fasta,
    trackList: [['gff', [gff, ...trackOpts]]],
    loc,
    width,
    noRasterize: true,
  })

const genes = {
  loc: 'ctgA:1001-11000',
  window: { windowStartBp: 1000, windowWidthBp: 10000 },
}

const labels = /<text[^>]*>EDEN<\/text>/
const boxes = /<(path|rect)/

const cases: Case[] = [
  {
    name: 'genes in normal mode with their labels',
    ...genes,
    trackOpts: ['height:300'],
    display: { height: 300 },
    draws: [boxes, labels],
  },
  {
    name: 'genes in collapsed mode',
    ...genes,
    trackOpts: ['displayMode=collapsed'],
    display: { displayMode: 'collapsed' },
    draws: [boxes],
  },
  {
    name: 'a whole contig, where the labels thin out to fit',
    loc: 'ctgA',
    trackOpts: [],
    draws: [boxes],
  },
  {
    name: 'features crossing the window edge',
    loc: 'ctgA:1-5000',
    window: { windowStartBp: 0, windowWidthBp: 5000 },
    trackOpts: ['height:300'],
    display: { height: 300 },
    draws: [boxes, labels],
  },
  {
    name: 'features colored by a field',
    ...genes,
    trackOpts: ['height:300', 'encoding.color.field=type'],
    display: { height: 300, encoding: { color: { field: 'type' } } },
    draws: [boxes, labels],
  },
  {
    name: 'a track grown to its features',
    ...genes,
    trackOpts: ['heightMode=grow'],
    display: { heightMode: 'grow' },
    draws: [boxes, labels],
  },
  {
    name: 'features grouped by strand under section chips',
    ...genes,
    trackOpts: ['height:400', 'facet.field=strand'],
    display: { height: 400, facet: { field: 'strand' } },
    draws: [boxes, /<text[^>]*>[+-]|strand/],
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
    for (const mark of c.draws) {
      expect(drawn).toMatch(mark)
    }
    expect(drawn).toBe(
      serialize(sessionDisplayNodes(session.nodes, separators)),
    )
  },
  60000,
)
