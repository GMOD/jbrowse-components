import { makeSizeSubMenu } from '@jbrowse/core/ui'
import {
  checkboxItem,
  radioItems,
  toggleItem,
  withSubHeader,
} from '@jbrowse/core/ui/menuItems'
import PolylineIcon from '@mui/icons-material/Polyline'

import { getSvChannelsMenuItem } from './svChannels.ts'

import type {
  AlignmentsUnit,
  ReadConnectionsMode,
  ReadConnectionsPlacement,
} from '../constants.ts'
import type { SvChannelsModel } from './svChannels.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface ReadConnectionsModel {
  unit: AlignmentsUnit
  setUnit: (unit: AlignmentsUnit) => void
  drawnReadConnections: ReadConnectionsMode
  setDrawnReadConnections: (mode: ReadConnectionsMode) => void
  showOrdinaryPairs: boolean
  setShowOrdinaryPairs: (show?: boolean) => void
  showConnectors: boolean
  setShowConnectors: (flag: boolean) => void
}

interface ReadConnectionsBandModel {
  drawnReadConnections: ReadConnectionsMode
  readConnectionsPlacement: ReadConnectionsPlacement
  setReadConnectionsPlacement: (placement: ReadConnectionsPlacement) => void
  readConnectionsLineWidth: number
  setReadConnectionsLineWidth: (width?: number) => void
}

// The width a one-read connection strokes at under the default
// `encoding.strokeWidth` scale, for the is-default marker.
const DEFAULT_READ_CONNECTIONS_LINE_WIDTH = 1

const PLACEMENT_OPTIONS: { value: ReadConnectionsPlacement; label: string }[] =
  [
    { value: 'up', label: 'Above coverage' },
    { value: 'down', label: 'Below coverage' },
  ]

const PAIR_BAND_OPTIONS: { value: ReadConnectionsMode; label: string }[] = [
  { value: 'off', label: 'None' },
  { value: 'link', label: 'Read arcs' },
  { value: 'rule', label: 'Read cloud' },
]

export const PAIR_BAND_LABEL = 'Pair band'

// Read arcs and the read cloud share one band, so they are radios under their
// own sub-header. The connection filters live in the "More filters..." dialog
// and the band's placement and line width in "Advanced".
export function getReadConnectionsMenuItem(
  model: ReadConnectionsModel & SvChannelsModel,
) {
  const linked = model.unit === 'chain'
  const subMenu: MenuItem[] = [
    checkboxItem('Link mates and supplementary alignments', linked, () => {
      model.setUnit(linked ? 'read' : 'chain')
    }),
    toggleItem('Pileup connectors', model.showConnectors, flag => {
      model.setShowConnectors(flag)
    }),
    getSvChannelsMenuItem(model),
    ...(model.drawnReadConnections === 'off'
      ? []
      : [
          toggleItem('Ordinary pairs', model.showOrdinaryPairs, show => {
            model.setShowOrdinaryPairs(show)
          }),
        ]),
    ...withSubHeader(
      PAIR_BAND_LABEL,
      radioItems(PAIR_BAND_OPTIONS, model.drawnReadConnections, mode => {
        model.setDrawnReadConnections(mode)
      }),
    ),
  ]
  return {
    label: 'Read connections',
    icon: PolylineIcon,
    type: 'subMenu' as const,
    subMenu,
  }
}

/** The band's layout rows, for "Advanced", while arcs or the read cloud draw. */
export function getReadConnectionsBandItems(
  model: ReadConnectionsBandModel,
): MenuItem[] {
  if (model.drawnReadConnections === 'off') {
    return []
  }
  return [
    {
      label: 'Read connections placement',
      type: 'subMenu' as const,
      subMenu: radioItems(
        PLACEMENT_OPTIONS,
        model.readConnectionsPlacement,
        placement => {
          model.setReadConnectionsPlacement(placement)
        },
      ),
    },
    makeSizeSubMenu({
      label: 'Read connections line width',
      title: 'Read connections line width',
      // Half-px steps because 1.5 is a real width on a retina display.
      scale: 'linear',
      min: 1,
      max: 5,
      step: 0.5,
      unit: 'px',
      getValue: () => model.readConnectionsLineWidth,
      isDefault:
        model.readConnectionsLineWidth === DEFAULT_READ_CONNECTIONS_LINE_WIDTH,
      onChange: width => {
        model.setReadConnectionsLineWidth(width)
      },
      onReset: () => {
        model.setReadConnectionsLineWidth()
      },
    }),
  ]
}
