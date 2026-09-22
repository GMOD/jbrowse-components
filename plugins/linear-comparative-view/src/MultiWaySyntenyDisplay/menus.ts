import {
  radioItems,
  toggleItem,
  withSubHeader,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { assembleLocStringRaw } from '@jbrowse/core/util'
import { STRAND_FIELD } from '@jbrowse/core/util/categoricalField'
import { openMateLabel } from '@jbrowse/core/util/tracks'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import { sectionRowMenuItems } from '@jbrowse/display-kit/groupByMenu'
import { colorByMenuItems } from '@jbrowse/synteny-core'
import PaletteIcon from '@mui/icons-material/Palette'
import SwapVertIcon from '@mui/icons-material/SwapVert'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { CLUSTER_FIELD } from './geneColor.ts'
import { laneRegion } from './laneHeader.ts'
import { laneResetLabel } from './laneSelection.ts'

import type { LaneFlipPin } from './laneDecision.ts'
import type { LaneSelectionModel } from './laneSelection.ts'
import type { Lane } from './laneStack.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { RadioOption } from '@jbrowse/core/ui/menuItems'
import type { AttributeRange } from '@jbrowse/synteny-core'

export type HeaderLane = Pick<
  Lane,
  'assemblyName' | 'isAnchor' | 'frame' | 'canon'
>

export interface LaneHeaderModel {
  rowAssemblies: string[]
  domain: readonly string[]
  setDomain: (domain: string[]) => void
  hideLane: (assemblyName: string) => void
  anchorLocString: string
  holdsAssembly: (assemblyName: string) => boolean
  canReanchor: boolean
  pinnedLaneContigs: ReadonlyMap<string, string>
  pinnedLaneFlips: ReadonlyMap<string, LaneFlipPin>
  openInNewView: (assemblyName: string, loc: string) => void
  reanchor: (assemblyName: string, loc: string) => void
  pinLaneContig: (assemblyName: string, refName: string | undefined) => void
  flipLane: (assemblyName: string) => void
  unpinLaneFlip: (assemblyName: string) => void
}

export interface MultiWayMenuModel extends LaneHeaderModel, LaneSelectionModel {
  laneStack: { lanes: readonly HeaderLane[] }
  hiddenLanes: readonly string[]
  showHiddenLanes: () => void
  openLaneSelection: () => void
  ribbonColorField: string
  setRibbonColorBy: (field: string) => void
  ribbonColorAttributes: readonly string[]
  ribbonAttributeRanges: Record<string, AttributeRange>
  ribbonColorDomain: readonly string[]
  setRibbonColorDomain: (domain: string[]) => void
  hideUnlabelled: boolean
  setHideUnlabelled: (flag: boolean) => void
  showLaneTicks: boolean
  setShowLaneTicks: (flag: boolean) => void
  splitStrands: boolean
  setSplitStrands: (flag: boolean) => void
  drawCurves: boolean
  setDrawCurves: (flag: boolean) => void
  bridgeSkippedLanes: boolean
  setBridgeSkippedLanes: (flag: boolean) => void
  showLegend: boolean
  setShowLegend: (flag: boolean) => void
  hasLegendKey: boolean
  geneColorField: string
  geneColorScale: string
  setGeneColorBy: (field: string) => void
  geneColorDomain: readonly string[]
  pinnedGeneColorDomain: readonly string[]
  pinGeneColorDomain: () => void
}

/**
 * The menu a lane's header raises, and the same menu under that lane in the
 * track menu's Lanes submenu. A mate lane offers its moves, its assembly in a
 * view of its own at the frame the lane draws, the track re-anchored on it, the
 * other contigs the anchor window touches there, and a flip. The hops are dead
 * while the lane places nothing or the session does not hold the genome, and a
 * source aligned to one anchor offers no re-anchor.
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
    ...sectionRowMenuItems(
      {
        sections: model.rowAssemblies.map(key => ({ key, label: key })),
        domain: model.domain,
        setDomain: model.setDomain,
        hideGroup: model.hideLane,
      },
      name,
      'lane',
    ),
    {
      label: openMateLabel(name),
      disabled: loc === undefined || !held,
      onClick: () => {
        // the way the lane reads, so its genes run as they did beside the
        // anchor
        model.openInNewView(
          name,
          assembleLocStringRaw({ ...region!, reversed: lane.frame?.flipped }),
        )
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
    ...laneFlipMenuItems(model, lane),
  ]
}

function laneContigMenuItems(
  model: LaneHeaderModel,
  lane: HeaderLane,
): MenuItem[] {
  const name = lane.assemblyName
  const pinned = model.pinnedLaneContigs.get(name)
  return [
    ...(lane.frame?.alsoOn ?? []).map(refName => ({
      label: `Show ${lane.canon(refName)} in this lane`,
      onClick: () => {
        model.pinLaneContig(name, refName)
      },
    })),
    ...(pinned === undefined
      ? []
      : [
          {
            label: `Let the lane choose its contig (pinned to ${lane.canon(pinned)})`,
            onClick: () => {
              model.pinLaneContig(name, undefined)
            },
          },
        ]),
  ]
}

function laneFlipMenuItems(
  model: LaneHeaderModel,
  lane: HeaderLane,
): MenuItem[] {
  const name = lane.assemblyName
  const pin = model.pinnedLaneFlips.get(name)
  return [
    ...(lane.frame === undefined
      ? []
      : [
          {
            label: 'Flip lane',
            onClick: () => {
              model.flipLane(name)
            },
          },
        ]),
    ...(pin === undefined
      ? []
      : [
          {
            label: `Let the lane choose its orientation (pinned on ${lane.canon(pin.refName)})`,
            onClick: () => {
              model.unpinLaneFlip(name)
            },
          },
        ]),
  ]
}

function hiddenLanesMenuItems(model: MultiWayMenuModel): MenuItem[] {
  const count = model.hiddenLanes.length
  return count > 0
    ? [
        {
          label: `Show ${count} hidden lane${count > 1 ? 's' : ''}`,
          icon: VisibilityIcon,
          onClick: () => {
            model.showHiddenLanes()
          },
        },
      ]
    : []
}

export function showSubMenuItems(model: MultiWayMenuModel): MenuItem[] {
  return [
    toggleItem('Show lane ticks', model.showLaneTicks, model.setShowLaneTicks),
    toggleItem('Split strands', model.splitStrands, model.setSplitStrands, {
      helpText:
        'Genes reading rightwards above the lane line and leftwards below it.',
    }),
    toggleItem('Curved lines', model.drawCurves, model.setDrawCurves),
    toggleItem(
      'Show ribbons across gaps',
      model.bridgeSkippedLanes,
      model.setBridgeSkippedLanes,
      {
        helpText:
          'Join a gene to the next lane down that places it when the lane between places nothing for it. Off, a sparse lane cuts every chain running through it.',
      },
    ),
    ...(model.hasLegendKey ? [legendCheckboxItem(model)] : []),
    ...hiddenLanesMenuItems(model),
  ]
}

const GENE_COLOR_MODES: RadioOption<string>[] = [
  {
    value: '',
    label: 'Default',
    helpText:
      "The gene color the track's config sets, goldenrod where it sets none.",
  },
  {
    value: CLUSTER_FIELD,
    label: 'Cluster',
    helpText:
      'Each gene by the ortholog group it carries, so a group is one color down the stack. A gene no group claims is grey.',
  },
  { value: 'name', label: 'Name', helpText: 'Each gene by its name.' },
  {
    value: STRAND_FIELD,
    label: 'Strand',
    helpText: 'Forward genes red and reverse genes blue.',
  },
]

export function geneColorMenuItems(model: MultiWayMenuModel): MenuItem[] {
  const field = model.geneColorField
  const modes = GENE_COLOR_MODES.some(mode => mode.value === field)
    ? GENE_COLOR_MODES
    : [...GENE_COLOR_MODES, { value: field, label: field }]
  return [
    ...radioItems(modes, field, value => {
      model.setGeneColorBy(value)
    }),
    ...(model.geneColorScale !== 'categorical'
      ? []
      : [
          {
            label: 'Pin distinct colors',
            disabled:
              model.pinnedGeneColorDomain.length ===
              model.geneColorDomain.length,
            onClick: () => {
              model.pinGeneColorDomain()
            },
          },
        ]),
  ]
}

export function ribbonColorMenuItems(model: MultiWayMenuModel): MenuItem[] {
  return colorByMenuItems({
    colorBy: model.ribbonColorField,
    structuralFields: ['', 'strand'],
    attributes: model.ribbonColorAttributes,
    attributeRanges: model.ribbonAttributeRanges,
    surface: 'lanes',
    hideUnlabelled: model.hideUnlabelled,
    colorDomain: model.ribbonColorDomain,
    setColorBy: model.setRibbonColorBy,
    setHideUnlabelled: model.setHideUnlabelled,
    setColorDomain: model.setRibbonColorDomain,
  })
}

function laneSelectionMenuItems(model: MultiWayMenuModel): MenuItem[] {
  return [
    ...(model.laneUniverse.length > 1 || model.laneFilter?.only
      ? [
          {
            label: 'Choose lanes...',
            onClick: () => {
              model.openLaneSelection()
            },
          },
        ]
      : []),
    ...(model.laneFilter?.only
      ? [
          {
            label: laneResetLabel(model),
            onClick: () => {
              model.setSelectedLanes(undefined)
            },
          },
        ]
      : []),
  ]
}

/**
 * Which lanes the stack draws and in what order, then each lane's own header
 * menu, the way the synteny view's Rows submenu lists each row's menu
 */
export function lanesMenuItem(model: MultiWayMenuModel) {
  const subMenu: MenuItem[] = [
    ...laneSelectionMenuItems(model),
    {
      label: 'Reset lane order',
      disabled: model.domain.length === 0,
      onClick: () => {
        model.setDomain([])
      },
    },
    ...withSubHeader(
      'Lane menus',
      model.laneStack.lanes.map(lane => ({
        label: lane.assemblyName,
        subMenu: laneHeaderMenuItems(model, lane),
      })),
    ),
  ]
  return { label: 'Lanes', icon: SwapVertIcon, subMenu }
}

export function multiWayTrackMenuItems(model: MultiWayMenuModel): MenuItem[] {
  return [
    ...makeShowSubMenu(showSubMenuItems(model)),
    {
      label: 'Color by...',
      icon: PaletteIcon,
      subMenu: [
        ...withSubHeader('Genes', geneColorMenuItems(model)),
        ...withSubHeader('Ribbons', ribbonColorMenuItems(model)),
      ],
    },
    lanesMenuItem(model),
  ]
}
