import { lazy } from 'react'

import { checkboxItem } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { treeBranchLengthMenuItem } from '@jbrowse/tree-sidebar'
import { makeRadioSubMenu } from '@jbrowse/wiggle-core'
import HeightIcon from '@mui/icons-material/Height'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { CONSERVATION_MODES } from './conservationModes.ts'
import { DEFAULTS } from './displayDefaults.ts'
import { ROW_IDENTITY_MODES } from './rowIdentityModes.ts'

import type { ConservationMode } from './conservationModes.ts'
import type { RowIdentityModeWithOff } from './rowIdentityModes.ts'
import type { MafSource } from './stateModel.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog/SetRowHeightDialog.tsx'),
)
const SetRowArrangementDialog = lazy(
  () => import('./components/SetRowArrangementDialog.tsx'),
)

// Compact row for the plain show/hide toggles, which are otherwise a dozen
// near-identical four-line literals. Reads the current value and hands the
// negation to the setter explicitly, so no event argument can reach it.
// `checkboxItem` supplies `keepMenuOpen` — users flip several of these in one
// visit, and the menu is an observer, so the ticks move live.
function toggle(label: string, checked: boolean, set: (v: boolean) => void) {
  return checkboxItem(label, checked, () => {
    set(!checked)
  })
}

// Row-height presets. `rowHeight` is a single coupled axis — 0 is the
// fit-to-view sentinel, any positive value is a fixed height — so unlike the
// alignments display, whose size and sizing are separable, these are one
// mutually-exclusive set expressed as radios. Each preset pairs a height with
// the glyph proportion that reads best at it.
const HEIGHT_PRESETS = [
  { label: 'Normal', rowHeight: DEFAULTS.rowHeight, rowProportion: 0.8 },
  { label: 'Compact', rowHeight: 8, rowProportion: 0.9 },
]

interface MafMenuSelf extends IAnyStateTreeNode {
  showAllLetters: boolean
  mismatchRendering: boolean
  showAsUpperCase: boolean
  showTree: boolean
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  showCoverage: boolean
  showAlignments: boolean
  showConservation: boolean
  conservationMode: ConservationMode
  showAnnotations: boolean
  showTranslation: boolean
  colorByChromosome: boolean
  showInversions: boolean
  annotationAdapterConfig: Record<string, unknown> | undefined
  rowIdentityMode: RowIdentityModeWithOff
  rowIdentityAutoZoom: boolean
  rowHeight: number
  subtreeFilter?: readonly string[]
  editableSources?: MafSource[]
  setRowHeight: (n: number) => void
  setFitToHeight: () => void
  setRowProportion: (n: number) => void
  setShowAllLetters: (f: boolean) => void
  setMismatchRendering: (f: boolean) => void
  setShowAsUpperCase: (f: boolean) => void
  setShowTree: (f: boolean) => void
  setShowBranchLength: (f: boolean) => void
  setShowCoverage: (f: boolean) => void
  setShowAlignments: (f: boolean) => void
  setShowConservation: (f: boolean) => void
  setConservationMode: (m: ConservationMode) => void
  setShowAnnotations: (f: boolean) => void
  setShowTranslation: (f: boolean) => void
  setColorByChromosome: (f: boolean) => void
  setShowInversions: (f: boolean) => void
  setRowIdentityMode: (m: RowIdentityModeWithOff) => void
  setRowIdentityAutoZoom: (f: boolean) => void
  setSubtreeFilter: (names?: string[]) => void
  // Consumed structurally by SetRowArrangementDialog's TreeLayoutModel<MafSource>
  // prop (model={self}), not directly in this file.
  setLayout: (s: MafSource[]) => void
  clearLayout: () => void
  willClearTree: (s: MafSource[]) => boolean
}

