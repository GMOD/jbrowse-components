import {
  animationAllowed,
  assembleLocString,
  getSession,
} from '@jbrowse/core/util'

import type {
  OffscreenMateLocus,
  OffscreenMateSpan,
} from '../LinearSyntenyDisplay/drawOffscreenMates.ts'
import type { AnimationMode, Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// padding around the mate locus, per side, as a fraction of its width
export const OFFSCREEN_MATE_NAV_GROW = 0.2

// the narrowest window a mark navigates to, so a small anchor framed exactly
// does not land the row at sequence zoom with nothing around it
export const OFFSCREEN_MATE_NAV_MIN_BP = 20_000

// The window a clicked mark frames: the locus padded, widened to the floor if
// still narrower, and clamped to the contig. Interbase.
export function navSpan(
  region: { start: number; end: number },
  locus: OffscreenMateLocus,
) {
  const padded = Math.round(
    (locus.end - locus.start) * (1 + 2 * OFFSCREEN_MATE_NAV_GROW),
  )
  const span = Math.max(OFFSCREEN_MATE_NAV_MIN_BP, padded)
  const start = Math.max(
    region.start,
    Math.min(
      region.end - span,
      Math.round((locus.start + locus.end - span) / 2),
    ),
  )
  return { start, end: Math.min(region.end, start + span) }
}

// `linkViews` holds the rows together in pixels and `installLinkedViewSync`
// replays a row's zoom onto the others but not its scroll, so a flight there
// pulls every row back to the apex while one of them travels
export function mateFlightAllowed(
  host: { linkViews: boolean },
  mode: AnimationMode,
) {
  return animationAllowed(mode) && !host.linkViews
}

export type MateNavDestination =
  | {
      kind: 'scroll'
      loc: string
      refName: string
      coord0: number
      displayedRegionIndex: number
    }
  | {
      kind: 'add'
      loc: string
      regions: Region[]
      location: { refName: string; start: number; end: number }
    }
  | { kind: 'none'; reason: string }

// The drawn span read back through the row's own layout: where it lands, and
// the locstring naming it, spanning the drawn extent where that sits inside
// one region and naming the centre base otherwise
function drawnPlacement(
  view: LinearGenomeViewModel,
  drawn: OffscreenMateLocus,
) {
  const px = (cumBp: number) => cumBp / view.bpPerPx - view.offsetPx
  const at = view.pxToBp(px((drawn.start + drawn.end) / 2))
  const from = view.pxToBp(px(drawn.start))
  const to = view.pxToBp(px(drawn.end))
  const whole =
    !from.oob && !to.oob && from.index === at.index && to.index === at.index
  const start = whole ? Math.min(from.coord0, to.coord0) : at.coord0
  const end = whole ? Math.max(from.coord0, to.coord0) : at.coord0
  return {
    at,
    loc: assembleLocString({
      refName: at.refName,
      start,
      end: Math.max(end, start + 1),
    }),
  }
}

// Resolve a mark's click against the row it names, without touching anything.
//
// The scroll class navigates with the row's own spelling and coordinates,
// read back through `pxToBp` from where the ribbons are drawn; a drawn span
// landing off the layout or on another contig is stale geometry and the row
// holds. The add class keeps the row's own region for the contig only when it
// reaches the framed window (compared raw, as `navTo` compares), and
// otherwise swaps every spelling of that contig for the whole one, so
// `showRegions` cannot be handed a window outside its regions.
export function mateNavDestination({
  node,
  view,
  mate,
}: {
  node: IStateTreeNode
  view: LinearGenomeViewModel
  mate: OffscreenMateSpan
}): MateNavDestination {
  const { refName } = mate
  const assemblyName = view.assemblyNames[0]
  const assembly = assemblyName
    ? getSession(node).assemblyManager.get(assemblyName)
    : undefined
  // the lenient resolver: the strict one throws before the aliases load
  const canonical = (name: string) =>
    assembly?.getCanonicalRefName2(name) ?? name
  const drawn = mate.mateCumBp
  if (drawn && view.displayedRegions.length > 0) {
    const { at, loc } = drawnPlacement(view, drawn)
    return at.oob || canonical(at.refName) !== canonical(refName)
      ? {
          kind: 'none',
          reason: `Could not show ${refName}: that mark's drawn position no longer lands on it`,
        }
      : {
          kind: 'scroll',
          refName: at.refName,
          coord0: at.coord0,
          displayedRegionIndex: at.index,
          loc,
        }
  }
  const region = assembly?.getRegionForRefName(canonical(refName))
  if (!region) {
    return {
      kind: 'none',
      reason: `Could not find ${refName} in ${assemblyName}`,
    }
  }
  const { start, end } = navSpan(region, mate.locus)
  const reaches = view.displayedRegions.some(
    r => r.refName === region.refName && start >= r.start && end <= r.end,
  )
  return {
    kind: 'add',
    regions: reaches
      ? [...view.displayedRegions]
      : [
          ...view.displayedRegions.filter(
            r => canonical(r.refName) !== region.refName,
          ),
          region,
        ],
    location: { refName: region.refName, start, end },
    loc: assembleLocString({ refName: region.refName, start, end }),
  }
}
