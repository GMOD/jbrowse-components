import { promotableToggleItem } from '@jbrowse/core/ui'
import PolylineIcon from '@mui/icons-material/Polyline'

import { checkboxItem } from './menuHelpers.ts'

import type { LinkedReadsMode, ReadConnectionsMode } from '../constants.ts'
import type { DisplayTypeDefaultControl } from '@jbrowse/core/configuration'
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
  pairsDisplayTypeDefault: DisplayTypeDefaultControl
  readConnections: ReadConnectionsMode
  setReadConnections: (mode: ReadConnectionsMode) => void
  arcsDisplayTypeDefault: DisplayTypeDefaultControl
  readCloudDisplayTypeDefault: DisplayTypeDefaultControl
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  readConnectionsDownDisplayTypeDefault: DisplayTypeDefaultControl
  drawLongRange: boolean
  setDrawLongRange: (draw: boolean) => void
  drawInter: boolean
  setDrawInter: (draw: boolean) => void
  showBezierConnections: boolean
  setShowBezierConnections: (flag: boolean) => void
}

// Everything about pairing/connecting reads lives here (arcs, read cloud, linked
// reads, bezier). Proper-pair / singleton visibility is a per-read-category
// toggle, so it sits in "Show..." (see reads.ts), not here. The arc/cloud band
// options are always present but greyed out (disabled submenu + disabledHelpText)
// until an overlay is active, so the settings are discoverable instead of
// vanishing.
export function getReadConnectionsMenuItem(model: ReadConnectionsModel) {
  const linked = model.linkedReads !== 'off'
  const overlayActive = model.readConnections !== 'off'
  const subMenu: MenuItem[] = [
    // Value checkbox + a trailing "default for all" pin, in one row.
    promotableToggleItem({
      label: 'View as pairs / link supplementary alignments',
      checked: linked,
      onToggle: () => {
        model.setLinkedReads(linked ? 'off' : 'normal')
      },
      displayTypeDefault: model.pairsDisplayTypeDefault,
    }),
    // Arcs and read cloud share one band and the read cloud repurposes the
    // band's Y axis to |tlen| (insertSizeTicks/arcsYDomainBp), so the two
    // overlays are mutually exclusive — enabling one disables the other. Their
    // "default for all" pins target distinct on-values ('arc' vs 'samplot'), so
    // they stay independent even though they share the readConnections slot.
    promotableToggleItem({
      label: 'Show read arcs',
      checked: model.readConnections === 'arc',
      onToggle: () => {
        model.setReadConnections(
          model.readConnections === 'arc' ? 'off' : 'arc',
        )
      },
      displayTypeDefault: model.arcsDisplayTypeDefault,
    }),
    promotableToggleItem({
      label: 'Show read cloud',
      checked: model.readConnections === 'samplot',
      onToggle: () => {
        model.setReadConnections(
          model.readConnections === 'samplot' ? 'off' : 'samplot',
        )
      },
      displayTypeDefault: model.readCloudDisplayTypeDefault,
    }),
    // Orthogonal to layout — the connection curves draw over an ordinary pileup
    // or a chain layout, so this is always offered.
    checkboxItem(
      'Use curved connectors',
      model.showBezierConnections,
      () => {
        model.setShowBezierConnections(!model.showBezierConnections)
      },
      {
        helpText:
          'draw a curve between a read and its mate or split-read segment; curve color marks the connection type (e.g. inversion, deletion, pair orientation — see the legend). Hover a curve to identify it.',
      },
    ),
    {
      label: 'Arc / read cloud band options',
      disabled: !overlayActive,
      disabledHelpText: 'Enable "Show read arcs" or "Show read cloud" first',
      subMenu: [
        promotableToggleItem({
          label: 'Draw arcs below coverage band',
          checked: model.readConnectionsDown,
          onToggle: () => {
            model.setReadConnectionsDown(!model.readConnectionsDown)
          },
          displayTypeDefault: model.readConnectionsDownDisplayTypeDefault,
        }),
        checkboxItem(
          'Show off-screen mate connections',
          model.drawLongRange,
          () => {
            model.setDrawLongRange(!model.drawLongRange)
          },
          {
            helpText:
              'draw an arc to a read whose mate is not loaded in the current view (off-screen or on another chromosome); the arc renders as vertical lines at this zoom',
          },
        ),
        checkboxItem(
          'Show inter-chromosomal pairs',
          model.drawInter,
          () => {
            model.setDrawInter(!model.drawInter)
          },
          { helpText: 'reads whose mate maps to a different chromosome' },
        ),
      ],
    },
  ]
  return {
    label: 'Read connections',
    icon: PolylineIcon,
    type: 'subMenu' as const,
    subMenu,
  }
}
