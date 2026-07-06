import PolylineIcon from '@mui/icons-material/Polyline'

import { checkboxItem } from './menuHelpers.ts'
import { promotableToggleItem } from './promotableToggleItem.tsx'

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
  isLinkedReadsDefault: boolean
  setLinkedReadsDefault: (promote: boolean) => void
  readConnections: ReadConnectionsMode
  setReadConnections: (mode: ReadConnectionsMode) => void
  isReadConnectionsDefault: boolean
  setReadConnectionsDefault: (promote: boolean) => void
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
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
// so they're always shown; the arc/cloud band options are revealed only when an
// overlay is active (never shown disabled).
export function getReadConnectionsMenuItem(model: ReadConnectionsModel) {
  const linked = model.linkedReads !== 'off'
  const overlayActive = model.readConnections !== 'off'
  return {
    label: 'Read connections',
    icon: PolylineIcon,
    type: 'subMenu' as const,
    subMenu: [
      // Value + "default for all" in one row (see PromotableToggleRow). The
      // default control appears only while pairs are on, so promoting the base
      // 'off' — a no-op — is never offered.
      promotableToggleItem({
        label: 'View as pairs / link supplementary alignments',
        checked: linked,
        onToggle: () => {
          model.setLinkedReads(linked ? 'off' : 'normal')
        },
        isDefault: model.isLinkedReadsDefault,
        onToggleDefault: () => {
          model.setLinkedReadsDefault(!model.isLinkedReadsDefault)
        },
      }),
      checkboxItem('Show singletons', model.drawSingletons, () => {
        model.setDrawSingletons(!model.drawSingletons)
      }),
      checkboxItem('Show proper pairs', model.drawProperPairs, () => {
        model.setDrawProperPairs(!model.drawProperPairs)
      }),
      // Arcs and read cloud share one band and the read cloud repurposes the
      // band's Y axis to |tlen| (insertSizeTicks/arcsYDomainBp), so the two
      // overlays are mutually exclusive — enabling one disables the other. Each
      // carries its own "default for all" toggle; because the two are mutually
      // exclusive and the default control only shows while that mode is on,
      // isReadConnectionsDefault always refers to the visible mode.
      promotableToggleItem({
        label: 'Show read arcs',
        checked: model.readConnections === 'arc',
        onToggle: () => {
          model.setReadConnections(
            model.readConnections === 'arc' ? 'off' : 'arc',
          )
        },
        isDefault: model.isReadConnectionsDefault,
        onToggleDefault: () => {
          model.setReadConnectionsDefault(!model.isReadConnectionsDefault)
        },
      }),
      promotableToggleItem({
        label: 'Show read cloud',
        checked: model.readConnections === 'samplot',
        onToggle: () => {
          model.setReadConnections(
            model.readConnections === 'samplot' ? 'off' : 'samplot',
          )
        },
        isDefault: model.isReadConnectionsDefault,
        onToggleDefault: () => {
          model.setReadConnectionsDefault(!model.isReadConnectionsDefault)
        },
      }),
      ...(overlayActive
        ? [
            checkboxItem(
              'Draw below coverage band',
              model.readConnectionsDown,
              () => {
                model.setReadConnectionsDown(!model.readConnectionsDown)
              },
            ),
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
          ]
        : []),
      // Orthogonal to layout — bezier curves draw over an ordinary pileup or a
      // chain layout, so this is always offered.
      checkboxItem(
        'Show read links as bezier curves',
        model.showBezierConnections,
        () => {
          model.setShowBezierConnections(!model.showBezierConnections)
        },
      ),
    ] satisfies MenuItem[],
  }
}
