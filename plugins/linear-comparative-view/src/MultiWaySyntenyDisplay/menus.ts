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
import {
  colorByMenuItem,
  solidColorItem,
} from '@jbrowse/display-kit/colorByMenu'
import {
  resetOrderItem,
  sectionRowMenuItems,
  showHiddenItems,
} from '@jbrowse/display-kit/groupByMenu'
import { colorByMenuItems } from '@jbrowse/synteny-core'
import SwapVertIcon from '@mui/icons-material/SwapVert'

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
  'assemblyName' | 'label' | 'isAnchor' | 'frame' | 'canon' | 'hasAnnotation'
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
  lanesFrozen: boolean
  realignLane: (assemblyName: string) => void
}

export interface MultiWayMenuModel extends LaneHeaderModel, LaneSelectionModel {
  laneStack: { lanes: readonly HeaderLane[] }
  laneStructureOrder: readonly string[]
  hiddenLanes: readonly string[]
  showHiddenLanes: () => void
  openLaneSelection: () => void
  ribbonColorField: string
  setRibbonColorField: (field: string) => void
  ribbonColorAttributes: readonly string[]
  ribbonAttributeRanges: Record<string, AttributeRange>
  hideUnlabelled: boolean
  setHideUnlabelled: (flag: boolean) => void
  showLaneTicks: boolean
  setShowLaneTicks: (flag: boolean) => void
  splitStrands: boolean
  setSplitStrands: (flag: boolean) => void
  showGeneLabels: boolean
  setShowGeneLabels: (flag: boolean) => void
  inlineLaneNames: boolean
  setInlineLaneNames: (flag: boolean) => void
  drawCurves: boolean
  setDrawCurves: (flag: boolean) => void
  bridgeSkippedLanes: boolean
  setBridgeSkippedLanes: (flag: boolean) => void
  showLegend: boolean
  setShowLegend: (flag: boolean) => void
  hasLegendKey: boolean
  geneColorField: string
  setGeneColorBy: (field: string) => void
  geneSolidColor: string | undefined
  pickDefaultGeneColor: () => void
  pickGeneSolidColor: () => void
  setLanesFrozen: (flag: boolean) => void
}

export function laneHeaderMenuItems(
  model: LaneHeaderModel,
  lane: HeaderLane,
): MenuItem[] {
  const name = lane.assemblyName
  if (lane.isAnchor) {
    return [
      {
        label: `Open ${lane.label} in a new view`,
        onClick: () => {
          model.openInNewView(name, model.anchorLocString)
        },
      },
    ]
  }
  const region = laneRegion(lane)
  const loc =
    region && assembleLocStringRaw({ ...region, reversed: lane.frame?.flipped })
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
      label: openMateLabel(lane.label),
      disabled: loc === undefined || !held,
      onClick: () => {
        model.openInNewView(name, loc!)
      },
    },
    ...(model.canReanchor
      ? [
          {
            label: `Re-anchor on ${lane.label}`,
            disabled: loc === undefined || !held,
            onClick: () => {
              model.reanchor(name, loc!)
            },
          },
        ]
      : []),
    ...laneContigMenuItems(model, lane),
    ...laneFlipMenuItems(model, lane),
    ...(model.lanesFrozen
      ? [
          {
            label: 'Re-align lane',
            helpText:
              'Fit this frozen lane to what the anchor shows now, and keep it frozen there.',
            onClick: () => {
              model.realignLane(name)
            },
          },
        ]
      : []),
    ...(lane.hasAnnotation
      ? []
      : [
          {
            label: 'No gene track for this genome',
            disabled: true,
            onClick: () => {},
          },
        ]),
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

export function showSubMenuItems(model: MultiWayMenuModel): MenuItem[] {
  return [
    toggleItem('Show lane ticks', model.showLaneTicks, model.setShowLaneTicks),
    toggleItem(
      'Show gene labels',
      model.showGeneLabels,
      model.setShowGeneLabels,
    ),
    toggleItem(
      'Lane names on the gene row',
      model.inlineLaneNames,
      model.setInlineLaneNames,
      {
        helpText:
          "Print each genome's name over the left end of its genes instead of on a line above them, so more lanes fit.",
      },
    ),
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
    ...showHiddenItems(model.hiddenLanes.length, 'lane', () => {
      model.showHiddenLanes()
    }),
  ]
}

const GENE_COLOR_FIELDS: RadioOption<string>[] = [
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
  const fields =
    field === '' || GENE_COLOR_FIELDS.some(mode => mode.value === field)
      ? GENE_COLOR_FIELDS
      : [...GENE_COLOR_FIELDS, { value: field, label: field }]
  return [
    {
      label: 'Default',
      type: 'radio',
      checked: field === '' && model.geneSolidColor === undefined,
      helpText:
        "The gene color the track's config sets, goldenrod where it sets none.",
      onClick: () => {
        model.pickDefaultGeneColor()
      },
    },
    ...radioItems(fields, field, value => {
      model.setGeneColorBy(value)
    }),
    solidColorItem(field === '' && model.geneSolidColor !== undefined, () => {
      model.pickGeneSolidColor()
    }),
  ]
}

export function ribbonColorMenuItems(model: MultiWayMenuModel): MenuItem[] {
  return colorByMenuItems({
    field: model.ribbonColorField,
    structuralFields: ['', 'strand'],
    attributes: model.ribbonColorAttributes,
    attributeRanges: model.ribbonAttributeRanges,
    surface: 'lanes',
    hideUnlabelled: model.hideUnlabelled,
    setColorField: model.setRibbonColorField,
    setHideUnlabelled: model.setHideUnlabelled,
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

export function lanesMenuItem(model: MultiWayMenuModel) {
  const subMenu: MenuItem[] = [
    ...laneSelectionMenuItems(model),
    ...(model.laneStructureOrder.length > 2
      ? [
          {
            label: 'Order lanes by structure',
            helpText:
              'Stack each lane beside the one whose deletions and insertions against the anchor are most alike, starting from the lane most like the anchor, so a structure its lanes share shows as one block. The order stays until you reset it.',
            onClick: () => {
              model.setDomain([...model.laneStructureOrder])
            },
          },
        ]
      : []),
    resetOrderItem(model, 'lane'),
    toggleItem('Freeze lanes', model.lanesFrozen, model.setLanesFrozen, {
      helpText:
        'Keep every lane where it is as you pan and zoom, instead of re-fitting it to each new window. While frozen, drag or side-scroll a lane to slide it. The lanes unfreeze once the view leaves the window they froze on.',
    }),
    ...withSubHeader(
      'Lane menus',
      model.laneStack.lanes.map(lane => ({
        label: lane.label,
        subMenu: laneHeaderMenuItems(model, lane),
      })),
    ),
  ]
  return { label: 'Lanes', icon: SwapVertIcon, subMenu }
}

export function multiWayTrackMenuItems(model: MultiWayMenuModel): MenuItem[] {
  return [
    ...makeShowSubMenu(showSubMenuItems(model)),
    colorByMenuItem({
      blocks: [
        { header: 'Genes', rows: geneColorMenuItems(model) },
        { header: 'Ribbons', rows: ribbonColorMenuItems(model) },
      ],
    }),
    lanesMenuItem(model),
  ]
}
