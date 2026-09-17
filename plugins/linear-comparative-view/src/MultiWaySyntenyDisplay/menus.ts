import { radioItems, toggleItem } from '@jbrowse/core/ui/menuItems'
import { assembleLocStringRaw } from '@jbrowse/core/util'
import { openMateLabel } from '@jbrowse/core/util/tracks'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import {
  sectionOrderMenuItems,
  sectionRowMenuItems,
} from '@jbrowse/display-kit/groupByMenu'

import { laneRegion } from './laneHeader.ts'
import { ribbonColorModeOptions } from './ribbonColorModes.ts'

import type { LaneFilter } from './laneSelection.ts'
import type { Lane } from './laneStack.ts'
import type { MultiWayRibbonColorBy } from './ribbonColorModes.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { SectionOrderModel } from '@jbrowse/display-kit/groupByMenu'

export interface LaneOrderModel {
  rowAssemblies: string[]
  domain: readonly string[]
  setDomain: (domain: string[]) => void
  hideLane: (assemblyName: string) => void
}

// The lane stack as the shared section-order menu reads it: a lane's key is
// its label, and a lane is a section.
function laneSections(model: LaneOrderModel): SectionOrderModel {
  return {
    sections: model.rowAssemblies.map(name => ({ key: name, label: name })),
    domain: model.domain,
    setDomain: model.setDomain,
    hideGroup: model.hideLane,
  }
}

export interface LaneHeaderModel extends LaneOrderModel {
  anchorLocString: string
  holdsAssembly: (assemblyName: string) => boolean
  canReanchor: boolean
  openInNewView: (assemblyName: string, loc: string) => void
  reanchor: (assemblyName: string, loc: string) => void
  pinnedContigOf: (assemblyName: string) => string | undefined
  pinLaneContig: (assemblyName: string, refName: string | undefined) => void
}

export type HeaderLane = Pick<
  Lane,
  'assemblyName' | 'isAnchor' | 'frame' | 'canon'
>

/**
 * One lane the picker offers: declared by the adapter's header, placed in the
 * fetched window, or both. `label` is the source's own name for it where that
 * differs from the assembly name (a haplotype's PanSN prefix against the
 * assembly it is loaded as) and `group` gathers lanes that belong together
 * (a diploid sample's two haplotypes). `drawn` is whether the stack draws the
 * lane wherever a window places it
 */
export interface LaneChoice {
  name: string
  label?: string
  group?: string
  placed: boolean
  drawn: boolean
}

export interface LaneSelectionModel {
  laneUniverse: LaneChoice[]
  laneFilter: LaneFilter | undefined
  configuredLanes: readonly string[]
  chooseLanes: (names: string[]) => void
  setSelectedLanes: (names: string[] | undefined) => void
  openLaneSelection: () => void
}

export interface LaneSettingsModel {
  ribbonColorBy: MultiWayRibbonColorBy
  setRibbonColorBy: (mode: MultiWayRibbonColorBy) => void
  /** the columns the track declares, each offered as its own ribbon mode */
  ribbonColorAttributes: readonly string[]
  drawCurves: boolean
  setDrawCurves: (flag: boolean) => void
  bridgeSkippedLanes: boolean
  setBridgeSkippedLanes: (flag: boolean) => void
  showLaneTicks: boolean
  setShowLaneTicks: (flag: boolean) => void
  showLegend: boolean
  setShowLegend: (flag: boolean) => void
  /** whether the drawn colors key anything; false leaves the row out */
  hasLegendKey: boolean
}

