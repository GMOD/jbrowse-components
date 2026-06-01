import GestureIcon from '@mui/icons-material/Gesture'
import PolylineIcon from '@mui/icons-material/Polyline'

import { LINKED_READS_OPTIONS, radioItems, radioModeMenuItem } from './menuHelpers.ts'

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
      ...radioItems(MODE_OPTIONS, model.readConnections, mode => {
        model.setReadConnections(mode)
      }),
      ...pairFilters,
    ] satisfies MenuItem[],
  }
}

interface SashimiArcsModel {
  sashimiArcs: ArcDirection
  toggleSashimiArcs: () => void
}

// Sashimi (splice-junction) arcs are a distinct feature, so they get a direct
// top-level on/off toggle. Direction follows the shared below-coverage toggle,
// and turning it on force-enables coverage — both invariants live in the
// `toggleSashimiArcs` action.
export function getSashimiArcsMenuItem(model: SashimiArcsModel) {
  return {
    label: 'Sashimi arcs',
    icon: GestureIcon,
    type: 'checkbox' as const,
    checked: model.sashimiArcs !== 'off',
    onClick: () => {
      model.toggleSashimiArcs()
    },
  }
}

interface ArcDirectionModel {
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  sashimiArcs: ArcDirection
}

// Single below-coverage toggle shared by read-connection arcs/cloud and sashimi
// arcs — direction is a rare modifier, so it lives once in the Show menu rather
// than once per feature. `setReadConnectionsDown` keeps sashimi direction in
// sync, so this handler just flips the canonical flag.
export function getArcDirectionMenuItem(model: ArcDirectionModel) {
  const anyArcsOn =
    model.readConnections !== 'off' || model.sashimiArcs !== 'off'
  return {
    label: 'Draw arcs below coverage band',
    disabled: !anyArcsOn,
    type: 'checkbox' as const,
    checked: model.readConnectionsDown,
    onClick: () => {
      model.setReadConnectionsDown(!model.readConnectionsDown)
    },
  }
}
