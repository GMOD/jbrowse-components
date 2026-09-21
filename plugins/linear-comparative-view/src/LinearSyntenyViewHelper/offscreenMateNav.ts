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
      // in the row's own cumBp, which `setWindow` and `flyToFit` take: where
      // to centre, and the narrowest window that holds the span, padded
      centerBp: number
      fitWidthBp: number
    }
  | {
      kind: 'show'
      loc: string
      regions: Region[]
      location: { refName: string; start: number; end: number }
    }
  | { kind: 'none'; reason: string }

// The drawn span read back through the row's own layout: its centre and ends
// where they land, the first of those on the contig, and the locstring naming
// it, spanning the drawn extent where that sits inside one region and naming
// that base otherwise. A span across two displayed copies of the contig
// centres between them, so its ends are asked too.
function drawnPlacement(
  view: LinearGenomeViewModel,
  drawn: OffscreenMateLocus,
  onContig: (refName: string) => boolean,
) {
  const px = (cumBp: number) => cumBp / view.bpPerPx - view.offsetPx
  const at = view.pxToBp(px((drawn.start + drawn.end) / 2))
  const from = view.pxToBp(px(drawn.start))
  const to = view.pxToBp(px(drawn.end))
  const landed = [at, from, to].find(p => !p.oob && onContig(p.refName))
  if (!landed) {
    return undefined
  }
  const whole =
    !from.oob && !to.oob && from.index === at.index && to.index === at.index
  const start = whole ? Math.min(from.coord0, to.coord0) : landed.coord0
  const end = whole ? Math.max(from.coord0, to.coord0) : landed.coord0
  return assembleLocString({
    refName: landed.refName,
    start,
    end: Math.max(end, start + 1),
  })
}

// Resolve a mark's click against the row it names, without touching anything.
//
// The scroll class moves the row to where the alignments are drawn, in its
// own cumBp: at the zoom it is on where the span fits the window, and framing
// the span, padded, where it does not. A drawn span none of whose centre and
// ends lands on the contig is stale geometry, and the row holds.
//
// Otherwise the click frames the mate locus and never removes a region.
// A contig the row lacks is appended whole. One the row shows slices of gains
// a slice in the gap between them holding most of the locus, placed beside its
// neighbour and running its way; a locus no gap holds any of is shown in the
// slice holding its centre. A region spelling the contig by an alias is
// respelled in place first: `navTo` canonicalizes the location and then
// compares refNames raw, so no spelling reaches an aliased region.
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
    const loc = drawnPlacement(
      view,
      drawn,
      name => canonical(name) === canonical(refName),
    )
    return loc === undefined
      ? {
          kind: 'none',
          reason: `Could not show ${refName}: that mark's drawn position no longer lands on it`,
        }
      : {
          kind: 'scroll',
          loc,
          centerBp: (drawn.start + drawn.end) / 2,
          // no wider than the row can show, or the zoom's clamp shifts the
          // window it was centred for
          fitWidthBp: Math.min(
            (drawn.end - drawn.start) * (1 + 2 * OFFSCREEN_MATE_NAV_GROW),
            view.maxBpPerPx * view.width,
          ),
        }
  }
  const region = assembly?.getRegionForRefName(canonical(refName))
  if (!region) {
    return {
      kind: 'none',
      reason: `Could not find ${refName} in ${assemblyName}`,
    }
  }
  const regions = view.displayedRegions.map(r =>
    canonical(r.refName) === region.refName
      ? { ...r, refName: region.refName }
      : r,
  )
  const own = regions.filter(r => r.refName === region.refName)
  const window = navSpan(region, mate.locus)
  if (own.length === 0) {
    return show([...regions, region], { refName: region.refName, ...window })
  }
  const gap = gapHolding(own, region, mate.locus)
  const centre = (mate.locus.start + mate.locus.end) / 2
  const room = gap ?? own.find(r => centre >= r.start && centre <= r.end)
  if (!room) {
    return {
      kind: 'none',
      reason: `Could not place that mark on ${refName}`,
    }
  }
  const location = {
    refName: region.refName,
    start: Math.max(window.start, room.start),
    end: Math.min(window.end, room.end),
  }
  if (!gap) {
    return show(regions, location)
  }
  const left = regions.findIndex(
    r => r.refName === region.refName && r.end === gap.start,
  )
  const right = regions.findIndex(
    r => r.refName === region.refName && r.start === gap.end,
  )
  const beside = regions[left] ?? regions[right]!
  const at =
    left === -1
      ? right + (beside.reversed ? 1 : 0)
      : left + (beside.reversed ? 0 : 1)
  return show(
    [
      ...regions.slice(0, at),
      { ...region, ...location, reversed: beside.reversed },
      ...regions.slice(at),
    ],
    location,
  )
}

function show(
  regions: Region[],
  location: { refName: string; start: number; end: number },
): MateNavDestination {
  return { kind: 'show', regions, location, loc: assembleLocString(location) }
}

// The gap between a contig's displayed slices that holds the most of `locus`,
// a point counting as one base; undefined when no gap holds any of it
function gapHolding(
  own: Region[],
  contig: { start: number; end: number },
  locus: OffscreenMateLocus,
) {
  const lo = locus.start
  const hi = Math.max(locus.end, locus.start + 1)
  let best: { start: number; end: number } | undefined
  let most = 0
  let start = contig.start
  const sorted = [...own].sort((a, b) => a.start - b.start)
  for (const r of [...sorted, { start: contig.end, end: contig.end }]) {
    const held = Math.min(hi, r.start) - Math.max(lo, start)
    if (held > most) {
      most = held
      best = { start, end: r.start }
    }
    start = Math.max(start, r.end)
  }
  return best
}
