import type { JBrowseStyleTheme } from './styleTheme.ts'

const LANE_WIDTH = 12
const THUMB_INSET = 3

/**
 * Makes a scroll container's native scrollbar always visible.
 *
 * macOS (and iOS, and Android) browsers default to *overlay* scrollbars: zero
 * layout width, drawn only while a scroll is in flight, faded out a moment
 * later. A stack of views taller than the window then offers nothing to grab
 * and no hint that it scrolls at all. `scrollbar-gutter` cannot fix that — it
 * is defined to have no effect on overlay scrollbars — but giving
 * `::-webkit-scrollbar` an explicit width does: Chromium and Safari switch that
 * container to a classic, always-drawn, space-occupying scrollbar.
 *
 * Deliberately no `scrollbar-gutter: stable`, which would work once the lane is
 * classic: it reserves the lane whether or not anything overflows, so a
 * container showing one short view would pay 12px for a scrollbar it never
 * draws. The lane appearing is the signal, so it has to mean something — which
 * puts the burden on the container to overflow only when it has content to
 * scroll to, rather than by trailing space it renders for its own reasons.
 *
 * Deliberately no `scrollbar-width`/`scrollbar-color`: in Chromium the standard
 * properties win over the `::-webkit-` pseudo-elements and put the overlay
 * behavior back. Firefox on macOS ignores both approaches and follows the OS
 * "Show scroll bars" setting; there is no CSS that overrides it.
 *
 * Thumb geometry matches {@link VerticalScrollbar}, the scrollbar the
 * canvas-backed displays draw for themselves, so the two read as one control.
 */
export const persistentScrollbarStyle = (theme: JBrowseStyleTheme) =>
  ({
    '&::-webkit-scrollbar': {
      width: LANE_WIDTH,
      height: LANE_WIDTH,
    },
    '&::-webkit-scrollbar-track': {
      background: 'transparent',
    },
    '&::-webkit-scrollbar-thumb': {
      background: theme.palette.action.disabled,
      borderRadius: LANE_WIDTH / 2,
      // paints the thumb inside a transparent border so the lane keeps its
      // full hit area while the visible thumb stays the same 6px the
      // in-display scrollbar uses
      border: `${THUMB_INSET}px solid transparent`,
      backgroundClip: 'content-box',
    },
    '&::-webkit-scrollbar-thumb:hover': {
      background: theme.palette.action.active,
      backgroundClip: 'content-box',
    },
    '&::-webkit-scrollbar-corner': {
      background: 'transparent',
    },
  }) as const
