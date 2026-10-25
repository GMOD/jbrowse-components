import { makeSizeSubMenu } from '@jbrowse/core/ui'
import {
  checkboxItem,
  radioItems,
  toggleItem,
} from '@jbrowse/core/ui/menuItems'
import { categoryFilterItem } from '@jbrowse/display-kit/categoryFilter'
import PolylineIcon from '@mui/icons-material/Polyline'

import { DEFAULT_MIN_INTERCHROM_READS } from '../../shared/alignmentsFilter.ts'
import { getSvChannelsMenuItem } from './svChannels.ts'

import type { ConnectionFilter } from '../../shared/types.ts'
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

interface ConnectionFiltersModel {
  drawnReadConnections: ReadConnectionsMode
  showConnectors: boolean
  connectionFilter: ConnectionFilter
  setConnectionFilter: (patch: Partial<ConnectionFilter>) => void
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

function bandMarkItem(
  model: ReadConnectionsModel,
  label: string,
  mode: 'arc' | 'cloud',
) {
  const on = model.drawnReadConnections === mode
  return checkboxItem(label, on, () => {
    model.setDrawnReadConnections(on ? 'off' : mode)
  })
}

// Checkboxes only, with no `?`: one row kind reads at a glance. Read arcs and
// the read cloud share a band, so ticking one unticks the other. The
// connection filters live in "Filter by..." and the band's placement and line
// width in "Advanced".
export function getReadConnectionsMenuItem(
  model: ReadConnectionsModel & SvChannelsModel,
) {
  const linked = model.unit === 'chain'
  const subMenu: MenuItem[] = [
    checkboxItem(
      'View as pairs / link supplementary alignments',
      linked,
      () => {
        model.setUnit(linked ? 'read' : 'chain')
      },
    ),
    toggleItem('Show pileup connectors', model.showConnectors, flag => {
      model.setShowConnectors(flag)
    }),
    bandMarkItem(model, 'Show read arcs', 'arc'),
    bandMarkItem(model, 'Show read cloud', 'cloud'),
    ...(model.drawnReadConnections === 'off'
      ? []
      : [
          toggleItem('Show ordinary pairs', model.showOrdinaryPairs, show => {
            model.setShowOrdinaryPairs(show)
          }),
        ]),
    getSvChannelsMenuItem(model),
  ]
  return {
    label: 'Read connections',
    icon: PolylineIcon,
    type: 'subMenu' as const,
    subMenu,
  }
}

/**
 * The `filter` rows on connections, for "Filter by...". Offered while the band
 * or the curved connectors draw, the two parts that read them.
 */
export function getConnectionFilterItems(
  model: ConnectionFiltersModel,
): MenuItem[] {
  if (model.drawnReadConnections === 'off' && !model.showConnectors) {
    return []
  }
  const filter = model.connectionFilter
  return [
    categoryFilterItem(
      {
        noun: 'Off-screen mate connections',
        all: 'All connections',
        only: 'Only off-screen mate connections',
        exclude: 'Hide off-screen mate connections',
      },
      filter.offscreenMates,
      offscreenMates => {
        model.setConnectionFilter({ offscreenMates })
      },
    ),
    categoryFilterItem(
      {
        noun: 'Inter-chromosomal pairs',
        all: 'All connections',
        only: 'Only inter-chromosomal pairs',
        exclude: 'Hide inter-chromosomal pairs',
      },
      filter.interchrom,
      interchrom => {
        model.setConnectionFilter({ interchrom })
      },
    ),
    makeSizeSubMenu({
      label: 'Inter-chromosomal evidence',
      title: 'Min reads at a breakpoint',
      // Linear and small-topped, unlike the junction floor's log slider: this
      // counts read PAIRS spanning a breakpoint, which even at 300x is tens.
      scale: 'linear',
      min: 1,
      max: 20,
      format: n => (n === 1 ? 'all' : `${n}`),
      getValue: () => filter.minInterchromReads,
      isDefault: filter.minInterchromReads === DEFAULT_MIN_INTERCHROM_READS,
      onChange: minInterchromReads => {
        model.setConnectionFilter({ minInterchromReads })
      },
      onReset: () => {
        model.setConnectionFilter({
          minInterchromReads: DEFAULT_MIN_INTERCHROM_READS,
        })
      },
    }),
  ]
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
