import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { isLinearSyntenyView } from '@jbrowse/plugin-linear-comparative-view'
import { createTestSession } from '@jbrowse/web/testUtils'

import { hasDisplayType, until } from '../testEnv.ts'

import type { MultiWayTablesArgs } from '../../index.ts'
import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { DotplotViewModel } from '@jbrowse/plugin-dotplot-view'
import type { MultiWaySyntenyDisplayModel } from '@jbrowse/plugin-linear-comparative-view'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const TRACK_ID = 'parity_synteny'
export const TRACK_NAME = 'parity synteny'
const SYNTENY_DISPLAY_ID = `${TRACK_ID}-LinearSyntenyDisplay`
const DOTPLOT_DISPLAY_ID = `${TRACK_ID}-DotplotDisplay`
const MULTIWAY_DISPLAY_ID = `${TRACK_ID}-MultiWaySyntenyDisplay`

export const fileUri = (file: string) => ({
  uri: pathToFileURL(path.resolve(file)).href,
  locationType: 'UriLocation',
})

/**
 * An assembly over an indexed FASTA, which the view loads and the tables
 * deal a color by contig in the order of.
 */
export function fastaAssembly(name: string, fasta: string) {
  return {
    name,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}-ReferenceSequenceTrack`,
      adapter: {
        type: 'IndexedFastaAdapter',
        fastaLocation: fileUri(fasta),
        faiLocation: fileUri(`${fasta}.fai`),
      },
    },
  }
}

export type FastaAssembly = ReturnType<typeof fastaAssembly>

/** An assembly config: its name and the sequence adapter it reads. */
export type AssemblyConfig = Readonly<{
  name: string
  sequence: {
    type: string
    trackId: string
    adapter: Record<string, unknown>
  }
}>

/** One axis: its assembly, the regions it shows end to end, and its px. */
export interface ComparativeAxis {
  assembly: FastaAssembly
  regions: TablesRegion[]
  width: number
}

export interface ComparativeViewSpec {
  adapterConfig: Record<string, unknown>
  /** query then target, as the export's two axes */
  axes: readonly [ComparativeAxis, ComparativeAxis]
  /** the view's settings, as its snapshot writes them */
  settings: Record<string, unknown>
}

const totalBp = (regions: readonly TablesRegion[]) =>
  regions.reduce((sum, r) => sum + r.end - r.start, 0)

export const axisBpPerPx = ({ regions, width }: ComparativeAxis) =>
  totalBp(regions) / width

type TestSession = ReturnType<typeof createTestSession>

/**
 * How the app frames an axis's regions: one region is a locus, a window into
 * its whole contig; several are the displayed regions themselves. The frame's
 * regions and the window's start in them, in bp.
 */
async function framed(
  session: TestSession,
  assemblyName: string,
  regions: readonly TablesRegion[],
) {
  const [locus, ...rest] = regions
  const assembly = await session.assemblyManager.waitForAssembly(assemblyName)
  const contig =
    locus && rest.length === 0
      ? assembly?.regions?.find(r => r.refName === locus.refName)
      : undefined
  return contig && locus
    ? {
        displayedRegions: [
          {
            refName: contig.refName,
            start: contig.start,
            end: contig.end,
            assemblyName,
          },
        ],
        windowStartBp: locus.start - contig.start,
      }
    : {
        displayedRegions: regions.map(r => ({ ...r, assemblyName })),
        windowStartBp: 0,
      }
}

// A web session holding both assemblies and one synteny track over the
// adapter, its RPC on the main thread, so the display fetches with its own
// args through the real adapters
function comparativeSession({ adapterConfig, axes }: ComparativeViewSpec) {
  const assemblies = new Map(axes.map(a => [a.assembly.name, a.assembly]))
  return createTestSession({
    jbrowseConfig: {
      assemblies: [...assemblies.values()],
      tracks: [
        {
          type: 'SyntenyTrack',
          trackId: TRACK_ID,
          name: TRACK_NAME,
          assemblyNames: axes.map(a => a.assembly.name),
          adapter: adapterConfig,
          displays: [
            { type: 'LinearSyntenyDisplay', displayId: SYNTENY_DISPLAY_ID },
            { type: 'DotplotDisplay', displayId: DOTPLOT_DISPLAY_ID },
          ],
        },
      ],
    },
  })
}

// connected and fetched, rather than inert while an assembly loads
const settled = (
  display: { fetchInert: boolean; svgReady: boolean } | undefined,
) => display !== undefined && !display.fetchInert && display.svgReady

function assertWindow(
  what: string,
  axis: ComparativeAxis,
  windowStartBp: number,
  shown: { bpPerPx: number; offsetPx: number },
) {
  const bpPerPx = axisBpPerPx(axis)
  const offsetPx = windowStartBp / bpPerPx
  if (
    Math.abs(shown.bpPerPx - bpPerPx) > 1e-9 ||
    Math.abs(shown.offsetPx - offsetPx) > 1e-6
  ) {
    throw new Error(
      `the ${what} shows ${shown.bpPerPx} bp/px from ${shown.offsetPx} px, not the export's ${bpPerPx} from ${offsetPx}`,
    )
  }
}