// The CDS-frame overlays only mean anything with a reading frame, so they
// appear only when an `annotationAdapter` (mafFrames) is configured.
function frameMenuItems(self: MafMenuSelf): MenuItem[] {
  return self.annotationAdapterConfig
    ? [
        toggle(
          'Show CDS frames',
          self.showAnnotations,
          self.setShowAnnotations,
        ),
        toggle(
          'Codon view (amino-acid changes)',
          self.showTranslation,
          self.setShowTranslation,
        ),
      ]
    : []
}

function showMenuItems(self: MafMenuSelf): MenuItem[] {
  return [
    toggle(
      'Show letters at all positions',
      self.showAllLetters,
      self.setShowAllLetters,
    ),
    toggle(
      'Show mismatches colored by base',
      self.mismatchRendering,
      self.setMismatchRendering,
    ),
    toggle(
      'Show letters as uppercase',
      self.showAsUpperCase,
      self.setShowAsUpperCase,
    ),
    toggle(
      'Show sidebar with tree and labels',
      self.showTree,
      self.setShowTree,
    ),
    treeBranchLengthMenuItem(self),
    toggle('Show coverage', self.showCoverage, self.setShowCoverage),
    toggle('Show alignments', self.showAlignments, self.setShowAlignments),
    toggle(
      'Show conservation (% identity)',
      self.showConservation,
      self.setShowConservation,
    ),
    // Per-codon (amino-acid) conservation needs a reading frame, so the
    // resolution radio only appears alongside the other frame-gated items.
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
    toggle(
      'Color by source chromosome',
      self.colorByChromosome,
      self.setColorByChromosome,
    ),
    toggle(
      'Show inversions (strand flips)',
      self.showInversions,
      self.setShowInversions,
    ),
    ...frameMenuItems(self),
    makeRadioSubMenu({
      label: 'Per-row identity',
      value: self.rowIdentityMode,
      onChange: m => {
        self.setRowIdentityMode(m)
      },
      options: ROW_IDENTITY_MODES,
      extraItems: [
        {
          ...checkboxItem(
            'Auto-switch by zoom',
            self.rowIdentityAutoZoom,
            () => {
              self.setRowIdentityAutoZoom(!self.rowIdentityAutoZoom)
            },
          ),
          disabled: self.rowIdentityMode === 'none',
        },
      ],
    }),
  ]
}

function rowHeightMenuItems(self: MafMenuSelf): MenuItem[] {
  const { rowHeight } = self
  return [
    {
      label: 'Squeeze to fit view',
      type: 'radio',
      checked: rowHeight === 0,
      onClick: () => {
        self.setFitToHeight()
      },
    },
    ...HEIGHT_PRESETS.map(preset => ({
      label: preset.label,
      type: 'radio' as const,
      checked: rowHeight === preset.rowHeight,
      onClick: () => {
        self.setRowHeight(preset.rowHeight)
        self.setRowProportion(preset.rowProportion)
      },
    })),
    {
      label: 'Custom...',
      type: 'radio',
      checked:
        rowHeight !== 0 && !HEIGHT_PRESETS.some(p => p.rowHeight === rowHeight),
      // a dialog opener, so it opts out of the checkbox/radio default
      keepMenuOpen: false,
      onClick: () => {
        getSession(self).queueDialog(handleClose => [
          SetRowHeightDialog,
          { model: self, handleClose },
        ])
      },
    },
  ]
}

export function buildMafTrackMenuItems(self: MafMenuSelf): MenuItem[] {
  return [
    {
      label: 'Row height',
      icon: HeightIcon,
      type: 'subMenu',
      subMenu: rowHeightMenuItems(self),
    },
    {
      label: 'Show...',
      icon: VisibilityIcon,
      type: 'subMenu',
      subMenu: showMenuItems(self),
    },
    {
      label: 'Edit row arrangement...',
      disabled: !self.editableSources?.length,
      onClick: () => {
        getSession(self).queueDialog(handleClose => [
          SetRowArrangementDialog,
          { model: self, handleClose },
        ])
      },
    },
    ...(self.subtreeFilter
      ? [
          {
            label: 'Clear subtree filter',
            onClick: () => {
              self.setSubtreeFilter(undefined)
            },
          },
        ]
      : []),
  ]
}
