import { lazy } from 'react'

import {
  makeRadioSubMenu,
  toggleItem,
  withHint,
} from '@jbrowse/core/ui/menuItems'
import { makeShowSubMenu } from '@jbrowse/core/ui/showSubMenu'
import { getDialogHost } from '@jbrowse/core/util'
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
import { DEFAULTS } from './displayDefaults.ts'
import { CODON_ROW_RENDERING, ROW_RENDERINGS } from './rowRenderings.ts'

import type { ConservationMode } from './conservationModes.ts'
import type { RowRendering } from './rowRenderings.ts'
import type { MafClusterSelf } from './runMafClustering.ts'
import type { MafSource } from './stateModel.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

const SetRowArrangementDialog = lazy(
  () => import('./components/SetRowArrangementDialog.tsx'),
)

const MafClusterDialog = lazy(() => import('./components/MafClusterDialog.tsx'))

// Compact row for the plain show/hide toggles, which are otherwise a dozen
// near-identical four-line literals. Reads the current value and hands the
// negation to the setter explicitly, so no event argument can reach it.
// A checkbox row keeps the menu open by its type — users flip several of these
// in one visit, and the menu is an observer, so the ticks move live.
// Both bands are computed from the per-base alignment, which the zoom-out
// summary tier does not read — so past the floor they collapse and the tick
// keeps reporting what the user chose. Said out loud, because otherwise the
// only feedback for ticking either one there is nothing happening.
export const ZOOM_IN_FOR_BAND = 'zoom in past the summary tier'

/**
 * The same override applied to a row whose ACTION the summary tier has taken
 * away rather than its setting: the row keeps its place and says why it cannot
 * act, instead of being enabled and silently doing nothing.
 */
export function zoomGatedItem(item: MenuItem, hint: string | undefined) {
  return hint ? { ...item, disabled: true, disabledHelpText: hint } : item
}

// Row-height presets for the shared "Row height" menu. Each pairs a height with
// the glyph proportion that reads best at it — maf is the one display that has
// a second axis here, and the shared builder writes both.
const HEIGHT_PRESETS = [
  { label: 'Normal', rowHeight: DEFAULTS.rowHeight, rowProportion: 0.8 },
  { label: 'Compact', rowHeight: 8, rowProportion: 0.9 },
]

interface MafMenuSelf extends IStateTreeNode, MafClusterSelf {
  showAllLetters: boolean
  mismatchRendering: boolean
  showAsUpperCase: boolean
  showTree: boolean
  clusterTree?: string
  showRowLabels: boolean
  setShowRowLabels: (arg: boolean) => void
  showBranchLength: boolean
  treeHasBranchLengths: boolean
  showCoverage: boolean
  showAlignments: boolean
  showConservation: boolean
  // Not settings and not settable — the three states in which a tick above is
  // correct and inert anyway. Read only to say so: the summary tier (both band
  // toggles), base-level zoom (the codon row coloring), and a frames read the
  // byte pre-flight declined (the CDS strip).
  showSummary: boolean
  zoomedToBaseLevel: boolean
  framesGateBlocked: boolean
  conservationMode: ConservationMode
  showAnnotations: boolean
  showInversions: boolean
  annotationAdapterConfig: Record<string, unknown> | undefined
  // The three slots behind "Row coloring" are read and written through this
  // pair, not individually — that is what keeps exactly one of them on.
  selectedRowRendering: RowRendering
  setRowRendering: (m: RowRendering) => void
  rowIdentityAutoZoom: boolean
  // Both halves of maf's row-height axis, declared so the shared
  // `rowHeightMenuItem` contract is checked here rather than only satisfied at
  // runtime: maf is the one display with a proportion, and it is what makes the
  // shared "Custom..." dialog grow its second field.
  rowHeight: number
  rowProportion: number
  subtreeFilter?: readonly string[]
  editableSources: MafSource[]
  sourcesKnown: boolean
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
  // The row order the arrangement dialog writes, and the reset that drops it
  // (`resetRowOrderMenuItems` gates on the first and calls the second).
  layout: readonly MafSource[]
  rowOrderIsCustom: boolean
  clearLayout: () => void
  // Consumed structurally by SetRowArrangementDialog's TreeLayoutModel<MafSource>
  // prop (model={self}), not directly in this file.
  setLayout: (s: MafSource[]) => void
  willClearTree: (s: MafSource[]) => boolean
}

