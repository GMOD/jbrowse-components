import PolylineIcon from '@mui/icons-material/Polyline'

import { checkboxItem } from './menuHelpers.ts'
import { promotableToggleItem } from './promotableToggleItem.tsx'

import type { SessionDefaultControl } from './sessionDefaultControl.ts'
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
  pairsSessionDefault: SessionDefaultControl
  readConnections: ReadConnectionsMode
  setReadConnections: (mode: ReadConnectionsMode) => void
  arcsSessionDefault: SessionDefaultControl
  readCloudSessionDefault: SessionDefaultControl
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  readConnectionsDownSessionDefault: SessionDefaultControl
  drawLongRange: boolean
  setDrawLongRange: (draw: boolean) => void
  drawInter: boolean
  setDrawInter: (draw: boolean) => void
  showBezierConnections: boolean
  setShowBezierConnections: (flag: boolean) => void
  drawSingletons: boolean
  drawProperPairs: boolean
  setDrawSingletons: (arg: boolean) => void
  setDrawProperPairs: (arg: boolean) => void
}

// Everything about pairing/connecting reads lives here, so the concept is in one
// place rather than split across "Show...". The singleton/proper-pair filters
// apply in plain pileup too (they're per-name/per-read, not pairing-specific),
// so they're always shown; the arc/cloud band options are always present but
// greyed out (disabled submenu + disabledHelpText) until an overlay is active,
// so the settings are discoverable instead of vanishing.
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
        sessionDefault: model.pairsSessionDefault,
      }),
      checkboxItem('Show singletons', model.drawSingletons, () => {
        model.setDrawSingletons(!model.drawSingletons)
      }),
      checkboxItem('Show proper pairs', model.drawProperPairs, () => {
        model.setDrawProperPairs(!model.drawProperPairs)
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
        sessionDefault: model.arcsSessionDefault,
      }),
      promotableToggleItem({
        label: 'Show read cloud',
        checked: model.readConnections === 'samplot',
        onToggle: () => {
          model.setReadConnections(
            model.readConnections === 'samplot' ? 'off' : 'samplot',
          )
        },
        sessionDefault: model.readCloudSessionDefault,
      }),
      // Orthogonal to layout — bezier curves draw over an ordinary pileup or a
      // chain layout, so this is always offered.
      checkboxItem(
        'Show read links as bezier curves',
        model.showBezierConnections,
        () => {
          model.setShowBezierConnections(!model.showBezierConnections)
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
            sessionDefault: model.readConnectionsDownSessionDefault,
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
