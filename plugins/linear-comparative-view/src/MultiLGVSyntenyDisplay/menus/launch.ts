import { lazy } from 'react'

import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import BubbleChartIcon from '@mui/icons-material/BubbleChart'
import TimelineIcon from '@mui/icons-material/Timeline'
import ViewComfyIcon from '@mui/icons-material/ViewComfy'

import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const LaunchPairwiseSyntenyDialog = lazy(
  () => import('../components/LaunchPairwiseSyntenyDialog.tsx'),
)

export const SUBGRAPH_VIEW_TYPES = [
  {
    type: 'GraphGenomeView' as const,
    label: 'Graph genome',
    icon: BubbleChartIcon,
  },
  { type: 'TubeMapView' as const, label: 'Tube map', icon: TimelineIcon },
]

// Shared with GraphGenomeView/TubeMapView (adr-027): `vg find` subgraph
// extraction is sub-second up to ~100 kb. Past this both graph views decline,
// so guard the launch here rather than fetch a subgraph that won't render.
const MAX_SUBGRAPH_REGION_BP = 100_000

function regionLabel(region: { refName: string; start: number; end: number }) {
  return `${region.refName}:${region.start.toLocaleString()}-${region.end.toLocaleString()}`
}

export function regionFromFeature(feature: Feature, fallbackAssembly: string) {
  const fStart = feature.get('start')
  const fEnd = feature.get('end')
  const padding = Math.max(10, Math.floor((fEnd - fStart) * 0.5))
  return {
    refName: feature.get('refName'),
    assemblyName:
      (feature.get('assemblyName') as string | undefined) ?? fallbackAssembly,
    start: Math.max(0, fStart - padding),
    end: fEnd + padding,
  }
}

function regionFromViewport(view: LGV) {
  const dr = view.displayedRegions[0]
  if (!dr) {
    return undefined
  }
  const rawStart = view.offsetPx * view.bpPerPx
  const rawEnd = (view.offsetPx + view.width) * view.bpPerPx
  return {
    refName: dr.refName,
    assemblyName: dr.assemblyName,
    start: Math.max(0, Math.floor(rawStart)),
    end: Math.floor(rawEnd),
  }
}

export async function launchSubgraphView(
  session: ReturnType<typeof getSession>,
  sessionId: string,
  adapterConfig: Record<string, unknown>,
  region: { refName: string; assemblyName: string; start: number; end: number },
  viewType: 'GraphGenomeView' | 'TubeMapView',
) {
  const regionSize = region.end - region.start
  if (regionSize > MAX_SUBGRAPH_REGION_BP) {
    session.notify(
      `Region too large (${Math.round(regionSize / 1000)} kb) — zoom in to open a graph view (max ${MAX_SUBGRAPH_REGION_BP / 1000} kb)`,
      'warning',
    )
    return
  }
  const gfaText = await session.rpcManager.call(sessionId, 'GetSubgraph', {
    adapterConfig,
    region,
    sessionId,
  })
  if (!gfaText) {
    session.notify(
      'This adapter does not support graph subgraph extraction',
      'warning',
    )
    return
  }
  const view = session.addView(viewType, {})
  ;(view as { loadGFA?: (gfa: string, label: string) => void }).loadGFA?.(
    gfaText,
    regionLabel(region),
  )
}

interface LaunchModel {
  displayedGenomes: string[]
}

/**
 * Builds the "Launch" submenu: N-way and 2-way synteny launchers (when the
 * model has displayed genomes), plus per-viewport subgraph view launchers.
 * Returns [] when there's nothing reasonable to launch — caller spreads the
 * result conditionally so the empty case doesn't add an empty submenu.
 */
export function getLaunchSubMenu(self: LaunchModel): MenuItem[] {
  const view = getContainingView(self) as LGV
  const track = getContainingTrack(self)
  const trackId = getConf(track, 'trackId')
  const adapterConfig = getConf(track, 'adapter')
  const refAssembly = view.displayedRegions[0]?.assemblyName
  const loc = view.displayedRegions[0]
    ? `${view.displayedRegions[0].refName}:${Math.floor(view.offsetPx * view.bpPerPx)}-${Math.floor((view.offsetPx + view.width) * view.bpPerPx)}`
    : undefined

  const items: MenuItem[] = []
  if (refAssembly && loc && self.displayedGenomes.length > 0) {
    items.push(
      {
        label: `N-way synteny view (${self.displayedGenomes.length + 1} genomes)`,
        icon: ViewComfyIcon,
        onClick: () => {
          const genomes = self.displayedGenomes
          const tracks = genomes.map(() => [trackId])
          getSession(self).addView('LinearSyntenyView', {
            type: 'LinearSyntenyView',
            init: {
              views: [
                { assembly: refAssembly, loc },
                ...genomes.map(genome => ({ assembly: genome })),
              ],
              tracks,
            },
          })
        },
      },
      {
        label: '2-way synteny with...',
        onClick: () => {
          getSession(self).queueDialog(handleClose => [
            LaunchPairwiseSyntenyDialog,
            {
              model: self,
              handleClose,
              refAssembly,
              loc,
              trackId,
            },
          ])
        },
      },
    )
  }

  for (const { type: viewType, label, icon } of SUBGRAPH_VIEW_TYPES) {
    items.push({
      label: `${label} view (local)`,
      icon,
      onClick: async () => {
        const session = getSession(self)
        const region = regionFromViewport(view)
        if (!region) {
          console.warn(`[${viewType} launch] No displayed region found`)
          return
        }
        try {
          await launchSubgraphView(
            session,
            getRpcSessionId(self),
            adapterConfig,
            region,
            viewType,
          )
        } catch (e) {
          console.error(`[${viewType} launch] Error:`, e)
          session.notify(
            `Failed to launch ${viewType}: ${e instanceof Error ? e.message : e}`,
            'error',
          )
        }
      },
    })
  }

  return items.length > 0 ? [{ label: 'Launch', subMenu: items }] : []
}
