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
import { FEATURE_NAME_FIELD } from '@jbrowse/plugin-features'
import { colorByMenuItems } from '@jbrowse/synteny-core'
import SwapVertIcon from '@mui/icons-material/SwapVert'

import { CLUSTER_FIELD } from './geneColor.ts'
import { blockLocString, laneRegion } from './laneHeader.ts'
import { flipPinOf, placePinOf } from './lanePins.ts'
import { laneResetLabel } from './laneSelection.ts'

import type { LanePin, LanePlacePin } from './lanePins.ts'
import type { LaneSelectionModel } from './laneSelection.ts'
import type { Lane } from './laneStack.ts'
import type { LaneLocus } from './multiwayRenderTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { RadioOption } from '@jbrowse/core/ui/menuItems'
import type {
  AttributeRange,
  RibbonInterpolation,
  SyntenyColorPaint,
} from '@jbrowse/synteny-core'

export type HeaderLane = Pick<
  Lane,
  'assemblyName' | 'label' | 'isAnchor' | 'frame' | 'canon'
>

export interface LaneHeaderModel {
  rowAssemblies: string[]
  domain: readonly string[]
  setDomain: (domain: string[]) => void
  hideLane: (assemblyName: string) => void
  anchorLocString: string
  holdsAssembly: (assemblyName: string) => boolean
  canReanchor: boolean
  pinsInForce: readonly LanePin[]
  openInNewView: (assemblyName: string, loc: string) => void
  reanchor: (assemblyName: string, loc: string) => void
  pinLane: (
    assemblyName: string,
    pin: Omit<LanePlacePin, 'lane'> | undefined,
  ) => void
  flipLane: (assemblyName: string) => void
  unpinLaneFlip: (assemblyName: string) => void
  lanesFrozen: boolean
  realignLane: (assemblyName: string) => void
  laneGeneAdapters: ReadonlyMap<string, unknown>
}

