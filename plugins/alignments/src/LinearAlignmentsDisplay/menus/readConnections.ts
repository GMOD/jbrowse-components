import GestureIcon from '@mui/icons-material/Gesture'
import PolylineIcon from '@mui/icons-material/Polyline'

import { LINKED_READS_OPTIONS, radioModeMenuItem } from './menuHelpers.ts'

import type {
  ArcDirection,
  LinkedReadsMode,
  ReadConnectionsMode,
} from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface ReadConnectionsModel {
  linkedReads: LinkedReadsMode
  setLinkedReads: (mode: LinkedReadsMode) => void
  readConnections: ReadConnectionsMode
  setReadConnections: (mode: ReadConnectionsMode) => void
  drawLongRange: boolean
  setDrawLongRange: (draw: boolean) => void
  drawInter: boolean
  setDrawInter: (draw: boolean) => void
}

// Mode picker: pick how mate-pair connections are drawn. Arc color moves to the
// Color by menu and up/down position moves to the shared direction toggle, so
// this stays a plain on/off-style choice.
const MODE_OPTIONS: { value: ReadConnectionsMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'arc', label: 'Arcs' },
  { value: 'samplot', label: 'Read cloud' },
]

export function getReadConnectionsMenuItem(model: ReadConnectionsModel) {
  const pairFilters: MenuItem[] =
    model.readConnections === 'off'
      ? []
      : [
          {
            label: 'Show long-range pairs',
            helpText: 'reads >100 kb apart or with off-screen mates',
            type: 'checkbox' as const,
            checked: model.drawLongRange,
            onClick: () => {
              model.setDrawLongRange(!model.drawLongRange)
            },
          },
          {
            label: 'Show inter-chromosomal pairs',
            helpText: 'reads whose mate maps to a different chromosome',
            type: 'checkbox' as const,
            checked: model.drawInter,
            onClick: () => {
              model.setDrawInter(!model.drawInter)
            },
          },
        ]
  return {
    label: 'Read connections',
    icon: PolylineIcon,
    type: 'subMenu' as const,
    subMenu: [
      radioModeMenuItem(
        'Linked reads',
        LINKED_READS_OPTIONS,
        model.linkedReads,
        mode => {
          model.setLinkedReads(mode)
        },
      ),
      { type: 'divider' as const },
      ...MODE_OPTIONS.map(({ value, label }) => ({
        label,
        type: 'radio' as const,
        checked: model.readConnections === value,
        onClick: () => {
          model.setReadConnections(value)
        },
      })),
      ...pairFilters,
    ] satisfies MenuItem[],
  }
}

interface SashimiArcsModel {
  sashimiArcs: ArcDirection
  setSashimiArcs: (mode: ArcDirection) => void
  readConnectionsDown: boolean
  showCoverage: boolean
  setShowCoverage: (show: boolean) => void
}

// Sashimi (splice-junction) arcs are a distinct feature, so they get a direct
// top-level on/off toggle. Direction follows the shared below-coverage toggle.
// Sashimi only renders over the coverage band, so turning it on also turns
// coverage on — otherwise the toggle would silently do nothing.
export function getSashimiArcsMenuItem(model: SashimiArcsModel) {
  return {
    label: 'Sashimi arcs',
    icon: GestureIcon,
    type: 'checkbox' as const,
    checked: model.sashimiArcs !== 'off',
    onClick: () => {
      const turningOn = model.sashimiArcs === 'off'
      model.setSashimiArcs(
        turningOn ? (model.readConnectionsDown ? 'down' : 'up') : 'off',
      )
      if (turningOn && !model.showCoverage) {
        model.setShowCoverage(true)
      }
    },
  }
}

interface ArcDirectionModel {
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  sashimiArcs: ArcDirection
  setSashimiArcs: (mode: ArcDirection) => void
}

// Single below-coverage toggle shared by read-connection arcs/cloud and sashimi
// arcs — direction is a rare modifier, so it lives once in the Show menu rather
// than once per feature. `readConnectionsDown` is the canonical flag; sashimi
// direction is kept in sync when it's on.
export function getArcDirectionMenuItem(model: ArcDirectionModel) {
  const anyArcsOn =
    model.readConnections !== 'off' || model.sashimiArcs !== 'off'
  return {
    label: 'Draw arcs below coverage band',
    disabled: !anyArcsOn,
    type: 'checkbox' as const,
    checked: model.readConnectionsDown,
    onClick: () => {
      const down = !model.readConnectionsDown
      model.setReadConnectionsDown(down)
      if (model.sashimiArcs !== 'off') {
        model.setSashimiArcs(down ? 'down' : 'up')
      }
    },
  }
}
