import { lazy } from 'react'

import {
  getCoverageMenuItems,
  interbaseIndicatorsMenuItem,
} from '@jbrowse/alignments-core/coverageMenuItems'
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
  rowOrderMenuItems,
  rowHeightMenuItem,
  showRowLabelsMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'

import { CONSERVATION_UNIT_OPTIONS } from './conservationUnits.ts'
import { HEIGHT_PRESETS } from './displayDefaults.ts'
import { MAF_COLOR_FIELDS, MAF_COLOR_FIELD_LABELS } from './rowRenderings.ts'

import type { MafSource } from '../types.ts'
import type { ConservationUnit } from './conservationUnits.ts'
import type { MafColorField, MafYField } from './rowRenderings.ts'
import type { MafClusterSelf } from './runMafClustering.ts'
import type { CoverageMenuModel } from '@jbrowse/alignments-core/coverageMenuItems'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

const MafClusterDialog = lazy(() => import('./components/MafClusterDialog.tsx'))

// Both bands need the per-base alignment, which the summary tier does not read.
// The tick keeps the user's choice and this hint says why nothing draws.
export const ZOOM_IN_FOR_BAND = 'zoom in past the summary tier'

// At base level a one-base identity is a match call, so the bases draw instead.
const ZOOM_OUT_FOR_IDENTITY = 'zoom out past base level'

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
  showTree: boolean
  showRowLabels: boolean
  setShowRowLabels: (arg: boolean) => void
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  showInterbaseIndicators: boolean
  setShowInterbaseIndicators: (f: boolean) => void
  setShowCoverageAlleles: (f: boolean) => void
  showAlignments: boolean
  showConservation: boolean
  showReferenceRow: boolean
  // Not settings: states in which a tick is correct yet inert (summary tier,
  // base-level zoom, a frames read the byte pre-flight declined). Read only to
  // say so.
  coarseTierActive: boolean
  zoomedToBaseLevel: boolean
  framesGateBlocked: boolean
  conservationUnit: ConservationUnit
  showFrames: boolean
  showInversions: boolean
  framesAdapterConfig: Record<string, unknown> | undefined
  selectedColorField: MafColorField
  colorByField: (field: MafColorField) => void
  yField: MafYField | undefined
  rowsY: MafYField | undefined
  setYField: (field: MafYField | undefined) => void
  colorScheme: ColorSchemeName | undefined
  setColorScheme: (scheme: ColorSchemeName) => void
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
  setShowTree: (f: boolean) => void
  setShowBranchLength: (f: boolean) => void
  setShowCoverage: (f: boolean) => void
  setShowAlignments: (f: boolean) => void
  setShowConservation: (f: boolean) => void
  setShowReferenceRow: (f: boolean) => void
  setConservationUnit: (m: ConservationUnit) => void
  setShowFrames: (f: boolean) => void
  setShowInversions: (f: boolean) => void
  rowFocus?: readonly string[]
  setRowFocus: (names?: readonly string[]) => void
  setScrollTop: (scrollTop: number) => void
  // `rowOrderMenuItems` gates its reset on the first and calls the second.
  rowArrangementIsCustom: boolean
  resetRowArrangement: () => void
}

// The frames strip needs a `framesAdapter` (mafFrames). It can be on and draw
// nothing when the RPC's byte gate declines the read (`executeMafFramesData`),
// so the menu says so.
function frameMenuItems(self: MafMenuSelf): MenuItem[] {
  return self.framesAdapterConfig
    ? [
        toggleItem(
          withHint(
            'CDS frames',
            self.framesGateBlocked
              ? 'too much frame data here, zoom in'
              : undefined,
          ),
          self.showFrames,
          self.setShowFrames,
        ),
      ]
    : []
}

/**
 * One Color by row, an `encoding.color.field`. The codon and identity rows
 * can tick a field that yields at the current zoom; the hint and the toggle
 * say why the rows show bases.
 */
function colorFieldRow(self: MafMenuSelf, field: MafColorField): MenuItem {
  const label = MAF_COLOR_FIELD_LABELS[field]
  const hint =
    self.rowsY === 'identity' && field !== 'identity'
      ? 'the X-Y plot draws its bars in one color'
      : field === 'codon' && !self.zoomedToBaseLevel
        ? 'zoom in to base level'
        : field === 'identity' && self.zoomedToBaseLevel
          ? ZOOM_OUT_FOR_IDENTITY
          : undefined
  return {
    label: withHint(label, hint),
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
          field => field !== 'codon' || !!self.framesAdapterConfig,
        ).map(field => colorFieldRow(self, field)),
      },
    ],
    additional: [
      ...(self.selectedColorField === 'identity'
        ? [colorSchemeMenuItem(self)]
        : []),
    ],
  })
}

function conservationResolutionMenuItems(self: MafMenuSelf): MenuItem[] {
  return self.framesAdapterConfig
    ? [
        makeRadioSubMenu({
          label: 'Conservation resolution',
          value: self.conservationUnit,
          onChange: m => {
            self.setConservationUnit(m)
          },
          options: CONSERVATION_UNIT_OPTIONS,
        }),
      ]
    : []
}

function plotTypeMenuItem(self: MafMenuSelf): MenuItem {
  return makeRadioSubMenu({
    label: withHint(
      'Plot type',
      self.yField && self.zoomedToBaseLevel ? ZOOM_OUT_FOR_IDENTITY : undefined,
    ),
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
    toggleItem(
      withHint(
        'Coverage',
        self.coarseTierActive ? ZOOM_IN_FOR_BAND : undefined,
      ),
      self.showCoverage,
      self.setShowCoverage,
    ),
    interbaseIndicatorsMenuItem(self),
    toggleItem('Alignments', self.showAlignments, self.setShowAlignments),
    toggleItem(
      'Reference row',
      self.showReferenceRow,
      self.setShowReferenceRow,
    ),
    toggleItem(
      withHint(
        'Conservation',
        self.coarseTierActive ? ZOOM_IN_FOR_BAND : undefined,
      ),
      self.showConservation,
      self.setShowConservation,
    ),
    toggleItem(
      'Inversions (strand flips)',
      self.showInversions,
      self.setShowInversions,
    ),
    ...frameMenuItems(self),
    // Only where a key exists: `bases` mode has nothing to key.
    ...(self.hasLegendKey ? [legendCheckboxItem(self)] : []),
  ]
}

export function buildMafTrackMenuItems(self: MafMenuSelf): MenuItem[] {
  return [
    rowHeightMenuItem(self, HEIGHT_PRESETS),
    colorMenuItem(self),
    plotTypeMenuItem(self),
    ...conservationResolutionMenuItems(self),
    ...makeShowSubMenu(showMenuItems(self)),
    ...getCoverageMenuItems(self),
    ...rowOrderMenuItems(self, {
      arrangement: { ready: !!self.editableSources.length },
      cluster: {
        runItem: {
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
        rowCount: self.sources.length,
      },
    }),
  ]
}