export interface MultiWayMenuModel extends LaneHeaderModel, LaneSelectionModel {
  laneStack: { lanes: readonly HeaderLane[] }
  laneStructureOrder: readonly string[]
  hiddenLanes: readonly string[]
  showHiddenLanes: () => void
  openLaneSelection: () => void
  ribbonColorField: string | undefined
  setRibbonColorField: (field: string | undefined) => void
  openRibbonSolidColorDialog: () => void
  ribbonColorAttributes: readonly string[]
  ribbonAttributeRanges: Record<string, AttributeRange>
  ribbonPaint: SyntenyColorPaint
  hideUnlabelled: boolean
  setHideUnlabelled: (flag: boolean) => void
  showLaneTicks: boolean
  setShowLaneTicks: (flag: boolean) => void
  showGeneLabels: boolean
  setShowGeneLabels: (flag: boolean) => void
  inlineLaneNames: boolean
  setInlineLaneNames: (flag: boolean) => void
  interpolate: RibbonInterpolation
  setInterpolate: (interpolate: RibbonInterpolation) => void
  showLegend: boolean
  setShowLegend: (flag: boolean) => void
  hasLegendKey: boolean
  geneColorField: string | undefined
  colorByField: (field: string) => void
  geneSolidColor: string | undefined
  pickDefaultColor: () => void
  pickSolidColor: () => void
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
    ...(model.laneGeneAdapters.has(name)
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

/** a lane glyph's right-click menu: go to where it sits on its own genome */
export function laneLocusMenuItems(
  model: LaneHeaderModel & { zoomTo: (loc: string) => void },
  lane: HeaderLane,
  { refName, start, end, name }: LaneLocus,
): MenuItem[] {
  const loc = assembleLocStringRaw({ refName, start, end })
  if (lane.isAnchor) {
    return [
      {
        label: `Zoom to ${name}`,
        onClick: () => {
          model.zoomTo(loc)
        },
      },
    ]
  }
  const held = model.holdsAssembly(lane.assemblyName)
  return [
    {
      label: `Open ${lane.label} at ${name}`,
      disabled: !held,
      onClick: () => {
        model.openInNewView(lane.assemblyName, loc)
      },
    },
    ...(model.canReanchor
      ? [
          {
            label: `Re-anchor on ${lane.label} at ${name}`,
            disabled: !held,
            onClick: () => {
              model.reanchor(lane.assemblyName, loc)
            },
          },
        ]
      : []),
  ]
}

function laneContigMenuItems(
  model: LaneHeaderModel,
  lane: HeaderLane,
): MenuItem[] {
  const name = lane.assemblyName
  const pinned = placePinOf(model.pinsInForce, name)
  const frame = lane.frame
  return [
    ...(frame?.alsoOn ?? []).map(refName => ({
      label: `Show ${lane.canon(refName)} in this lane`,
      onClick: () => {
        model.pinLane(name, { refName })
      },
    })),
    ...(frame?.alsoAt ?? []).map(block => ({
      label: `Show ${blockLocString(lane, frame!.refName, block)} in this lane`,
      onClick: () => {
        model.pinLane(name, {
          refName: frame!.refName,
          at: (block.start + block.end) / 2,
        })
      },
    })),
    ...(pinned === undefined
      ? []
      : [
          {
            label: `Let the lane choose where it draws (pinned to ${lane.canon(pinned.refName)})`,
            onClick: () => {
              model.pinLane(name, undefined)
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
  const pin = flipPinOf(model.pinsInForce, name)
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
    toggleItem('Lane ticks', model.showLaneTicks, model.setShowLaneTicks),
    toggleItem('Gene labels', model.showGeneLabels, model.setShowGeneLabels),
    toggleItem(
      'Lane names on the gene row',
      model.inlineLaneNames,
      model.setInlineLaneNames,
      {
        helpText:
          "Print each genome's name over the left end of its genes instead of on a line above them, so more lanes fit.",
      },
    ),
    toggleItem('Curved lines', model.interpolate === 'bump', v => {
      model.setInterpolate(v ? 'bump' : 'linear')
    }),
    ...showHiddenItems(model.hiddenLanes.length, 'lane', () => {
      model.showHiddenLanes()
    }),
    ...(model.hasLegendKey ? [legendCheckboxItem(model)] : []),
  ]
}

const GENE_COLOR_FIELDS: RadioOption<string>[] = [
  {
    value: CLUSTER_FIELD,
    label: 'Cluster',
    helpText:
      'Each gene by the ortholog group it carries, so a group is one color down the stack. A gene no group claims is grey.',
  },
  {
    value: FEATURE_NAME_FIELD,
    label: 'Name',
    helpText:
      'Each gene by the name its label prints: its name, or its ID where it has none.',
  },
  {
    value: STRAND_FIELD,
    label: 'Strand',
    helpText: 'Forward genes red and reverse genes blue.',
  },
]

export function geneColorMenuItems(model: MultiWayMenuModel): MenuItem[] {
  const field = model.geneColorField
  const fields =
    field === undefined || GENE_COLOR_FIELDS.some(mode => mode.value === field)
      ? GENE_COLOR_FIELDS
      : [...GENE_COLOR_FIELDS, { value: field, label: field }]
  return [
    {
      label: 'Default',
      type: 'radio',
      checked: field === undefined && model.geneSolidColor === undefined,
      helpText:
        "The gene color the track's config sets, goldenrod where it sets none.",
      onClick: () => {
        model.pickDefaultColor()
      },
    },
    ...radioItems(fields, field, value => {
      model.colorByField(value)
    }),
    solidColorItem(
      field === undefined && model.geneSolidColor !== undefined,
      () => {
        model.pickSolidColor()
      },
    ),
  ]
}

export function ribbonColorMenuItems(model: MultiWayMenuModel): MenuItem[] {
  return colorByMenuItems({
    field: model.ribbonColorField,
    structuralFields: ['strand'],
    attributes: model.ribbonColorAttributes,
    attributeRanges: model.ribbonAttributeRanges,
    paint: model.ribbonPaint,
    surface: 'lanes',
    hideUnlabelled: model.hideUnlabelled,
    setColorField: model.setRibbonColorField,
    setHideUnlabelled: model.setHideUnlabelled,
    solidColor: {
      checked: model.ribbonColorField === undefined,
      pick: () => {
        model.openRibbonSolidColorDialog()
      },
    },
  })
}

function laneSelectionMenuItems(model: MultiWayMenuModel): MenuItem[] {
  return [
    ...(model.laneUniverse.length > 1 || model.laneChoice
      ? [
          {
            label: 'Choose lanes...',
            onClick: () => {
              model.openLaneSelection()
            },
          },
        ]
      : []),
    ...(model.laneChoice
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
    colorByMenuItem({
      blocks: [
        { header: 'Genes', rows: geneColorMenuItems(model) },
        { header: 'Ribbons', rows: ribbonColorMenuItems(model) },
      ],
    }),
    lanesMenuItem(model),
    ...makeShowSubMenu(showSubMenuItems(model)),
  ]
}
