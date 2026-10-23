import { makeSizeSubMenu } from '@jbrowse/core/ui'
import {
  checkboxItem,
  radioItems,
  toggleItem,
  withSubHeader,
} from '@jbrowse/core/ui/menuItems'
import { categoryFilterItem } from '@jbrowse/display-kit/categoryFilter'
import PolylineIcon from '@mui/icons-material/Polyline'

import { DEFAULT_MIN_INTERCHROM_READS } from '../../shared/alignmentsFilter.ts'
import { READ_CONNECTIONS_OPTIONS } from '../constants.ts'
import { getSvChannelsMenuItem } from './svChannels.ts'

import type { ConnectionFilter } from '../../shared/types.ts'
import type {
  AlignmentsUnit,
  ReadConnectionsMode,
  ReadConnectionsPlacement,
} from '../constants.ts'
import type { SvChannelsModel } from './svChannels.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface ReadConnectionsModel {
  unit: AlignmentsUnit
  setUnit: (unit: AlignmentsUnit) => void
  drawnReadConnections: ReadConnectionsMode
  setDrawnReadConnections: (mode: ReadConnectionsMode) => void
  readConnectionsPlacement: ReadConnectionsPlacement
  setReadConnectionsPlacement: (placement: ReadConnectionsPlacement) => void
  connectionFilter: ConnectionFilter
  setConnectionFilter: (patch: Partial<ConnectionFilter>) => void
  showOrdinaryPairs: boolean
  setShowOrdinaryPairs: (show?: boolean) => void
  showConnectors: boolean
  setShowConnectors: (flag: boolean) => void
  readConnectionsLineWidth: number
  setReadConnectionsLineWidth: (width?: number) => void
}

// The width a one-read connection strokes at under the default
// `encoding.strokeWidth` scale, for the is-default marker.
const DEFAULT_READ_CONNECTIONS_LINE_WIDTH = 1

const PLACEMENT_OPTIONS: { value: ReadConnectionsPlacement; label: string }[] =
  [
    { value: 'up', label: 'Above coverage' },
    { value: 'down', label: 'Below coverage' },
  ]

