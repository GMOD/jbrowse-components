import PolylineIcon from '@mui/icons-material/Polyline'

import { checkboxItem, radioModeMenuItem } from './menuHelpers.ts'

import type { LinkedReadsMode, ReadConnectionsMode } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const VIEW_AS_PAIRS_OPTIONS: { value: ReadConnectionsMode; label: string }[] =
  [
    { value: 'off', label: 'Off' },
    { value: 'arc', label: 'Arcs' },
    { value: 'samplot', label: 'Read cloud' },
  ]

interface ReadConnectionsModel {
  linkedReads: LinkedReadsMode
  setLinkedReads: (mode: LinkedReadsMode) => void
  readConnections: ReadConnectionsMode
  setReadConnections: (mode: ReadConnectionsMode) => void
}

export function getReadConnectionsMenuItem(model: ReadConnectionsModel) {
  return {
    label: 'Read connections',
    icon: PolylineIcon,
    type: 'subMenu' as const,
    subMenu: [
      checkboxItem(
        'Link supplementary alignments',
        model.linkedReads !== 'off',
        () => {
          model.setLinkedReads(model.linkedReads === 'off' ? 'normal' : 'off')
        },
      ),
      radioModeMenuItem(
        'View as pairs',
        VIEW_AS_PAIRS_OPTIONS,
        model.readConnections,
        mode => {
          model.setReadConnections(mode)
        },
      ),
    ] satisfies MenuItem[],
  }
}

interface ArcDirectionModel {
  readConnections: ReadConnectionsMode
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  showSashimiArcs: boolean
}

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
