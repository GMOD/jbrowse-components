import { makeSizeMenu } from '@jbrowse/core/ui'
import { promotableToggleItem, toggleItem } from '@jbrowse/core/ui/menuItems'
import PolylineIcon from '@mui/icons-material/Polyline'

import { DEFAULT_MIN_INTERCHROM_SUPPORT } from '../constants.ts'
import { getSvChannelsMenuItem } from './svChannels.ts'

import type { LinkedReadsMode, ReadConnectionsMode } from '../constants.ts'
import type { SvChannelsModel } from './svChannels.ts'
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
  drawProperPairArcs: boolean
  setDrawProperPairArcs: (draw: boolean) => void
  minInterchromSupport: number
  setMinInterchromSupport: (support: number) => void
  showBezierConnections: boolean
  setShowBezierConnections: (flag: boolean) => void
  readConnectionsLineWidth: number
  setReadConnectionsLineWidth: (width: number) => void
  debugArcGeometry: boolean
  setDebugArcGeometry: (on: boolean) => void
}

// The `readConnectionsLineWidth` slot's default, spelled again here for the
// reset item and the is-default marker — the same duplication
// `DEFAULT_MIN_INTERCHROM_SUPPORT` carries, and for the same reason: the config
// docgen renders a slot default off its AST source text, so the slot cannot name
// a constant.
const DEFAULT_READ_CONNECTIONS_LINE_WIDTH = 1

// No @types/node here, and bundlers string-replace the expression, so this is
// the minimal type displayAutoruns.ts gives it.
declare const process: { env: { NODE_ENV?: string } }

// Everything about pairing/connecting reads lives here (arcs, read cloud, linked
// reads, bezier). Proper-pair / singleton visibility is a per-read-category
// toggle, so it sits in "Show..." (see reads.ts), not here. The arc/cloud band
// options are always present but greyed out (disabled submenu + disabledHelpText)
// until an overlay is active, so the settings are discoverable instead of
// vanishing.
//
// The SV-channel row sits here too, under the two overlay modes it builds on.
// It spent a day at the top of the track menu, where it was the one bare
// checkbox in a column of submenus; three of the five settings it writes are
// this menu's own, and the reader watching "Show read arcs" tick as they turn
// it on is what says how the row and the switches relate.
export function getReadConnectionsMenuItem(
  model: ReadConnectionsModel & SvChannelsModel,
) {
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
    getSvChannelsMenuItem(model),
    // Orthogonal to layout — the connection curves draw over an ordinary pileup
    // or a chain layout, so this is always offered.
    toggleItem(
      'Use curved connectors',
      model.showBezierConnections,
      flag => {
        model.setShowBezierConnections(flag)
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
        toggleItem(
          'Show concordant-pair arcs',
          model.drawProperPairArcs,
          draw => {
            model.setDrawProperPairArcs(draw)
          },
          {
            helpText:
              'Uncheck to draw only the arcs that carry a category — abnormal insert size or orientation, and split junctions — leaving out the ordinary pairs. "Concordant" means exactly what it means for the Proper pairs filter under Filter by...: the aligner flagged the pair proper (SAM 0x2), it is not a chimeric segment, and its mates face each other. That setting hides the reads; this one hides their arcs, so you can keep the pileup whole and still read the band. On deep coverage it is the difference between a readable band and a solid mass — at 300x roughly 99 arcs in 100 are the ordinary case.',
          },
        ),
        toggleItem(
          'Show off-screen mate connections',
          model.drawLongRange,
          draw => {
            model.setDrawLongRange(draw)
          },
          {
            helpText:
              'draw an arc to a read whose mate is elsewhere on this chromosome and not loaded in the current view; the arc renders as vertical lines at this zoom. Inter-chromosomal partners have their own setting below and do not need this one.',
          },
        ),
        toggleItem(
          'Show inter-chromosomal pairs',
          model.drawInter,
          draw => {
            model.setDrawInter(draw)
          },
          {
            helpText:
              'reads whose mate — or split-read segment — maps to a different chromosome. Drawn as an arc when both chromosomes are displayed and as a connector tick at each breakpoint otherwise. Independent of the setting above: a single-chromosome view never loads the far end of a translocation, so this one has to be able to draw it on its own.',
          },
        ),
        makeSizeMenu({
          label: 'Inter-chromosomal evidence',
          title: 'Min reads at a breakpoint',
          // Support is counted over a window of one fragment length on BOTH
          // sides, not at an exact base: mates straddle a breakpoint rather than
          // landing on it, so a real translocation is a scatter of reads across
          // the fragment span and never a stack on one coordinate. See
          // `clusteredInterchromSupport`.
          //
          // Linear and small-topped, unlike sashimi's log slider to 10,000: this
          // counts read PAIRS spanning a breakpoint, which even at 300x is tens,
          // where a sashimi junction's read support runs to thousands on deep
          // RNA-seq. 1 shows every connection, which is the pre-setting
          // behaviour. Tier 4 (rebuilds `arcsByGroup`), so a live onChange is
          // fine.
          scale: 'linear',
          min: 1,
          max: 20,
          format: n => (n === 1 ? 'all' : `${n}`),
          getValue: () => model.minInterchromSupport,
          isDefault:
            model.minInterchromSupport === DEFAULT_MIN_INTERCHROM_SUPPORT,
          onChange: support => {
            model.setMinInterchromSupport(support)
          },
          onReset: () => {
            model.setMinInterchromSupport(DEFAULT_MIN_INTERCHROM_SUPPORT)
          },
        }),
        makeSizeMenu({
          label: 'Line width',
          title: 'Arc line width',
          // Tier 4 (repaint only), so a live onChange is fine. Small-topped
          // because the strokes of a deep band merge into each other well before
          // 5px, and half-px steps because 1.5 is a real width on a retina
          // display rather than a rounding of 2.
          scale: 'linear',
          min: 1,
          max: 5,
          step: 0.5,
          unit: 'px',
          getValue: () => model.readConnectionsLineWidth,
          isDefault:
            model.readConnectionsLineWidth ===
            DEFAULT_READ_CONNECTIONS_LINE_WIDTH,
          onChange: width => {
            model.setReadConnectionsLineWidth(width)
          },
          onReset: () => {
            model.setReadConnectionsLineWidth(
              DEFAULT_READ_CONNECTIONS_LINE_WIDTH,
            )
          },
        }),
        // A diagnostic, so it is not in a shipped build's track menu. The
        // setting itself stays — a session snapshot carrying it still draws the
        // overlay in a dev build — it is only the row that goes.
        ...(process.env.NODE_ENV === 'production'
          ? []
          : [
              toggleItem(
                'Debug: show arc geometry',
                model.debugArcGeometry,
                on => {
                  model.setDebugArcGeometry(on)
                },
                {
                  helpText:
                    'diagnostic overlay: outlines the band, the pre-unclamp apex ceiling, and every arc traced from the same radii the renderer uses, with rx/ry/aspect printed for the widest few. An outline that does not sit on its painted arc is a real disagreement between the model and the paint.',
                },
              ),
            ]),
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