/**
 * A real `LinearSyntenyView` of two genome rows, each framed as the app
 * frames its axis (`framed`) and scrolled to the axis's regions across its
 * width, and one level holding the track's `LinearSyntenyDisplay` at
 * `height` px, settled on its first fetch. The rows open on that window, so
 * the first fetch is the one compared.
 */
export async function standUpSynteny(
  spec: ComparativeViewSpec & { height: number },
) {
  const session = comparativeSession(spec)
  const [query, target] = spec.axes
  if (query.width !== target.width) {
    throw new Error('the synteny rows share one width')
  }
  const frames = await Promise.all(
    spec.axes.map(axis => framed(session, axis.assembly.name, axis.regions)),
  )
  const typeName: string = 'LinearSyntenyView'
  const view = await session.launchView(typeName, {
    ...spec.settings,
    views: spec.axes.map((axis, i) => ({
      type: 'LinearGenomeView',
      hideHeader: true,
      ...frames[i],
      windowWidthBp: totalBp(axis.regions),
    })),
    levels: [
      {
        height: spec.height,
        tracks: [
          {
            type: 'SyntenyTrack',
            configuration: TRACK_ID,
            displays: [
              {
                type: 'LinearSyntenyDisplay',
                configuration: SYNTENY_DISPLAY_ID,
              },
            ],
          },
        ],
      },
    ],
  })
  if (!isLinearSyntenyView(view)) {
    throw new Error('the session holds no LinearSyntenyView')
  }
  view.setWidth(query.width)
  await until(
    () => settled(view.allSyntenyDisplays[0]),
    () => 'LinearSyntenyDisplay',
  )
  const display = view.allSyntenyDisplays[0]
  const level = view.levels[0]
  if (!display || !level) {
    throw new Error('the view holds no LinearSyntenyDisplay')
  } else if (display.error) {
    throw new Error(`the LinearSyntenyDisplay failed: ${String(display.error)}`)
  }
  spec.axes.forEach((axis, i) => {
    const row = view.views[i]
    if (row) {
      assertWindow(`row ${i}`, axis, frames[i]!.windowStartBp, row)
    }
  })
  return {
    view,
    level,
    display,
    dispose: () => {
      session.removeView(view)
    },
  }
}

const isDotplotView = (view: unknown): view is DotplotViewModel =>
  hasDisplayType(view, 'DotplotView')

// room past the plot for the axis labels, so each axis shows its regions whole
const DOTPLOT_MARGIN_PX = 400

/**
 * A real `DotplotView` whose horizontal axis shows the query axis's regions
 * and whose vertical the target's, each framed as the app frames it
 * (`framed`) at its axis's bp per px, and the track's `DotplotDisplay`,
 * settled on its first fetch.
 */
export async function standUpDotplot(spec: ComparativeViewSpec) {
  const session = comparativeSession(spec)
  const [x, y] = spec.axes
  const [xFrame, yFrame] = await Promise.all(
    spec.axes.map(axis => framed(session, axis.assembly.name, axis.regions)),
  )
  const axisView = (
    axis: ComparativeAxis,
    { displayedRegions, windowStartBp }: Awaited<ReturnType<typeof framed>>,
  ) => ({
    displayedRegions,
    bpPerPx: axisBpPerPx(axis),
    offsetPx: windowStartBp / axisBpPerPx(axis),
  })
  const typeName: string = 'DotplotView'
  const view = await session.launchView(typeName, {
    ...spec.settings,
    assemblyNames: [x.assembly.name, y.assembly.name],
    hview: axisView(x, xFrame!),
    vview: axisView(y, yFrame!),
    tracks: [
      {
        type: 'SyntenyTrack',
        configuration: TRACK_ID,
        displays: [
          { type: 'DotplotDisplay', configuration: DOTPLOT_DISPLAY_ID },
        ],
      },
    ],
  })
  if (!isDotplotView(view)) {
    throw new Error('the session holds no DotplotView')
  }
  view.setWidth(x.width + DOTPLOT_MARGIN_PX)
  view.setHeight(y.width + DOTPLOT_MARGIN_PX)
  await until(
    () => settled(view.dotplotDisplays[0]),
    () => 'DotplotDisplay',
  )
  const display = view.dotplotDisplays[0]
  if (!display) {
    throw new Error('the view holds no DotplotDisplay')
  } else if (display.error) {
    throw new Error(`the DotplotDisplay failed: ${String(display.error)}`)
  }
  assertWindow('horizontal axis', x, xFrame!.windowStartBp, view.hview)
  assertWindow('vertical axis', y, yFrame!.windowStartBp, view.vview)
  return {
    view,
    display,
    dispose: () => {
      session.removeView(view)
    },
  }
}

