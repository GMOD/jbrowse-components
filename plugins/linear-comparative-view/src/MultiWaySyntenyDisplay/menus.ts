import { toggleItem } from '@jbrowse/core/ui/menuItems'

import type { MenuItem } from '@jbrowse/core/ui'

export interface LaneOrderModel {
  rowAssemblies: string[]
  rowOrder: readonly string[]
  setRowOrder: (order: string[]) => void
  hiddenLanes: readonly string[]
  setHiddenLanes: (names: string[]) => void
}

export interface LaneSettingsModel {
  drawCurves: boolean
  setDrawCurves: (flag: boolean) => void
  bridgeSkippedLanes: boolean
  setBridgeSkippedLanes: (flag: boolean) => void
  showLaneTicks: boolean
  setShowLaneTicks: (flag: boolean) => void
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
        ...lanes.map((name, i) => ({
          label: name,
          subMenu: [
            {
              label: 'Move up',
              disabled: i === 0,
              onClick: () => {
                model.setRowOrder(moveLane(lanes, name, -1))
              },
            },
            {
              label: 'Move down',
              disabled: i === lanes.length - 1,
              onClick: () => {
                model.setRowOrder(moveLane(lanes, name, 1))
              },
            },
            {
              label: 'Hide lane',
              onClick: () => {
                model.setHiddenLanes([...hidden, name])
              },
            },
          ],
        })),
        ...hidden.map(name => ({
          label: `Show ${name}`,
          onClick: () => {
            model.setHiddenLanes(hidden.filter(h => h !== name))
          },
        })),
        { type: 'divider' },
        {
          label: 'Reset lane order',
          disabled: model.rowOrder.length === 0,
          onClick: () => {
            model.setRowOrder([])
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
export function laneSettingsMenuItems(model: LaneSettingsModel): MenuItem[] {
  return [
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
          'Where a lane places nothing for a group, join it across that lane to the next one down that does, at half opacity. Off, a ribbon joins adjacent lanes only and a sparse lane mid-stack cuts every chain running through it.',
      },
    ),
    toggleItem('Show lane ticks', model.showLaneTicks, model.setShowLaneTicks, {
      helpText:
        "Each lane's own coordinate ticks, at one interval shared by every lane. Equal spacing between two lanes means equal bp-per-pixel; a lane whose ticks crowd together is zoomed out.",
    }),
  ]
}
