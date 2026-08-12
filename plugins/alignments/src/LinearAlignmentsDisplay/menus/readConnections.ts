import { checkboxItem, promotableToggleItem } from '@jbrowse/core/ui/menuItems'
import PolylineIcon from '@mui/icons-material/Polyline'

import type { LinkedReadsMode, ReadConnectionsMode } from '../constants.ts'
import type { Pin } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'

interface ReadConnectionsModel {
  linkedReads: LinkedReadsMode
  setLinkedReads: (mode: LinkedReadsMode) => void
  pairsDisplayTypeDefault: Pin
  readConnections: ReadConnectionsMode
  setReadConnections: (mode: ReadConnectionsMode) => void
  arcsDisplayTypeDefault: Pin
  readCloudDisplayTypeDefault: Pin
  readConnectionsDown: boolean
  setReadConnectionsDown: (down: boolean) => void
  readConnectionsDownDisplayTypeDefault: Pin
  drawLongRange: boolean
  setDrawLongRange: (draw: boolean) => void
  drawInter: boolean
  setDrawInter: (draw: boolean) => void
  showBezierConnections: boolean
  setShowBezierConnections: (flag: boolean) => void
  debugArcGeometry: boolean
  setDebugArcGeometry: (on: boolean) => void
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
      pin: model.pairsDisplayTypeDefault,
    }),
    // Arcs and read cloud share one band and the read cloud repurposes the
    // band's Y axis to |tlen| (insertSizeTicks/arcsYDomainBp), so the two
    // overlays are mutually exclusive — enabling one disables the other. Their
    // "default for all" pins target distinct on-values ('arc' vs 'cloud'), so
    // they stay independent even though they share the readConnections slot.
    promotableToggleItem({
      label: 'Show read arcs',
      checked: model.readConnections === 'arc',
      onToggle: () => {
        model.setReadConnections(
          model.readConnections === 'arc' ? 'off' : 'arc',
        )
      },
      pin: model.arcsDisplayTypeDefault,
    }),
    promotableToggleItem({
      label: 'Show read cloud',
      checked: model.readConnections === 'cloud',
      onToggle: () => {
        model.setReadConnections(
          model.readConnections === 'cloud' ? 'off' : 'cloud',
        )
      },
      pin: model.readCloudDisplayTypeDefault,
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
          'draw a curve between a read and its mate or split-read segment; curve color marks the connection type (e.g. inversion, deletion, pair orientation — see the legend). Hover a curve to identify it. A connection between two different displayed regions is drawn this way whatever this is set to, since the per-region pass cannot reach across one.',
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
          pin: model.readConnectionsDownDisplayTypeDefault,
        }),
        checkboxItem(
          'Show off-screen mate connections',
          model.drawLongRange,
          () => {
            model.setDrawLongRange(!model.drawLongRange)
          },
          {
            helpText:
              'draw an arc to a read whose mate is elsewhere on this chromosome and not loaded in the current view; the arc renders as vertical lines at this zoom. Inter-chromosomal partners have their own setting below and do not need this one.',
          },
        ),
        checkboxItem(
          'Show inter-chromosomal pairs',
          model.drawInter,
          () => {
            model.setDrawInter(!model.drawInter)
          },
          {
            helpText:
              'reads whose mate — or split-read segment — maps to a different chromosome, drawn as a connector tick at each breakpoint. Independent of the setting above: a single-chromosome view never loads the far end of a translocation, so this one has to be able to draw it on its own.',
          },
        ),
        checkboxItem(
          'Debug: show arc geometry',
          model.debugArcGeometry,
          () => {
            model.setDebugArcGeometry(!model.debugArcGeometry)
          },
          {
            helpText:
              'diagnostic overlay: outlines the band, the pre-unclamp apex ceiling, and every arc traced from the same radii the renderer uses, with rx/ry/aspect printed for the widest few. An outline that does not sit on its painted arc is a real disagreement between the model and the paint.',
          },
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
