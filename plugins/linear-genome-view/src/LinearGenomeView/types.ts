import type { LinearGenomeViewStateModel } from './model.ts'
import type { HighlightType } from '@jbrowse/core/util/highlights'
import type { TrackInit } from '@jbrowse/core/util/tracks'
import type { SnapshotIn } from '@jbrowse/mobx-state-tree'

export interface BpOffset {
  refName?: string
  index: number
  offset: number
  start?: number
  end?: number
  coord?: number
  reversed?: boolean
  assemblyName?: string
  oob?: boolean
}
export type {
  ExportSvgOptions,
  TrackLabelMode,
} from '@jbrowse/display-kit/types'

// canonical definition lives in core so the shared HighlightsMixin and dotplot
// can reference it without depending on this plugin
export type { HighlightType }

export interface NavLocation {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

export interface VolatileGuide {
  xPos: number
}

// The LGV launch keys: the settings that need on-attach resolution or
// conversion and have no direct MST representation — `loc` (→ the viewport once
// the assembly loads), `tracks` (→ showTrack), `highlight` (→ coercion). They
// are written directly on the view like any other setting;
// `preProcessSnapshot` moves them into `launch`, and the autorun discards them
// once applied. A plain persisted prop needs nothing here: declaring it on the
// model is what makes it settable. Adding a key here means an entry in
// `lgvLaunchKeys` — the Record makes an unregistered one a compile error — and
// a case in afterAttach's applyInit.
// #region initState
export interface InitState {
  /**
   * A locstring, or several separated by spaces to open a discontinuous view:
   * `'chr3:25,325,000-25,361,000 chr10:58,716,500-58,718,500'`. Multiple
   * regions are the only declarative way to frame something spread across loci
   * (a derivative allele against its sources, a gene's partners in a fusion) --
   * `displayedRegionNames` takes whole chromosomes, not intervals.
   */
  loc?: string
  // fractional zoom-out applied around `loc` for context (passed to
  // navToLocString's `grow`), e.g. 0.2 pads a region by 20% on each side.
  // Ignored without `loc`.
  grow?: number
  assembly: string
  // restrict a whole-genome view to these assembly refNames (whole
  // chromosomes), in the order given — e.g. the main chromosomes without the
  // unplaced/alt contigs. Names resolve through the assembly's aliases. Ignored
  // when `loc` is set (which navigates to a single region instead).
  displayedRegionNames?: string[]
  tracks?: TrackInit[]
  tracklist?: boolean
  nav?: boolean
  // a string entry is a locstring or a JSON-encoded HighlightType (the URL
  // wire-format); programmatic callers (createViewState/session JSON) can pass
  // a HighlightType object directly
  highlight?: (string | HighlightType)[]
}

// Plain persisted view props a launch spec may set beside the launch keys.
// Unlike InitState these need no resolution — they stay on the view snapshot,
// where MST restores and validates them natively.
//
// EVERY declared property of the view, derived, minus the init keys (which mean
// something else here: `tracks` is trackIds to open, not built track models)
// and the view's identity. Nothing is listed, so a property is settable from a
// spec — and type-checked — from the line that declares it.
//
// It used to be a hand-written eight, and the model has grown past it:
// `hideHeader`, `hideHeaderOverview`, `hideNoTracksActive`, `labelsVisible`,
// `scalebarOnly`, `showCytobands`, `showGridlines` and `showTrackOutlines` were
// all declared, all settable from the menu, and all dropped in silence by a
// spec that named them — which is most of what a figure or an embed wants to
// say. The partition reads the same set off the model at wrap time.
export type LinearGenomeViewLaunchProps = Partial<
  Omit<
    SnapshotIn<LinearGenomeViewStateModel>,
    keyof InitState | 'id' | 'type' | 'launch'
  >
>
// #endregion
