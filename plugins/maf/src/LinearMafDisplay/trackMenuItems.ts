import { lazy } from 'react'

import {
  makeRadioSubMenu,
  toggleItem,
  withHint,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import {
  clusteringMenuItem,
  resetRowOrderMenuItems,
  rowArrangementMenuItem,
  rowHeightMenuItem,
  showRowLabelsMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'
import PaletteIcon from '@mui/icons-material/Palette'

import { CONSERVATION_MODES } from './conservationModes.ts'
import { HEIGHT_PRESETS } from './displayDefaults.ts'
import { CODON_ROW_RENDERING, ROW_RENDERINGS } from './rowRenderings.ts'

import type { ConservationMode } from './conservationModes.ts'
import type { RowRendering } from './rowRenderings.ts'
import type { MafClusterSelf } from './runMafClustering.ts'
import type { MafSource } from './stateModel.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

const MafClusterDialog = lazy(() => import('./components/MafClusterDialog.tsx'))

// Both bands need the per-base alignment, which the summary tier does not read.
// The tick keeps the user's choice and this hint says why nothing draws.
export const ZOOM_IN_FOR_BAND = 'zoom in past the summary tier'

/**
 * A row whose action the summary tier took away keeps its place and says why it
 * cannot act.
 */
export function zoomGatedItem(item: MenuItem, hint: string | undefined) {
  return hint ? { ...item, disabled: true, disabledHelpText: hint } : item
}

interface MafMenuSelf
  extends IStateTreeNode, MafClusterSelf, TreeLayoutModel<MafSource> {
  hasLegendKey: boolean
  showLegend: boolean
  setShowLegend: (arg: boolean) => void
  showAllLetters: boolean
  showAsUpperCase: boolean
  showTree: boolean
  showRowLabels: boolean
  setShowRowLabels: (arg: boolean) => void
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  showCoverage: boolean
  showAlignments: boolean
  showConservation: boolean
  showReferenceRow: boolean
  // Not settings: states in which a tick is correct yet inert (summary tier,
  // base-level zoom, a frames read the byte pre-flight declined). Read only to
  // say so.
  coarseTierActive: boolean
  zoomedToBaseLevel: boolean
  framesGateBlocked: boolean
  conservationMode: ConservationMode
  showAnnotations: boolean
  showInversions: boolean
  annotationAdapterConfig: Record<string, unknown> | undefined
  selectedRowRendering: RowRendering
  setRowRendering: (m: RowRendering) => void
  rowIdentityAutoZoom: boolean
  // Declared so the shared `rowHeightMenuItem` contract is checked here; maf is
  // the one display with a proportion.
  rowHeight: number
  rowProportion: number
  editableSources: MafSource[]
  sources: MafSource[]
  sourcesKnown: boolean
  setRowHeight: (n: number) => void
  setFitToHeight: () => void
  setRowProportion: (n: number) => void
  setShowAllLetters: (f: boolean) => void
  setShowAsUpperCase: (f: boolean) => void
  setShowTree: (f: boolean) => void
  setShowBranchLength: (f: boolean) => void
  setShowCoverage: (f: boolean) => void
  setShowAlignments: (f: boolean) => void
  setShowConservation: (f: boolean) => void
  setShowReferenceRow: (f: boolean) => void
  setConservationMode: (m: ConservationMode) => void
  setShowAnnotations: (f: boolean) => void
  setShowInversions: (f: boolean) => void
  setRowIdentityAutoZoom: (f: boolean) => void
  rowFocus?: readonly string[]
  setRowFocus: (names?: readonly string[]) => void
  setScrollTop: (scrollTop: number) => void
  // `resetRowOrderMenuItems` gates on the first and calls the second.
  rowArrangementIsCustom: boolean
  resetRowArrangement: () => void
}

// The CDS-frame overlays need a reading frame, so they appear only with an
// `annotationAdapter` (mafFrames). The strip can be on and draw nothing when
// the RPC's byte gate declines the read (`executeMafAnnotationData`), so the
// menu says so.
function frameMenuItems(self: MafMenuSelf): MenuItem[] {
  return self.annotationAdapterConfig
    ? [
        toggleItem(
          withHint(
            'Show CDS frames',
            self.framesGateBlocked
              ? 'too much frame data here, zoom in'
              : undefined,
          ),
          self.showAnnotations,
          self.setShowAnnotations,
        ),
      ]
    : []
}

/**
 * What the rows are colored by, as one radio over `color` and `y`. The codon
 * and identity options can tick a rendering that yields at the current zoom;
 * the hint and toggle say why the rows show bases.
 */
function rowRenderingMenuItem(self: MafMenuSelf): MenuItem {
  const [codonValue, codonLabel] = CODON_ROW_RENDERING
  return makeRadioSubMenu({
    label: 'Row coloring',
    icon: PaletteIcon,
    value: self.selectedRowRendering,
    onChange: m => {
      self.setRowRendering(m)
    },
    options: [
      ...ROW_RENDERINGS,
      ...(self.annotationAdapterConfig
        ? [
            [
              codonValue,
              withHint(
                codonLabel,
                self.zoomedToBaseLevel ? undefined : 'zoom in to base level',
              ),
            ] as const,
          ]
        : []),
    ],
    extraItems: [
      toggleItem(
        'Show bases when zoomed in',
        self.rowIdentityAutoZoom,
        self.setRowIdentityAutoZoom,
        { helpText: 'for the identity plots above' },
      ),
      toggleItem(
        'Show letters at all positions',
        self.showAllLetters,
        self.setShowAllLetters,
      ),
      toggleItem(
        'Show letters as uppercase',
        self.showAsUpperCase,
        self.setShowAsUpperCase,
      ),
    ],
  })
}

function showMenuItems(self: MafMenuSelf): MenuItem[] {
  return [
    ...treeSidebarShowMenuItems(self),
    showRowLabelsMenuItem(self),
    // Only where a key exists: `bases` mode has nothing to key.
    ...(self.hasLegendKey ? [legendCheckboxItem(self)] : []),
    toggleItem(
      withHint(
        'Show coverage',
        self.coarseTierActive ? ZOOM_IN_FOR_BAND : undefined,
      ),
      self.showCoverage,
      self.setShowCoverage,
    ),
    toggleItem('Show alignments', self.showAlignments, self.setShowAlignments),
    toggleItem(
      'Show reference row',
      self.showReferenceRow,
      self.setShowReferenceRow,
    ),
    toggleItem(
      withHint(
        'Show conservation (% identity)',
        self.coarseTierActive ? ZOOM_IN_FOR_BAND : undefined,
      ),
      self.showConservation,
      self.setShowConservation,
    ),
    ...(self.annotationAdapterConfig
      ? [
          makeRadioSubMenu({
            label: 'Conservation resolution',
            value: self.conservationMode,
            onChange: m => {
              self.setConservationMode(m)
            },
            options: CONSERVATION_MODES,
          }),
        ]
      : []),
    toggleItem(
      'Show inversions (strand flips)',
      self.showInversions,
      self.setShowInversions,
    ),
    ...frameMenuItems(self),
  ]
}

export function buildMafTrackMenuItems(self: MafMenuSelf): MenuItem[] {
  return [
    rowHeightMenuItem(self, HEIGHT_PRESETS),
    // Top level, like the wiggle displays' "Plot type".
    rowRenderingMenuItem(self),
    ...makeShowSubMenu(showMenuItems(self)),
    rowArrangementMenuItem(self, { ready: !!self.editableSources.length }),
    clusteringMenuItem(
      self,
      {
        label: 'Cluster rows by identity...',
        // `sources` is the post-filter list, so one row is as often a clade
        // focused to one species as a track still loading.
        disabled: !self.sourcesKnown,
        disabledHelpText: 'Loading rows...',
        onClick: () => {
          getDialogHost(self).queueDialog(handleClose => [
            MafClusterDialog,
            { model: self, handleClose },
          ])
        },
      },
      self.sources.length,
    ),
    ...resetRowOrderMenuItems(self),
  ]
}
