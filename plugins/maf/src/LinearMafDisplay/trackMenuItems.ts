import { lazy } from 'react'

import { checkboxItem } from '@jbrowse/core/ui/menuItems'
import { getSession } from '@jbrowse/core/util'
import {
  clearSubtreeFilterMenuItems,
  treeBranchLengthMenuItem,
} from '@jbrowse/tree-sidebar'
import { makeRadioSubMenu } from '@jbrowse/wiggle-core'
import HeightIcon from '@mui/icons-material/Height'
import PaletteIcon from '@mui/icons-material/Palette'
import VisibilityIcon from '@mui/icons-material/Visibility'

import { CONSERVATION_MODES } from './conservationModes.ts'
import { DEFAULTS } from './displayDefaults.ts'
import { CODON_ROW_RENDERING, ROW_RENDERINGS } from './rowRenderings.ts'

import type { ConservationMode } from './conservationModes.ts'
import type { RowRendering } from './rowRenderings.ts'
import type { MafSource } from './stateModel.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetRowHeightDialog = lazy(
  () => import('./components/SetRowHeightDialog/SetRowHeightDialog.tsx'),
)
const SetRowArrangementDialog = lazy(
  () => import('./components/SetRowArrangementDialog.tsx'),
)

// Compact row for the plain show/hide toggles, which are otherwise a dozen
// near-identical four-line literals. Reads the current value and hands the
// negation to the setter explicitly, so no event argument can reach it.
// A checkbox row keeps the menu open by its type — users flip several of these
// in one visit, and the menu is an observer, so the ticks move live.
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

interface MafMenuSelf extends IStateTreeNode {
  showAllLetters: boolean
  mismatchRendering: boolean
  showAsUpperCase: boolean
  showTree: boolean
  showRowLabels: boolean
  setShowRowLabels: (arg: boolean) => void
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  showCoverage: boolean
  showAlignments: boolean
  showConservation: boolean
  conservationMode: ConservationMode
  showAnnotations: boolean
  showInversions: boolean
  annotationAdapterConfig: Record<string, unknown> | undefined
  // The three slots behind "Row coloring" are read and written through this
  // pair, not individually — that is what keeps exactly one of them on.
  selectedRowRendering: RowRendering
  setRowRendering: (m: RowRendering) => void
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
  setShowInversions: (f: boolean) => void
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
    ? [toggle('Show CDS frames', self.showAnnotations, self.setShowAnnotations)]
    : []
}

/**
 * The one thing the per-sample rows are colored by.
 *
 * These are alternatives — `activeRowRendering` paints exactly one and resolves
 * a clash by precedence — but they used to be three separate controls sitting
 * among the visibility toggles: a "Color by source chromosome" checkbox, a
 * "Codon view" checkbox, and a "Per-row identity" radio. Nothing said they
 * competed, so checking one while another was on left a setting that was on,
 * persisted, and painting nothing. One radio, in the shape wiggle's "Plot type"
 * already uses for the same problem, makes the exclusivity the menu's rather
 * than something the user has to know.
 *
 * `Show bases when zoomed in` rides along because it qualifies the two identity
 * options and nothing else.
 */
function rowRenderingMenuItem(self: MafMenuSelf): MenuItem {
  return makeRadioSubMenu({
    label: 'Row coloring',
    icon: PaletteIcon,
    value: self.selectedRowRendering,
    onChange: m => {
      self.setRowRendering(m)
    },
    options: [
      ...ROW_RENDERINGS,
      // Codons need a reading frame, so the option appears only where a
      // mafFrames adapter can define one — same gate as the CDS-frame row.
      ...(self.annotationAdapterConfig ? [CODON_ROW_RENDERING] : []),
    ],
    extraItems: [
      // Named for what it does, not for the mechanism. "Auto-switch by zoom"
      // said neither which two things swap nor which way round — so the only
      // thing the label had to carry (that zooming in gives you the letters
      // back) was the part it left out.
      checkboxItem(
        'Show bases when zoomed in',
        self.rowIdentityAutoZoom,
        () => {
          self.setRowIdentityAutoZoom(!self.rowIdentityAutoZoom)
        },
        // The dependency stated rather than gated on: it qualifies the two
        // identity options above and is inert under the others.
        { subLabel: 'for the identity plots above' },
      ),
    ],
  })
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
    // Separate from the sidebar toggle above so the tree can be kept without
    // the names, which are an overlay on the alignment and cover the left of
    // the rows they name. Only reachable while the sidebar is on, since that is
    // what reserves their gutter.
    ...(self.showTree
      ? [toggle('Show row labels', self.showRowLabels, self.setShowRowLabels)]
      : []),
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
    // An overlay drawn on top of whatever the rows are colored by, not one of
    // the alternatives in "Row coloring" — so it stays a plain toggle here.
    toggle(
      'Show inversions (strand flips)',
      self.showInversions,
      self.setShowInversions,
    ),
    ...frameMenuItems(self),
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
    // Top level rather than inside "Show...": it is the one choice that decides
    // what the rows look like, and the neighbouring wiggle displays surface
    // their equivalent ("Plot type") at the top level too.
    rowRenderingMenuItem(self),
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
    // maf has no "Clustering" submenu to file this under (its tree is the
    // adapter's guide tree, not a run), so it takes the shared item directly.
    ...clearSubtreeFilterMenuItems(self),
  ]
}
