import { makeRadioSubMenu, toggleItem } from '@jbrowse/core/ui/menuItems'
import { toLocale } from '@jbrowse/core/util'
import { openMateLabel } from '@jbrowse/core/util/tracks'

import type { Lane } from './laneStack.ts'
import type { MultiWayRibbonColorBy } from './multiwayGeometry.ts'
import type { MenuItem } from '@jbrowse/core/ui'

export interface LaneOrderModel {
  rowAssemblies: string[]
  rowOrder: readonly string[]
  setRowOrder: (order: string[]) => void
  resetRowOrder: () => void
  hiddenLanes: readonly string[]
  setHiddenLanes: (names: string[]) => void
}

export interface LaneHeaderModel extends LaneOrderModel {
  anchorLocString: string
  holdsAssembly: (assemblyName: string) => boolean
  openInNewView: (assemblyName: string, loc: string) => void
  reanchor: (assemblyName: string, loc: string) => void
  pinnedContigOf: (assemblyName: string) => string | undefined
  pinLaneContig: (assemblyName: string, refName: string | undefined) => void
}

export type HeaderLane = Pick<
  Lane,
  'assemblyName' | 'isAnchor' | 'frame' | 'canon'
>

export interface LaneSettingsModel {
  ribbonColorBy: MultiWayRibbonColorBy
  setRibbonColorBy: (mode: MultiWayRibbonColorBy) => void
  drawCurves: boolean
  setDrawCurves: (flag: boolean) => void
  bridgeSkippedLanes: boolean
  setBridgeSkippedLanes: (flag: boolean) => void
  showLaneTicks: boolean
  setShowLaneTicks: (flag: boolean) => void
}

/**
 * The lanes a reorder names, plus the pinned lanes it could not see.
 *
 * A move writes back the whole order it is looking at, which is
 * `rowAssemblies` — the lanes present in the fetched window and not hidden. So
 * a lane the reader hid, or panned away from, was dropped out of `rowOrder`
 * entirely by the next move on any other lane, and came back densest-first at
 * the bottom rather than where they left it. Each one is spliced back at the
 * index it held, so the order the reader authored survives a lane being away.
 */
export function mergeRowOrder(previous: string[], next: string[]) {
  const named = new Set(next)
  const out = [...next]
  previous.forEach((name, i) => {
    if (!named.has(name)) {
      out.splice(Math.min(i, out.length), 0, name)
    }
  })
  return out
}

/** `order` with `name` moved `delta` places, or unchanged where it cannot go. */
export function moveLane(order: string[], name: string, delta: number) {
  const from = order.indexOf(name)
  const to = from + delta
  if (from < 0 || to < 0 || to >= order.length) {
    return order
  }
  const out = [...order]
  out.splice(from, 1)
  out.splice(to, 0, name)
  return out
}

/** Move up / Move down / Hide lane for one mate lane, off the order it is in now */
export function laneRowMenuItems(
  model: LaneOrderModel,
  name: string,
): MenuItem[] {
  const lanes = model.rowAssemblies
  const hidden = model.hiddenLanes
  const i = lanes.indexOf(name)
  // `keepMenuOpen`, because moving a lane two places is two clicks and the
  // default dismisses an action row: reordering by menu was a fresh trip
  // through the track menu per place moved. The rows' own disabled marks
  // update live, since the menu re-reads this
  return [
    {
      label: 'Move up',
      disabled: i <= 0,
      keepMenuOpen: true,
      onClick: () => {
        model.setRowOrder(moveLane(lanes, name, -1))
      },
    },
    {
      label: 'Move down',
      disabled: i < 0 || i === lanes.length - 1,
      keepMenuOpen: true,
      onClick: () => {
        model.setRowOrder(moveLane(lanes, name, 1))
      },
    },
    {
      label: 'Hide lane',
      keepMenuOpen: true,
      onClick: () => {
        model.setHiddenLanes([...hidden, name])
      },
    },
  ]
}

/** the mate lane's frame as a locstring the lane's own assembly resolves */
export function laneLocString(lane: HeaderLane) {
  const { frame } = lane
  if (!frame) {
    return undefined
  }
  const min = Math.max(0, Math.round(frame.min))
  const max = Math.max(min + 1, Math.round(frame.max))
  return `${lane.canon(frame.refName)}:${toLocale(min)}-${toLocale(max)}`
}

/**
 * The menu a lane's header raises. A mate lane gets the track menu's own row
 * plus the two hops off it: its assembly in a view of its own at the frame the
 * lane is drawing (the same jump a synteny track and a MAF row offer a mate),
 * and the whole track re-anchored on it, which the hosting view
 * does by navigating there — the anchor lane reads off the view's first
 * assembly, so the old anchor drops into a mate lane on its own. Either hop is
 * dead while the lane places nothing, and re-anchoring also while the session
 * does not hold the genome.
 *
 * Then the lane's other contigs, one row each: the frame shows the contig
 * explaining most of the anchor window, and a genome holding two homoeologous
 * copies of it shows one — the same silent loss the synteny follow's refused
 * spread had, answered the same way, by naming the other and offering it. A
 * pin outranks the vote until the reader lets the lane choose again.
 */