/**
 * The menu a lane's header raises. A mate lane gets the track menu's own row
 * plus the two hops off it: its assembly in a view of its own at the frame the
 * lane is drawing (the same jump a synteny track and a MAF row offer a mate),
 * and the whole track re-anchored on it, which the hosting view does by
 * navigating there. Either hop is dead while the lane places nothing or the
 * session does not hold the genome, and a source aligned to one anchor offers
 * no re-anchor at all.
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
  const region = laneRegion(lane)
  const loc = region && assembleLocStringRaw(region)
  const held = model.holdsAssembly(name)
  return [
    ...sectionRowMenuItems(laneSections(model), name, 'lane'),
    { type: 'divider' },
    {
      label: openMateLabel(name),
      disabled: loc === undefined || !held,
      onClick: () => {
        model.openInNewView(name, loc!)
      },
    },
    ...(model.canReanchor
      ? [
          {
            label: `Re-anchor on ${name}`,
            disabled: loc === undefined || !held,
            onClick: () => {
              model.reanchor(name, loc!)
            },
          },
        ]
      : []),
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
 * Reorder or hide the mate lanes: the shared section-order menu with lanes as
 * its sections. Worth a row per lane because a ribbon joins ADJACENT lanes
 * only: moving a near-empty lane out from mid-stack reconnects the chains it
 * was cutting through every denser lane below it, and that is the one edit
 * densest-first cannot make for itself.
 */
export function laneOrderMenuItems(model: LaneOrderModel): MenuItem[] {
  return sectionOrderMenuItems(laneSections(model), 'lane')
}

/**
 * What the picker's Reset and the track menu's undo go back to: the track's
 * lanes where it declares some, else every lane
 */
export function laneResetLabel(
  model: Pick<LaneSelectionModel, 'configuredLanes' | 'laneUniverse'>,
) {
  const configured = model.configuredLanes.length
  return configured
    ? `The track's lanes (${configured})`
    : `Every lane (${model.laneUniverse.length})`
}

/**
 * The picker's entry and its undo. Offered only when there is a choice to
 * make: two or more lanes to choose among, or a choice already made that the
 * reader may want back out of.
 */
export function laneSelectionMenuItems(model: LaneSelectionModel): MenuItem[] {
  const chosen = model.laneFilter
  if (model.laneUniverse.length < 2 && chosen === undefined) {
    return []
  }
  return [
    {
      label: 'Choose lanes...',
      helpText:
        'Pick which of the lanes the source offers to draw. A source that declares its lanes up front (a pangenome graph naming every haplotype) is listed whole, before any of them has been placed in the window.',
      onClick: () => {
        model.openLaneSelection()
      },
    },
    ...(chosen === undefined
      ? []
      : [
          {
            label: laneResetLabel(model),
            onClick: () => {
              model.setSelectedLanes(undefined)
            },
          },
        ]),
  ]
}

const RIBBON_COLOR_HELP: Record<string, string> = {
  default: "The track's ribbon color.",
  strand:
    "Each record's strand against the lane above, in the synteny view's forward and reverse colors. It is the record's strand, not the drawn twist, so a lane drawn flipped shows straight ribbons that are all inversions.",
  identity:
    "Each pair's identity on the synteny view's viridis ramp. A pair without one keeps the ribbon color.",
}

const ATTRIBUTE_COLOR_HELP =
  'One color per distinct label, or the color the file put beside it. A pair without one keeps the ribbon color.'

/**
 * Checkboxes, a divider, then the submenus — the order the synteny view's
 * settings menu uses. The display appends Level of detail after these.
 */
export function laneSettingsMenuItems(model: LaneSettingsModel): MenuItem[] {
  return [
    toggleItem('Curved lines', model.drawCurves, model.setDrawCurves, {
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
    ...(model.hasLegendKey ? [legendCheckboxItem(model)] : []),
    { type: 'divider' },
    {
      label: 'Color ribbons by',
      helpText: 'What colors each ribbon.',
      subMenu: radioItems(
        ribbonColorModeOptions(model.ribbonColorAttributes).map(
          ([value, label]) => ({
            value,
            label,
            helpText: RIBBON_COLOR_HELP[value] ?? ATTRIBUTE_COLOR_HELP,
          }),
        ),
        model.ribbonColorBy,
        model.setRibbonColorBy,
      ),
    },
  ]
}
