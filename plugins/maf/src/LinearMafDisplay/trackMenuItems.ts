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
  solidColorItem,
} from '@jbrowse/display-kit/colorByMenu'
import {
  rowOrderMenuItems,
  showRowLabelsMenuItem,
  treeSidebarShowMenuItems,
} from '@jbrowse/tree-sidebar'

import { CONSERVATION_UNIT_OPTIONS } from './conservationUnits.ts'
import {
  MAF_BASES_FIELDS,
  MAF_BASES_FIELD_LABELS,
  MAF_COLOR_FIELDS,
  MAF_COLOR_FIELD_LABELS,
} from './rowPlan.ts'

import type { MafSource } from '../types.ts'
import type { ConservationUnit } from './conservationUnits.ts'
import type {
  MafBasesField,
  MafColorField,
  MafYField,
  RowPlan,
} from './rowPlan.ts'
import type { MafClusterSelf } from './runMafClustering.ts'
import type { CoverageMenuModel } from '@jbrowse/alignments-core/coverageMenuItems'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ColorSchemeName } from '@jbrowse/core/util/colorSchemes'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { TreeLayoutModel } from '@jbrowse/tree-sidebar'

const MafClusterDialog = lazy(() => import('./components/MafClusterDialog.tsx'))

// At base level a one-base identity is a match call, so the bases draw instead.
const ZOOM_OUT_FOR_IDENTITY = 'zoom out past base level'

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
  showTree: boolean
  showRowLabels: boolean
  setShowRowLabels: (arg: boolean) => void
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  showInterbase: boolean
  setShowInterbase: (f: boolean) => void
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
  colorField: MafColorField | undefined
  colorValue: string | undefined
  colorByField: (field: MafColorField) => void
  pickDefaultColor: () => void
  pickSolidColor: () => void
  basesField: MafBasesField | undefined
  setBasesField: (field: MafBasesField | undefined) => void
  showMismatches: boolean
  setShowMismatches: (f: boolean) => void
  rowPlan: RowPlan
  yField: MafYField | undefined
  setYField: (field: MafYField | undefined) => void
  colorScheme: ColorSchemeName | undefined
  setColorScheme: (scheme: ColorSchemeName) => void
  editableSources: MafSource[]
  sources: MafSource[]
  sourcesKnown: boolean
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
          f => {
            self.setShowFrames(f)
          },
        ),
      ]
    : []
}

function radio(label: string, checked: boolean, onClick: () => void) {
  return { label, type: 'radio' as const, checked, onClick }
}

/**
 * Color by: what fills the rows, `encoding.color`, then the per-position
 * layer drawn over it, `alignments.bases`, as alignments' Color by offers
 * the read fill and its per-base coloring.
 */
function colorMenuItem(self: MafMenuSelf): MenuItem {
  const constant = self.colorValue !== undefined
  const fieldHint = (field: MafColorField) =>
    self.coarseTierActive
      ? ZOOM_IN_FOR_BAND
      : field === 'identity' && self.zoomedToBaseLevel
        ? ZOOM_OUT_FOR_IDENTITY
        : undefined
  return colorByMenuItem({
    blocks: [
      {
        rows: [
          radio('Default', self.colorField === undefined && !constant, () => {
            self.pickDefaultColor()
          }),
          ...MAF_COLOR_FIELDS.map(field =>
            radio(
              withHint(MAF_COLOR_FIELD_LABELS[field], fieldHint(field)),
              self.colorField === field,
              () => {
                self.setShowLegend(true)
                self.colorByField(field)
              },
            ),
          ),
          solidColorItem(self.colorField === undefined && constant, () => {
            self.pickSolidColor()
          }),
        ],
      },
      {
        header: 'Per-base coloring',
        rows: [
          radio('None', self.basesField === undefined, () => {
            self.setBasesField(undefined)
          }),
          ...MAF_BASES_FIELDS.filter(
            field => field !== 'codon' || !!self.framesAdapterConfig,
          ).map(field =>
            radio(
              withHint(MAF_BASES_FIELD_LABELS[field], basesHint(self, field)),
              self.basesField === field,
              () => {
                self.setBasesField(field)
              },
            ),
          ),
        ],
      },
    ],
    additional: [
      ...(self.colorField === 'identity' ? [colorSchemeMenuItem(self)] : []),
    ],
  })
}

/** Why no cells draw for a per-base layer at this zoom or plot. */
function cellsHint(self: MafMenuSelf) {
  return self.coarseTierActive
    ? ZOOM_IN_FOR_BAND
    : self.rowPlan.mark === 'bar'
      ? 'the X-Y plot draws bars, not cells'
      : undefined
}

/** Why ticked mismatches draw nothing at this zoom, plot or layer. */
function mismatchesHint(self: MafMenuSelf) {
  return (
    cellsHint(self) ??
    (self.rowPlan.bases
      ? 'the per-base coloring draws in their place'
      : undefined)
  )
}

/** Why a ticked per-position layer draws nothing at this zoom or plot. */
function basesHint(self: MafMenuSelf, field: MafBasesField) {
  return (
    cellsHint(self) ??
    (field === 'codon' && !self.zoomedToBaseLevel
      ? 'zoom in to base level'
      : undefined)
  )
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
      self.yField && self.rowPlan.mark === 'rect'
        ? self.coarseTierActive
          ? ZOOM_IN_FOR_BAND
          : ZOOM_OUT_FOR_IDENTITY
        : undefined,
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
      f => {
        self.setShowCoverage(f)
      },
    ),
    interbaseIndicatorsMenuItem(self),
    toggleItem('Alignments', self.showAlignments, f => {
      self.setShowAlignments(f)
    }),
    toggleItem(
      withHint('Mismatches', mismatchesHint(self)),
      self.showMismatches,
      f => {
        self.setShowMismatches(f)
      },
    ),
    toggleItem('Reference row', self.showReferenceRow, f => {
      self.setShowReferenceRow(f)
    }),
    toggleItem(
      withHint(
        'Conservation',
        self.coarseTierActive ? ZOOM_IN_FOR_BAND : undefined,
      ),
      self.showConservation,
      f => {
        self.setShowConservation(f)
      },
    ),
    toggleItem(
      withHint(
        'Inversions (strand flips)',
        self.coarseTierActive ? ZOOM_IN_FOR_BAND : undefined,
      ),
      self.showInversions,
      f => {
        self.setShowInversions(f)
      },
    ),
    ...frameMenuItems(self),
    // Only where a key exists: a constant fill and the bases key nothing.
    ...(self.hasLegendKey ? [legendCheckboxItem(self)] : []),
  ]
}

export function buildMafTrackMenuItems(self: MafMenuSelf): MenuItem[] {
  return [
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