export function laneHeaderMenuItems(
  model: LaneHeaderModel,
  lane: HeaderLane,
): MenuItem[] {
  const name = lane.assemblyName
  if (lane.isAnchor) {
    return [
      {
        label: `Open ${name} in a new view`,
        onClick: () => {
          model.openInNewView(name, model.anchorLocString)
        },
      },
    ]
  }
  const loc = laneLocString(lane)
  const held = model.holdsAssembly(name)
  return [
    ...laneRowMenuItems(model, name),
    { type: 'divider' },
    {
      label: openMateLabel(name),
      disabled: loc === undefined || !held,
      onClick: () => {
        model.openInNewView(name, loc!)
      },
    },
    {
      label: `Re-anchor on ${name}`,
      disabled: loc === undefined || !held,
      onClick: () => {
        model.reanchor(name, loc!)
      },
    },
    ...laneContigMenuItems(model, lane),
  ]
}

function laneContigMenuItems(
  model: LaneHeaderModel,
  lane: HeaderLane,
): MenuItem[] {
  const name = lane.assemblyName
  const pinned = model.pinnedContigOf(name)
  const alsoOn = lane.frame?.alsoOn ?? []
  const offers = alsoOn.map(
    refName =>
      ({
        label: `Show ${lane.canon(refName)} in this lane`,
        onClick: () => {
          model.pinLaneContig(name, refName)
        },
      }) satisfies MenuItem,
  )
  const release =
    pinned === undefined
      ? []
      : [
          {
            label: `Let the lane choose its contig (pinned to ${lane.canon(pinned)})`,
            onClick: () => {
              model.pinLaneContig(name, undefined)
            },
          } satisfies MenuItem,
        ]
  const items = [...offers, ...release]
  return items.length ? [{ type: 'divider' }, ...items] : []
}

/**
 * Reorder or hide the mate lanes, or nothing while there is one lane and
 * nothing hidden.
 *
 * Worth a row per lane because a ribbon joins ADJACENT lanes only: moving a
 * near-empty lane out from mid-stack reconnects the chains it was cutting
 * through every denser lane below it, and that is the one edit densest-first
 * cannot make for itself.
 *
 * A move writes back the WHOLE order it is looking at, not the one lane it
 * moved. `rowOrder` pins the lanes it names to the top in its own order and
 * leaves the rest densest-first, so pinning one lane would leave the others
 * free to re-sort under it as a pan changed the counts — the second move would
 * be made against a stack that had shifted since the first.
 */
export function laneOrderMenuItem(model: LaneOrderModel): MenuItem[] {
  const lanes = model.rowAssemblies
  const hidden = model.hiddenLanes
  if (lanes.length < 2 && hidden.length === 0) {
    return []
  }
  return [
    {
      label: 'Lanes',
      subMenu: [
        ...lanes.map(name => ({
          label: name,
          subMenu: laneRowMenuItems(model, name),
        })),
        ...hidden.map(name => ({
          label: `Show ${name}`,
          keepMenuOpen: true,
          onClick: () => {
            model.setHiddenLanes(hidden.filter(h => h !== name))
          },
        })),
        { type: 'divider' },
        // A reader who hid four lanes had four trips through this menu to get
        // them back, and no reset covered them: `Reset lane order` clears the
        // order and leaves every hidden lane hidden
        {
          label: 'Show all lanes',
          disabled: hidden.length === 0,
          onClick: () => {
            model.setHiddenLanes([])
          },
        },
        {
          label: 'Reset lane order',
          disabled: model.rowOrder.length === 0,
          onClick: () => {
            model.resetRowOrder()
          },
        },
      ],
    },
  ]
}

/**
 * The two drawing settings, which were config-only: a reader deciding whether
 * the ticks help or crowd is making that call in front of the picture, and
 * config is the wrong distance from it.
 */
export const RIBBON_COLOR_MODES: readonly (readonly [
  MultiWayRibbonColorBy,
  string,
])[] = [
  ['default', 'Default'],
  ['strand', 'Strand'],
  ['identity', 'Identity'],
]

export function laneSettingsMenuItems(model: LaneSettingsModel): MenuItem[] {
  return [
    makeRadioSubMenu({
      label: 'Color ribbons by',
      value: model.ribbonColorBy,
      onChange: model.setRibbonColorBy,
      options: RIBBON_COLOR_MODES,
      helpText:
        "Default is the ribbon color. Strand colors a crossed ribbon — an inversion relative to the lane above — in the synteny view's reverse color and the rest in its forward color. Identity paints each pair's identity attribute on the same viridis ramp as the synteny view, and leaves a pair without one at the ribbon color.",
    }),
    toggleItem('Draw curved ribbons', model.drawCurves, model.setDrawCurves, {
      helpText:
        "Bezier curves rather than straight chords. Straight is the default: a chord's slant reads directly as the offset between two lanes drawn in different coordinate frames, which is exactly what a curve hides.",
    }),
    toggleItem(
      'Bridge lanes that place nothing',
      model.bridgeSkippedLanes,
      model.setBridgeSkippedLanes,
      {
        helpText:
          'Where a lane places nothing for a group, join it across that lane to the next one down that does. Off, a ribbon joins adjacent lanes only and a sparse lane mid-stack cuts every chain running through it.',
      },
    ),
    toggleItem('Show lane ticks', model.showLaneTicks, model.setShowLaneTicks, {
      helpText:
        "Each lane's own coordinate ticks, at one interval shared by every lane. Equal spacing between two lanes means equal bp-per-pixel; a lane whose ticks crowd together is zoomed out.",
    }),
  ]
}
