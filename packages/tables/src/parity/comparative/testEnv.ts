import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { isLinearSyntenyView } from '@jbrowse/plugin-linear-comparative-view'
import { createTestSession } from '@jbrowse/web/testUtils'

import { hasDisplayType, until } from '../testEnv.ts'

import type { TablesRegion } from '@jbrowse/core/data_adapters/tables'
import type { DotplotViewModel } from '@jbrowse/plugin-dotplot-view'

const TRACK_ID = 'parity_synteny'
const SYNTENY_DISPLAY_ID = `${TRACK_ID}-LinearSyntenyDisplay`
const DOTPLOT_DISPLAY_ID = `${TRACK_ID}-DotplotDisplay`

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

const displayedRegions = ({ assembly, regions }: ComparativeAxis) =>
  regions.map(r => ({ ...r, assemblyName: assembly.name }))

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
          name: 'parity synteny',
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
  shown: { bpPerPx: number; offsetPx: number },
) {
  const bpPerPx = axisBpPerPx(axis)
  if (shown.bpPerPx !== bpPerPx || shown.offsetPx !== 0) {
    throw new Error(
      `the ${what} shows ${shown.bpPerPx} bp/px from ${shown.offsetPx} px, not the export's ${bpPerPx} from 0`,
    )
  }
}

/**
 * A real `LinearSyntenyView` of two genome rows, each showing its axis's
 * regions end to end across the axis's width, and one level holding the
 * track's `LinearSyntenyDisplay` at `height` px, settled on its first fetch.
 * The rows open on that window, so the first fetch is the one compared.
 */
export async function standUpSynteny(
  spec: ComparativeViewSpec & { height: number },
) {
  const session = comparativeSession(spec)
  const [query, target] = spec.axes
  if (query.width !== target.width) {
    throw new Error('the synteny rows share one width')
  }
  const typeName: string = 'LinearSyntenyView'
  const view = await session.launchView(typeName, {
    ...spec.settings,
    views: spec.axes.map(axis => ({
      type: 'LinearGenomeView',
      hideHeader: true,
      displayedRegions: displayedRegions(axis),
      windowWidthBp: totalBp(axis.regions),
      windowStartBp: 0,
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
      assertWindow(`row ${i}`, axis, row)
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
 * and whose vertical the target's, each at its axis's bp per px from 0, and
 * the track's `DotplotDisplay`, settled on its first fetch.
 */
export async function standUpDotplot(spec: ComparativeViewSpec) {
  const session = comparativeSession(spec)
  const [x, y] = spec.axes
  const axisView = (axis: ComparativeAxis) => ({
    displayedRegions: displayedRegions(axis),
    bpPerPx: axisBpPerPx(axis),
    offsetPx: 0,
  })
  const typeName: string = 'DotplotView'
  const view = await session.launchView(typeName, {
    ...spec.settings,
    assemblyNames: [x.assembly.name, y.assembly.name],
    hview: axisView(x),
    vview: axisView(y),
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
  assertWindow('horizontal axis', x, view.hview)
  assertWindow('vertical axis', y, view.vview)
  return {
    view,
    display,
    dispose: () => {
      session.removeView(view)
    },
  }
}