/** An assembly over a chrom.sizes file, which holds its contigs' lengths. */
export function chromSizesAssembly(name: string, chromSizes: string) {
  return {
    name,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}-ReferenceSequenceTrack`,
      adapter: {
        type: 'ChromSizesAdapter',
        chromSizesLocation: fileUri(chromSizes),
      },
    },
  }
}

export interface MultiwayViewSpec {
  adapterConfig: Record<string, unknown>
  /** every lane's genome, the anchor's first */
  assemblies: readonly AssemblyConfig[]
  /** the regions the anchor lane shows end to end across `width` px */
  anchor: { assemblyName: string; regions: TablesRegion[]; width: number }
  /** the display's config slots, as the export's `display` argument */
  settings: Record<string, unknown>
  pins?: MultiWayTablesArgs['pins']
  hidden?: MultiWayTablesArgs['hidden']
}

const isLinearGenomeView = (view: unknown): view is LinearGenomeViewModel =>
  hasDisplayType(view, 'LinearGenomeView')

const isMultiWayDisplay = (
  display: unknown,
): display is MultiWaySyntenyDisplayModel =>
  hasDisplayType(display, 'MultiWaySyntenyDisplay')

/**
 * A real `LinearGenomeView` showing the anchor's regions end to end across
 * its width, holding the track's `MultiWaySyntenyDisplay` with the reader's
 * pins and hidden lanes, settled once it reads as ready to export. Not yet
 * framed as the app frames a locus (`framed`): the multi-way tables fetch
 * the anchor's regions alone, where the display fetches the view's static
 * blocks around them, so a framed view parts from them at the window's
 * edges.
 */
export async function standUpMultiway(spec: MultiwayViewSpec) {
  const { anchor, assemblies } = spec
  const session = createTestSession({
    jbrowseConfig: {
      assemblies,
      tracks: [
        {
          type: 'SyntenyTrack',
          trackId: TRACK_ID,
          name: TRACK_NAME,
          assemblyNames: assemblies.map(a => a.name),
          adapter: spec.adapterConfig,
          displays: [
            {
              type: 'MultiWaySyntenyDisplay',
              displayId: MULTIWAY_DISPLAY_ID,
              ...spec.settings,
            },
          ],
        },
      ],
    },
  })
  session.setPreferenceOverride('animationMode', 'disabled')
  const typeName: string = 'LinearGenomeView'
  const bpPerPx = totalBp(anchor.regions) / anchor.width
  const frame = {
    displayedRegions: anchor.regions.map(r => ({
      ...r,
      assemblyName: anchor.assemblyName,
    })),
    windowStartBp: 0,
  }
  const offsetPx = frame.windowStartBp / bpPerPx
  const view = await session.launchView(typeName, {
    ...frame,
    windowWidthBp: totalBp(anchor.regions),
    showTrackOutlines: false,
    tracks: [
      {
        type: 'SyntenyTrack',
        configuration: TRACK_ID,
        displays: [
          {
            type: 'MultiWaySyntenyDisplay',
            configuration: MULTIWAY_DISPLAY_ID,
            lanePins: spec.pins,
            hiddenLaneNames: spec.hidden,
          },
        ],
      },
    ],
  })
  if (!isLinearGenomeView(view)) {
    throw new Error('the session holds no LinearGenomeView')
  }
  view.setWidth(anchor.width)
  const display = view.tracks[0]?.displays[0]
  if (!isMultiWayDisplay(display)) {
    throw new Error('the view holds no MultiWaySyntenyDisplay')
  }
  await Promise.all(
    assemblies.map(a => session.assemblyManager.waitForAssembly(a.name)),
  )
  await until(
    () => display.svgReady,
    () => 'MultiWaySyntenyDisplay',
  )
  if (display.error) {
    throw new Error(
      `the MultiWaySyntenyDisplay failed: ${String(display.error)}`,
    )
  } else if (
    Math.abs(view.bpPerPx - bpPerPx) > 1e-9 ||
    Math.abs(view.offsetPx - offsetPx) > 1e-6 ||
    display.canvasWidthPx !== anchor.width
  ) {
    throw new Error(
      `the view shows ${view.bpPerPx} bp/px from ${view.offsetPx} px over ${display.canvasWidthPx}, not the export's ${bpPerPx} from ${offsetPx} over ${anchor.width}`,
    )
  }
  return {
    view,
    display,
    dispose: () => {
      session.removeView(view)
    },
  }
}
