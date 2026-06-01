import GestureIcon from '@mui/icons-material/Gesture'
import PolylineIcon from '@mui/icons-material/Polyline'

import {
  LINKED_READS_OPTIONS,
  checkboxItem,
  radioItems,
  radioModeMenuItem,
} from './menuHelpers.ts'

import type { LinkedReadsMode, ReadConnectionsMode } from '../constants.ts'
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
          checkboxItem(
            'Show long-range pairs',
            model.drawLongRange,
            () => {
              model.setDrawLongRange(!model.drawLongRange)
            },
            { helpText: 'reads >100 kb apart or with off-screen mates' },
          ),
          checkboxItem(
            'Show inter-chromosomal pairs',
            model.drawInter,
            () => {
              model.setDrawInter(!model.drawInter)
            },
            { helpText: 'reads whose mate maps to a different chromosome' },
          ),
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
  showSashimiArcs: boolean
  toggleSashimiArcs: () => void
}

// Sashimi (splice-junction) arcs are a distinct feature, so they get a direct
// top-level on/off toggle. Direction follows the shared below-coverage toggle,
// and turning it on force-enables coverage — both invariants live in the
// `toggleSashimiArcs` action.
export function getSashimiArcsMenuItem(model: SashimiArcsModel) {
  return checkboxItem(
    'Sashimi arcs',
    model.showSashimiArcs,
    () => {
      model.toggleSashimiArcs()
    },
    { icon: GestureIcon },
  )
}

interface ArcDirectionModel {
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  showSashimiArcs: boolean
}

// Single below-coverage toggle shared by read-connection arcs/cloud and sashimi
// arcs — direction is a rare modifier, so it lives once in the Show menu rather
// than once per feature. `readConnectionsDown` is the one direction field both
// features read, so this handler just flips it.
export function getArcDirectionMenuItem(model: ArcDirectionModel) {
  const anyArcsOn = model.readConnections !== 'off' || model.showSashimiArcs
  return checkboxItem(
    'Draw arcs below coverage band',
    model.readConnectionsDown,
    () => {
      model.setReadConnectionsDown(!model.readConnectionsDown)
    },
    { disabled: !anyArcsOn },
  )
}
