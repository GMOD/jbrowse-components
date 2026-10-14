import { lazy } from 'react'

import { getCoverageMenuItems } from '@jbrowse/alignments-core/coverageMenuItems'
import {
  makeRadioSubMenu,
  toggleItem,
  withHint,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
import { legendCheckboxItem } from '@jbrowse/display-kit/LegendMixin'
import {
  colorByMenuItem,
  colorSchemeMenuItem,
} from '@jbrowse/display-kit/colorByMenu'
import {
  clusteringMenuItem,
  resetRowOrderMenuItems,
  rowArrangementMenuItem,
  rowHeightMenuItem,
  showRowLabelsMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'

import { CONSERVATION_MODES } from './conservationModes.ts'
import { HEIGHT_PRESETS } from './displayDefaults.ts'
import { MAF_COLOR_FIELDS, MAF_COLOR_FIELD_LABELS } from './rowRenderings.ts'

import type { ConservationMode } from './conservationModes.ts'
import type { MafColorField, MafYField } from './rowRenderings.ts'
import type { MafClusterSelf } from './runMafClustering.ts'
import type { MafSource } from './stateModel.ts'
import type { CoverageMenuModel } from '@jbrowse/alignments-core/coverageMenuItems'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
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
  extends
    IStateTreeNode,
    MafClusterSelf,
    TreeLayoutModel<MafSource>,
    CoverageMenuModel {
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
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (f: boolean) => void
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
  selectedColorField: MafColorField
  colorByField: (field: MafColorField) => void
  yField: MafYField | undefined
  setYField: (field: MafYField | undefined) => void
  colorScheme: ColorSchemeName
  setColorScheme: (scheme: ColorSchemeName) => void
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
function colorFieldRow(self: MafMenuSelf, field: MafColorField): MenuItem {
  const label = MAF_COLOR_FIELD_LABELS[field]
  return {
    label:
      field === 'codon'
        ? withHint(
            label,
            self.zoomedToBaseLevel ? undefined : 'zoom in to base level',
          )
        : label,
    type: 'radio',
    checked: self.selectedColorField === field,
    onClick: () => {
      self.colorByField(field)
    },
  }
}

function colorMenuItem(self: MafMenuSelf): MenuItem {
  return colorByMenuItem({
    blocks: [
      {
        rows: MAF_COLOR_FIELDS.filter(
          field => field !== 'codon' || !!self.annotationAdapterConfig,
        ).map(field => colorFieldRow(self, field)),
      },
    ],
    additional: [
      ...(self.selectedColorField === 'identity'
        ? [colorSchemeMenuItem(self)]
        : []),
      toggleItem(
        'Show bases when zoomed in',
        self.rowIdentityAutoZoom,
        self.setRowIdentityAutoZoom,
        { helpText: 'identity, in either plot, yields to the bases' },
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

function plotTypeMenuItem(self: MafMenuSelf): MenuItem {
  return makeRadioSubMenu({
    label: 'Plot type',
    value: self.yField ?? 'cells',
    onChange: plot => {
      self.setYField(plot === 'cells' ? undefined : plot)
    },
    options: [
      ['cells', 'Cells'],
      ['identity', 'Identity X-Y plot'],
    ] as const,
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
    toggleItem(
      'Show interbase indicators',
      self.showInterbaseIndicators,
      self.setShowInterbaseIndicators,
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
    colorMenuItem(self),
    plotTypeMenuItem(self),
    ...makeShowSubMenu(showMenuItems(self)),
    ...getCoverageMenuItems(self),
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
