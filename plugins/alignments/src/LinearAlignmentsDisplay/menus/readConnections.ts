import PolylineIcon from '@mui/icons-material/Polyline'

import { checkboxItem } from './menuHelpers.ts'

import type { LinkedReadsMode, ReadConnectionsMode } from '../constants.ts'
import type { MenuItem } from '@jbrowse/core/ui'

export const PAIR_OVERLAY_OPTIONS: {
  value: ReadConnectionsMode
  label: string
}[] = [
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
        'View as pairs / link supplementary alignments',
        model.linkedReads !== 'off',
        () => {
          model.setLinkedReads(model.linkedReads === 'off' ? 'normal' : 'off')
        },
      ),
      // Arcs and read cloud share one band and the read cloud repurposes the
      // band's Y axis to |tlen| (insertSizeTicks/arcsYDomainBp), so the two
      // overlays are mutually exclusive — enabling one disables the other.
      checkboxItem('Show read arcs', model.readConnections === 'arc', () => {
        model.setReadConnections(
          model.readConnections === 'arc' ? 'off' : 'arc',
        )
      }),
      checkboxItem(
        'Show read cloud',
        model.readConnections === 'samplot',
        () => {
          model.setReadConnections(
            model.readConnections === 'samplot' ? 'off' : 'samplot',
          )
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
