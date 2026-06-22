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
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  drawLongRange: boolean
  setDrawLongRange: (draw: boolean) => void
  drawInter: boolean
  setDrawInter: (draw: boolean) => void
  showBezierConnections: boolean
  setShowBezierConnections: (flag: boolean) => void
  drawSingletons?: boolean
  drawProperPairs?: boolean
  setDrawSingletons?: (arg: boolean) => void
  setDrawProperPairs?: (arg: boolean) => void
}

// Everything about pairing/connecting reads lives here, so the concept is in one
// place rather than split across "Show...". Sub-options are revealed only when
// the mode they tune is active (never shown disabled): pair filters appear with
// linked reads, the arc/cloud band options appear with an overlay.
export function getReadConnectionsMenuItem(
  model: ReadConnectionsModel,
  opts: { showPairFilters?: boolean } = {},
) {
  const showPairFilters = opts.showPairFilters ?? false
  const linked = model.linkedReads !== 'off'
  const overlayActive = model.readConnections !== 'off'
  return {
    label: 'Read connections',
    icon: PolylineIcon,
    type: 'subMenu' as const,
    subMenu: [
      checkboxItem(
        'View as pairs / link supplementary alignments',
        linked,
        () => {
          model.setLinkedReads(model.linkedReads === 'off' ? 'normal' : 'off')
        },
      ),
      ...(linked && showPairFilters
        ? [
            checkboxItem(
              'Show singletons',
              model.drawSingletons ?? false,
              () => {
                model.setDrawSingletons?.(!model.drawSingletons)
              },
            ),
            checkboxItem(
              'Show proper pairs',
              model.drawProperPairs ?? false,
              () => {
                model.setDrawProperPairs?.(!model.drawProperPairs)
              },
            ),
          ]
        : []),
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
