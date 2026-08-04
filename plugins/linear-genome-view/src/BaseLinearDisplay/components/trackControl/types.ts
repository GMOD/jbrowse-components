import type { ComponentType } from 'react'

// The one shape every ambient bottom-right track control has: a small thing in
// the corner of a display that says what state the track is in, and usually
// opens a short list of ways to change it. Track sizing, isoform collapse and
// the show-only badge were three components with three copies of the same
// bordered-button styling before this existed.
//
// This module is types only, so it pulls no runtime dependency. That is the
// point: it lets a display describe its controls without naming a UI toolkit,
// so the same description can be drawn by `MuiTrackControl` (what JBrowse ships)
// or by `plainTrackControl` (no toolkit at all) — the same split
// `chromeOverlays.ts` makes for the status states, for the same reason.

/**
 * Icons are *named* rather than passed in as elements, which is the whole
 * mechanism: an element would have to come from somewhere, and every call site
 * would end up importing `@mui/icons-material` whatever the renderer was. A name
 * lets each implementation draw it its own way.
 *
 * A closed set on purpose — a display wanting a new one adds it here and to both
 * implementations, which is the moment to check the plain set still has an
 * answer.
 */
export type TrackControlIcon = 'height' | 'isoform' | 'filter'

/** One row of the control's menu. Rendered as a radio group. */
export interface TrackControlOption {
  label: string
  selected: boolean
  onSelect: () => void
}

export interface TrackControlProps {
  icon: TrackControlIcon
  /**
   * Always required: it is the only place the control explains itself, and
   * these controls are deliberately small and wordless.
   */
  tooltip: string
  /**
   * Present: a text chip, for a state the user should notice without looking
   * (the isoform notice, the show-only count). Absent: a quiet icon button, for
   * a control that is always there and should not shout.
   */
  label?: string
  /** Pressing opens these as a radio list. Mutually exclusive with `onClick`. */
  options?: TrackControlOption[]
  /** Pressing does this. Mutually exclusive with `options`. */
  onClick?: () => void
  /** Adds a (×). What it means is the caller's business — dismiss, clear, undo. */
  onDelete?: () => void
  /**
   * Something is wrong and a tooltip nobody opens is not a disclosure — today
   * this is features the layout dropped outright. Renders in an alert tone
   * rather than the quiet default.
   */
  warning?: boolean
}

export type TrackControlComponent = ComponentType<TrackControlProps>