// Everything about pairing/connecting reads lives here (arcs, read cloud, linked
// reads, curved connectors). Proper-pair / singleton visibility is a
// per-read-category filter, so it sits in "Filter by..." (see reads.ts), not
// here. The arc/cloud band rows sit under their own heading, greyed out until an
// overlay is active so they stay discoverable. Their sliders are submenus
// (`makeSizeSubMenu`): two inline slider blocks would turn this column of
// checkboxes into a form.
//
// The SV-channel row sits here too, under the overlay radio it builds on.
// It spent a day at the top of the track menu, where it was the one bare
// checkbox in a column of submenus; two of the four settings it writes are
// this menu's own, and the reader watching "Read arcs" select as they turn it
// on is what says how the row and the switches relate.
export function getReadConnectionsMenuItem(
  model: ReadConnectionsModel & SvChannelsModel,
) {
  const linked = model.unit === 'chain'
  const bandGate = {
    disabled: model.drawnReadConnections === 'off',
    disabledHelpText: 'Choose "Read arcs" or "Read cloud" first',
  }
  // the `connection` filter fields reach the band and the curved connectors alike
  const filterGate = {
    disabled: model.drawnReadConnections === 'off' && !model.showConnectors,
    disabledHelpText:
      'Choose "Read arcs" or "Read cloud", or use curved connectors, first',
  }
  const filter = model.connectionFilter
  const subMenu: MenuItem[] = [
    checkboxItem(
      'View as pairs / link supplementary alignments',
      linked,
      () => {
        model.setUnit(linked ? 'read' : 'chain')
      },
    ),
    // One radio over `readConnections.show` and `.mark` rather than an arcs
    // checkbox and a cloud checkbox: the two overlays share a band (the cloud
    // repurposes its Y axis to |tlen|, insertSizeTicks/arcsYDomainBp), so they
    // are mutually exclusive and a radio says so.
    { type: 'subHeader' as const, label: 'Connection overlay' },
    ...radioItems(
      READ_CONNECTIONS_OPTIONS,
      model.drawnReadConnections,
      mode => {
        model.setDrawnReadConnections(mode)
      },
    ),
    getSvChannelsMenuItem(model),
    // Orthogonal to layout — the connection curves draw over an ordinary pileup
    // or a chain layout, so this is always offered.
    toggleItem(
      'Use curved connectors',
      model.showConnectors,
      flag => {
        model.setShowConnectors(flag)
      },
      {
        helpText:
          'draw a curve between a read and its mate or split-read segment; curve color marks the connection type (e.g. inversion, deletion, pair orientation — see the legend). Hover a curve to identify it. A connection between two different displayed regions is drawn this way whatever this is set to, since the per-region pass cannot reach across one.',
      },
    ),
    ...withSubHeader('Which connections draw', [
      categoryFilterItem(
        {
          noun: 'Off-screen mate connections',
          all: 'All connections',
          only: 'Only off-screen mate connections',
          exclude: 'Hide off-screen mate connections',
          helpText:
            'Connections to a read whose mate or split segment is elsewhere on this chromosome and not loaded in the current view; the arc renders as vertical lines at this zoom. A curved connector joins two loaded reads, so it is never one. Inter-chromosomal partners have their own filter below.',
        },
        filter.offscreenMates,
        offscreenMates => {
          model.setConnectionFilter({ offscreenMates })
        },
        filterGate,
      ),
      categoryFilterItem(
        {
          noun: 'Inter-chromosomal pairs',
          all: 'All connections',
          only: 'Only inter-chromosomal pairs',
          exclude: 'Hide inter-chromosomal pairs',
          helpText:
            'Reads whose mate — or split-read segment — maps to a different chromosome. Drawn as an arc, or as a curved connector over the pileup, when both chromosomes are displayed, and as a breakpoint tick otherwise. Independent of the off-screen filter above: a single-chromosome view never loads the far end of a translocation, so this one has to be able to draw it on its own.',
        },
        filter.interchrom,
        interchrom => {
          model.setConnectionFilter({ interchrom })
        },
        filterGate,
      ),
      {
        ...makeSizeSubMenu({
          label: 'Inter-chromosomal evidence',
          title: 'Min reads at a breakpoint',
          help: 'Hide an inter-chromosomal connection unless this many read pairs support its breakpoint, counted over one fragment length on both sides. 1 shows every connection.',
          // Support is counted over a window, not at an exact base: mates
          // straddle a breakpoint rather than landing on it. See
          // `clusteredInterchromSupport`.
          //
          // Linear and small-topped, unlike sashimi's log slider to 10,000:
          // this counts read PAIRS spanning a breakpoint, which even at 300x is
          // tens. Tier 4 (rebuilds `arcsByGroup`), so a live onChange is fine.
          scale: 'linear',
          min: 1,
          max: 20,
          format: n => (n === 1 ? 'all' : `${n}`),
          getValue: () => filter.minInterchromReads,
          isDefault: filter.minInterchromReads === DEFAULT_MIN_INTERCHROM_READS,
          onChange: minInterchromReads => {
            model.setConnectionFilter({ minInterchromReads })
          },
          onReset: () => {
            model.setConnectionFilter({
              minInterchromReads: DEFAULT_MIN_INTERCHROM_READS,
            })
          },
        }),
        ...filterGate,
      },
    ]),
    ...withSubHeader('Arc / read cloud band', [
      toggleItem(
        'Show ordinary pairs',
        model.showOrdinaryPairs,
        show => {
          model.setShowOrdinaryPairs(show)
        },
        {
          ...bandGate,
          helpText:
            'Draw the ordinary pairs alongside the ones that carry a category — abnormal insert size or orientation, and split junctions. For arcs, ordinary means concordant: the aligner flagged the pair proper (SAM 0x2), it is not a chimeric segment, and its mates face each other. A pair that fails this counts as SV evidence under Filter by..., which hides reads where this hides only arcs, so you can keep the pileup whole and still read the band. For the read cloud, ordinary means an insert size inside the usual band, whatever the flags say. Arcs draw them unless you uncheck this and the cloud leaves them out unless you check it; on deep coverage, unchecking it for arcs is the difference between a readable band and a solid mass.',
        },
      ),
      {
        label: 'Arc placement',
        type: 'subMenu' as const,
        subMenu: radioItems(
          PLACEMENT_OPTIONS,
          model.readConnectionsPlacement,
          placement => {
            model.setReadConnectionsPlacement(placement)
          },
        ),
        ...bandGate,
      },
      {
        ...makeSizeSubMenu({
          label: 'Line width',
          title: 'Arc line width',
          // Tier 4 (repaint only), so a live onChange is fine. Half-px steps
          // because 1.5 is a real width on a retina display.
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
            model.setReadConnectionsLineWidth()
          },
        }),
        ...bandGate,
      },
    ]),
  ]
  return {
    label: 'Read connections',
    icon: PolylineIcon,
    type: 'subMenu' as const,
    subMenu,
  }
}