// The CDS-frame overlays only mean anything with a reading frame, so they
// appear only when an `annotationAdapter` (mafFrames) is configured.
//
// The strip is the one thing here that can be on, and correctly on, and still
// draw nothing — the frames file is one record per CDS exon *per species*, so
// the RPC's own byte gate declines the read at wide spans on a deep alignment
// (`executeMafAnnotationData`). That failure is deliberately soft, which is
// exactly why it has to be said here: nothing else on screen changes.
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
 *
 * The codon option is the one whose tick can sit on a rendering that is not
 * painting: codons only exist at base level and not at all on the summary tier,
 * and `activeRowRendering` falls back to the bases at both without moving the
 * tick (deliberately — a radio that re-picks itself as you zoom reads as the
 * menu changing the setting behind your back). The two identity options have
 * carried an explanation of their own swap since they got one; this is the same
 * sentence for the option that never had it.
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
      // Codons need a reading frame, so the option appears only where a
      // mafFrames adapter can define one — same gate as the CDS-frame row.
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
      // Named for what it does, not for the mechanism. "Auto-switch by zoom"
      // said neither which two things swap nor which way round — so the only
      // thing the label had to carry (that zooming in gives you the letters
      // back) was the part it left out.
      toggleItem(
        'Show bases when zoomed in',
        self.rowIdentityAutoZoom,
        self.setRowIdentityAutoZoom,
        // The dependency stated rather than gated on: it qualifies the two
        // identity options above and is inert under the others.
        { helpText: 'for the identity plots above' },
      ),
    ],
  })
}

function showMenuItems(self: MafMenuSelf): MenuItem[] {
  return [
    toggleItem(
      'Show letters at all positions',
      self.showAllLetters,
      self.setShowAllLetters,
    ),
    toggleItem(
      'Show mismatches colored by base',
      self.mismatchRendering,
      self.setMismatchRendering,
    ),
    toggleItem(
      'Show letters as uppercase',
      self.showAsUpperCase,
      self.setShowAsUpperCase,
    ),
    ...treeSidebarShowMenuItems(self),
    showRowLabelsMenuItem(self),
    toggleItem(
      withHint(
        'Show coverage',
        self.showSummary ? ZOOM_IN_FOR_BAND : undefined,
      ),
      self.showCoverage,
      self.setShowCoverage,
    ),
    toggleItem('Show alignments', self.showAlignments, self.setShowAlignments),
    toggleItem(
      withHint(
        'Show conservation (% identity)',
        self.showSummary ? ZOOM_IN_FOR_BAND : undefined,
      ),
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
    // Top level rather than inside "Show...": it is the one choice that decides
    // what the rows look like, and the neighbouring wiggle displays surface
    // their equivalent ("Plot type") at the top level too.
    rowRenderingMenuItem(self),
    ...makeShowSubMenu(showMenuItems(self)),
    rowArrangementMenuItem({
      ready: !!self.editableSources.length,
      onOpen: () => {
        getDialogHost(self).queueDialog(handleClose => [
          SetRowArrangementDialog,
          { model: self, handleClose },
        ])
      },
    }),
    // maf used to have no "Clustering" submenu, on the grounds that its tree is
    // the adapter's guide phylogeny rather than a run, and it took the shared
    // subtree-filter item flat instead. There is a run now — per-bin identity to
    // the reference over the drawn rows — so the submenu is where it and the
    // "Clustered on <locus>" provenance belong, and the filter item moves inside
    // with them.
    clusteringMenuItem(
      self,
      {
        label: 'Cluster rows by identity...',
        // the count below is `sources`, the post-filter list, so one row there
        // is as often a clade focused down to a single species as a track still
        // loading — which is this display's own reason and is stated here
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
    // The way back from a drag-reorder in the arrangement dialog and from a
    // clustering run alike: both write `layout`, and `clearLayout` also restores
    // the guide tree the run replaced.
    ...resetRowOrderMenuItems(self),
  ]
}
